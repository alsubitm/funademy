export interface SubmittedAnswer {
  exerciseId: number;
  answer: string;
}

export interface AnswerKeyEntry {
  id: number;
  correctAnswer: string;
}

/**
 * Grade submitted answers server-side against the stored answer key.
 * - Client-reported correctness is never trusted (not even accepted).
 * - Duplicate submissions for the same exercise are ignored (first wins).
 * - Answers for exercises not in this lesson are ignored.
 * - The score is computed over ALL of the lesson's exercises, so omitting
 *   hard questions cannot inflate the score.
 * - A lesson with no exercises scores 100 (video-only lesson).
 */
export function gradeAnswers(
  answers: SubmittedAnswer[],
  exercises: AnswerKeyEntry[],
): { score: number; correctCount: number } {
  const answerKey = new Map(exercises.map((e) => [e.id, e.correctAnswer]));
  const gradedIds = new Set<number>();
  let correctCount = 0;
  for (const a of answers) {
    if (gradedIds.has(a.exerciseId)) continue;
    const expected = answerKey.get(a.exerciseId);
    if (expected === undefined) continue;
    gradedIds.add(a.exerciseId);
    if (a.answer.trim() === expected.trim()) correctCount += 1;
  }
  const score =
    exercises.length === 0
      ? 100
      : Math.round((correctCount / exercises.length) * 100);
  return { score, correctCount };
}
