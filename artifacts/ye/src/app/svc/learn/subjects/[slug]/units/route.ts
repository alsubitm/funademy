import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { getKidSession, familyHasActiveEnrollment } from '@/lib/kid-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const enrolled = await familyHasActiveEnrollment(familyId);
  if (!enrolled) return NextResponse.json({ error: 'no_active_enrollment' }, { status: 403 });

  const kidSession = await getKidSession();
  const childId = kidSession?.familyId === familyId ? kidSession.childId : null;

  const { slug } = await params;
  const subject = await prisma.lrnSubject.findUnique({ where: { slug } });
  if (!subject) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let completedIds = new Set<number>();
  let band: 'explorers' | 'builders' | 'achievers' | 'graduates' = 'explorers';

  if (childId) {
    const child = await prisma.lrnChild.findFirst({ where: { id: childId, familyId } });
    if (child) {
      band = child.band;
      const completions = await prisma.lrnCompletion.findMany({
        where: { childId: child.id },
        select: { lessonId: true, score: true },
      });
      completedIds = new Set(completions.map((c) => c.lessonId));
    }
  }

  const units = await prisma.lrnUnit.findMany({
    where: { subjectId: subject.id, band, status: 'published' },
    orderBy: { position: 'asc' },
    include: {
      lessons: {
        where: { status: 'published' },
        orderBy: { position: 'asc' },
        include: { _count: { select: { exercises: true } } },
      },
    },
  });

  const unitsData = units.map((u, unitIdx) => {
    const prevUnitsComplete = units.slice(0, unitIdx).every((pu) =>
      pu.lessons.every((l) => completedIds.has(l.id)),
    );
    const locked = unitIdx > 0 && !prevUnitsComplete;

    return {
      id: u.id,
      titleAr: u.titleAr,
      titleEn: u.titleEn,
      position: u.position,
      locked,
      lessons: u.lessons.map((l) => ({
        id: l.id,
        titleAr: l.titleAr,
        titleEn: l.titleEn,
        durationMinutes: l.durationMinutes,
        exerciseCount: l._count.exercises,
        isFreeSample: l.isFreeSample,
        completed: completedIds.has(l.id),
      })),
    };
  });

  return NextResponse.json({
    subject: {
      id: subject.id,
      nameAr: subject.nameAr,
      nameEn: subject.nameEn,
      slug: subject.slug,
      icon: subject.icon,
      color: subject.color,
    },
    units: unitsData,
  });
}
