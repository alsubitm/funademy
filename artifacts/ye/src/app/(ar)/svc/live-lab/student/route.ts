import { prisma } from '@/lib/db';
import { safeInstructorMutation } from '@/lib/instructor-auth';
import { failure, grade, LiveError, questions, reply, roomWire, unexpired } from '@/lib/live-lab';
const validToken = (t: unknown): t is string => typeof t === 'string' && /^[a-f0-9]{64}$/.test(t);
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get('token');
    if (!validToken(token)) throw new LiveError(404, 'not_found');
    const guest = await prisma.liveLabGuest.findUnique({
      where: { token }, include: { room: { include: { instructor: { select: { active: true } } } } },
    });
    if (!guest || guest.revoked || !guest.room.instructor.active) throw new LiveError(404, 'not_found');
    if (!unexpired(guest.room)) throw new LiveError(410, 'expired');
    if (!guest.joinedAt) await prisma.liveLabGuest.updateMany({
      where: { id: guest.id, joinedAt: null, revoked: false }, data: { joinedAt: new Date() },
    });
    return reply({
      room: roomWire(guest.room), name: guest.name,
      questions: guest.room.phase === 'quiz' ? questions : [],
      submission: guest.submittedAt ? { score: guest.score, total: questions.length } : null,
    });
  } catch (e) { return failure(e); }
}
export async function POST(req: Request) {
  try {
    if (!safeInstructorMutation(req)) throw new LiveError(403, 'forbidden');
    const b = await req.json();
    if (!validToken(b.token)) throw new LiveError(404, 'not_found');
    const result = await prisma.$transaction(async tx => {
      const initial = await tx.liveLabGuest.findUnique({ where: { token: b.token }, include: { room: true } });
      if (!initial) throw new LiveError(404, 'not_found');
      // Same lock order as staff mutations: teacher, room, guest. A concurrent
      // end/revoke cannot accept a submission after revocation won the lock.
      await tx.$queryRaw`SELECT id FROM ye_instructors WHERE id = ${initial.room.instructorId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM ye_live_lab_rooms WHERE id = ${initial.roomId} FOR UPDATE`;
      const guest = await tx.liveLabGuest.findUniqueOrThrow({
        where: { id: initial.id }, include: { room: { include: { instructor: { select: { active: true } } } } },
      });
      if (guest.revoked || !guest.room.instructor.active) throw new LiveError(404, 'not_found');
      if (!unexpired(guest.room)) throw new LiveError(410, 'expired');
      // Idempotent retries (including after teacher ends) return the first result.
      if (guest.submittedAt) return { score: guest.score, total: questions.length };
      if (guest.room.phase !== 'quiz') throw new LiveError(409, 'quiz_closed');
      const { answers, score } = grade(b.answers);
      await tx.liveLabGuest.update({ where: { id: guest.id }, data: { answers, score, submittedAt: new Date() } });
      return { score, total: questions.length };
    });
    return reply(result);
  } catch (e) { return failure(e); }
}
