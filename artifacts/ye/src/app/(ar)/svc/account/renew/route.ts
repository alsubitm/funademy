import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { createPayment, PAYMENT_PROVIDERS, type PaymentProvider } from '@/lib/payments';
import { addOneMonth, effectiveMonthlySar } from '@/lib/billing';
import { originFromRequest } from '@/lib/request-origin';

export const dynamic = 'force-dynamic';

/**
 * Renew one month of an enrollment's subscription from the parent portal.
 * Same mechanics as enrollment checkout: LIVE providers return a
 * `redirectUrl` and the payment settles via /svc/pay/return (or webhook,
 * see src/lib/pay-core.ts); without credentials it falls back to a clearly
 * flagged simulated payment settled immediately.
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
  const lang = body.lang === 'en' ? 'en' : 'ar';
  if (!Number.isInteger(enrollmentId)) return NextResponse.json({ error: 'invalid_enrollment' }, { status: 400 });
  if (!PAYMENT_PROVIDERS.includes(provider)) return NextResponse.json({ error: 'invalid_provider' }, { status: 400 });

  // Ownership + state checks — the enrollment must belong to this family.
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, student: { familyId } },
    include: { student: { include: { family: true } }, courseRun: { include: { program: true } } },
  });
  if (!enrollment) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (enrollment.status !== 'active' && enrollment.status !== 'pending') {
    return NextResponse.json({ error: 'not_renewable' }, { status: 409 });
  }

  const totalSar = Math.round(effectiveMonthlySar(enrollment.monthlyPriceSar, enrollment.discountPct));

  // Provisional covered period — recomputed at settlement time for live
  // payments (see pay-core.ts) since settlement can happen later.
  const now = new Date();
  const base = enrollment.paidThrough && enrollment.paidThrough > now ? enrollment.paidThrough : now;
  const periodEnd = addOneMonth(base);

  const claim = await prisma.$transaction(async (tx) => {
    // Serialize renewal creation per enrollment. A retry after a lost provider
    // response must reuse the outstanding operation, never create a second charge.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(94613, ${enrollment.id}::int)`;
    const outstanding = await tx.payment.findFirst({
      where: { kind: 'renewal', status: 'initiated', items: { some: { enrollmentId: enrollment.id } } },
      select: { id: true },
    });
    if (outstanding) return { outstandingId: outstanding.id, record: null };
    const record = await tx.payment.create({
      data: {
        familyId,
        kind: 'renewal',
        provider,
        reference: `INIT-${Date.now()}`,
        status: 'initiated',
        subtotalSar: enrollment.monthlyPriceSar,
        discountSar: enrollment.monthlyPriceSar - totalSar,
        totalSar,
        simulated: false,
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
    return { outstandingId: null, record };
  });
  if (claim.outstandingId != null) {
    return NextResponse.json(
      { error: 'payment_pending_reconciliation', paymentId: claim.outstandingId },
      { status: 409 },
    );
  }
  const record = claim.record!;

  const origin = originFromRequest(req);
  const payment = await createPayment(
    provider,
    totalSar,
    `FunAdemy renewal — enrollment ${enrollment.id}`,
    {
      callbackUrl: `${origin}/svc/pay/return?paymentId=${record.id}&lang=${lang}`,
      orderRef: String(record.id),
      consumer: {
        name: enrollment.student.family.parentName,
        phone: enrollment.student.family.phone,
        email: enrollment.student.family.email,
      },
      lines: [{ name: `${enrollment.courseRun.program.nameEn} — ${enrollment.student.firstName} (1 month)`, totalSar }],
    },
  );

  if (payment.status === 'indeterminate') {
    if (payment.reference) {
      await prisma.payment.updateMany({
        where: { id: record.id, status: 'initiated' },
        data: { reference: payment.reference },
      }).catch((e) => {
        console.error(`[payments] ADMIN ACTION REQUIRED: partial renewal reference was not saved for payment ${record.id}:`, e);
      });
    }
    console.error(`[payments] ADMIN ACTION REQUIRED: renewal checkout creation outcome unknown for payment ${record.id}`);
    return NextResponse.json({ error: 'payment_pending_reconciliation', paymentId: record.id }, { status: 503 });
  }

  if (payment.status === 'failed') {
    await prisma.payment.updateMany({ where: { id: record.id, status: 'initiated' }, data: { status: 'failed' } });
    return NextResponse.json({ error: 'payment_failed' }, { status: 402 });
  }

  if (payment.status === 'redirect') {
    try {
      await prisma.payment.update({ where: { id: record.id }, data: { reference: payment.reference } });
    } catch (e) {
      console.error(`[payments] ADMIN ACTION REQUIRED: renewal provider reference was not saved for payment ${record.id}:`, e);
      return NextResponse.json({ error: 'payment_pending_reconciliation', paymentId: record.id }, { status: 503 });
    }
    return NextResponse.json({ redirectUrl: payment.redirectUrl, paymentId: record.id });
  }

  // SIMULATED: settle immediately.
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: record.id },
      data: { reference: payment.reference, status: 'paid', simulated: true },
    });
    await tx.enrollment.update({ where: { id: enrollment.id }, data: { paidThrough: periodEnd } });
  });

  return NextResponse.json({
    paid: true,
    simulated: true,
    reference: payment.reference,
    paymentId: record.id,
    totalSar,
    paidThrough: periodEnd,
  });
}
