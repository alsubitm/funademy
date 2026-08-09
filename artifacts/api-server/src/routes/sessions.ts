/**
 * Online live-sessions platform (Funademy): scheduling, booking with
 * capacity + waitlist, entitlements (free / subscription / package credits /
 * single purchase), join-link gating, attendance, materials, notifications.
 */
import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  childrenTable,
  subscriptionsTable,
  invoicesTable,
  sessionSeriesTable,
  liveSessionsTable,
  sessionBookingsTable,
  sessionAttendanceTable,
  sessionMaterialsTable,
  sessionPackagesTable,
  sessionNotificationsTable,
  type LiveSession,
  type User,
} from "@workspace/db";
import {
  CreateSessionSeriesBody,
  CreateLiveSessionBody,
  UpdateLiveSessionBody,
  BookSessionBody,
  MarkSessionAttendanceBody,
  AddSessionMaterialBody,
  PurchaseSessionPackageBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";
import { activeProvider } from "../lib/payments";
import { queueNotification, formatRiyadh } from "../lib/sessionNotifications";
import {
  consumePackageCreditTx,
  promoteFromWaitlistTx,
  settlePromotions,
  finalizeBookingCharge,
  finalizePackageCharge,
  processBookingRefund,
  type PromotionResult,
} from "../lib/sessionPayments";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbLike = typeof db | Tx;

const router: IRouter = Router();

/** Cancellations allowed until this long before start. */
const CANCEL_CUTOFF_MS = 2 * 3600_000;
/** Join link revealed this long before start. */
const JOIN_REVEAL_MS = 15 * 60_000;
const PACKAGE_PRICE_PER_CREDIT_SAR = 40;

function intParam(raw: unknown): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(String(v), 10);
}

function isStaff(user: User): boolean {
  return user.role === "teacher" || user.role === "admin";
}

function canManage(user: User, session: LiveSession): boolean {
  return user.role === "admin" || session.teacherId === user.id;
}

/**
 * Resolve the teacher a session/series is assigned to. Admins may assign any
 * existing staff (teacher/admin) account; assigning a non-staff account would
 * hand that user full session ownership (links, participant data, attendance).
 * Returns null when the requested assignee is invalid.
 */
async function resolveStaffAssignee(
  user: User,
  requestedTeacherId: number | undefined,
): Promise<number | null> {
  if (user.role !== "admin" || !requestedTeacherId) return user.id;
  const [assignee] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, requestedTeacherId));
  if (!assignee || !isStaff(assignee as User)) return null;
  return assignee.id;
}

function serializeSession(s: LiveSession, bookedCount: number) {
  return {
    id: s.id,
    seriesId: s.seriesId,
    teacherId: s.teacherId,
    title: s.title,
    description: s.description,
    program: s.program,
    startsAt: s.startsAt.toISOString(),
    startsAtRiyadh: formatRiyadh(s.startsAt),
    durationMinutes: s.durationMinutes,
    capacity: s.capacity,
    priceSar: s.priceSar,
    includedInSubscription: s.includedInSubscription,
    status: s.status,
    bookedCount,
    seatsLeft: Math.max(0, s.capacity - bookedCount),
  };
}

async function bookedCountFor(
  sessionId: number,
  dbc: DbLike = db,
): Promise<number> {
  const rows = await dbc
    .select({ id: sessionBookingsTable.id })
    .from(sessionBookingsTable)
    .where(
      and(
        eq(sessionBookingsTable.sessionId, sessionId),
        inArray(sessionBookingsTable.status, ["booked", "attended"]),
      ),
    );
  return rows.length;
}

async function loadSession(id: number): Promise<LiveSession | null> {
  const [s] = await db
    .select()
    .from(liveSessionsTable)
    .where(eq(liveSessionsTable.id, id));
  return s ?? null;
}

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------

type PaymentMethod = "free" | "subscription" | "package" | "single";

/**
 * A booking grants paid-session access only once its payment is settled:
 * single purchases must be `charged` — a pending or failed charge never
 * unlocks the join link, materials, or attendance.
 */
function hasSettledPayment(booking: {
  paymentMethod: string;
  paymentState: string;
}): boolean {
  return (
    booking.paymentMethod !== "single" || booking.paymentState === "charged"
  );
}

