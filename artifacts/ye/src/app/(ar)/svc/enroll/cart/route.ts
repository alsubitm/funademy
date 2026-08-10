import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { CART_COOKIE, CART_COOKIE_OPTIONS, encodeCart, priceCart, readCart } from '@/lib/cart';

export const dynamic = 'force-dynamic';

export async function GET() {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const items = await readCart(familyId);
  return NextResponse.json(await priceCart(familyId, items));
}

/** Add an item { studentId, courseRunId }. Server validates ownership + age. */
export async function POST(req: NextRequest) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const studentId = Number(body.studentId);
  const courseRunId = Number(body.courseRunId);
  if (!Number.isInteger(studentId) || !Number.isInteger(courseRunId)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const [student, run, existing] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, familyId } }),
    prisma.courseRun.findFirst({
      where: { id: courseRunId, active: true, endDate: { gte: new Date() } },
      include: { program: true },
    }),
    prisma.enrollment.findFirst({
      where: { studentId, courseRunId, status: { in: ['pending', 'active'] } },
    }),
  ]);
  if (!student) return NextResponse.json({ error: 'student_not_found' }, { status: 404 });
  if (!run) return NextResponse.json({ error: 'run_not_found' }, { status: 404 });
  if (run.seatsLeft <= 0) return NextResponse.json({ error: 'run_full' }, { status: 409 });
  if (existing) return NextResponse.json({ error: 'already_enrolled' }, { status: 409 });

  const age = new Date().getFullYear() - student.birthYear;
  if (age < run.program.ageMin || age > run.program.ageMax) {
    return NextResponse.json({ error: 'age_ineligible' }, { status: 409 });
  }

  const items = await readCart(familyId);
  if (items.some((i) => i.studentId === studentId && i.courseRunId === courseRunId)) {
    return NextResponse.json({ error: 'already_in_cart' }, { status: 409 });
  }
  if (items.some((i) => i.studentId === studentId && i.courseRunId !== courseRunId)) {
    // one run per child per checkout — keep the cart simple; replace instead
    return NextResponse.json({ error: 'child_already_in_cart' }, { status: 409 });
  }
  items.push({ studentId, courseRunId });

  const res = NextResponse.json(await priceCart(familyId, items), { status: 201 });
  res.cookies.set(CART_COOKIE, encodeCart(familyId, items), CART_COOKIE_OPTIONS);
  return res;
}

/** Remove an item (?studentId=&courseRunId=) or clear all (no params). */
export async function DELETE(req: NextRequest) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const studentId = Number(sp.get('studentId'));
  const courseRunId = Number(sp.get('courseRunId'));

  let items = await readCart(familyId);
  items = sp.has('studentId')
    ? items.filter((i) => !(i.studentId === studentId && i.courseRunId === courseRunId))
    : [];

  const res = NextResponse.json(await priceCart(familyId, items));
  res.cookies.set(CART_COOKIE, encodeCart(familyId, items), CART_COOKIE_OPTIONS);
  return res;
}
