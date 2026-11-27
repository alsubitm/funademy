/**
 * Shared lesson-access guard.
 *
 * Returns { child, lesson } when access is permitted, or a NextResponse
 * error to return immediately.
 *
 * Rules:
 *   1. Valid family session (ye_family cookie).
 *   2. Active enrollment.
 *   3. Valid kid session (ye_kid cookie) tied to the same family.
 *   4. Child exists and is owned by the family.
 *   5. Lesson is published AND its unit is published AND the unit is in
 *      the child's band — otherwise 404 (indistinguishable from "not found").
 *   6. All previous units (lower position) in the same subject/band must be
 *      fully first-completed by this child — otherwise 403 unit_locked.
 *      Uses LrnFirstCompletion (durable reward claims), NOT LrnCompletion,
 *      so repeat/zero-score attempts do not count as progression.
 *   7. Child's daily time limit has not been exceeded. Time is computed
 *      server-side as the sum of lesson.durationMinutes for first completions
 *      claimed during the current Asia/Riyadh day. Replays do not consume the
 *      allowance again.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { getKidSession, familyHasActiveEnrollment } from '@/lib/kid-auth';
import type { LrnChild, LrnLesson, LrnExercise, LrnUnit, LrnSubject } from '@prisma/client';
import { riyadhDayStart } from '@/lib/riyadh-time';

export type LessonWithDetails = LrnLesson & {
  unit: LrnUnit & { subject: LrnSubject };
  exercises: LrnExercise[];
};

export type GuardResult =
  | { ok: true; familyId: number; child: LrnChild; lesson: LessonWithDetails }
  | { ok: false; response: NextResponse };

export async function requireLessonAccess(lessonId: number, options: { skipDailyLimit?: boolean } = {}): Promise<GuardResult> {
  // 1. Family session
  const familyId = await getFamilyId();
  if (!familyId)
    return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };

  // 2. Active enrollment
  const kidSession = await getKidSession();
  const validSelection = kidSession?.familyId === familyId;
  // Enrollment, ownership and the published lesson are independent reads.
  // Preserve the original error precedence and never return lesson data until
  // all authorization and band checks have passed.
  const [enrolled, child, candidate] = await Promise.all([
    familyHasActiveEnrollment(familyId),
    validSelection ? prisma.lrnChild.findFirst({
      where: { id: kidSession.childId, familyId },
    }) : Promise.resolve(null),
    validSelection ? prisma.lrnLesson.findFirst({
    where: { id: lessonId, status: 'published', unit: { status: 'published' } },
    include: {
      unit: { include: { subject: true } },
      exercises: { orderBy: { position: 'asc' } },
    },
    }) : Promise.resolve(null),
  ]);
  if (!enrolled)
    return { ok: false, response: NextResponse.json({ error: 'no_active_enrollment' }, { status: 403 }) };
  if (!validSelection)
    return { ok: false, response: NextResponse.json({ error: 'no_kid_selected' }, { status: 401 }) };
  if (!child)
    return { ok: false, response: NextResponse.json({ error: 'no_kid_selected' }, { status: 401 }) };

  // 5. Lesson published, unit published, unit band matches child's band
  const lesson = candidate?.unit.band === child.band ? candidate : null;
  if (!lesson)
    return { ok: false, response: NextResponse.json({ error: 'not_found' }, { status: 404 }) };

  // 6. Prerequisite-unit lock: all units with lower position in the same
  //    subject must be fully first-completed (LrnFirstCompletion) by this child.
  //    We deliberately use LrnFirstCompletion — the durable progression claim —
  //    so repeat/zero-score attempts do NOT count as unit completion.
  const checkDailyLimit = !options.skipDailyLimit && child.dailyLimitMinutes !== null;
  const [priorUnits, firstCompletions, todayCompletions] = await Promise.all([prisma.lrnUnit.findMany({
    where: {
      subjectId: lesson.unit.subjectId,
      band: child.band,
      status: 'published',
      position: { lt: lesson.unit.position },
    },
    include: {
      lessons: {
        where: { status: 'published' },
        select: { id: true },
      },
    },
    orderBy: { position: 'asc' },
  }), prisma.lrnFirstCompletion.findMany({
    where: { childId: child.id }, select: { lessonId: true },
  }), checkDailyLimit ? prisma.lrnFirstCompletion.findMany({
    where: { childId: child.id, claimedAt: { gte: riyadhDayStart() } },
    include: { lesson: { select: { durationMinutes: true } } },
  }) : Promise.resolve([])]);
  const firstCompletedIds = new Set(firstCompletions.map(c => c.lessonId));

  if (priorUnits.length > 0) {
    // Use LrnFirstCompletion as the source of truth for progression.

    for (const unit of priorUnits) {
      const allDone = unit.lessons.every((l) => firstCompletedIds.has(l.id));
      if (!allDone)
        return {
          ok: false,
          response: NextResponse.json({ error: 'unit_locked' }, { status: 403 }),
        };
    }
  }

  // 7. Daily limit uses first-completion claims and the Riyadh day boundary.
  if (checkDailyLimit && child.dailyLimitMinutes !== null) {
    const alreadyCompleted = firstCompletedIds.has(lessonId);
    const consumedMinutes = todayCompletions.reduce(
      (sum, c) => sum + c.lesson.durationMinutes,
      0,
    );

    // Deny when adding this lesson's duration would exceed (strictly) the limit.
    // Equality is allowed: a child with a 5-minute limit may complete one 5-minute lesson.
    if (!alreadyCompleted && consumedMinutes + lesson.durationMinutes > child.dailyLimitMinutes) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'daily_limit_reached' }, { status: 403 }),
      };
    }
  }

  return { ok: true, familyId, child, lesson: lesson as LessonWithDetails };
}
