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

  const kidSession = await getKidSession();
  const childId = kidSession?.familyId === familyId ? kidSession.childId : null;

  let child = childId ? await prisma.lrnChild.findFirst({ where: { id: childId, familyId } }) : null;
  const band = (req.nextUrl.searchParams.get('band') as 'explorers' | 'builders' | 'achievers' | 'graduates' | null) ?? child?.band ?? 'explorers';

  let completedIds = new Set<number>();
  if (child) {
    const completions = await prisma.lrnCompletion.findMany({
      where: { childId: child.id },
      select: { lessonId: true },
    });
    completedIds = new Set(completions.map((c) => c.lessonId));
  }

  const subjects = await prisma.lrnSubject.findMany({
    orderBy: { position: 'asc' },
    include: {
      units: {
        where: { band, status: 'published' },
        include: {
          lessons: {
            where: { status: 'published' },
            select: { id: true },
          },
        },
      },
    },
  });

  const data = subjects.map((s) => {
    const lessonIds = s.units.flatMap((u) => u.lessons.map((l) => l.id));
    const total = lessonIds.length;
    const done = lessonIds.filter((id) => completedIds.has(id)).length;
    return {
      id: s.id,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      slug: s.slug,
      icon: s.icon,
      color: s.color,
      bands: ['explorers', 'builders', 'achievers', 'graduates'],
      unitCount: s.units.length,
      lessonCount: total,
      progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });

  return NextResponse.json(data);
}
