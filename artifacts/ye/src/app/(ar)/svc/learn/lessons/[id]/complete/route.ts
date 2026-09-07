import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireLessonAccess } from '@/lib/lesson-guard';
import { computeReward, gradeAnswers, XP_PER_LESSON } from '@/lib/learning';
import { enqueueCompletionEvents, flushOutboxServer } from '@/lib/xapiOutbox';
import { riyadhDateKey, riyadhDayStart } from '@/lib/riyadh-time';

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

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const b = body as { answers?: Array<{ exerciseId: number; answer: string }>; timeSpentSeconds?: number };
  if (!Array.isArray(b.answers)) {
    return NextResponse.json({ error: 'answers_required' }, { status: 400 });
  }
  const answers = b.answers;
  const expectedIds = new Set(lesson.exercises.map((e) => e.id));
  const seenIds = new Set<number>();
  for (const answer of answers) {
    if (
      !answer || !Number.isInteger(answer.exerciseId) ||
      typeof answer.answer !== 'string' || answer.answer.trim().length === 0 ||
      !expectedIds.has(answer.exerciseId)
    ) {
      return NextResponse.json({ error: 'unknown_exercise_answer' }, { status: 400 });
    }
    if (seenIds.has(answer.exerciseId)) {
      return NextResponse.json({ error: 'duplicate_exercise_answer' }, { status: 400 });
    }
    seenIds.add(answer.exerciseId);
  }
  if (seenIds.size !== expectedIds.size) {
    return NextResponse.json({ error: 'missing_exercise_answer' }, { status: 400 });
  }
  // Client-reported and therefore untrusted: clamp to a bounded non-negative
  // integer (0..4h). It feeds daily-limit accounting and the NELC-reported
  // duration — raw client input must not be able to distort either.
  const timeSpentSeconds =
    typeof b.timeSpentSeconds === 'number' && Number.isFinite(b.timeSpentSeconds)
      ? Math.min(Math.max(Math.round(b.timeSpentSeconds), 0), 4 * 3600)
      : 0;

  // Server-authoritative grading (correctAnswer never leaves the server)
  const { score, perAnswer } = gradeAnswers(lesson.exercises, answers);
  const now = new Date();
  const today = riyadhDateKey(now);

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
      `SELECT * FROM ye_lrn_children WHERE id = $1 FOR UPDATE`,
      child.id,
    );
    if (!lockedChild) throw new Error('child_disappeared');

    // 2. Enforce daily time limit inside the lock (server-trusted durations).
    //    This re-evaluation inside the transaction is what prevents concurrent
    //    requests from all observing pre-lock usage below the limit and each
    //    inserting a completion that pushes total over the limit.
    const priorClaim = await tx.lrnFirstCompletion.findUnique({
      where: { childId_lessonId: { childId: child.id, lessonId } },
      select: { id: true },
    });
    if (!priorClaim && lockedChild.dailyLimitMinutes !== null) {
      const todayCompletions = await tx.lrnFirstCompletion.findMany({
        where: { childId: lockedChild.id, claimedAt: { gte: riyadhDayStart(now) } },
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
    const { streak, totalXp, newBadges } = computeReward(lockedChild, totalDistinct, score, now);

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

  // NELC production reporting — FIRST completions only. The ENQUEUE is
  // awaited (a fast local tx — once the child sees success, the statement is
  // durably queued even if autoscale kills the instance right after), while
  // DELIVERY is fire-and-forget. Both swallow their own errors and are no-ops
  // outside the published deployment or for children without a national ID —
  // the child's lesson can never break because of NELC.
  if (txResult.isFirst) {
    const queued = await enqueueCompletionEvents({
      childId: child.id,
      lessonId,
      score,
      timeSpentSeconds,
    });
    if (queued > 0) void flushOutboxServer();
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
