/**
 * Durable payment finalization for session bookings.
 *
 * Provider charges/refunds are NEVER performed inside a database transaction:
 * transactions only move bookings through durable payment states
 * (`charge_pending`, `charged`, `refund_pending`, `refunded`). The provider
 * side effect happens after commit — with an idempotency key — and the result
 * is persisted in a follow-up write. A scheduled reconciliation pass retries
 * anything left pending (crash between provider call and DB write, provider
 * failure, etc.), so no state is unrecoverable.
 */
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  db,
  invoicesTable,
  liveSessionsTable,
  sessionBookingsTable,
  sessionPackagesTable,
  type LiveSession,
  type SessionBooking,
} from "@workspace/db";
import { activeProvider } from "./payments";
import { logger } from "./logger";
import { queueNotification, formatRiyadh } from "./sessionNotifications";

/**
 * Finalize a `charge_pending` booking: charge the provider (idempotent per
 * booking), persist reference + invoice on success. On a declined charge the
 * seat is released under the session lock and the next waitlisted user is
 * promoted. Returns true when the booking ended up charged.
 */
export async function finalizeBookingCharge(
  bookingId: number,
): Promise<boolean> {
  const [booking] = await db
    .select()
    .from(sessionBookingsTable)
    .where(eq(sessionBookingsTable.id, bookingId));
  if (!booking) return false;
  if (booking.paymentState !== "charge_pending") {
    return booking.paymentState === "charged";
  }
  const [session] = await db
    .select()
    .from(liveSessionsTable)
    .where(eq(liveSessionsTable.id, booking.sessionId));
  if (!session) return false;

  // Idempotent per booking: a retry (reconciliation, crash recovery) returns
  // the same charge instead of double-charging.
  let charge: Awaited<ReturnType<typeof activeProvider.chargeOneTime>> | null =
    null;
  try {
    charge = await activeProvider.chargeOneTime({
      userId: booking.userId,
      amountSar: session.priceSar ?? 0,
      description: `حجز جلسة «${session.title}»`,
      idempotencyKey: `booking-${booking.id}`,
    });
  } catch (err) {
    logger.error({ err, bookingId }, "provider charge errored");
  }

  if (charge && charge.status === "paid") {
    // Settle conditionally under the session lock — cancellation-aware. If
    // the booking or session was cancelled while the provider call was in
    // flight, the successful charge transitions to refund_pending instead of
    // granting entitlement.
    const settled = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(liveSessionsTable)
        .where(eq(liveSessionsTable.id, session.id))
        .for("update");
      const [current] = await tx
        .select()
        .from(sessionBookingsTable)
        .where(eq(sessionBookingsTable.id, booking.id));
      if (!current || current.paymentState !== "charge_pending") {
        return { outcome: "noop" as const };
      }
      let stillActive =
        current.status === "booked" &&
        locked !== undefined &&
        locked.status !== "cancelled";
      if (stillActive && locked) {
        // Defensive capacity recheck at the moment a seat becomes fully
        // settled: if active bookings somehow exceed capacity, the losing
        // charge is compensated deterministically via the refund path
        // instead of overfilling the session.
        const active = await tx
          .select({ id: sessionBookingsTable.id })
          .from(sessionBookingsTable)
          .where(
            and(
              eq(sessionBookingsTable.sessionId, locked.id),
              inArray(sessionBookingsTable.status, ["booked", "attended"]),
            ),
          );
        if (active.length > locked.capacity) stillActive = false;
      }
      // Conditional claim: only the caller that flips charge_pending forward
      // records the paid ledger entry — concurrent settlers (request +
      // reconciliation) receive the same idempotent charge but must not
      // double-insert invoices.
      // When compensating (refund path) a booking that still holds a seat,
      // release the seat atomically in the same transaction so the user
      // keeps no join access while the refund is in flight and the freed
      // seat is promoted immediately.
      const mustRelease = !stillActive && current.status === "booked";
      const claimed = await tx
        .update(sessionBookingsTable)
        .set({
          paymentState: stillActive ? "charged" : "refund_pending",
          paymentReference: charge.reference,
          ...(mustRelease
            ? { status: "cancelled" as const, cancelledAt: new Date() }
            : {}),
        })
        .where(
          and(
            eq(sessionBookingsTable.id, booking.id),
            eq(sessionBookingsTable.paymentState, "charge_pending"),
          ),
        )
        .returning();
      if (claimed.length === 0) return { outcome: "noop" as const };
      await tx.insert(invoicesTable).values({
        userId: booking.userId,
        amountSar: charge.amountSar,
        status: "paid",
        description: `حجز جلسة «${session.title}» — ${formatRiyadh(session.startsAt)} (${activeProvider.name}:${charge.reference})`,
      });
      let promoted: PromotionResult[] = [];
      if (mustRelease && locked && locked.status !== "cancelled") {
        promoted = await promoteFromWaitlistTx(tx, locked);
      }
      return {
        outcome: stillActive ? ("charged" as const) : ("refund" as const),
        promoted,
      };
    });
    if (settled.outcome === "noop") return false;
    if (settled.outcome === "refund") {
      await settlePromotions(session, settled.promoted ?? []);
      await processBookingRefund(booking.id);
      return false;
    }
    return true;
  }

  // Charge declined/errored → release the seat under the session lock (also
  // cancellation-aware: an already-cancelled booking just clears the state).
  const promoted = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(liveSessionsTable)
      .where(eq(liveSessionsTable.id, session.id))
      .for("update");
    const [current] = await tx
      .select()
      .from(sessionBookingsTable)
      .where(eq(sessionBookingsTable.id, booking.id));
    if (!locked || !current || current.paymentState !== "charge_pending") {
      return [] as PromotionResult[];
    }
    if (current.status !== "booked") {
      // Cancelled while pending and provider says no charge exists → nothing
      // was ever captured; clear the pending state AND backfill any seat that
      // is free under the lock (the cancellation path may have skipped
      // promotion while this charge was unsettled).
      await tx
        .update(sessionBookingsTable)
        .set({ paymentState: "none" })
        .where(eq(sessionBookingsTable.id, booking.id));
      return promoteFromWaitlistTx(tx, locked);
    }
    await tx
      .update(sessionBookingsTable)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        paymentState: "none",
      })
      .where(eq(sessionBookingsTable.id, booking.id));
    return promoteFromWaitlistTx(tx, locked);
  });
  await settlePromotions(session, promoted);
  return false;
}

