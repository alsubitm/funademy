import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AttendanceError, saveAttendance } from '@/lib/attendance';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

const STATUSES = ['present', 'absent', 'late', 'excused'] as const;
type Status = (typeof STATUSES)[number];

/** GET ?sessionId= — session roster with current attendance statuses. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sessionId = Number(req.nextUrl.searchParams.get('sessionId'));
  if (!Number.isInteger(sessionId)) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [enrollments, makeups, marks] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseRunId: session.courseRunId, status: { in: ['active', 'paused'] } },
      include: { student: true },
      orderBy: { createdAt: 'asc' },
    }),
    // Children booked into this session as an approved makeup slot.
    prisma.makeupRequest.findMany({
      where: { makeupSessionId: sessionId, status: 'approved' },
      include: { student: true },
      orderBy: { decidedAt: 'asc' },
    }),
    prisma.attendance.findMany({ where: { sessionId } }),
  ]);
  const byStudent = new Map(marks.map((m) => [m.studentId, m.status]));

  const enrolledIds = new Set(enrollments.map((e) => e.student.id));
  const students = [
    ...enrollments.map((e) => ({
      id: e.student.id,
      firstName: e.student.firstName,
      birthYear: e.student.birthYear,
      nationalId: e.student.nationalId,
      makeup: false,
      status: byStudent.get(e.student.id) ?? null,
    })),
    ...makeups
      .filter((m) => !enrolledIds.has(m.student.id))
      .map((m) => ({
        id: m.student.id,
        firstName: m.student.firstName,
        birthYear: m.student.birthYear,
        nationalId: m.student.nationalId,
        makeup: true,
        status: byStudent.get(m.student.id) ?? null,
      })),
  ];

  return NextResponse.json({ session, students });
}

/** POST { sessionId, studentId, status } — upsert one mark (phone-friendly, one tap per child). */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const sessionId = Number(b?.sessionId);
  const studentId = Number(b?.studentId);
  const status = String(b?.status ?? '') as Status;
  if (!Number.isInteger(sessionId) || !Number.isInteger(studentId) || !STATUSES.includes(status)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  try {
    const mark = await saveAttendance({ sessionId, studentId, status });
    return NextResponse.json({ mark });
  } catch (e) {
    if (e instanceof AttendanceError) return NextResponse.json({ error: e.code }, { status: e.status });
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
}
