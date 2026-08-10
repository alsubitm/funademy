import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { hashPin } from '@/lib/kid-auth';
import { serializeChild } from '@/lib/learning';

export const dynamic = 'force-dynamic';

async function getOwnedChild(familyId: number, childId: number) {
  return prisma.lrnChild.findFirst({ where: { id: childId, familyId } });
}

/** PATCH /svc/learn/children/:id — update a kid profile */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const childId = Number(id);
  if (!childId) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const child = await getOwnedChild(familyId, childId);
  if (!child) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const b = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (typeof b.name === 'string' && b.name.trim()) data.name = b.name.trim();
  if (typeof b.avatar === 'string' && b.avatar) data.avatar = b.avatar;
  const validBands = ['explorers', 'builders', 'achievers', 'graduates'];
  if (typeof b.band === 'string' && validBands.includes(b.band)) data.band = b.band;
  if (typeof b.pin === 'string' && b.pin.trim().length >= 4) data.pin = await hashPin(b.pin.trim());
  if (typeof b.dailyLimitMinutes === 'number') data.dailyLimitMinutes = b.dailyLimitMinutes > 0 ? b.dailyLimitMinutes : null;

  const updated = await prisma.lrnChild.update({ where: { id: childId }, data });
  return NextResponse.json(serializeChild(updated));
}

/** DELETE /svc/learn/children/:id — delete a kid profile */
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const childId = Number(id);
  if (!childId) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const child = await getOwnedChild(familyId, childId);
  if (!child) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.lrnChild.delete({ where: { id: childId } });
  return NextResponse.json({ ok: true });
}
