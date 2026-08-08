import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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

  const [enrollments, marks] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseRunId: session.courseRunId, status: { in: ['active', 'paused'] } },
      include: { student: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.attendance.findMany({ where: { sessionId } }),
  ]);
  const byStudent = new Map(marks.map((m) => [m.studentId, m.status]));

  return NextResponse.json({
    session,
    students: enrollments.map((e) => ({
      id: e.student.id,
      firstName: e.student.firstName,
      birthYear: e.student.birthYear,
      status: byStudent.get(e.student.id) ?? null,
    })),
  });
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

  const session = await prisma.classSession.findUnique({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  const enrolled = await prisma.enrollment.findFirst({
    where: { studentId, courseRunId: session.courseRunId, status: { in: ['active', 'paused'] } },
  });
  if (!enrolled) return NextResponse.json({ error: 'not_enrolled' }, { status: 409 });

  const mark = await prisma.attendance.upsert({
    where: { sessionId_studentId: { sessionId, studentId } },
    update: { status, markedAt: new Date() },
    create: { sessionId, studentId, status },
  });
  return NextResponse.json({ mark });
}
