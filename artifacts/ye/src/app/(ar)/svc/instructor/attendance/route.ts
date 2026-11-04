import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { currentInstructor, safeInstructorMutation } from '@/lib/instructor-auth';
import { AttendanceError, attendanceRoster, attendanceSession, attendanceStatuses, saveAttendance } from '@/lib/attendance';

export const dynamic = 'force-dynamic';
const error = (code: string, status: number) => NextResponse.json({ error: code }, { status });
const failure = (e: unknown) => e instanceof AttendanceError ? error(e.code, e.status) : error('service_unavailable', 503);
const validId = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;

export async function GET(req: Request) {
  try {
    const teacher = await currentInstructor();
    if (!teacher) return error('unauthorized', 401);
    const sessionId = Number(new URL(req.url).searchParams.get('sessionId'));
    if (!validId(sessionId)) return error('validation', 400);
    const students = await prisma.$transaction(async tx => {
      const session = await attendanceSession(tx, sessionId, teacher);
      return attendanceRoster(tx, sessionId, session.courseRunId);
    });
    return NextResponse.json({ students }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  if (!safeInstructorMutation(req)) return error('forbidden', 403);
  try {
    const teacher = await currentInstructor();
    if (!teacher) return error('unauthorized', 401);
    const b = await req.json().catch(() => null);
    if (!validId(b?.sessionId) || !validId(b?.studentId) || !attendanceStatuses.includes(b?.status) ||
      !(b?.expectedVersion === null || typeof b?.expectedVersion === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(b.expectedVersion))) return error('validation', 400);
    const mark = await saveAttendance({ sessionId: b.sessionId, studentId: b.studentId, status: b.status, expectedVersion: b.expectedVersion, teacher });
    return NextResponse.json({ studentId: mark.studentId, status: mark.status, version: mark.markedAt.toISOString() });
  } catch (e) { return failure(e); }
}
