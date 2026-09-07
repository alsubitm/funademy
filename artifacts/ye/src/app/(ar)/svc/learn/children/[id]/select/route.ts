import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import {
  verifyPin,
  kidToken,
  KID_COOKIE,
  KID_COOKIE_OPTIONS,
  familyHasActiveEnrollment,
} from '@/lib/kid-auth';
import { serializeChild } from '@/lib/learning';
import { allowRate } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const enrolled = await familyHasActiveEnrollment(familyId);
  if (!enrolled) return NextResponse.json({ error: 'no_active_enrollment' }, { status: 403 });

  const { id } = await params;
  const childId = Number(id);
  if (!childId) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const child = await prisma.lrnChild.findFirst({ where: { id: childId, familyId } });
  if (!child) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const { pin } = body as { pin?: string };
  if (typeof pin !== 'string' || !/^\d{4,}$/.test(pin.trim()))
    return NextResponse.json({ error: 'invalid_pin' }, { status: 400 });

  const allowed = await allowRate(`kid-pin:${familyId}:${childId}`, 10, 15 * 60_000);
  if (!allowed) return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 });

  const ok = await verifyPin(pin.trim(), child.pin);
  if (!ok) return NextResponse.json({ error: 'wrong_pin' }, { status: 401 });

  // If legacy plaintext — upgrade silently (would need a write, skip for now unless wrong)
  const store = await cookies();
  store.set(KID_COOKIE, kidToken(familyId, childId), KID_COOKIE_OPTIONS);

  return NextResponse.json({ ok: true, child: serializeChild(child) });
}