/**
 * Process a `refund_pending` booking: provider refund by persisted reference,
 * then refund invoice + `refunded` state. Failures leave the state untouched
 * for the reconciliation pass.
 */
export async function processBookingRefund(
  bookingId: number,
): Promise<boolean> {
  const [booking] = await db
    .select()
    .from(sessionBookingsTable)
    .where(eq(sessionBookingsTable.id, bookingId));
  if (!booking || booking.paymentState !== "refund_pending") {
    return booking?.paymentState === "refunded";
  }
  if (!booking.paymentReference) {
    logger.error({ bookingId }, "refund_pending booking without reference");
    return false;
  }
  const [session] = await db
    .select()
    .from(liveSessionsTable)
    .where(eq(liveSessionsTable.id, booking.sessionId));
  try {
    // Idempotent per booking: concurrent/retried calls map to the same
    // provider-side refund.
    const refund = await activeProvider.refundOneTime({
      userId: booking.userId,
      amountSar: session?.priceSar ?? 0,
      reference: booking.paymentReference,
      idempotencyKey: `refund-booking-${booking.id}`,
    });
    if (refund.status !== "refunded") return false;
    // Conditional claim + ledger insert in ONE transaction: only the caller
    // that flips refund_pending → refunded records the ledger entry, so
    // concurrent settlers cannot insert duplicate refund invoices, and a
    // crash between claim and insert rolls both back together.
    await db.transaction(async (tx) => {
      const claimed = await tx
        .update(sessionBookingsTable)
        .set({ paymentState: "refunded", refundReference: refund.reference })
        .where(
          and(
            eq(sessionBookingsTable.id, booking.id),
            eq(sessionBookingsTable.paymentState, "refund_pending"),
          ),
        )
        .returning();
      if (claimed.length === 0) return; // another settler won the claim
      await tx.insert(invoicesTable).values({
        userId: booking.userId,
        amountSar: -(session?.priceSar ?? 0),
        status: "refunded",
        description: `استرداد حجز جلسة «${session?.title ?? ""}» (${activeProvider.name}:${refund.reference})`,
      });
    });
    return true;
  } catch (err) {
    logger.error({ err, bookingId }, "provider refund errored");
    return false;
  }
}

