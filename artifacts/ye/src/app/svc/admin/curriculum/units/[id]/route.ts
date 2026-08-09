import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const unitId = Number(id);
  if (!unitId) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const b = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof b.titleAr === 'string') data.titleAr = b.titleAr;
  if (typeof b.titleEn === 'string') data.titleEn = b.titleEn;
  const validBands = ['explorers', 'builders', 'achievers', 'graduates'];
  if (typeof b.band === 'string' && validBands.includes(b.band)) data.band = b.band;
  if (b.status === 'draft' || b.status === 'published') data.status = b.status;
  if (typeof b.position === 'number') data.position = b.position;

  const updated = await prisma.lrnUnit.update({ where: { id: unitId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const unitId = Number(id);
  if (!unitId) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await prisma.lrnUnit.delete({ where: { id: unitId } });
  return NextResponse.json({ ok: true });
}
