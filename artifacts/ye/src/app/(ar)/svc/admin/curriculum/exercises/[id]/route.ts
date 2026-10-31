import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminRequest } from '@/lib/auth';
import { validEnglishOptions } from '@/lib/learning-options';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const exId = Number(id);
  if (!exId) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const b = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const validTypes = ['multiple_choice', 'matching', 'fill_blank', 'picture_select'];
  if (typeof b.type === 'string' && validTypes.includes(b.type)) data.type = b.type;
  if (typeof b.promptAr === 'string') data.promptAr = b.promptAr;
  if (typeof b.promptEn === 'string') data.promptEn = b.promptEn;
  if (Array.isArray(b.options)) data.options = b.options.map(String);
  if ('options' in b || 'optionsEn' in b) {
    const current = await prisma.lrnExercise.findUnique({ where: { id: exId } });
    if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const options = Array.isArray(b.options) ? b.options.map(String) : current.options;
    const optionsEn = b.optionsEn ?? (Array.isArray(b.options) ? [] : current.optionsEn);
    if (!validEnglishOptions(optionsEn, options)) {
      return NextResponse.json({ error: 'optionsEn must be empty or match options in order and length' }, { status: 400 });
    }
    data.optionsEn = optionsEn;
  }
  if (typeof b.correctAnswer === 'string') data.correctAnswer = b.correctAnswer;
  if (typeof b.position === 'number') data.position = b.position;

  const updated = await prisma.lrnExercise.update({ where: { id: exId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const exId = Number(id);
  if (!exId) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await prisma.lrnExercise.delete({ where: { id: exId } });
  return NextResponse.json({ ok: true });
}
