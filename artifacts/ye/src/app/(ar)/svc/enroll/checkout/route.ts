import { NextRequest, NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { CART_COOKIE, priceCart, readCart } from '@/lib/cart';
import { createPayment, PAYMENT_PROVIDERS, type PaymentProvider } from '@/lib/payments';
import { sweepStalePayments } from '@/lib/pay-core';
import { addOneMonth } from '@/lib/billing';
import { originFromRequest } from '@/lib/request-origin';
import { createPaymentReturnState } from '@/lib/payment-return-state';

export const dynamic = 'force-dynamic';

/**
 * Checkout.
 *
 * LIVE providers (Moyasar/Tamara credentials configured):
 *   1. Seats are reserved + enrollments created as `pending` + a payment row
 *      as `initiated`, all in one transaction.
 *   2. The response carries `redirectUrl`; the parent pays on the provider's
 *      hosted page (3DS included).
 *   3. `/svc/pay/return` (and/or the provider webhook) verifies with the
 *      provider and activates the enrollments — see src/lib/pay-core.ts.
 *   Abandoned checkouts are swept (seats returned) after ~45 minutes.
 *
 * SIMULATED fallback (no credentials): payment "succeeds" immediately and
 * enrollments activate in this request, clearly flagged simulated.
 */
export async function POST(req: NextRequest) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const provider = String(body.provider ?? '') as PaymentProvider;
  const lang = body.lang === 'en' ? 'en' : 'ar';
  if (!PAYMENT_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'invalid_provider' }, { status: 400 });
  }

  // Free seats held by abandoned checkouts before enforcing capacity.
  await sweepStalePayments().catch(() => undefined);

  const rawCart = await readCart(familyId);
  const cart = await withDbRetry(
    () => priceCart(familyId, rawCart),
    { operation: 'checkout-cart-pricing' },
  );
  if (cart.items.length === 0) return NextResponse.json({ error: 'cart_empty' }, { status: 400 });

  const family = await withDbRetry(
    () => prisma.family.findUnique({ where: { id: familyId } }),
    { operation: 'checkout-family-read' },
  );
  if (!family) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const periodStart = new Date();
  const periodEnd = addOneMonth(periodStart);

  // Atomic: seat decrements + pending enrollments + initiated payment row,
  // all-or-nothing. If any run is full or a child is already enrolled,
  // everything rolls back and no seat is consumed.
  let outcome:
    | { error: string; item?: number }
    | { enrollmentIds: number[]; paymentId: number };
  try {
    const created = await withDbRetry(() => prisma.$transaction(async (tx) => {
      const enrollmentIds: number[] = [];
      for (const item of cart.items) {
        const existing = await tx.enrollment.findUnique({
          where: { studentId_courseRunId: { studentId: item.studentId, courseRunId: item.courseRunId } },
        });
        if (existing && existing.status !== 'cancelled') throw new Error(`already_enrolled:${item.studentId}`);
        const updated = await tx.courseRun.updateMany({
          where: { id: item.courseRunId, active: true, endDate: { gte: new Date() }, seatsLeft: { gt: 0 } },
          data: { seatsLeft: { decrement: 1 } },
        });
        if (updated.count === 0) throw new Error(`run_full:${item.courseRunId}`);
        const enrollment = existing
          ? await (async () => {
              const reclaimed = await tx.enrollment.updateMany({
                where: { id: existing.id, status: 'cancelled' },
                data: {
                  status: 'pending',
                  monthlyPriceSar: item.baseSar,
                  discountPct: item.discountPct,
                  startedAt: null,
                  paidThrough: null,
                },
              });
              if (reclaimed.count === 0) throw new Error(`already_enrolled:${item.studentId}`);
              return existing;
            })()
          : await tx.enrollment.create({
              data: {
                studentId: item.studentId,
                courseRunId: item.courseRunId,
                status: 'pending',
                monthlyPriceSar: item.baseSar,
                discountPct: item.discountPct,
              },
            });
        enrollmentIds.push(enrollment.id);
      }
      const payment = await tx.payment.create({
        data: {
          familyId,
          kind: 'enrollment',
          provider,
          reference: `INIT-${Date.now()}`,
          status: 'initiated',
          subtotalSar: cart.subtotalSar,
          discountSar: cart.discountSar,
          totalSar: cart.totalSar,
          simulated: false,
          items: {
            create: cart.items.map((item, i) => ({
              enrollmentId: enrollmentIds[i],
              studentName: item.studentName,
              programAr: item.programNameAr,
              programEn: item.programNameEn,
              periodStart,
              periodEnd,
              baseSar: item.baseSar,
              discountPct: item.discountPct,
              totalSar: Math.round(item.totalSar),
              trialBookingId: item.trialBookingId,
            })),
          },
        },
      });
      return { enrollmentIds, paymentId: payment.id };
    }), { operation: 'checkout-seat-reservation', kind: 'transaction' });
    outcome = created;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.startsWith('run_full:')) {
      return NextResponse.json({ error: 'run_full', courseRunId: Number(msg.split(':')[1]) }, { status: 409 });
    }
    if (msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'already_enrolled' }, { status: 409 });
    }
    throw e;
  }

  const { enrollmentIds, paymentId } = outcome;
  const origin = originFromRequest(req);
  const returnState = createPaymentReturnState(paymentId, familyId);
  const payment = await createPayment(
    provider,
    cart.totalSar,
    `FunAdemy enrollment — ${cart.items.length} child(ren)`,
    {
      callbackUrl: `${origin}/svc/pay/return?state=${encodeURIComponent(returnState)}&lang=${lang}`,
      orderRef: String(paymentId),
      consumer: { name: family.parentName, phone: family.phone, email: family.email },
      lines: cart.items.map((i) => ({
        name: `${i.programNameEn} — ${i.studentName}`,
        totalSar: Math.round(i.totalSar),
      })),
    },
  );

  if (payment.status === 'indeterminate') {
    if (payment.reference) {
      await withDbRetry(
        () => prisma.payment.updateMany({
          where: { id: paymentId, status: 'initiated' },
          data: { reference: payment.reference },
        }),
        { operation: 'checkout-partial-provider-reference' },
      ).catch((e) => {
        console.error(`[payments] ADMIN ACTION REQUIRED: partial provider reference was not saved for payment ${paymentId}:`, e);
      });
    }
    console.error(`[payments] ADMIN ACTION REQUIRED: checkout creation outcome unknown for payment ${paymentId}`);
    return NextResponse.json({ error: 'payment_pending_reconciliation', paymentId }, { status: 503 });
  }

  if (payment.status === 'failed') {
    // Roll everything back — seats must not stay held for a payment that
    // never started.
    await withDbRetry(() => prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({ where: { id: paymentId, status: 'initiated' }, data: { status: 'failed' } });
      await tx.paymentItem.updateMany({ where: { paymentId }, data: { trialBookingId: null } });
      for (let i = 0; i < cart.items.length; i++) {
        const deleted = await tx.enrollment.deleteMany({ where: { id: enrollmentIds[i], status: 'pending' } });
        if (deleted.count > 0) {
          await tx.courseRun.update({ where: { id: cart.items[i].courseRunId }, data: { seatsLeft: { increment: 1 } } });
        }
      }
    }), { operation: 'checkout-provider-failure-release', kind: 'transaction' });
    return NextResponse.json({ error: 'payment_failed' }, { status: 402 });
  }

  if (payment.status === 'redirect') {
    // LIVE: hand the parent to the provider's secure page. Cart is kept until
    // payment is confirmed (cleared by /svc/pay/return).
    try {
      await withDbRetry(
        () => prisma.payment.update({ where: { id: paymentId }, data: { reference: payment.reference } }),
        { operation: 'checkout-provider-reference' },
      );
    } catch (e) {
      // The provider checkout exists, so releasing/retrying could create a
      // duplicate charge. Keep INIT + held seats for the reconciliation sweep.
      console.error(`[payments] ADMIN ACTION REQUIRED: provider reference was not saved for payment ${paymentId}:`, e);
      return NextResponse.json({ error: 'payment_pending_reconciliation', paymentId }, { status: 503 });
    }
    return NextResponse.json({ redirectUrl: payment.redirectUrl, paymentId });
  }

  // SIMULATED: settle immediately in this request.
  await withDbRetry(() => prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { reference: payment.reference, status: 'paid', simulated: true },
    });
    await tx.enrollment.updateMany({
      where: { id: { in: enrollmentIds } },
      data: { status: 'active', startedAt: new Date(), paidThrough: periodEnd },
    });
  }), { operation: 'checkout-simulated-settlement', kind: 'transaction' });

  const res = NextResponse.json({
    paid: true,
    simulated: true,
    reference: payment.reference,
    provider,
    totalSar: cart.totalSar,
    discountSar: cart.discountSar,
    items: cart.items,
    enrollmentIds,
  });
  res.cookies.set(CART_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

/**
 * GET ?paymentId= — payment status/details for the post-redirect "done"
 * screen. Owner-scoped.
 */
export async function GET(req: NextRequest) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const paymentId = Number(req.nextUrl.searchParams.get('paymentId'));
  if (!Number.isInteger(paymentId)) return NextResponse.json({ error: 'invalid_payment' }, { status: 400 });

  const payment = await withDbRetry(() => prisma.payment.findFirst({
    where: { id: paymentId, familyId, kind: 'enrollment' },
    include: { items: true },
  }), { operation: 'checkout-status-read' });
  if (!payment) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    status: payment.status,
    paid: payment.status === 'paid',
    simulated: payment.simulated,
    reference: payment.reference,
    provider: payment.provider,
    totalSar: payment.totalSar,
    discountSar: payment.discountSar,
    items: payment.items.map((i) => ({
      studentId: i.enrollmentId ?? i.id,
      courseRunId: i.id,
      studentName: i.studentName,
      programNameAr: i.programAr,
      programNameEn: i.programEn,
      totalSar: i.totalSar,
    })),
  });
}