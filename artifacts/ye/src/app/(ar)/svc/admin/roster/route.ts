import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

/** GET ?runId= — enrolled students for a run, with sessions list. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const runId = Number(req.nextUrl.searchParams.get('runId'));
  if (!Number.isInteger(runId)) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const [enrollments, sessions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseRunId: runId, status: { in: ['active', 'pending', 'paused'] } },
      include: { student: { include: { family: { select: { parentName: true, phone: true } } } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.classSession.findMany({ where: { courseRunId: runId }, orderBy: { date: 'asc' } }),
  ]);

  return NextResponse.json({
    roster: enrollments.map((e) => ({
      enrollmentId: e.id,
      status: e.status,
      monthlyPriceSar: e.monthlyPriceSar,
      discountPct: e.discountPct,
      student: {
        id: e.student.id,
        firstName: e.student.firstName,
        birthYear: e.student.birthYear,
        parentName: e.student.family.parentName,
        phone: e.student.family.phone,
      },
    })),
    sessions,
  });
}
