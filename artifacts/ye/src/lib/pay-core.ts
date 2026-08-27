import { prisma } from '@/lib/db';
import { addOneMonth } from '@/lib/billing';
import { reconcilePaymentCreation, verifyPayment, type PaymentProvider, PAYMENT_PROVIDERS } from '@/lib/payments';

/**
 * Shared finalization for live payments.
 *
 * STATUS LIFECYCLE
 * ----------------
 *  initiated → paid      (provider confirmed, enrollment activated)
 *  initiated → failed    (provider declined, seats released — terminal)
 *  initiated → expired   (our timeout, seats released — still reconcilable)
 *  expired   → paid      (provider settled after timeout; re-seat or log REFUND REQUIRED)
 *  expired   → failed    (provider declined after timeout — truly terminal)
 *
 * All transitions are idempotent via guarded updateMany.
 *
 * SEAT RELEASE INVARIANT
 * ----------------------
 * When releasing seats we cancel the enrollment (status → 'cancelled') rather
 * than deleting it. This preserves the PaymentItem.enrollmentId link (deletion
 * would trigger onDelete:SetNull and clear it), which is needed for late
 * settlement to find the enrollment and either re-activate it or log a
 * REFUND REQUIRED alert.
 */

export type FinalizeOutcome = 'paid' | 'pending' | 'failed' | 'not_found';

export async function finalizePayment(paymentId: number): Promise<FinalizeOutcome> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { items: true } });
  if (!payment) return 'not_found';
  if (payment.status === 'paid') return 'paid';
  if (payment.status === 'failed') return 'failed';
  // Expired payments can still be reconciled if the provider later confirms paid.
  const isExpired = payment.status === 'expired';
  if (payment.status !== 'initiated' && !isExpired) return 'failed';
  if (!PAYMENT_PROVIDERS.includes(payment.provider as PaymentProvider)) return 'failed';

  let providerReference = payment.reference;
  if (/^INIT-\d+$/.test(providerReference)) {
    const creation = await reconcilePaymentCreation(payment.provider as PaymentProvider, String(payment.id));
    if (creation.status === 'unknown') {
      console.error(`[payments] ADMIN ACTION REQUIRED: checkout creation for payment ${payment.id} is still indeterminate`);
      return 'pending';
    }
    const saved = await prisma.payment.updateMany({
      where: { id: payment.id, status: { in: ['initiated', 'expired'] }, reference: providerReference },
      data: { reference: creation.reference },
    });
    if (saved.count === 0) {
      const current = await prisma.payment.findUnique({ where: { id: payment.id }, select: { reference: true } });
      if (!current) return 'not_found';
      providerReference = current.reference;
    } else {
      providerReference = creation.reference;
    }
  }

  const verdict = await verifyPayment(payment.provider as PaymentProvider, providerReference);

  if (verdict === 'pending') return 'pending';

  if (verdict === 'failed') {
    // Mark terminal failed (idempotent — covers both initiated and expired).
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: { in: ['initiated', 'expired'] } },
        data: { status: 'failed' },
      });
      if (claimed.count === 0) return;
      if (payment.kind === 'enrollment') {
        await tx.paymentItem.updateMany({ where: { paymentId }, data: { trialBookingId: null } });
        if (!isExpired) await _cancelEnrollmentsInTx(tx, payment.items);
      }
    });
    return 'failed';
  }

  // Provider says paid — settle exactly once.
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: ['initiated', 'expired'] } },
      data: { status: 'paid' },
    });
    if (claimed.count === 0) return; // another request already settled it

    if (payment.kind === 'enrollment') {
      for (const item of payment.items) {
        if (item.enrollmentId == null) continue;

        const enr = await tx.enrollment.findUnique({ where: { id: item.enrollmentId } });
        if (!enr) {
          // Should not happen (cancelled, not deleted), but log for safety.
          console.error(`[payments] REFUND REQUIRED: payment ${paymentId} settled but enrollment ${item.enrollmentId} not found`);
          continue;
        }

        if (isExpired) {
          // Seats were released on timeout. Try to reclaim a seat for this run.
          const reseated = await tx.courseRun.updateMany({
            where: { id: enr.courseRunId, active: true, seatsLeft: { gt: 0 } },
            data: { seatsLeft: { decrement: 1 } },
          });
          if (reseated.count > 0) {
            await tx.enrollment.update({
              where: { id: enr.id },
              data: { status: 'active', startedAt: now, paidThrough: item.periodEnd },
            });
          } else {
            // Run is full — keep enrollment as cancelled, flag for manual refund.
            console.error(
              `[payments] REFUND REQUIRED: payment ${paymentId} settled after timeout but run ${enr.courseRunId} is full — enrollment ${enr.id} remains cancelled`,
            );
          }
        } else {
          await tx.enrollment.update({
            where: { id: enr.id },
            data: { status: 'active', startedAt: now, paidThrough: item.periodEnd },
          });
        }
      }
    } else {
      // renewal — recompute the covered period from the CURRENT paidThrough.
      for (const item of payment.items) {
        if (item.enrollmentId == null) continue;
        const enr = await tx.enrollment.findUnique({ where: { id: item.enrollmentId } });
        if (!enr) continue;
        const base = enr.paidThrough && enr.paidThrough > now ? enr.paidThrough : now;
        const periodEnd = addOneMonth(base);
        await tx.enrollment.update({ where: { id: enr.id }, data: { paidThrough: periodEnd } });
        await tx.paymentItem.update({ where: { id: item.id }, data: { periodStart: base, periodEnd } });
      }
    }
  });

  return 'paid';
}

