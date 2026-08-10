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
    durationMinutes: lesson.durationMinutes,
    isFreeSample: lesson.isFreeSample,
    completed: completionCount > 0,
    subjectId: lesson.unit.subject.id,
    subjectNameAr: lesson.unit.subject.nameAr,
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
    })),
  });
}
