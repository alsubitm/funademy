import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { parseNationalId } from '@/lib/learning';

export const dynamic = 'force-dynamic';

const MAX_CHILDREN = 10;

function validChild(b: Record<string, unknown>) {
  const firstName = String(b.firstName ?? '').trim();
  const birthYear = Number(b.birthYear);
  const currentYear = new Date().getFullYear();
  if (!firstName || firstName.length > 40) return null;
  if (!(birthYear >= currentYear - 19 && birthYear <= currentYear - 3)) return null;
  return { firstName, birthYear };
}

export async function POST(req: NextRequest) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const data = validChild(body);
  if (!data) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const nationalId = parseNationalId(body.nationalId);
  if (nationalId === 'invalid') return NextResponse.json({ error: 'invalid_national_id' }, { status: 400 });

  const count = await prisma.student.count({ where: { familyId } });
  if (count >= MAX_CHILDREN) return NextResponse.json({ error: 'limit_reached' }, { status: 409 });

  try {
    const student = await prisma.student.create({ data: { ...data, familyId, nationalId } });
    return NextResponse.json(
      { id: student.id, firstName: student.firstName, birthYear: student.birthYear, nationalId: student.nationalId },
      { status: 201 },
    );
  } catch (e) {
    // Unique national ID — one learner identity per child, across all families.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'national_id_taken' }, { status: 409 });
    }
    throw e;
  }
}