/**
 * Expiry-aware subscription check: status must be current AND the relevant
 * end date (trial end for trials, period end for active) must not have
 * passed. An expired subscription grants no session entitlement.
 */
function isSubscriptionCurrent(sub: {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}): boolean {
  const now = Date.now();
  if (sub.status === "trial") {
    return sub.trialEndsAt !== null && sub.trialEndsAt.getTime() > now;
  }
  if (sub.status === "active") {
    return (
      sub.currentPeriodEnd === null || sub.currentPeriodEnd.getTime() > now
    );
  }
  return false;
}

/**
 * Determine how a user is entitled to attend a paid session.
 * Order: free → active subscription (if included) → package credits →
 * explicit single purchase. Returns null when not entitled.
 */
async function resolveEntitlement(
  userId: number,
  session: LiveSession,
  requested: PaymentMethod | undefined,
): Promise<PaymentMethod | null> {
  if (!session.priceSar || session.priceSar <= 0) return "free";
  if (session.includedInSubscription && requested !== "single" && requested !== "package") {
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId));
    if (sub && isSubscriptionCurrent(sub)) return "subscription";
  }
  if (requested === "package" || requested === undefined) {
    const [pkg] = await db
      .select()
      .from(sessionPackagesTable)
      .where(
        and(
          eq(sessionPackagesTable.userId, userId),
          gte(sessionPackagesTable.remainingCredits, 1),
          eq(sessionPackagesTable.paymentState, "charged"),
        ),
      )
      .orderBy(asc(sessionPackagesTable.createdAt));
    if (pkg) return "package";
    if (requested === "package") return null;
  }
  // A paid single purchase must be requested explicitly — never charged by default.
  if (requested === "single") return "single";
  return null;
}

/**
 * DB-only refund of a package credit (oldest package first). Safe inside a
 * transaction — no provider side effects.
 */
async function refundPackageCredit(
  dbc: DbLike,
  packageId: number | null,
): Promise<void> {
  if (packageId === null) return;
  // Atomic increment on exactly the (charged) package the booking consumed
  // from — concurrent cancellations across different sessions must never
  // lose a credit to a read-then-write race.
  await dbc
    .update(sessionPackagesTable)
    .set({
      remainingCredits: sql`${sessionPackagesTable.remainingCredits} + 1`,
    })
    .where(
      and(
        eq(sessionPackagesTable.id, packageId),
        eq(sessionPackagesTable.paymentState, "charged"),
      ),
    );
}

/**
 * Cancel a booking's payment side inside a transaction (durable state only —
 * provider refunds happen after commit via processBookingRefund).
 * Returns true when a provider refund must be processed after commit.
 */
async function markBookingCancelledTx(
  tx: Tx,
  booking: {
    id: number;
    userId: number;
    paymentMethod: string;
    paymentState: string;
    packageId: number | null;
  },
): Promise<boolean> {
  const needsRefund =
    booking.paymentMethod === "single" && booking.paymentState === "charged";
  await tx
    .update(sessionBookingsTable)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      paymentState: needsRefund ? "refund_pending" : booking.paymentState,
    })
    .where(eq(sessionBookingsTable.id, booking.id));
  if (booking.paymentMethod === "package") {
    await refundPackageCredit(tx, booking.packageId);
  }
  return needsRefund;
}

/** Load a session inside a transaction with a FOR UPDATE row lock. */
async function lockSession(tx: Tx, id: number): Promise<LiveSession | null> {
  const [s] = await tx
    .select()
    .from(liveSessionsTable)
    .where(eq(liveSessionsTable.id, id))
    .for("update");
  return s ?? null;
}

// ---------------------------------------------------------------------------
// Series (teacher/admin)
// ---------------------------------------------------------------------------

router.post(
  "/sessions/series",
  requireRole("teacher", "admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateSessionSeriesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
    const user = req.auth!.user;
    const teacherId = await resolveStaffAssignee(user, parsed.data.teacherId);
    if (teacherId === null) {
      res.status(400).json({ message: "المعلّم المحدد غير موجود أو ليس من الطاقم" });
      return;
    }
    const [series] = await db
      .insert(sessionSeriesTable)
      .values({
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        program: parsed.data.program ?? "",
        teacherId,
      })
      .returning();
    res.status(201).json(series);
  },
);

