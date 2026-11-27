import { cache } from 'react';
import { prisma } from '@/lib/db';
import { safeQuery } from '@/lib/safe-query';

/** React request memoization shares the same row between metadata and body. */
export const getProgramDetail = cache((slug: string) => safeQuery(
  () => prisma.program.findUnique({
    where: { slug },
    include: { slots: { where: { active: true }, orderBy: [{ weekday: 'asc' }, { time: 'asc' }] } },
  }), null, 'program:detail',
));

export function getProgramSiblings() {
  return safeQuery(() => prisma.program.findMany({
    orderBy: { position: 'asc' },
    select: { id: true, slug: true, nameAr: true, nameEn: true, position: true },
  }), [], 'program:siblings');
}