export interface PromotionResult {
  bookingId: number;
  userId: number;
  /** true when a provider charge must be finalized after commit */
  needsCharge: boolean;
}

/**
 * Promote waitlisted bookings (oldest first) into free seats. DB-only side
 * effects: package credits are consumed in-transaction; `single` promotions
 * are marked `charge_pending` and finalized after commit. Must run inside a
 * transaction holding the session row lock.
 */
export async function promoteFromWaitlistTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  session: LiveSession,
): Promise<PromotionResult[]> {
  const promoted: PromotionResult[] = [];
  const active = await tx
    .select({ id: sessionBookingsTable.id })
    .from(sessionBookingsTable)
    .where(
      and(
        eq(sessionBookingsTable.sessionId, session.id),
        inArray(sessionBookingsTable.status, ["booked", "attended"]),
      ),
    );
  let seatsLeft = session.capacity - active.length;
  if (seatsLeft <= 0) return promoted;
  const candidates = await tx
    .select()
    .from(sessionBookingsTable)
    .where(
      and(
        eq(sessionBookingsTable.sessionId, session.id),
        eq(sessionBookingsTable.status, "waitlisted"),
      ),
    )
    .orderBy(asc(sessionBookingsTable.createdAt));
  for (const next of candidates) {
    if (seatsLeft <= 0) break;
    if (next.paymentMethod === "package") {
      const pkgId = await consumePackageCreditTx(tx, next.userId);
      if (pkgId === null) continue; // credits gone — keep waitlisted, try next
      await tx
        .update(sessionBookingsTable)
        .set({ status: "booked", packageId: pkgId })
        .where(eq(sessionBookingsTable.id, next.id));
      promoted.push({ bookingId: next.id, userId: next.userId, needsCharge: false });
    } else if (next.paymentMethod === "single") {
      await tx
        .update(sessionBookingsTable)
        .set({ status: "booked", paymentState: "charge_pending" })
        .where(eq(sessionBookingsTable.id, next.id));
      promoted.push({ bookingId: next.id, userId: next.userId, needsCharge: true });
    } else {
      await tx
        .update(sessionBookingsTable)
        .set({ status: "booked" })
        .where(eq(sessionBookingsTable.id, next.id));
      promoted.push({ bookingId: next.id, userId: next.userId, needsCharge: false });
    }
    seatsLeft--;
  }
  return promoted;
}

/**
 * Race-safe conditional package-credit decrement (oldest charged package
 * first). Returns the consumed package's id, or null when no credit exists.
 */
export async function consumePackageCreditTx(
  dbc: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: number,
): Promise<number | null> {
  // Retry with a fresh re-query: under Read Committed a concurrent
  // refund/consumption can invalidate a candidate's compare-and-set, so a
  // failed CAS must never be reported as "no credit" without re-checking.
  for (let attempt = 0; attempt < 5; attempt++) {
    const packages = await dbc
      .select()
      .from(sessionPackagesTable)
      .where(
        and(
          eq(sessionPackagesTable.userId, userId),
          // Only verified-paid packages grant credits.
          eq(sessionPackagesTable.paymentState, "charged"),
          gte(sessionPackagesTable.remainingCredits, 1),
        ),
      )
      .orderBy(asc(sessionPackagesTable.createdAt));
    if (packages.length === 0) return null; // genuinely no credit left
    for (const pkg of packages) {
      const updated = await dbc
        .update(sessionPackagesTable)
        .set({
          remainingCredits: sql`${sessionPackagesTable.remainingCredits} - 1`,
        })
        .where(
          and(
            eq(sessionPackagesTable.id, pkg.id),
            eq(sessionPackagesTable.paymentState, "charged"),
            gte(sessionPackagesTable.remainingCredits, 1),
          ),
        )
        .returning();
      if (updated.length > 0) return pkg.id;
    }
  }
  return null;
}

/**
 * After-commit settlement of waitlist promotions: finalize provider charges
 * and notify successfully promoted users.
 */
