import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { getKidSession, familyHasActiveEnrollment } from '@/lib/kid-auth';
import { serializeChild } from '@/lib/learning';
import { riyadhDayStart } from '@/lib/riyadh-time';

export const dynamic = 'force-dynamic';

export async function GET() {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const enrolled = await familyHasActiveEnrollment(familyId);
  if (!enrolled) return NextResponse.json({ error: 'no_active_enrollment' }, { status: 403 });

  const kidSession = await getKidSession();
  if (!kidSession || kidSession.familyId !== familyId)
    return NextResponse.json({ error: 'no_kid_selected' }, { status: 401 });

  const child = await prisma.lrnChild.findFirst({
    where: { id: kidSession.childId, familyId },
    include: { completions: { select: { lessonId: true } } },
  });
  if (!child) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const completedIds = new Set(child.completions.map((c) => c.lessonId));

  // Find next lesson to continue in child's band (first published, not yet completed)
  const nextLesson = await prisma.lrnLesson.findFirst({
    where: {
      status: 'published',
      unit: { band: child.band, status: 'published' },
      id: { notIn: completedIds.size > 0 ? [...completedIds] : [-1] },
    },
    orderBy: [{ unit: { position: 'asc' } }, { position: 'asc' }],
    include: { unit: { include: { subject: true } } },
  });

  // Subjects with progress
  const subjects = await prisma.lrnSubject.findMany({
    orderBy: { position: 'asc' },
    include: {
      units: {
        where: { band: child.band, status: 'published' },
        include: {
          lessons: {
            where: { status: 'published' },
            select: { id: true },
          },
        },
      },
    },
  });

  const subjectData = subjects
    .filter((s) => s.units.length > 0)
    .map((s) => {
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
        unitCount: s.units.length,
        lessonCount: total,
        progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });

  // Today's usage — first completions only, using the Riyadh day boundary.
  // Replays never inflate the daily-use display.
  const todayStart = riyadhDayStart();
  const todayLessonCompletions = await prisma.lrnFirstCompletion.findMany({
    where: { childId: child.id, claimedAt: { gte: todayStart } },
    include: { lesson: { select: { durationMinutes: true } } },
  });
  const todayMinutes = todayLessonCompletions.reduce(
    (sum, c) => sum + c.lesson.durationMinutes,
    0,
  );
  // Consistent with enforcement: limit is exceeded when consumed + next would exceed,
  // but here we report the raw consumed total for display; dailyLimitReached means
  // no further lessons can be started today.
  const dailyLimitReached =
    child.dailyLimitMinutes !== null && todayMinutes >= child.dailyLimitMinutes;

  return NextResponse.json({
    child: serializeChild(child),
    continueLesson: nextLesson
      ? {
          lessonId: nextLesson.id,
          titleAr: nextLesson.titleAr,
          titleEn: nextLesson.titleEn,
          subjectNameAr: nextLesson.unit.subject.nameAr,
          subjectNameEn: nextLesson.unit.subject.nameEn,
          subjectColor: nextLesson.unit.subject.color,
          subjectIcon: nextLesson.unit.subject.icon,
        }
      : null,
    subjects: subjectData,
    todayMinutes,
    dailyLimitReached,
  });
}
