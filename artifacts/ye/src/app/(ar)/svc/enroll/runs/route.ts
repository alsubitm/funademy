import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Public — active course runs with seats + schedule, for enrollment discovery. */
export async function GET() {
  const runs = await prisma.courseRun.findMany({
    where: { active: true, endDate: { gte: new Date() } },
    include: { program: { select: { id: true, slug: true, nameAr: true, nameEn: true, ageMin: true, ageMax: true, color: true, kitCode: true } } },
    orderBy: [{ programId: 'asc' }, { startDate: 'asc' }],
  });
  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      program: r.program,
      titleAr: r.titleAr,
      titleEn: r.titleEn,
      startDate: r.startDate,
      endDate: r.endDate,
      weekday: r.weekday,
      time: r.time,
      format: r.format,
      location: r.location,
      capacity: r.capacity,
      seatsLeft: r.seatsLeft,
      monthlyPriceSar: r.monthlyPriceSar,
    })),
  });
}
