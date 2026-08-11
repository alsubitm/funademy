import type { LrnChild } from '@prisma/client';

export const XP_PER_LESSON = 50;

export interface BadgeRule {
  key: string;
  test: (ctx: { total: number; streak: number; perfect: boolean }) => boolean;
}

export const BADGE_RULES: BadgeRule[] = [
  { key: 'first_lesson', test: ({ total }) => total >= 1 },
  { key: 'five_lessons', test: ({ total }) => total >= 5 },
  { key: 'ten_lessons', test: ({ total }) => total >= 10 },
  { key: 'streak_3', test: ({ streak }) => streak >= 3 },
  { key: 'streak_7', test: ({ streak }) => streak >= 7 },
  { key: 'perfect_score', test: ({ perfect }) => perfect },
];

export const BADGE_ICONS: Record<string, string> = {
  first_lesson: '⭐',
  five_lessons: '🔥',
  ten_lessons: '🏆',
  streak_3: '⚡',
  streak_7: '💎',
  perfect_score: '🎯',
};

export const BAND_LABELS: Record<string, string> = {
  explorers: 'المستكشفون',
  builders: 'الصانعون',
  achievers: 'المتفوقون',
  graduates: 'الخريجون',
};

/** Compute new streak, XP, and badges for a just-completed lesson */
export function computeReward(
  child: LrnChild,
  totalDistinctCompleted: number,
  score: number,
): { streak: number; totalXp: number; newBadges: string[] } {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  let streak = child.streak;
  if (child.lastActiveDate === today) {
    // already counted today — no change
  } else if (child.lastActiveDate === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }

  const ctx = {
    total: totalDistinctCompleted,
    streak,
    perfect: score === 100,
  };

  const newBadges = BADGE_RULES.filter(
    (b) => b.test(ctx) && !child.badges.includes(b.key),
  ).map((b) => b.key);

  return { streak, totalXp: child.xp + XP_PER_LESSON, newBadges };
}

/** Strip PIN before sending to client */
export function serializeChild(child: LrnChild) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pin, ...rest } = child;
  return rest;
}

export interface GradeResult {
  score: number; // 0-100
  perAnswer: Array<{ exerciseId: number; correct: boolean }>;
}

/** Grade a set of submitted answers against server-authoritative correct answers.
 *  Returns overall score and per-exercise correctness. Correct answers MUST
 *  never be sent to the client browser — only this server-side result is shared. */
/** Saudi national ID / iqama: 10 digits starting with 1 or 2 (NELC learner identity). */
export const NATIONAL_ID_RE = /^[12]\d{9}$/;

/**
 * Parse an optional national ID input: null when absent/blank, the trimmed
 * value when valid, or 'invalid' when malformed.
 */
export function parseNationalId(raw: unknown): string | null | 'invalid' {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const v = String(raw).trim();
  return NATIONAL_ID_RE.test(v) ? v : 'invalid';
}

export function gradeAnswers(
  exercises: Array<{ id: number; correctAnswer: string }>,
  answers: Array<{ exerciseId: number; answer: string }>,
): GradeResult {
  if (exercises.length === 0) return { score: 100, perAnswer: [] };
  const answerMap = new Map(answers.map((a) => [a.exerciseId, a.answer]));
  const perAnswer = exercises.map((e) => ({
    exerciseId: e.id,
    correct: answerMap.get(e.id)?.trim() === e.correctAnswer.trim(),
  }));
  const correctCount = perAnswer.filter((a) => a.correct).length;
  return { score: Math.round((correctCount / exercises.length) * 100), perAnswer };
}
