import type { PrismaClient } from '@prisma/client';
import { explorerExercises, builderExercises } from './seeded-learning-exercises';

/**
 * Idempotent data upgrade for pre-localization starter content. Exact prompt,
 * option ordering and answer-key matching protects edited/custom exercises.
 * Existing authored translations are never replaced.
 */
export async function backfillEnglishLearningOptions(prisma: PrismaClient, lessonId?: number) {
  let updated = 0;
  for (const exercise of [...explorerExercises(0), ...builderExercises()]) {
    if (!exercise.optionsEn) continue;
    const result = await prisma.lrnExercise.updateMany({
      where: {
        ...(lessonId ? { lessonId } : {}),
        type: exercise.type,
        promptAr: exercise.promptAr,
        promptEn: exercise.promptEn,
        options: { equals: exercise.options },
        correctAnswer: exercise.correctAnswer,
        optionsEn: { isEmpty: true },
      },
      data: { optionsEn: exercise.optionsEn },
    });
    updated += result.count;
  }
  return updated;
}