router.get("/sessions/series", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(sessionSeriesTable)
    .orderBy(desc(sessionSeriesTable.createdAt));
  res.json(rows);
});

// ---------------------------------------------------------------------------
// Packages (must precede /sessions/:id)
// ---------------------------------------------------------------------------

router.post(
  "/sessions/packages",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = PurchaseSessionPackageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
    const credits = parsed.data.credits;
    const priceSar = credits * PACKAGE_PRICE_PER_CREDIT_SAR;
    // Durable purchase intent first (charge_pending), then an idempotent
    // provider charge keyed to the package row. A crash between the two is
    // recovered by the reconciliation job; credits are only usable once the
    // state is `charged`.
    const [pkg] = await db
      .insert(sessionPackagesTable)
      .values({
        userId: req.auth!.user.id,
        name: parsed.data.name ?? `باقة ${credits} جلسات`,
        totalCredits: credits,
        remainingCredits: credits,
        priceSar,
        paymentState: "charge_pending",
      })
      .returning();
    const charged = await finalizePackageCharge(pkg!.id);
    if (!charged) {
      res.status(402).json({ message: "تعذّر إتمام الدفع" });
      return;
    }
    const [fresh] = await db
      .select()
      .from(sessionPackagesTable)
      .where(eq(sessionPackagesTable.id, pkg!.id));
    res.status(201).json(fresh ?? pkg);
  },
);

router.get(
  "/sessions/packages",
  requireAuth,
  async (req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(sessionPackagesTable)
      .where(eq(sessionPackagesTable.userId, req.auth!.user.id))
      .orderBy(desc(sessionPackagesTable.createdAt));
    res.json(rows);
  },
);

// ---------------------------------------------------------------------------
// Notifications + bookings + attendance history (before /sessions/:id)
// ---------------------------------------------------------------------------

router.get(
  "/sessions/notifications",
  requireAuth,
  async (req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(sessionNotificationsTable)
      .where(eq(sessionNotificationsTable.userId, req.auth!.user.id))
      .orderBy(desc(sessionNotificationsTable.createdAt));
    res.json(rows);
  },
);

router.get(
  "/sessions/my/bookings",
  requireAuth,
  async (req, res): Promise<void> => {
    const bookings = await db
      .select()
      .from(sessionBookingsTable)
      .where(eq(sessionBookingsTable.userId, req.auth!.user.id))
      .orderBy(desc(sessionBookingsTable.createdAt));
    const sessionIds = [...new Set(bookings.map((b) => b.sessionId))];
    const sessions = sessionIds.length
      ? await db
          .select()
          .from(liveSessionsTable)
          .where(inArray(liveSessionsTable.id, sessionIds))
      : [];
    res.json(
      bookings.map((b) => {
        const s = sessions.find((x) => x.id === b.sessionId);
        return {
          ...b,
          session: s ? serializeSession(s, 0) : null,
        };
      }),
    );
  },
);

router.get(
  "/sessions/attendance/history",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = req.auth!.user;
    const childIdRaw = req.query["childId"];
    const userIdRaw = req.query["userId"];
    const childId = childIdRaw ? intParam(childIdRaw) : null;
    const targetUserId = userIdRaw ? intParam(userIdRaw) : user.id;

    if (childId) {
      const [child] = await db
        .select()
        .from(childrenTable)
        .where(eq(childrenTable.id, childId));
      if (!child || (user.role !== "admin" && child.parentId !== user.id)) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
    } else if (targetUserId !== user.id && user.role !== "admin") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const rows = await db
      .select()
      .from(sessionAttendanceTable)
      .where(
        childId
          ? eq(sessionAttendanceTable.childId, childId)
          : eq(sessionAttendanceTable.userId, targetUserId),
      )
      .orderBy(desc(sessionAttendanceTable.markedAt));
    const sessionIds = [...new Set(rows.map((r) => r.sessionId))];
    const sessions = sessionIds.length
      ? await db
          .select()
          .from(liveSessionsTable)
          .where(inArray(liveSessionsTable.id, sessionIds))
      : [];
    res.json(
      rows.map((r) => {
        const s = sessions.find((x) => x.id === r.sessionId);
        return {
          id: r.id,
          sessionId: r.sessionId,
          childId: r.childId,
          userId: r.userId,
          status: r.status,
          markedAt: r.markedAt.toISOString(),
          sessionTitle: s?.title ?? "",
          sessionStartsAt: s?.startsAt.toISOString() ?? null,
        };
      }),
    );
  },
);

