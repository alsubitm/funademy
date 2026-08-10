import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { subscriptionState } from '@/lib/billing';

export const dynamic = 'force-dynamic';

/** Payment history + per-enrollment subscription status for the family. */
export async function GET() {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [payments, enrollments] = await Promise.all([
    prisma.payment.findMany({
      where: { familyId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.enrollment.findMany({
      where: { student: { familyId }, status: { in: ['active', 'pending'] } },
      include: { student: true, courseRun: { include: { program: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      provider: p.provider,
      reference: p.reference,
      status: p.status,
      subtotalSar: p.subtotalSar,
      discountSar: p.discountSar,
      totalSar: p.totalSar,
      simulated: p.simulated,
      createdAt: p.createdAt,
      items: p.items.map((i) => ({
        studentName: i.studentName,
        programAr: i.programAr,
        programEn: i.programEn,
        periodStart: i.periodStart,
        periodEnd: i.periodEnd,
        totalSar: i.totalSar,
        discountPct: i.discountPct,
      })),
    })),
    subscriptions: enrollments.map((e) => ({
      enrollmentId: e.id,
      studentName: e.student.firstName,
      programAr: e.courseRun.program.nameAr,
      programEn: e.courseRun.program.nameEn,
      monthlyPriceSar: e.monthlyPriceSar,
      discountPct: e.discountPct,
      paidThrough: e.paidThrough,
      state: subscriptionState(e.paidThrough),
    })),
  });
}
