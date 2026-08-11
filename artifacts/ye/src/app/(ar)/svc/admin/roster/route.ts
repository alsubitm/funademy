import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { parseNationalId } from '@/lib/learning';
import { enqueueStudentIdSnapshot, flushOutboxServer, lockStudentRow } from '@/lib/xapiOutbox';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

/** GET ?runId= — enrolled students for a run, with sessions list. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const runId = Number(req.nextUrl.searchParams.get('runId'));
  if (!Number.isInteger(runId)) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const [enrollments, sessions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseRunId: runId, status: { in: ['active', 'pending', 'paused'] } },
      include: { student: { include: { family: { select: { parentName: true, phone: true } } } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.classSession.findMany({ where: { courseRunId: runId }, orderBy: { date: 'asc' } }),
  ]);

  return NextResponse.json({
    roster: enrollments.map((e) => ({
      enrollmentId: e.id,
      status: e.status,
      monthlyPriceSar: e.monthlyPriceSar,
      discountPct: e.discountPct,
      student: {
        id: e.student.id,
        firstName: e.student.firstName,
        birthYear: e.student.birthYear,
        parentName: e.student.family.parentName,
        phone: e.student.family.phone,
        nationalId: e.student.nationalId,
      },
    })),
    sessions,
  });
}

/**
 * PATCH { studentId, nationalId } — admin sets/corrects a child's national ID
 * (NELC learner identity). Same rules as the parent portal: format check,
 * uniqueness, and immutability once statements were queued under the current
 * ID. Adding an ID backfills past attendance via enqueueStudentIdSnapshot.
 */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const studentId = Number(b?.studentId);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  const parsed = parseNationalId(b?.nationalId);
  if (parsed === 'invalid') return NextResponse.json({ error: 'invalid_national_id' }, { status: 400 });

  try {
    // The check + update run in ONE transaction holding the same per-student
    // row lock the attendance enqueue takes: a concurrent enqueue either
    // commits its old-ID statement first (then the lock check below rejects
    // the change) or waits and reads the new ID. No interleaving can queue a
    // statement under an identity that is being replaced.
    const outcome = await prisma.$transaction(async (tx) => {
      await lockStudentRow(tx, studentId);
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) return { error: 'not_found' as const, status: 404 };
      if (parsed === student.nationalId) {
        return { student: { id: student.id, nationalId: student.nationalId }, changed: false };
      }
      // Once statements were queued under this identity, it is immutable —
      // NELC's store is append-only, records cannot be moved to another ID.
      const hasStatements = student.nationalId
        ? Boolean(await tx.xapiOutbox.findFirst({ where: { studentId: student.id }, select: { id: true } }))
        : false;
      if (hasStatements) return { error: 'national_id_locked' as const, status: 409 };

      const updated = await tx.student.update({
        where: { id: student.id },
        data: { nationalId: parsed },
      });
      return { student: { id: updated.id, nationalId: updated.nationalId }, changed: true };
    });

    if ('error' in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    // ID newly added → backfill registered + attended for real past marks.
    // enqueueStudentIdSnapshot re-takes the same row lock, so it serializes
    // after any attendance enqueue and dedupes per session IRI.
    if (outcome.changed && outcome.student.nationalId) {
      const queued = await enqueueStudentIdSnapshot({
        studentId: outcome.student.id,
        nationalId: outcome.student.nationalId,
      });
      if (queued > 0) void flushOutboxServer();
    }
    return NextResponse.json({ student: outcome.student });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'national_id_taken' }, { status: 409 });
    }
    throw e;
  }
}
