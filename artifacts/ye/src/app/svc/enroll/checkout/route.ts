import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { CART_COOKIE, priceCart, readCart } from '@/lib/cart';
import { createPayment, PAYMENT_PROVIDERS, type PaymentProvider } from '@/lib/payments';
import { sweepStalePayments } from '@/lib/pay-core';
import { addOneMonth } from '@/lib/billing';
import { originFromRequest } from '@/lib/request-origin';

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

  const cart = await priceCart(familyId, await readCart(familyId));
  if (cart.items.length === 0) return NextResponse.json({ error: 'cart_empty' }, { status: 400 });

  const family = await prisma.family.findUnique({ where: { id: familyId } });
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
    const created = await prisma.$transaction(async (tx) => {
      const enrollmentIds: number[] = [];
      for (const item of cart.items) {
        const updated = await tx.courseRun.updateMany({
          where: { id: item.courseRunId, active: true, endDate: { gte: new Date() }, seatsLeft: { gt: 0 } },
          data: { seatsLeft: { decrement: 1 } },
        });
        if (updated.count === 0) throw new Error(`run_full:${item.courseRunId}`);
        const enrollment = await tx.enrollment.create({
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
            })),
          },
        },
      });
      return { enrollmentIds, paymentId: payment.id };
    });
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
  const payment = await createPayment(
    provider,
    cart.totalSar,
    `FunAdemy enrollment — ${cart.items.length} child(ren)`,
    {
      callbackUrl: `${origin}/svc/pay/return?paymentId=${paymentId}&lang=${lang}`,
      orderRef: String(paymentId),
      consumer: { name: family.parentName, phone: family.phone, email: family.email },
      lines: cart.items.map((i) => ({
        name: `${i.programNameEn} — ${i.studentName}`,
        totalSar: Math.round(i.totalSar),
      })),
    },
  );

  if (payment.status === 'failed') {
    // Roll everything back — seats must not stay held for a payment that
    // never started.
    await prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({ where: { id: paymentId, status: 'initiated' }, data: { status: 'failed' } });
      for (let i = 0; i < cart.items.length; i++) {
        const deleted = await tx.enrollment.deleteMany({ where: { id: enrollmentIds[i], status: 'pending' } });
        if (deleted.count > 0) {
          await tx.courseRun.update({ where: { id: cart.items[i].courseRunId }, data: { seatsLeft: { increment: 1 } } });
        }
      }
    });
    return NextResponse.json({ error: 'payment_failed' }, { status: 402 });
  }

  if (payment.status === 'redirect') {
    // LIVE: hand the parent to the provider's secure page. Cart is kept until
    // payment is confirmed (cleared by /svc/pay/return).
    await prisma.payment.update({ where: { id: paymentId }, data: { reference: payment.reference } });
    return NextResponse.json({ redirectUrl: payment.redirectUrl, paymentId });
  }

  // SIMULATED: settle immediately in this request.
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { reference: payment.reference, status: 'paid', simulated: true },
    });
    await tx.enrollment.updateMany({
      where: { id: { in: enrollmentIds } },
      data: { status: 'active', startedAt: new Date(), paidThrough: periodEnd },
    });
  });

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

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, familyId, kind: 'enrollment' },
    include: { items: true },
  });
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
