import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';

export const dynamic = 'force-dynamic';

async function ownedStudent(id: number, familyId: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const student = await prisma.student.findUnique({ where: { id } });
  return student && student.familyId === familyId ? student : null;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const student = await ownedStudent(Number(id), familyId);
  if (!student) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const firstName = body.firstName !== undefined ? String(body.firstName).trim() : student.firstName;
  const birthYear = body.birthYear !== undefined ? Number(body.birthYear) : student.birthYear;
  const currentYear = new Date().getFullYear();
  if (!firstName || firstName.length > 40 || !(birthYear >= currentYear - 19 && birthYear <= currentYear - 3)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const updated = await prisma.student.update({ where: { id: student.id }, data: { firstName, birthYear } });
  return NextResponse.json({ id: updated.id, firstName: updated.firstName, birthYear: updated.birthYear });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const student = await ownedStudent(Number(id), familyId);
  if (!student) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const activeEnrollments = await prisma.enrollment.count({
    where: { studentId: student.id, status: { in: ['pending', 'active'] } },
  });
  if (activeEnrollments > 0) return NextResponse.json({ error: 'has_enrollments' }, { status: 409 });

  await prisma.student.delete({ where: { id: student.id } });
  return NextResponse.json({ ok: true });
}
