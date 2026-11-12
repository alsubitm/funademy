import { prisma } from '@/lib/db';
import { safeInstructorMutation } from '@/lib/instructor-auth';
import { failure, LiveError, lockTeacher, reply, roomTransaction, roomWire, staff, validId } from '@/lib/live-lab';
import { allowRate } from '@/lib/rate-limit';
import { cancelCalendarEvent } from '@/lib/google-calendar';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await staff();
    const rooms = await prisma.liveLabRoom.findMany({
      where: actor.id ? { instructorId: actor.id } : {},
      orderBy: { startsAt: 'desc' }, take: 100,
      include: { guests: { orderBy: { name: 'asc' } } },
    });
    const instructors = await prisma.instructor.findMany({
      where: { active: true, ...(actor.id ? { id: actor.id } : {}) }, select: { id: true, name: true },
    });
    return reply({ role: actor.role, instructors, rooms: rooms.map(room => ({
      ...roomWire(room), guests: room.guests.map(({ token, answers: _answers, roomId: _roomId,
        privateEmailPayload: _payload, privateEmailProviderId: _provider, privateEmailAttemptedAt: _attempt, ...guest }) => ({
        ...guest, joinPath: `/windmill/live/${token}`,
      })),
    })) });
  } catch (e) { return failure(e); }
}
export async function POST(req: Request) {
  try {
    if (!safeInstructorMutation(req)) throw new LiveError(403, 'forbidden');
    const actor = await staff();
    const b = await req.json();
    const startsAt = new Date(b.startsAt);
    if (typeof b.title !== 'string' || !b.title.trim() || b.title.length > 120 ||
      !Number.isInteger(b.instructorId) || !Number.isInteger(b.durationMin) || b.durationMin < 15 || b.durationMin > 120 ||
      typeof b.startsAt !== 'string' || !Number.isFinite(startsAt.getTime()) || startsAt.getTime() < Date.now() - 60000 ||
      startsAt.getTime() > Date.now() + 366 * 86400000) throw new LiveError(400, 'invalid_input');
    if (!await allowRate(`live-create:${actor.id ?? 'admin'}`, 30, 3600000)) throw new LiveError(429, 'rate_limited');
    const room = await prisma.$transaction(async tx => {
      await lockTeacher(tx, actor, b.instructorId);
      return tx.liveLabRoom.create({ data: { title: b.title.trim(), instructorId: b.instructorId, startsAt, durationMin: b.durationMin } });
    });
    return reply({ ok: true, id: room.id });
  } catch (e) { return failure(e); }
}
export async function PATCH(req: Request) {
  try {
    if (!safeInstructorMutation(req)) throw new LiveError(403, 'forbidden');
    const actor = await staff();
    const b = await req.json();
    if (!validId(b.id) || !Number.isInteger(b.version) ||
      (b.step !== undefined && (!Number.isInteger(b.step) || b.step < 0 || b.step > 14)) ||
      (b.motor !== undefined && typeof b.motor !== 'boolean') ||
      (b.reverse !== undefined && typeof b.reverse !== 'boolean') ||
      (b.speed !== undefined && (typeof b.speed !== 'number' || !Number.isFinite(b.speed) || b.speed < .25 || b.speed > 2)) ||
      (b.phase !== undefined && !['waiting', 'teaching', 'quiz', 'ended'].includes(b.phase))) throw new LiveError(400, 'invalid_input');
    await roomTransaction(actor, b.id, async (tx, room) => {
      if (room.version !== b.version) throw new LiveError(409, 'stale_version');
      const next = b.phase ?? room.phase;
      const allowed: Record<string, string[]> = { waiting: ['waiting', 'teaching', 'ended'], teaching: ['teaching', 'quiz', 'ended'], quiz: ['quiz', 'ended'], ended: [] };
      if (!allowed[room.phase]?.includes(next)) throw new LiveError(409, 'invalid_phase');
      if (next === 'quiz' && room.step !== 14) throw new LiveError(409, 'finish_lesson_first');
      if (next !== 'teaching' && [b.step, b.motor, b.speed, b.reverse].some(x => x !== undefined)) throw new LiveError(409, 'not_teaching');
      const step = b.step ?? room.step;
      if (b.motor === true && step !== 14) throw new LiveError(409, 'finish_lesson_first');
      if (room.phase === 'waiting' && next === 'ended' && room.calendarStatus !== 'not_sent') {
        // Cancelling before the lesson also withdraws the scheduled invitation.
        // Google deletion is idempotent; a timeout is safe to retry.
        await cancelCalendarEvent(`lab${room.id.replaceAll('-', '')}`);
      }
      await tx.liveLabRoom.update({ where: { id: room.id }, data: {
        phase: next, step, speed: b.speed, reverse: b.reverse,
        motor: next !== 'teaching' || step !== 14 ? false : b.motor,
        version: { increment: 1 },
      } });
    });
    return reply({ ok: true });
  } catch (e) { return failure(e); }
}
