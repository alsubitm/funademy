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

  const sessionPromise = getKidSession();
  const [enrolled, kidSession, child] = await Promise.all([
    familyHasActiveEnrollment(familyId), sessionPromise,
    sessionPromise.then(session => session?.familyId === familyId ? prisma.lrnChild.findFirst({
      where: { id: session.childId, familyId },
      include: { firstCompletions: { select: { lessonId: true } } },
    }) : null),
  ]);
  if (!enrolled) return NextResponse.json({ error: 'no_active_enrollment' }, { status: 403 });
  if (!kidSession || kidSession.familyId !== familyId)
    return NextResponse.json({ error: 'no_kid_selected' }, { status: 401 });
  if (!child) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const completedIds = new Set(child.firstCompletions.map((c) => c.lessonId));

  // Find next lesson to continue in child's band (first published, not yet completed)
  const [remainingLessons, subjects, todayLessonCompletions] = await Promise.all([prisma.lrnLesson.findMany({
    where: {
      status: 'published',
      unit: { band: child.band, status: 'published' },
      firstCompletions: { none: { childId: child.id } },
    },
    orderBy: [{ unit: { position: 'asc' } }, { position: 'asc' }, { id: 'asc' }],
    select: {
      id: true, titleAr: true, titleEn: true, durationMinutes: true,
      unit: { select: {
        subjectId: true, position: true,
        subject: { select: { nameAr: true, nameEn: true, color: true, icon: true } },
      } },
    },
  }), prisma.lrnSubject.findMany({
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
  }), prisma.lrnFirstCompletion.findMany({
    where: { childId: child.id, claimedAt: { gte: riyadhDayStart() } },
    include: { lesson: { select: { durationMinutes: true } } },
  })]);

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
  const todayMinutes = todayLessonCompletions.reduce(
    (sum, c) => sum + c.lesson.durationMinutes,
    0,
  );
  // Consistent with enforcement: limit is exceeded when consumed + next would exceed,
  // but here we report the raw consumed total for display; dailyLimitReached means
  // no further lessons can be started today.
  // Recommend only a lesson the server guard would allow: a shorter lesson
  // in another subject can still fit, but never skip an unfinished prior unit.
  const firstUnitBySubject = new Map<number, number>();
  for (const lesson of remainingLessons) {
    const { subjectId, position } = lesson.unit;
    firstUnitBySubject.set(subjectId, Math.min(firstUnitBySubject.get(subjectId) ?? position, position));
  }
  const availableLessons = remainingLessons.filter(lesson =>
    lesson.unit.position === firstUnitBySubject.get(lesson.unit.subjectId));
  const nextLesson = availableLessons.find(lesson =>
    child.dailyLimitMinutes === null ||
    todayMinutes + lesson.durationMinutes <= child.dailyLimitMinutes);
  const dailyLimitReached = child.dailyLimitMinutes !== null &&
    (todayMinutes >= child.dailyLimitMinutes ||
      (availableLessons.length > 0 && !nextLesson));

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