/**
 * Mark an initiated payment failed and cancel its pending enrollment holds,
 * returning the seats. Only touches `initiated` payments — never already-settled
 * or already-expired ones.
 */
export async function releasePayment(paymentId: number): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { items: true } });
  if (!payment) return;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: 'initiated' },
      data: { status: 'failed' },
    });
    if (claimed.count === 0) return;
    if (payment.kind !== 'enrollment') return;
    await tx.paymentItem.updateMany({ where: { paymentId }, data: { trialBookingId: null } });
    await _cancelEnrollmentsInTx(tx, payment.items);
  });
}

/**
 * Cancel pending enrollment rows and return their seats.
 * Uses status='cancelled' (not delete) to preserve PaymentItem.enrollmentId
 * for potential late-settlement reconciliation.
 */
async function _cancelEnrollmentsInTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  items: { enrollmentId: number | null }[],
): Promise<void> {
  for (const item of items) {
    if (item.enrollmentId == null) continue;
    const enr = await tx.enrollment.findUnique({ where: { id: item.enrollmentId } });
    if (!enr || enr.status !== 'pending') continue;
    await tx.enrollment.update({ where: { id: enr.id }, data: { status: 'cancelled' } });
    await tx.courseRun.update({ where: { id: enr.courseRunId }, data: { seatsLeft: { increment: 1 } } });
  }
}

/**
 * Sweep initiated payments older than `maxAgeMinutes`.
 *
 * For each stale payment:
 *  - Provider confirmed paid/failed → finalize normally.
 *  - Provider still pending → mark `expired`, cancel enrollment holds (seats
 *    returned), enrollment row preserved for late settlement (see finalizePayment).
 *  - Provider confirmed failed → mark `failed` and cancel holds.
 *
 * Returns { settled, expired, errors } for observability.
 */
export async function sweepStalePayments(
  maxAgeMinutes = 45,
): Promise<{ settled: number; expired: number; errors: number }> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000);
  const stale = await prisma.payment.findMany({
    where: { status: 'initiated', createdAt: { lt: cutoff } },
    include: { items: true },
    take: 50,
  });

  let settled = 0, expiredCount = 0, errors = 0;

  for (const payment of stale) {
    try {
      if (/^INIT-\d+$/.test(payment.reference)) {
        const creation = await reconcilePaymentCreation(payment.provider as PaymentProvider, String(payment.id));
        if (creation.status === 'unknown') {
          console.error(`[payments] ADMIN ACTION REQUIRED: checkout creation for payment ${payment.id} is still indeterminate`);
          errors++;
          continue;
        }
        if (creation.status === 'found') {
          await prisma.payment.updateMany({
            where: { id: payment.id, status: 'initiated', reference: payment.reference },
            data: { reference: creation.reference },
          });
          payment.reference = creation.reference;
        }
      }
      const verdict = await verifyPayment(payment.provider as PaymentProvider, payment.reference);

      if (verdict === 'paid') {
        await finalizePayment(payment.id);
        settled++;
      } else if (verdict === 'failed') {
        await prisma.$transaction(async (tx) => {
          const claimed = await tx.payment.updateMany({
            where: { id: payment.id, status: 'initiated' },
            data: { status: 'failed' },
          });
          if (claimed.count === 0) return;
          if (payment.kind === 'enrollment') {
            await tx.paymentItem.updateMany({ where: { paymentId: payment.id }, data: { trialBookingId: null } });
            await _cancelEnrollmentsInTx(tx, payment.items);
          }
        });
        expiredCount++;
      } else {
        // Still pending after timeout — mark `expired` and release seats.
        // Enrollment rows are preserved (cancelled, not deleted) for reconciliation.
        await prisma.$transaction(async (tx) => {
          const claimed = await tx.payment.updateMany({
            where: { id: payment.id, status: 'initiated' },
            data: { status: 'expired' },
          });
          if (claimed.count === 0) return;
          if (payment.kind === 'enrollment') {
            console.warn(`[payments] sweep: payment ${payment.id} expired (provider pending) — releasing seats, reconcilable via late webhook`);
            await _cancelEnrollmentsInTx(tx, payment.items);
          }
        });
        expiredCount++;
      }
    } catch (e) {
      console.error(`[payments] sweep failed for payment ${payment.id}:`, e);
      errors++;
    }
  }

  return { settled, expired: expiredCount, errors };
}
