import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const subjectId = Number(id);
  if (!subjectId) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const b = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof b.nameAr === 'string') data.nameAr = b.nameAr;
  if (typeof b.nameEn === 'string') data.nameEn = b.nameEn;
  if (typeof b.slug === 'string') data.slug = b.slug.toLowerCase().replace(/\s+/g, '-');
  if (typeof b.icon === 'string') data.icon = b.icon;
  if (typeof b.color === 'string') data.color = b.color;
  if (typeof b.position === 'number') data.position = b.position;

  const updated = await prisma.lrnSubject.update({ where: { id: subjectId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const subjectId = Number(id);
  if (!subjectId) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await prisma.lrnSubject.delete({ where: { id: subjectId } });
  return NextResponse.json({ ok: true });
}
