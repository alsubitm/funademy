import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const lessonId = Number(id);
  if (!lessonId) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const exercises = await prisma.lrnExercise.findMany({
    where: { lessonId },
    orderBy: { position: 'asc' },
  });
  return NextResponse.json(exercises);
}

/** POST body: { exercises: [...], replace?: boolean }
 *  Each exercise: { type, promptAr, promptEn, options: string[], correctAnswer }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const lessonId = Number(id);
  if (!lessonId) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const lesson = await prisma.lrnLesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const b = body as { exercises?: unknown[]; replace?: boolean };
  if (!Array.isArray(b.exercises)) return NextResponse.json({ error: 'exercises array required' }, { status: 400 });

  const validTypes = ['multiple_choice', 'matching', 'fill_blank', 'picture_select'];
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const toCreate: Array<{
    lessonId: number; type: 'multiple_choice' | 'matching' | 'fill_blank' | 'picture_select';
    promptAr: string; promptEn: string; options: string[]; correctAnswer: string; position: number;
  }> = [];

  b.exercises.forEach((ex, i) => {
    const e = ex as Record<string, unknown>;
    if (!e.promptAr || !e.promptEn || !e.correctAnswer) {
      errors.push(`Row ${i + 1}: promptAr, promptEn, correctAnswer required`);
      skipped++;
      return;
    }
    const type = validTypes.includes(String(e.type)) ? String(e.type) : 'multiple_choice';
    const options = Array.isArray(e.options) ? e.options.map(String) : [];
    toCreate.push({
      lessonId,
      type: type as 'multiple_choice' | 'matching' | 'fill_blank' | 'picture_select',
      promptAr: String(e.promptAr),
      promptEn: String(e.promptEn),
      options,
      correctAnswer: String(e.correctAnswer),
      position: i,
    });
    imported++;
  });

  if (b.replace) {
    await prisma.lrnExercise.deleteMany({ where: { lessonId } });
  }

  if (toCreate.length > 0) {
    await prisma.lrnExercise.createMany({ data: toCreate });
  }

  return NextResponse.json({ imported, skipped, errors });
}
