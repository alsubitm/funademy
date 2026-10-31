import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const subjectId = Number(req.nextUrl.searchParams.get('subjectId'));
  if (!subjectId) return NextResponse.json({ error: 'subjectId required' }, { status: 400 });

  const units = await prisma.lrnUnit.findMany({
    where: { subjectId },
    orderBy: { position: 'asc' },
    include: {
      lessons: {
        orderBy: { position: 'asc' },
        include: { exercises: { select: { promptEn: true, options: true, optionsEn: true } } },
      },
    },
  });
  return NextResponse.json(units);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const b = body as Record<string, unknown>;
  if (!b.subjectId || !b.titleAr || !b.titleEn || !b.band)
    return NextResponse.json({ error: 'subjectId, titleAr, titleEn, band required' }, { status: 400 });

  const maxPos = await prisma.lrnUnit.aggregate({
    where: { subjectId: Number(b.subjectId) },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? 0) + 1;

  const validBands = ['explorers', 'builders', 'achievers', 'graduates'];
  if (!validBands.includes(String(b.band)))
    return NextResponse.json({ error: 'invalid band' }, { status: 400 });

  const unit = await prisma.lrnUnit.create({
    data: {
      subjectId: Number(b.subjectId),
      titleAr: String(b.titleAr),
      titleEn: String(b.titleEn),
      band: b.band as 'explorers' | 'builders' | 'achievers' | 'graduates',
      position,
      status: b.status === 'draft' ? 'draft' : 'published',
    },
  });
  return NextResponse.json(unit, { status: 201 });
}