export async function settlePromotions(
  session: LiveSession,
  promoted: PromotionResult[],
): Promise<void> {
  for (const p of promoted) {
    const ok = p.needsCharge ? await finalizeBookingCharge(p.bookingId) : true;
    if (ok) {
      await queueNotification({
        userId: p.userId,
        sessionId: session.id,
        type: "waitlist_promoted",
        message: `تمت ترقيتك من قائمة الانتظار: حُجز لك مقعد في جلسة «${session.title}» — ${formatRiyadh(session.startsAt)}.`,
      });
    }
  }
}

/**
 * Finalize a `charge_pending` package purchase: idempotent provider charge,
 * then mark `charged` + invoice, or `failed` on decline. Credits become
 * usable only after this succeeds.
 */
export async function finalizePackageCharge(
  packageId: number,
): Promise<boolean> {
  const [pkg] = await db
    .select()
    .from(sessionPackagesTable)
    .where(eq(sessionPackagesTable.id, packageId));
  if (!pkg) return false;
  if (pkg.paymentState !== "charge_pending") {
    return pkg.paymentState === "charged";
  }
  let charge: Awaited<ReturnType<typeof activeProvider.chargeOneTime>> | null =
    null;
  try {
    charge = await activeProvider.chargeOneTime({
      userId: pkg.userId,
      amountSar: pkg.priceSar,
      description: `شراء باقة جلسات (${pkg.totalCredits} جلسات)`,
      idempotencyKey: `package-${pkg.id}`,
    });
  } catch (err) {
    logger.error({ err, packageId }, "provider package charge errored");
    return false; // stays charge_pending — reconciliation retries
  }
  if (charge.status === "paid") {
    // Conditional claim + ledger insert in ONE transaction: only the settler
    // that flips charge_pending → charged records the invoice; concurrent
    // callers (request + reconciliation) get the same idempotent charge but
    // never a duplicate ledger entry.
    const won = await db.transaction(async (tx) => {
      const updated = await tx
        .update(sessionPackagesTable)
        .set({ paymentState: "charged", paymentReference: charge.reference })
        .where(
          and(
            eq(sessionPackagesTable.id, pkg.id),
            eq(sessionPackagesTable.paymentState, "charge_pending"),
          ),
        )
        .returning();
      if (updated.length === 0) return false;
      await tx.insert(invoicesTable).values({
        userId: pkg.userId,
        amountSar: charge.amountSar,
        status: "paid",
        description: `باقة جلسات (${pkg.totalCredits} جلسات) — ${activeProvider.name}:${charge.reference}`,
      });
      return true;
    });
    void won; // claim outcome only affects who wrote the ledger entry
    // Either this call or a concurrent settler completed the charge.
    return true;
  }
  await db
    .update(sessionPackagesTable)
    .set({ paymentState: "failed" })
    .where(
      and(
        eq(sessionPackagesTable.id, pkg.id),
        eq(sessionPackagesTable.paymentState, "charge_pending"),
      ),
    );
  return false;
}

const PENDING_RETRY_AGE_MS = 2 * 60_000;

/**
 * Reconciliation pass (run from the scheduled job): retries pending refunds
 * and finalizes stale pending charges left behind by crashes or provider
 * failures.
 */
export async function reconcilePayments(): Promise<void> {
  const cutoff = new Date(Date.now() - PENDING_RETRY_AGE_MS);
  const pending = await db
    .select()
    .from(sessionBookingsTable)
    .where(
      inArray(sessionBookingsTable.paymentState, [
        "refund_pending",
        "charge_pending",
      ]),
    );
  for (const b of pending as SessionBooking[]) {
    if (b.paymentState === "refund_pending") {
      await processBookingRefund(b.id);
    } else if (b.createdAt <= cutoff) {
      await finalizeBookingCharge(b.id);
    }
  }
  const pendingPackages = await db
    .select()
    .from(sessionPackagesTable)
    .where(
      and(
        eq(sessionPackagesTable.paymentState, "charge_pending"),
        lte(sessionPackagesTable.createdAt, cutoff),
      ),
    );
  for (const pkg of pendingPackages) {
    await finalizePackageCharge(pkg.id);
  }
}
