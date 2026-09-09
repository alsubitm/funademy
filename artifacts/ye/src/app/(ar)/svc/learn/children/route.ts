import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { hashPin, familyHasActiveEnrollment } from '@/lib/kid-auth';
import { NATIONAL_ID_RE, serializeChild } from '@/lib/learning';

export const dynamic = 'force-dynamic';

/** GET /svc/learn/children — list kid profiles for the authenticated family */
export async function GET() {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const enrolled = await familyHasActiveEnrollment(familyId);
  if (!enrolled) return NextResponse.json({ error: 'no_active_enrollment' }, { status: 403 });

  const children = await prisma.lrnChild.findMany({
    where: { familyId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(children.map(serializeChild));
}

/** POST /svc/learn/children — create a kid profile */
export async function POST(req: NextRequest) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const enrolled = await familyHasActiveEnrollment(familyId);
  if (!enrolled) return NextResponse.json({ error: 'no_active_enrollment' }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { name, avatar, band, pin, dailyLimitMinutes, nationalId } = body as Record<string, unknown>;
  if (!name || typeof name !== 'string' || name.trim().length === 0)
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  if (typeof pin !== 'string' || !/^\d{4,}$/.test(pin.trim()))
    return NextResponse.json({ error: 'invalid_pin' }, { status: 400 });
  const validBands = ['explorers', 'builders', 'achievers', 'graduates'];
  const resolvedBand = typeof band === 'string' && validBands.includes(band) ? band : 'explorers';

  // Optional child national ID (NELC learning-record identity).
  let resolvedNationalId: string | null = null;
  if (nationalId !== undefined && nationalId !== null && String(nationalId).trim() !== '') {
    const v = String(nationalId).trim();
    if (!NATIONAL_ID_RE.test(v))
      return NextResponse.json({ error: 'invalid_national_id' }, { status: 400 });
    resolvedNationalId = v;
  }

  const pinHash = await hashPin(pin.trim());

  try {
    const child = await prisma.lrnChild.create({
      data: {
        familyId,
        name: name.trim(),
        avatar: typeof avatar === 'string' && avatar ? avatar : '⭐',
        band: resolvedBand as 'explorers' | 'builders' | 'achievers' | 'graduates',
        pin: pinHash,
        dailyLimitMinutes: typeof dailyLimitMinutes === 'number' && dailyLimitMinutes > 0 ? dailyLimitMinutes : null,
        nationalId: resolvedNationalId,
      },
    });
    return NextResponse.json(serializeChild(child), { status: 201 });
  } catch (e) {
    // Unique national ID — one learner identity per child, across all families.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'national_id_taken' }, { status: 409 });
    }
    throw e;
  }
}
