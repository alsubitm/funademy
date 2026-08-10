import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const lessonId = Number(id);
  if (!lessonId) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const b = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof b.titleAr === 'string') data.titleAr = b.titleAr;
  if (typeof b.titleEn === 'string') data.titleEn = b.titleEn;
  if (typeof b.descAr === 'string') data.descAr = b.descAr;
  if (typeof b.descEn === 'string') data.descEn = b.descEn;
  if (typeof b.videoUrl === 'string') data.videoUrl = b.videoUrl || null;
  if (['youtube', 'vimeo', 'mp4'].includes(String(b.videoType))) data.videoType = b.videoType;
  if (typeof b.durationMinutes === 'number') data.durationMinutes = b.durationMinutes;
  if (b.status === 'draft' || b.status === 'published') data.status = b.status;
  if (typeof b.isFreeSample === 'boolean') data.isFreeSample = b.isFreeSample;
  if (typeof b.position === 'number') data.position = b.position;

  const updated = await prisma.lrnLesson.update({ where: { id: lessonId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const lessonId = Number(id);
  if (!lessonId) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await prisma.lrnLesson.delete({ where: { id: lessonId } });
  return NextResponse.json({ ok: true });
}
