import type { Prisma, AttendanceStatus } from '@prisma/client';
import { prisma } from './db';
import { enqueueAttendanceEvents, flushOutboxServer } from './xapiOutbox';

export const attendanceStatuses = ['present', 'absent', 'late', 'excused'] as const;
export class AttendanceError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
type Teacher = { id: number; authVersion: number };

export async function attendanceSession(tx: Prisma.TransactionClient, sessionId: number, teacher?: Teacher) {
  // Lock the account before its assignments, matching administrator account edits.
  if (teacher) {
    const accounts = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM ye_instructors WHERE id = ${teacher.id} AND active = true AND "authVersion" = ${teacher.authVersion} FOR SHARE`;
    if (!accounts.length) throw new AttendanceError('unauthorized', 401);
  }
  await tx.$queryRaw`SELECT id FROM ye_class_sessions WHERE id = ${sessionId} FOR UPDATE`;
  const session = await tx.classSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AttendanceError(teacher ? 'forbidden' : 'session_not_found', teacher ? 403 : 404);
  if (teacher) {
    const assignments = await tx.$queryRaw<{ instructorId: number }[]>`SELECT "instructorId" FROM ye_instructor_assignments WHERE "instructorId" = ${teacher.id} AND "courseRunId" = ${session.courseRunId} FOR SHARE`;
    if (!assignments.length) throw new AttendanceError('forbidden', 403);
  }
  return session;
}

export async function attendanceRoster(tx: Prisma.TransactionClient, sessionId: number, courseRunId: number) {
  const select = { id: true, firstName: true, birthYear: true } as const;
  const enrolled = await tx.enrollment.findMany({
    where: { courseRunId, status: { in: ['active', 'paused'] } }, select: { student: { select } },
  });
  const makeups = await tx.makeupRequest.findMany({
    where: { makeupSessionId: sessionId, status: 'approved' }, select: { student: { select } },
  });
  const marks = await tx.attendance.findMany({ where: { sessionId } });
  const students = new Map(enrolled.map(e => [e.student.id, { ...e.student, makeup: false }]));
  for (const m of makeups) if (!students.has(m.student.id)) students.set(m.student.id, { ...m.student, makeup: true });
  return [...students.values()].map(student => {
    const mark = marks.find(m => m.studentId === student.id);
    return { ...student, status: mark?.status ?? null, version: mark?.markedAt.toISOString() ?? null };
  });
}

export async function saveAttendance(input: {
  sessionId: number; studentId: number; status: AttendanceStatus;
  expectedVersion?: string | null; teacher?: Teacher;
}) {
  const { sessionId, studentId, status, teacher } = input;
  const mark = await prisma.$transaction(async tx => {
    const session = await attendanceSession(tx, sessionId, teacher);
    const roster = await attendanceRoster(tx, sessionId, session.courseRunId);
    if (!roster.some(s => s.id === studentId)) throw new AttendanceError('not_enrolled', 409);
    const previous = await tx.attendance.findUnique({ where: { sessionId_studentId: { sessionId, studentId } } });
    if (input.expectedVersion !== undefined && input.expectedVersion !== (previous?.markedAt.toISOString() ?? null)) {
      throw new AttendanceError('attendance_conflict', 409);
    }
    // Monotonic even for two writes in the same millisecond.
    const markedAt = new Date(Math.max(Date.now(), (previous?.markedAt.getTime() ?? 0) + 1));
    return tx.attendance.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      update: { status, markedAt }, create: { sessionId, studentId, status, markedAt },
    });
  });
  if (status === 'present' || status === 'late') {
    const queued = await enqueueAttendanceEvents({ studentId, sessionId });
    if (queued > 0) void flushOutboxServer();
  }
  return mark;
}
