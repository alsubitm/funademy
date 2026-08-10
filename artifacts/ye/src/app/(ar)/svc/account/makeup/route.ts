import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';

export const dynamic = 'force-dynamic';

/** GET — makeup requests for all children of the logged-in family. */
export async function GET() {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const requests = await prisma.makeupRequest.findMany({
    where: { student: { familyId } },
    include: {
      student: { select: { id: true, firstName: true } },
      session: { include: { courseRun: { include: { program: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ requests });
}

/** POST { studentId, sessionId, note? } — parent requests a makeup for a missed session. */
export async function POST(req: NextRequest) {
  const familyId = await getFamilyId();
  if (!familyId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => null);
  const studentId = Number(b?.studentId);
  const sessionId = Number(b?.sessionId);
  const note = typeof b?.note === 'string' ? b.note.trim().slice(0, 300) : null;
  if (!Number.isInteger(studentId) || !Number.isInteger(sessionId)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  // The child must belong to this family.
  const student = await prisma.student.findFirst({ where: { id: studentId, familyId } });
  if (!student) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // The child must have actually missed this session (absent or excused).
  const mark = await prisma.attendance.findUnique({
    where: { sessionId_studentId: { sessionId, studentId } },
  });
  if (!mark || (mark.status !== 'absent' && mark.status !== 'excused')) {
    return NextResponse.json({ error: 'not_missed' }, { status: 409 });
  }

  const existing = await prisma.makeupRequest.findUnique({
    where: { studentId_sessionId: { studentId, sessionId } },
  });
  if (existing) return NextResponse.json({ error: 'already_requested' }, { status: 409 });

  const request = await prisma.makeupRequest.create({
    data: { studentId, sessionId, note: note || null },
  });
  return NextResponse.json({ request }, { status: 201 });
}
