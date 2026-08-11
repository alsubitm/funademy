import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { enqueueStudentIdSnapshot, flushOutboxServer } from '@/lib/xapiOutbox';
import { parseNationalId } from '@/lib/learning';

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

  // Optional national ID change — the child's NELC learner identity.
  let nationalId = student.nationalId;
  let idChanged = false;
  if (body.nationalId !== undefined) {
    const parsed = parseNationalId(body.nationalId);
    if (parsed === 'invalid') return NextResponse.json({ error: 'invalid_national_id' }, { status: 400 });
    if (parsed !== student.nationalId) {
      // Once statements were queued under this identity, it is immutable —
      // NELC's store is append-only, records cannot be moved to another ID.
      const hasStatements = student.nationalId
        ? Boolean(await prisma.xapiOutbox.findFirst({ where: { studentId: student.id }, select: { id: true } }))
        : false;
      if (hasStatements) return NextResponse.json({ error: 'national_id_locked' }, { status: 409 });
      nationalId = parsed;
      idChanged = true;
    }
  }

  try {
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: { firstName, birthYear, nationalId },
    });
    // ID newly added → backfill registered + attended for real past marks.
    if (idChanged && nationalId) {
      const queued = await enqueueStudentIdSnapshot({ studentId: student.id, nationalId });
      if (queued > 0) void flushOutboxServer();
    }
    return NextResponse.json({
      id: updated.id,
      firstName: updated.firstName,
      birthYear: updated.birthYear,
      nationalId: updated.nationalId,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'national_id_taken' }, { status: 409 });
    }
    throw e;
  }
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