// ---------------------------------------------------------------------------
// Sessions CRUD + listing
// ---------------------------------------------------------------------------

router.post(
  "/sessions",
  requireRole("teacher", "admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateLiveSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
    const user = req.auth!.user;
    const d = parsed.data;
    const startsAt = new Date(d.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      res.status(400).json({ message: "تاريخ غير صالح" });
      return;
    }
    const teacherId = await resolveStaffAssignee(user, d.teacherId);
    if (teacherId === null) {
      res.status(400).json({ message: "المعلّم المحدد غير موجود أو ليس من الطاقم" });
      return;
    }
    const [session] = await db
      .insert(liveSessionsTable)
      .values({
        seriesId: d.seriesId ?? null,
        teacherId,
        title: d.title,
        description: d.description ?? "",
        program: d.program ?? "",
        startsAt,
        durationMinutes: d.durationMinutes ?? 60,
        capacity: d.capacity ?? 10,
        priceSar: d.priceSar ?? null,
        includedInSubscription: d.includedInSubscription ?? false,
        meetingLink: d.meetingLink ?? "",
      })
      .returning();
    res.status(201).json(serializeSession(session!, 0));
  },
);

router.get("/sessions", async (req, res): Promise<void> => {
  const teacherId = req.query["teacherId"]
    ? intParam(req.query["teacherId"])
    : null;
  const seriesId = req.query["seriesId"]
    ? intParam(req.query["seriesId"])
    : null;
  const includePast = req.query["includePast"] === "true";
  const conditions = [eq(liveSessionsTable.status, "scheduled")];
  if (!includePast) {
    conditions.push(gte(liveSessionsTable.startsAt, new Date()));
  }
  if (teacherId) conditions.push(eq(liveSessionsTable.teacherId, teacherId));
  if (seriesId) conditions.push(eq(liveSessionsTable.seriesId, seriesId));
  const rows = await db
    .select()
    .from(liveSessionsTable)
    .where(and(...conditions))
    .orderBy(asc(liveSessionsTable.startsAt));
  const result = [];
  for (const s of rows) {
    result.push(serializeSession(s, await bookedCountFor(s.id)));
  }
  res.json(result);
});

router.get("/sessions/:id", async (req, res): Promise<void> => {
  const session = await loadSession(intParam(req.params["id"]));
  if (!session) {
    res.status(404).json({ message: "الجلسة غير موجودة" });
    return;
  }
  res.json(serializeSession(session, await bookedCountFor(session.id)));
});

