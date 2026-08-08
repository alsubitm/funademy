import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { createPayment, PAYMENT_PROVIDERS, type PaymentProvider } from '@/lib/payments';
import { addOneMonth, effectiveMonthlySar } from '@/lib/billing';

export const dynamic = 'force-dynamic';

/**
 * Renew one month of an enrollment's subscription from the parent portal.
 * Uses the SAME payment integration point as enrollment checkout
 * (src/lib/payments.ts) — simulated until a real provider is wired in.
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
  const enrollmentId = Number(body.enrollmentId);
  const provider = String(body.provider ?? '') as PaymentProvider;
  if (!Number.isInteger(enrollmentId)) return NextResponse.json({ error: 'invalid_enrollment' }, { status: 400 });
  if (!PAYMENT_PROVIDERS.includes(provider)) return NextResponse.json({ error: 'invalid_provider' }, { status: 400 });

  // Ownership + state checks — the enrollment must belong to this family.
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, student: { familyId } },
    include: { student: true, courseRun: { include: { program: true } } },
  });
  if (!enrollment) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (enrollment.status !== 'active' && enrollment.status !== 'pending') {
    return NextResponse.json({ error: 'not_renewable' }, { status: 409 });
  }

  const totalSar = Math.round(effectiveMonthlySar(enrollment.monthlyPriceSar, enrollment.discountPct));
  const payment = await createPayment(
    provider,
    totalSar,
    `FunAdemy renewal — enrollment ${enrollment.id}`,
  );
  if (payment.status !== 'paid') {
    return NextResponse.json({ error: 'payment_failed' }, { status: 402 });
  }

  // Extend from the current paidThrough if still in the future, else from now.
  const now = new Date();
  const base = enrollment.paidThrough && enrollment.paidThrough > now ? enrollment.paidThrough : now;
  const periodEnd = addOneMonth(base);

  const record = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        familyId,
        kind: 'renewal',
        provider,
        reference: payment.reference,
        status: 'paid',
        subtotalSar: enrollment.monthlyPriceSar,
        discountSar: enrollment.monthlyPriceSar - totalSar,
        totalSar,
        simulated: payment.simulated === true,
        items: {
          create: [{
            enrollmentId: enrollment.id,
            studentName: enrollment.student.firstName,
            programAr: enrollment.courseRun.program.nameAr,
            programEn: enrollment.courseRun.program.nameEn,
            periodStart: base,
            periodEnd,
            baseSar: enrollment.monthlyPriceSar,
            discountPct: enrollment.discountPct,
            totalSar,
          }],
        },
      },
    });
    await tx.enrollment.update({ where: { id: enrollment.id }, data: { paidThrough: periodEnd } });
    return p;
  });

  return NextResponse.json({
    paid: true,
    simulated: payment.simulated === true,
    reference: payment.reference,
    paymentId: record.id,
    totalSar,
    paidThrough: periodEnd,
  });
}
