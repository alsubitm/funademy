import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { familyHasActiveEnrollment, hashPin } from '@/lib/kid-auth';
import { NATIONAL_ID_RE, serializeChild } from '@/lib/learning';
import { enqueueIdSetSnapshot, flushOutboxServer } from '@/lib/xapiOutbox';

export const dynamic = 'force-dynamic';

async function getOwnedChild(familyId: number, childId: number) {
  return prisma.lrnChild.findFirst({ where: { id: childId, familyId } });
}

/** PATCH /svc/learn/children/:id — update a kid profile */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await familyHasActiveEnrollment(familyId))) {
    return NextResponse.json({ error: 'no_active_enrollment' }, { status: 403 });
  }

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
  if ('pin' in b) {
    if (typeof b.pin !== 'string' || !/^\d{4,}$/.test(b.pin.trim())) {
      return NextResponse.json({ error: 'invalid_pin' }, { status: 400 });
    }
    data.pin = await hashPin(b.pin.trim());
  }
  if (typeof b.dailyLimitMinutes === 'number') data.dailyLimitMinutes = b.dailyLimitMinutes > 0 ? b.dailyLimitMinutes : null;

  // Child national ID (NELC learning-record identity): set / change / clear.
  if ('nationalId' in b) {
    const v = b.nationalId === null ? '' : String(b.nationalId).trim();
    const next = v === '' ? null : v;
    if (next !== null && !NATIONAL_ID_RE.test(next)) {
      return NextResponse.json({ error: 'invalid_national_id' }, { status: 400 });
    }
    if (next !== child.nationalId) {
      // Once statements were queued/sent under an identity, changing it would
      // split the learner across two identities in NELC's permanent store.
      if (child.nationalId !== null) {
        const used = await prisma.xapiOutbox.findFirst({
          where: { childId: child.id },
          select: { id: true },
        });
        if (used) return NextResponse.json({ error: 'national_id_locked' }, { status: 409 });
      }
      data.nationalId = next;
    }
  }

  let updated;
  try {
    updated = await prisma.lrnChild.update({ where: { id: childId }, data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'national_id_taken' }, { status: 409 });
    }
    throw e;
  }

  // ID newly set → queue the NELC registration + current-progress snapshot.
  // Enqueue is awaited (fast local tx, durable once the parent sees success);
  // delivery is fire-and-forget. Never throws — a snapshot problem must not
  // fail the profile update.
  if (typeof data.nationalId === 'string') {
    const queued = await enqueueIdSetSnapshot({ childId, nationalId: data.nationalId });
    if (queued > 0) void flushOutboxServer();
  }

  return NextResponse.json(serializeChild(updated));
}

/** DELETE /svc/learn/children/:id — delete a kid profile */
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await familyHasActiveEnrollment(familyId))) {
    return NextResponse.json({ error: 'no_active_enrollment' }, { status: 403 });
  }

  const { id } = await params;
  const childId = Number(id);
  if (!childId) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const child = await getOwnedChild(familyId, childId);
  if (!child) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.lrnChild.delete({ where: { id: childId } });
  return NextResponse.json({ ok: true });
}