router.patch(
  "/sessions/:id",
  requireRole("teacher", "admin"),
  async (req, res): Promise<void> => {
    const session = await loadSession(intParam(req.params["id"]));
    if (!session) {
      res.status(404).json({ message: "الجلسة غير موجودة" });
      return;
    }
    if (!canManage(req.auth!.user, session)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const parsed = UpdateLiveSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
    const d = parsed.data;
    const set: Record<string, unknown> = {};
    if (d.title !== undefined) set["title"] = d.title;
    if (d.description !== undefined) set["description"] = d.description;
    if (d.program !== undefined) set["program"] = d.program;
    if (d.startsAt !== undefined) {
      const dt = new Date(d.startsAt);
      if (Number.isNaN(dt.getTime())) {
        res.status(400).json({ message: "تاريخ غير صالح" });
        return;
      }
      set["startsAt"] = dt;
    }
    if (d.durationMinutes !== undefined) set["durationMinutes"] = d.durationMinutes;
    if (d.capacity !== undefined) set["capacity"] = d.capacity;
    if (d.priceSar !== undefined) set["priceSar"] = d.priceSar;
    if (d.includedInSubscription !== undefined)
      set["includedInSubscription"] = d.includedInSubscription;
    if (d.meetingLink !== undefined) set["meetingLink"] = d.meetingLink;
    if (d.status !== undefined) set["status"] = d.status;
    if (Object.keys(set).length === 0) {
      res.status(400).json({ message: "لا توجد تعديلات" });
      return;
    }
    // Capacity validation + update share the same FOR UPDATE session lock as
    // booking, so a concurrent booking cannot slip in between check and write.
    const patchOutcome = await db.transaction(async (tx) => {
      const locked = await lockSession(tx, session.id);
      if (!locked) return { error: "الجلسة غير موجودة" };
      if (d.capacity !== undefined) {
        // Never allow capacity below the current active bookings — that would
        // oversubscribe the session with no defined demotion behavior.
        const activeBooked = await bookedCountFor(locked.id, tx);
        if (d.capacity < activeBooked) {
          return {
            error: `لا يمكن تقليل السعة إلى أقل من عدد الحجوزات القائمة (${activeBooked})`,
          };
        }
      }
      const [row] = await tx
        .update(liveSessionsTable)
        .set(set)
        .where(eq(liveSessionsTable.id, locked.id))
        .returning();

      // Session-wide cancellation: finalize all booking states under the same
      // session lock. Provider refunds are deferred to after commit via the
      // durable `refund_pending` state.
      const refundBookingIds: number[] = [];
      const cancelledUserIds: number[] = [];
      let promoted: PromotionResult[] = [];
      // Capacity increase frees seats → promote waitlisted bookings FIFO
      // under the same lock (same path as cancellation-driven promotion).
      if (
        d.capacity !== undefined &&
        d.capacity > locked.capacity &&
        row !== undefined &&
        row.status !== "cancelled"
      ) {
        promoted = await promoteFromWaitlistTx(tx, row);
      }
      if (d.status === "cancelled" && locked.status !== "cancelled") {
        const bookings = await tx
          .select()
          .from(sessionBookingsTable)
          .where(
            and(
              eq(sessionBookingsTable.sessionId, locked.id),
              inArray(sessionBookingsTable.status, ["booked", "waitlisted"]),
            ),
          );
        for (const b of bookings) {
          if (b.status === "booked") {
            const needsRefund = await markBookingCancelledTx(tx, b);
            if (needsRefund) refundBookingIds.push(b.id);
          } else {
            await tx
              .update(sessionBookingsTable)
              .set({ status: "cancelled", cancelledAt: new Date() })
              .where(eq(sessionBookingsTable.id, b.id));
          }
          cancelledUserIds.push(b.userId);
        }
      }
      return { updated: row!, refundBookingIds, cancelledUserIds, promoted };
    });
    if ("error" in patchOutcome && patchOutcome.error !== undefined) {
      res.status(400).json({ message: patchOutcome.error });
      return;
    }
    const updated = patchOutcome.updated;

    // After-commit settlement of a session-wide cancellation: provider
    // refunds (recoverable — reconcilePayments retries any that fail) and
    // participant notifications.
    for (const bookingId of patchOutcome.refundBookingIds ?? []) {
      await processBookingRefund(bookingId);
    }
    // Settle capacity-increase promotions (charges single-purchase
    // promotions + sends waitlist-promotion notifications).
    await settlePromotions(updated!, patchOutcome.promoted ?? []);
    for (const userId of patchOutcome.cancelledUserIds ?? []) {
      await queueNotification({
        userId,
        sessionId: session.id,
        type: "session_cancelled",
        message: `نأسف — أُلغيت جلسة «${session.title}» المقررة ${formatRiyadh(session.startsAt)}.`,
      });
    }
    res.json(serializeSession(updated!, await bookedCountFor(session.id)));
  },
);

// ---------------------------------------------------------------------------
// Booking / cancellation / waitlist
// ---------------------------------------------------------------------------

router.post(
  "/sessions/:id/book",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = req.auth!.user;
    const session = await loadSession(intParam(req.params["id"]));
    if (!session || session.status !== "scheduled") {
      res.status(404).json({ message: "الجلسة غير متاحة للحجز" });
      return;
    }
    if (session.startsAt.getTime() < Date.now()) {
      res.status(400).json({ message: "انتهى وقت الحجز لهذه الجلسة" });
      return;
    }
    const parsed = BookSessionBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
    const childId = parsed.data.childId ?? null;
    if (childId) {
      const [child] = await db
        .select()
        .from(childrenTable)
        .where(eq(childrenTable.id, childId));
      if (!child || child.parentId !== user.id) {
        res.status(403).json({ message: "الطفل غير تابع لحسابك" });
        return;
      }
    }
    const method = await resolveEntitlement(
      user.id,
      session,
      parsed.data.paymentMethod as PaymentMethod | undefined,
    );
    if (!method) {
      res.status(402).json({
        message:
          "هذه الجلسة مدفوعة — يلزم اشتراك فعّال أو رصيد باقة أو شراء مفرد",
      });
      return;
    }

    // Capacity allocation runs under a FOR UPDATE lock on the session row so
    // concurrent requests cannot both take the final seat. The transaction
    // only performs DB-safe work (seat + durable payment state); provider
    // charges happen after commit via finalizeBookingCharge.
    const outcome = await db.transaction(async (tx) => {
      const locked = await lockSession(tx, session.id);
      if (!locked || locked.status !== "scheduled") {
        return { error: "الجلسة غير متاحة للحجز" };
      }
      const [existing] = await tx
        .select()
        .from(sessionBookingsTable)
        .where(
          and(
            eq(sessionBookingsTable.sessionId, locked.id),
            eq(sessionBookingsTable.userId, user.id),
          ),
        );
      if (existing && existing.status !== "cancelled") {
        return { error: "لديك حجز قائم في هذه الجلسة" };
      }
      const booked = await bookedCountFor(locked.id, tx);
      const status = booked >= locked.capacity ? "waitlisted" : "booked";
      let packageId: number | null = null;
      if (status === "booked" && method === "package") {
        packageId = await consumePackageCreditTx(tx, user.id);
        if (packageId === null) return { error: "لا يوجد رصيد باقة كافٍ" };
      }
      const paymentState =
        status === "booked" && method === "single" ? "charge_pending" : "none";
      const values = {
        sessionId: locked.id,
        userId: user.id,
        childId,
        status,
        paymentMethod: method,
        paymentReference: null,
        refundReference: null,
        paymentState,
        packageId,
        cancelledAt: null,
        createdAt: new Date(),
      };
      const [booking] = existing
        ? await tx
            .update(sessionBookingsTable)
            .set(values)
            .where(eq(sessionBookingsTable.id, existing.id))
            .returning()
        : await tx.insert(sessionBookingsTable).values(values).returning();
      return { booking: booking!, status };
    });
    if ("error" in outcome || !outcome.booking) {
      res.status(400).json({ message: "error" in outcome ? outcome.error! : "تعذّر الحجز" });
      return;
    }
    let status = outcome.status;

    // Provider charge outside the transaction (idempotent per booking). On
    // decline the seat is released and the waitlist promoted inside
    // finalizeBookingCharge.
    if (status === "booked" && method === "single") {
      const charged = await finalizeBookingCharge(outcome.booking.id);
      if (!charged) {
        res
          .status(402)
          .json({ message: "تعذّر إتمام الدفع — لم يُحجز المقعد" });
        return;
      }
      // Reflect the settled payment state in the response.
      const [fresh] = await db
        .select()
        .from(sessionBookingsTable)
        .where(eq(sessionBookingsTable.id, outcome.booking.id));
      if (fresh) outcome.booking = fresh;
    }

    await queueNotification({
      userId: user.id,
      sessionId: session.id,
      type: "booking_confirmed",
      message:
        status === "booked"
          ? `تم تأكيد حجزك في جلسة «${session.title}» — ${formatRiyadh(session.startsAt)} بتوقيت الرياض.`
          : `الجلسة «${session.title}» مكتملة — أُضفت إلى قائمة الانتظار وسنعلمك عند توفر مقعد.`,
    });

    res
      .status(201)
      .json({
        ...(outcome.booking as object),
        waitlisted: status === "waitlisted",
      });
  },
);

