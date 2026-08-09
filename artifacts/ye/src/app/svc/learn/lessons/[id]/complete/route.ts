import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireLessonAccess } from '@/lib/lesson-guard';
import { computeReward, gradeAnswers, XP_PER_LESSON } from '@/lib/learning';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lessonId = Number(id);
  if (!lessonId) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const guard = await requireLessonAccess(lessonId);
  if (!guard.ok) return guard.response;

  const { child, lesson } = guard;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const b = body as { answers?: Array<{ exerciseId: number; answer: string }>; timeSpentSeconds?: number };
  const answers = Array.isArray(b.answers) ? b.answers : [];
  const timeSpentSeconds = typeof b.timeSpentSeconds === 'number' ? b.timeSpentSeconds : 0;

  // Server-authoritative grading (correctAnswer never leaves the server)
  const { score, perAnswer } = gradeAnswers(lesson.exercises, answers);
  const today = new Date().toISOString().slice(0, 10);

  // Fully-atomic completion: lock the child row, check daily limit, claim
  // first-completion, and update rewards — all in one transaction.
  // SELECT FOR UPDATE serializes concurrent completions for the same child
  // (even for different lessons), which is also what makes the daily-limit
  // check race-safe: every concurrent request queues on this lock and
  // re-evaluates usage with fresh data before inserting a new completion.
  type TxResult =
    | { isFirst: false; xp: number; streak: number }
    | { isFirst: true; xp: number; streak: number; newBadges: string[] }
    | { limitReached: true };

  const txResult = await prisma.$transaction<TxResult>(async (tx) => {
    // 1. Lock the child row — any concurrent transaction that also tries to
    //    lock this row will wait here, guaranteeing sequential read-modify-write
    //    and making the daily-limit check authoritative.
    const [lockedChild] = await tx.$queryRawUnsafe<typeof child[]>(
      `SELECT * FROM ye.ye_lrn_children WHERE id = $1 FOR UPDATE`,
      child.id,
    );
    if (!lockedChild) throw new Error('child_disappeared');

    // 2. Enforce daily time limit inside the lock (server-trusted durations).
    //    This re-evaluation inside the transaction is what prevents concurrent
    //    requests from all observing pre-lock usage below the limit and each
    //    inserting a completion that pushes total over the limit.
    if (lockedChild.dailyLimitMinutes !== null) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const todayCompletions = await tx.lrnCompletion.findMany({
        where: { childId: lockedChild.id, createdAt: { gte: todayStart } },
        include: { lesson: { select: { durationMinutes: true } } },
      });
      const consumedMinutes = todayCompletions.reduce(
        (sum, c) => sum + c.lesson.durationMinutes,
        0,
      );
      // Deny when adding THIS lesson would strictly exceed the limit.
      // Equality (consumedMinutes + duration === limit) is allowed.
      if (consumedMinutes + lesson.durationMinutes > lockedChild.dailyLimitMinutes) {
        return { limitReached: true as const };
      }
    }

    // 3. Record the completion attempt (always).
    await tx.lrnCompletion.create({
      data: { childId: child.id, lessonId, score, timeSpentSeconds },
    });

    // 3. Atomically claim the first-completion slot.
    //    @@unique([childId, lessonId]) prevents two rows; skipDuplicates makes it
    //    a no-op (rather than an error) for the loser.
    const claim = await tx.lrnFirstCompletion.createMany({
      data: [{ childId: child.id, lessonId }],
      skipDuplicates: true,
    });

    if (claim.count === 0) {
      // Repeat completion — record time only, no rewards.
      return { isFirst: false, xp: lockedChild.xp, streak: lockedChild.streak };
    }

    // 4. Count distinct first-completions (source of truth for totalLessons).
    const totalDistinct = await tx.lrnFirstCompletion.count({
      where: { childId: child.id },
    });

    // 5. Compute rewards from the LOCKED (fresh) child state.
    const { streak, totalXp, newBadges } = computeReward(lockedChild, totalDistinct, score);

    // 6. Persist the updated state.
    const updated = await tx.lrnChild.update({
      where: { id: child.id },
      data: {
        xp: totalXp,
        streak,
        lastActiveDate: today,
        badges: [...lockedChild.badges, ...newBadges],
      },
    });

    return { isFirst: true, xp: updated.xp, streak: updated.streak, newBadges };
  });

  if ('limitReached' in txResult) {
    return NextResponse.json({ error: 'daily_limit_reached' }, { status: 403 });
  }

  if (!txResult.isFirst) {
    return NextResponse.json({
      xpEarned: 0,
      totalXp: txResult.xp,
      streak: txResult.streak,
      newBadges: [],
      score,
      perAnswer,
      repeated: true,
    });
  }

  return NextResponse.json({
    xpEarned: XP_PER_LESSON,
    totalXp: txResult.xp,
    streak: txResult.streak,
    newBadges: txResult.newBadges,
    score,
    perAnswer,
    repeated: false,
  });
}
