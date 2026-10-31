import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { getKidSession, familyHasActiveEnrollment } from '@/lib/kid-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const enrolled = await familyHasActiveEnrollment(familyId);
  if (!enrolled) return NextResponse.json({ error: 'no_active_enrollment' }, { status: 403 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json([]);

  const kidSession = await getKidSession();
  const childId = kidSession?.familyId === familyId ? kidSession.childId : null;

  let completedIds = new Set<number>();
  let band: 'explorers' | 'builders' | 'achievers' | 'graduates' | undefined;

  if (childId) {
    const child = await prisma.lrnChild.findFirst({ where: { id: childId, familyId } });
    if (child) {
      band = child.band;
      const completions = await prisma.lrnCompletion.findMany({
        where: { childId: child.id },
        select: { lessonId: true },
      });
      completedIds = new Set(completions.map((c) => c.lessonId));
    }
  }

  const lessons = await prisma.lrnLesson.findMany({
    where: {
      status: 'published',
      unit: { status: 'published', ...(band ? { band } : {}) },
      OR: [
        { titleAr: { contains: q, mode: 'insensitive' } },
        { titleEn: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 20,
    include: { unit: { include: { subject: true } } },
  });

  return NextResponse.json(
    lessons.map((l) => ({
      id: l.id,
      titleAr: l.titleAr,
      titleEn: l.titleEn,
      unitTitleAr: l.unit.titleAr,
      subjectNameAr: l.unit.subject.nameAr,
      subjectNameEn: l.unit.subject.nameEn,
      subjectColor: l.unit.subject.color,
      subjectIcon: l.unit.subject.icon,
      durationMinutes: l.durationMinutes,
      completed: completedIds.has(l.id),
    })),
  );
}