router.post(
  "/sessions/:id/cancel-booking",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = req.auth!.user;
    const session = await loadSession(intParam(req.params["id"]));
    if (!session) {
      res.status(404).json({ message: "الجلسة غير موجودة" });
      return;
    }
    const outcome = await db.transaction(async (tx) => {
      const locked = await lockSession(tx, session.id);
      if (!locked) return { error: 404, message: "الجلسة غير موجودة" };
      const [booking] = await tx
        .select()
        .from(sessionBookingsTable)
        .where(
          and(
            eq(sessionBookingsTable.sessionId, locked.id),
            eq(sessionBookingsTable.userId, user.id),
          ),
        );
      if (!booking || booking.status === "cancelled") {
        return { error: 404, message: "لا يوجد حجز لإلغائه" };
      }
      if (booking.status === "attended") {
        return {
          error: 400,
          message: "لا يمكن إلغاء حجز تمّت المشاركة فيه",
        };
      }
      const wasBooked = booking.status === "booked";
      if (
        wasBooked &&
        locked.startsAt.getTime() - Date.now() < CANCEL_CUTOFF_MS
      ) {
        return {
          error: 400,
          message: "لا يمكن الإلغاء قبل أقل من ساعتين من بداية الجلسة",
        };
      }
      const needsRefund = await markBookingCancelledTx(tx, booking);
      let promoted: PromotionResult[] = [];
      if (wasBooked) {
        promoted = await promoteFromWaitlistTx(tx, locked);
      }
      return {
        promoted,
        refundBookingId: needsRefund ? booking.id : null,
      };
    });
    if ("error" in outcome && outcome.error !== undefined) {
      res.status(outcome.error).json({ message: outcome.message });
      return;
    }
    // Provider refund + promotion charges after commit (recoverable — the
    // reconciliation job retries anything left pending).
    if (outcome.refundBookingId) {
      await processBookingRefund(outcome.refundBookingId);
    }
    await settlePromotions(session, outcome.promoted ?? []);
    await queueNotification({
      userId: user.id,
      sessionId: session.id,
      type: "booking_cancelled",
      message: `تم إلغاء حجزك في جلسة «${session.title}».`,
    });
    res.json({ message: "تم إلغاء الحجز" });
  },
);

