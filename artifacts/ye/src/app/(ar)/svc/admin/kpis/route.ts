import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [activeEnrollments, activeStudents, runs, pendingBricks] = await Promise.all([
    prisma.enrollment.findMany({ where: { status: 'active' }, select: { monthlyPriceSar: true, discountPct: true } }),
    prisma.enrollment.groupBy({ by: ['studentId'], where: { status: 'active' } }),
    prisma.courseRun.findMany({ where: { active: true }, select: { capacity: true, seatsLeft: true } }),
    prisma.watanBrick.count({ where: { status: 'pending' } }),
  ]);

  const monthlyRevenueSar = Math.round(
    activeEnrollments.reduce((sum, e) => sum + (e.monthlyPriceSar * (100 - e.discountPct)) / 100, 0),
  );
  const totalSeats = runs.reduce((s, r) => s + r.capacity, 0);
  const filledSeats = runs.reduce((s, r) => s + (r.capacity - r.seatsLeft), 0);

  return NextResponse.json({
    activeStudents: activeStudents.length,
    activeEnrollments: activeEnrollments.length,
    monthlyRevenueSar,
    seatsFilledPct: totalSeats ? Math.round((filledSeats / totalSeats) * 100) : 0,
    totalSeats,
    filledSeats,
    activeRuns: runs.length,
    pendingBricks,
  });
}
