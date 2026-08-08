import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { CART_COOKIE, priceCart, readCart } from '@/lib/cart';
import { createPayment, PAYMENT_PROVIDERS, type PaymentProvider } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/**
 * Checkout — SIMULATED payment (see src/lib/payments.ts integration point),
 * then atomic enrollment creation with capacity checks. Seats are only
 * consumed here, after "payment": abandoned carts never hold seats.
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
  if (!PAYMENT_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'invalid_provider' }, { status: 400 });
  }

  const cart = await priceCart(familyId, await readCart(familyId));
  if (cart.items.length === 0) return NextResponse.json({ error: 'cart_empty' }, { status: 400 });

  // Atomic: seat decrements + enrollment rows all-or-nothing. If any run is
  // full or a child is already enrolled, everything rolls back and no seat
  // is consumed.
  let outcome: { error: string; item?: number } | { enrollmentIds: number[] };
  try {
    const ids = await prisma.$transaction(async (tx) => {
      const created: number[] = [];
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
            status: 'active',
            monthlyPriceSar: item.baseSar,
            discountPct: item.discountPct,
            startedAt: new Date(),
          },
        });
        created.push(enrollment.id);
      }
      return created;
    });
    outcome = { enrollmentIds: ids };
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

  // Payment AFTER capacity is secured inside the same request. With a real
  // provider this becomes: create pending enrollments → redirect to pay →
  // activate on webhook. For the stub, payment always succeeds.
  const payment = await createPayment(
    provider,
    cart.totalSar,
    `FunAdemy enrollment — ${cart.items.length} child(ren)`,
  );
  if (payment.status !== 'paid') {
    // Roll seats + enrollments back — stub never hits this, but keep it safe.
    await prisma.$transaction(async (tx) => {
      for (const item of cart.items) {
        await tx.enrollment.deleteMany({ where: { studentId: item.studentId, courseRunId: item.courseRunId, status: 'active' } });
        await tx.courseRun.update({ where: { id: item.courseRunId }, data: { seatsLeft: { increment: 1 } } });
      }
    });
    return NextResponse.json({ error: 'payment_failed' }, { status: 402 });
  }

  const res = NextResponse.json({
    paid: true,
    simulated: true,
    reference: payment.reference,
    provider,
    totalSar: cart.totalSar,
    discountSar: cart.discountSar,
    items: cart.items,
    enrollmentIds: outcome.enrollmentIds,
  });
  res.cookies.set(CART_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