// ---------------------------------------------------------------------------
// Join link (gated)
// ---------------------------------------------------------------------------

router.get(
  "/sessions/:id/join",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = req.auth!.user;
    const session = await loadSession(intParam(req.params["id"]));
    if (!session || session.status === "cancelled") {
      res.status(404).json({ message: "الجلسة غير موجودة" });
      return;
    }
    if (!canManage(user, session)) {
      const [booking] = await db
        .select()
        .from(sessionBookingsTable)
        .where(
          and(
            eq(sessionBookingsTable.sessionId, session.id),
            eq(sessionBookingsTable.userId, user.id),
            inArray(sessionBookingsTable.status, ["booked", "attended"]),
          ),
        );
      if (!booking || !hasSettledPayment(booking)) {
        res.status(403).json({ message: "الرابط متاح للمشتركين في الجلسة فقط" });
        return;
      }
      const now = Date.now();
      const revealAt = session.startsAt.getTime() - JOIN_REVEAL_MS;
      const endsAt =
        session.startsAt.getTime() + session.durationMinutes * 60_000;
      if (now < revealAt) {
        res.status(403).json({
          message: "رابط الانضمام يُتاح قبل ١٥ دقيقة من بداية الجلسة",
          availableAt: new Date(revealAt).toISOString(),
        });
        return;
      }
      if (now > endsAt) {
        res.status(410).json({ message: "انتهت الجلسة" });
        return;
      }
    }
    res.json({
      meetingLink: session.meetingLink,
      startsAt: session.startsAt.toISOString(),
      durationMinutes: session.durationMinutes,
    });
  },
);

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

