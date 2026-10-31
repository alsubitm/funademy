import { NextRequest, NextResponse } from 'next/server';
import { requireLessonAccess } from '@/lib/lesson-guard';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lessonId = Number(id);
  if (!lessonId) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const guard = await requireLessonAccess(lessonId);
  if (!guard.ok) return guard.response;

  const { child, lesson } = guard;

  // Check if this child already completed this lesson
  const { prisma } = await import('@/lib/db');
  // Read-time repair also upgrades existing published databases after the
  // additive schema sync, without requiring a broad curriculum re-seed.
  if (lesson.exercises.some(e => !e.optionsEn.length && e.options.some(option => /[\u0600-\u06ff]/.test(option)))) {
    const { backfillEnglishLearningOptions } = await import('@/lib/backfill-learning-options');
    await backfillEnglishLearningOptions(prisma, lessonId);
    // Always re-read: another request may have won the conditional update.
    const labels = await prisma.lrnExercise.findMany({
      where: { lessonId }, select: { id: true, optionsEn: true },
    });
    for (const exercise of lesson.exercises) {
      exercise.optionsEn = labels.find(label => label.id === exercise.id)?.optionsEn ?? exercise.optionsEn;
    }
  }
  const completionCount = await prisma.lrnCompletion.count({
    where: { childId: child.id, lessonId },
  });

  return NextResponse.json({
    id: lesson.id,
    titleAr: lesson.titleAr,
    titleEn: lesson.titleEn,
    descAr: lesson.descAr,
    descEn: lesson.descEn,
    videoUrl: lesson.videoUrl,
    videoType: lesson.videoType,
    videoLanguage: lesson.videoLanguage,
    videoUrlEn: lesson.videoUrlEn,
    videoTypeEn: lesson.videoTypeEn,
    durationMinutes: lesson.durationMinutes,
    isFreeSample: lesson.isFreeSample,
    completed: completionCount > 0,
    subjectId: lesson.unit.subject.id,
    subjectNameAr: lesson.unit.subject.nameAr,
    subjectNameEn: lesson.unit.subject.nameEn,
    subjectColor: lesson.unit.subject.color,
    subjectSlug: lesson.unit.subject.slug,
    unitTitleAr: lesson.unit.titleAr,
    // correctAnswer is intentionally excluded — grading is server-side only
    exercises: lesson.exercises.map((e) => ({
      id: e.id,
      type: e.type,
      promptAr: e.promptAr,
      promptEn: e.promptEn,
      options: e.options,
      optionsEn: e.optionsEn,
    })),
  });
}
