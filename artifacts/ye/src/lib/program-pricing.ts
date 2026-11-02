import { prisma } from '@/lib/db';
import { safeQuery } from '@/lib/safe-query';

/** Same active/end-date boundary as enrollment; full runs cannot be purchased. */
export function loadProgramPricing(programId: number, now = new Date()) {
  return safeQuery(() => prisma.courseRun.findMany({
    where: { programId, active: true, endDate: { gte: now }, seatsLeft: { gt: 0 } },
    orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    select: {
      id: true, titleAr: true, titleEn: true, startDate: true,
      weekday: true, time: true, format: true, location: true, monthlyPriceSar: true,
    },
  }), null, 'program:pricing');
}

export type ProgramPricingRun = NonNullable<Awaited<ReturnType<typeof loadProgramPricing>>>[number];