router.post(
  "/sessions/:id/attendance",
  requireRole("teacher", "admin"),
  async (req, res): Promise<void> => {
    const user = req.auth!.user;
    const session = await loadSession(intParam(req.params["id"]));
    if (!session) {
      res.status(404).json({ message: "الجلسة غير موجودة" });
      return;
    }
    if (!canManage(user, session)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const parsed = MarkSessionAttendanceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
    // All booked → attended transitions run under the session row lock so
    // they serialize with booking/cancellation/capacity edits (attendance is
    // count-neutral — both statuses hold a seat — but the lock guarantees a
    // consistent view for concurrent capacity checks).
    const results = await db.transaction(async (tx) => {
      const locked = await lockSession(tx, session.id);
      if (!locked) return [];
      const rows = [];
      for (const record of parsed.data.records) {
        const [booking] = await tx
          .select()
          .from(sessionBookingsTable)
          .where(eq(sessionBookingsTable.id, record.bookingId));
        // Only active participants (booked/attended) can be marked — never
        // waitlisted or cancelled bookings, which hold no seat.
        if (
          !booking ||
          booking.sessionId !== session.id ||
          !["booked", "attended"].includes(booking.status) ||
          !hasSettledPayment(booking)
        ) {
          continue;
        }
        const values = {
          sessionId: session.id,
          bookingId: booking.id,
          childId: booking.childId,
          userId: booking.userId,
          status: record.status,
          markedById: user.id,
          markedAt: new Date(),
        };
        const [row] = await tx
          .insert(sessionAttendanceTable)
          .values(values)
          .onConflictDoUpdate({
            target: sessionAttendanceTable.bookingId,
            set: values,
          })
          .returning();
        if (record.status !== "absent") {
          await tx
            .update(sessionBookingsTable)
            .set({ status: "attended" })
            .where(eq(sessionBookingsTable.id, booking.id));
        }
        rows.push(row);
      }
      return rows;
    });
    res.json({ marked: results.length, records: results });
  },
);

router.get(
  "/sessions/:id/participants",
  requireRole("teacher", "admin"),
  async (req, res): Promise<void> => {
    const session = await loadSession(intParam(req.params["id"]));
    if (!session) {
      res.status(404).json({ message: "الجلسة غير موجودة" });
      return;
    }
    if (!canManage(req.auth!.user, session)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const bookings = await db
      .select()
      .from(sessionBookingsTable)
      .where(eq(sessionBookingsTable.sessionId, session.id))
      .orderBy(asc(sessionBookingsTable.createdAt));
    const userIds = [...new Set(bookings.map((b) => b.userId))];
    const users = userIds.length
      ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
      : [];
    const childIds = bookings.map((b) => b.childId).filter((x): x is number => x != null);
    const children = childIds.length
      ? await db
          .select()
          .from(childrenTable)
          .where(inArray(childrenTable.id, childIds))
      : [];
    const attendance = await db
      .select()
      .from(sessionAttendanceTable)
      .where(eq(sessionAttendanceTable.sessionId, session.id));
    res.json(
      bookings.map((b) => ({
        bookingId: b.id,
        status: b.status,
        paymentMethod: b.paymentMethod,
        userName: users.find((u) => u.id === b.userId)?.name ?? "",
        childName: children.find((c) => c.id === b.childId)?.name ?? null,
        attendanceStatus:
          attendance.find((a) => a.bookingId === b.id)?.status ?? null,
      })),
    );
  },
);

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

router.post(
  "/sessions/:id/materials",
  requireRole("teacher", "admin"),
  async (req, res): Promise<void> => {
    const session = await loadSession(intParam(req.params["id"]));
    if (!session) {
      res.status(404).json({ message: "الجلسة غير موجودة" });
      return;
    }
    if (!canManage(req.auth!.user, session)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const parsed = AddSessionMaterialBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
    const [material] = await db
      .insert(sessionMaterialsTable)
      .values({
        sessionId: session.id,
        kind: parsed.data.kind ?? "link",
        title: parsed.data.title,
        url: parsed.data.url ?? null,
        content: parsed.data.content ?? null,
        createdById: req.auth!.user.id,
      })
      .returning();
    res.status(201).json(material);
  },
);

router.get(
  "/sessions/:id/materials",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = req.auth!.user;
    const session = await loadSession(intParam(req.params["id"]));
    if (!session) {
      res.status(404).json({ message: "الجلسة غير موجودة" });
      return;
    }
    // Materials are restricted to the session's own teacher/admin or a
    // settled, active participant — no blanket teacher access.
    if (!canManage(user, session)) {
      const [booking] = await db
        .select()
        .from(sessionBookingsTable)
        .where(
          and(
            eq(sessionBookingsTable.sessionId, session.id),
            eq(sessionBookingsTable.userId, user.id),
            inArray(sessionBookingsTable.status, ["booked", "attended"]),
          ),
        );
      if (!booking || !hasSettledPayment(booking)) {
        res.status(403).json({ message: "المواد متاحة للمشتركين في الجلسة فقط" });
        return;
      }
    }
    const rows = await db
      .select()
      .from(sessionMaterialsTable)
      .where(eq(sessionMaterialsTable.sessionId, session.id))
      .orderBy(asc(sessionMaterialsTable.createdAt));
    res.json(rows);
  },
);

export default router;
