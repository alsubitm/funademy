import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';
import { refundPayment, type PaymentProvider, PAYMENT_PROVIDERS } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/** GET — recent payments with family + line details for the admin panel. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const payments = await prisma.payment.findMany({
    include: { family: { select: { parentName: true, phone: true } }, items: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      provider: p.provider,
      reference: p.reference,
      status: p.status,
      totalSar: p.totalSar,
      simulated: p.simulated,
      createdAt: p.createdAt,
      parentName: p.family.parentName,
      phone: p.family.phone,
      students: p.items.map((i) => i.studentName),
      attentionRequired: p.status === 'initiated' && /^INIT-\d+$/.test(p.reference),
    })),
  });
}

/**
 * POST { id, cancelEnrollment? } — refund a paid payment.
 *
 * When `cancelEnrollment` is true (admin chose «استرجاع مع إلغاء التسجيل»),
 * after the provider refund succeeds we also — atomically with the
 * refunding → refunded flip — cancel the enrollments linked to the payment,
 * return their seats, and shrink paidThrough (null for a first enrollment
 * payment, back to the period start for a renewal).
 *
 * CONCURRENCY SAFETY
 * ------------------
 * The provider refund is an external financial operation, so it must run at
 * most once. Before calling the provider we atomically claim the payment
 * with a guarded updateMany (paid → refunding); only the request whose
 * update matched a row proceeds. Concurrent/retried requests observe
 * `refunding` and get 409 refund_in_progress (or `refunded` → ok).
 * On provider failure the claim is rolled back (refunding → paid) so the
 * admin can retry. If the process dies mid-call the payment stays in
 * `refunding` — deliberate fail-closed: reconcile against the provider
 * dashboard before flipping it manually, never auto-retry a refund blindly.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { id?: unknown; cancelEnrollment?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const cancelEnrollment = body.cancelEnrollment === true;

  const payment = await prisma.payment.findUnique({ where: { id }, include: { items: true } });
  if (!payment) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (payment.status === 'refunded') return NextResponse.json({ ok: true, status: 'refunded' });
  if (payment.status !== 'paid') {
    const err = payment.status === 'refunding' ? 'refund_in_progress' : 'not_refundable';
    return NextResponse.json({ error: err, status: payment.status }, { status: 409 });
  }
  if (!PAYMENT_PROVIDERS.includes(payment.provider as PaymentProvider)) {
    return NextResponse.json({ error: 'unknown_provider' }, { status: 409 });
  }

  // Atomically claim the refund BEFORE touching the provider — exactly one
  // concurrent request wins this guarded transition.
  const claimed = await prisma.payment.updateMany({
    where: { id, status: 'paid' },
    data: { status: 'refunding' },
  });
  if (claimed.count === 0) {
    const current = await prisma.payment.findUnique({ where: { id }, select: { status: true } });
    if (current?.status === 'refunded') return NextResponse.json({ ok: true, status: 'refunded' });
    return NextResponse.json(
      { error: current?.status === 'refunding' ? 'refund_in_progress' : 'not_refundable', status: current?.status },
      { status: 409 },
    );
  }

  let result: Awaited<ReturnType<typeof refundPayment>>;
  try {
    result = await refundPayment(
      payment.provider as PaymentProvider,
      payment.reference,
      payment.totalSar,
    );
  } catch (e) {
    // refundPayment catches internally; this is belt-and-braces. Treat a
    // throw here as indeterminate — the provider may have executed it.
    console.error('[admin/payments] refund threw:', e);
    result = { ok: false, error: 'provider_error', indeterminate: true };
  }

  if (!result.ok) {
    if (result.indeterminate) {
      // The provider may already have executed the refund. Keep the payment
      // in `refunding` (fail closed) so no retry can trigger a duplicate
      // financial operation — resolve it against the provider dashboard.
      console.error(`[admin/payments] refund of payment ${id} indeterminate — left in 'refunding' for manual reconciliation`);
      return NextResponse.json({ error: 'refund_status_unknown' }, { status: 502 });
    }
    // Definitive pre-execution rejection — no money moved; allow retry.
    await prisma.payment.updateMany({ where: { id, status: 'refunding' }, data: { status: 'paid' } });
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Flip refunding → refunded and, if requested, cancel the linked
  // enrollments in the SAME transaction so exactly one request applies the
  // enrollment side-effects.
  let cancelledEnrollments = 0;
  await prisma.$transaction(async (tx) => {
    const flipped = await tx.payment.updateMany({
      where: { id, status: 'refunding' },
      data: { status: 'refunded' },
    });
    if (flipped.count === 0 || !cancelEnrollment) return;

    for (const item of payment.items) {
      if (item.enrollmentId == null) continue;
      const enr = await tx.enrollment.findUnique({ where: { id: item.enrollmentId } });
      if (!enr || enr.status === 'cancelled') continue;

      const wasHoldingSeat = enr.status === 'active' || enr.status === 'pending' || enr.status === 'paused';
      // Shrink paidThrough: a first-enrollment refund voids coverage entirely;
      // a renewal refund rolls coverage back to the start of the refunded period.
      const newPaidThrough = payment.kind === 'renewal' ? item.periodStart : null;
      await tx.enrollment.update({
        where: { id: enr.id },
        data: { status: 'cancelled', paidThrough: newPaidThrough },
      });
      if (wasHoldingSeat) {
        await tx.courseRun.update({
          where: { id: enr.courseRunId },
          data: { seatsLeft: { increment: 1 } },
        });
      }
      cancelledEnrollments++;
    }
  });
  return NextResponse.json({ ok: true, status: 'refunded', cancelledEnrollments });
}
