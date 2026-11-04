import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminRequest } from '@/lib/auth';
import { currentInstructor } from '@/lib/instructor-auth';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const instructor = await currentInstructor();
    const admin = !instructor && await isAdminRequest();
    if (!instructor && !admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const runs = await prisma.courseRun.findMany({
      where: instructor ? { instructorAssignments: { some: { instructorId: instructor.id } } } : {},
      orderBy: { startDate: 'desc' },
      select: {
        id: true, titleAr: true, titleEn: true, location: true, capacity: true,
        active: true, startDate: true, endDate: true,
        program: { select: { nameEn: true } },
        enrollments: { where: { status: 'active' }, select: {
          status: true, student: { select: { id: true, firstName: true, birthYear: true } },
        } },
        sessions: { orderBy: { date: 'asc' }, select: {
          id: true, date: true, status: true, note: true,
          attendance: { select: { studentId: true, status: true } },
          instructorNotes: {
            where: { instructorId: instructor?.id ?? -1 }, select: { text: true },
          },
        } },
      },
    });
    return NextResponse.json({
      viewer: instructor ? { id: instructor.id, name: instructor.name, email: instructor.email, role: 'instructor' } :
        { id: null, name: 'Administrator', email: null, role: 'admin' },
      runs: runs.map(run => ({
        id: run.id, title: run.titleAr || run.titleEn || run.program.nameEn,
        program: run.program.nameEn, location: run.location, capacity: run.capacity,
        active: run.active, startDate: run.startDate, endDate: run.endDate,
        students: run.enrollments.map(enrollment => ({ ...enrollment.student, status: enrollment.status })),
        sessions: run.sessions.map(session => ({
          id: session.id, date: session.date, status: session.status, note: session.note,
          attendance: session.attendance.filter(a => run.enrollments.some(e => e.student.id === a.studentId)),
          preparationNote: session.instructorNotes[0]?.text || '',
        })),
      })),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'service_unavailable' }, { status: 503 }); }
}
