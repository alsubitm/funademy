import { NextResponse } from 'next/server';
import { isTransientDatabaseError, prisma, withDbRetry } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let family;
  try {
    family = await withDbRetry(
      () => prisma.family.findUnique({
        where: { id: familyId },
        include: { students: { orderBy: { birthYear: 'desc' } } },
      }),
      { operation: 'account-me', kind: 'read' },
    );
  } catch (error) {
    if (!isTransientDatabaseError(error)) throw error;
    return NextResponse.json({ error: 'temporarily_unavailable' }, { status: 503 });
  }
  if (!family) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return NextResponse.json({
    id: family.id,
    phone: family.phone,
    parentName: family.parentName,
    locale: family.locale,
    students: family.students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      birthYear: s.birthYear,
      nationalId: s.nationalId,
    })),
  });
}
