import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { currentInstructor, safeInstructorMutation } from '@/lib/instructor-auth';

export async function POST(req: Request) {
  if (!safeInstructorMutation(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const instructor = await currentInstructor();
    if (!instructor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = await req.json();
    if (!Number.isSafeInteger(body.sessionId) || typeof body.text !== 'string' || body.text.length > 5000) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }
    const result = await prisma.$transaction(async tx => {
      // Serialize with admin account/assignment edits; revocation must win over a stale save.
      await tx.$queryRaw`SELECT id FROM ye_instructors WHERE id = ${instructor.id} FOR UPDATE`;
      const fresh = await tx.instructor.findUnique({ where: { id: instructor.id } });
      if (!fresh?.active || fresh.authVersion !== instructor.authVersion) return null;
      const session = await tx.classSession.findFirst({ where: {
        id: body.sessionId,
        courseRun: { instructorAssignments: { some: { instructorId: instructor.id } } },
      }, select: { id: true } });
      if (!session) return null;
      return tx.instructorNote.upsert({
        where: { instructorId_sessionId: { instructorId: instructor.id, sessionId: session.id } },
        create: { instructorId: instructor.id, sessionId: session.id, text: body.text.trim() },
        update: { text: body.text.trim() }, select: { updatedAt: true },
      });
    });
    if (!result) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    return NextResponse.json({ ok: true, updatedAt: result.updatedAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'service_unavailable' }, { status: 503 }); }
}
