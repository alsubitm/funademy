import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminRequest } from '@/lib/auth';
import { parseLessonMedia } from '@/lib/learning-readiness';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const b = body as Record<string, unknown>;
  if (!b || Array.isArray(b) || typeof b !== 'object') return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  let media;
  try { media = parseLessonMedia(b); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  if (!b.unitId || !b.titleAr || !b.titleEn)
    return NextResponse.json({ error: 'unitId, titleAr, titleEn required' }, { status: 400 });

  const maxPos = await prisma.lrnLesson.aggregate({
    where: { unitId: Number(b.unitId) },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? 0) + 1;

  const lesson = await prisma.lrnLesson.create({
    data: {
      ...media,
      unitId: Number(b.unitId),
      titleAr: String(b.titleAr),
      titleEn: String(b.titleEn),
      descAr: typeof b.descAr === 'string' ? b.descAr : null,
      descEn: typeof b.descEn === 'string' ? b.descEn : null,
      videoUrl: typeof b.videoUrl === 'string' ? b.videoUrl : null,
      videoType: ['youtube', 'vimeo', 'mp4'].includes(String(b.videoType)) ? b.videoType as 'youtube' | 'vimeo' | 'mp4' : 'youtube',
      durationMinutes: typeof b.durationMinutes === 'number' ? b.durationMinutes : 8,
      position,
      status: b.status === 'draft' ? 'draft' : 'published',
      isFreeSample: b.isFreeSample === true,
    },
  });
  return NextResponse.json(lesson, { status: 201 });
}
