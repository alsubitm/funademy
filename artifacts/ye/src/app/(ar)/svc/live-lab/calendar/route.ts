import { safeInstructorMutation } from '@/lib/instructor-auth';
import { failure, LiveError, reply, roomTransaction, staff, validId } from '@/lib/live-lab';
import { syncLiveCalendar } from '@/lib/live-lab-calendar';
import { allowRate } from '@/lib/rate-limit';
import { tryPrivateLabEmail } from '@/lib/live-lab-email';
export async function POST(req: Request) {
  try {
    if (!safeInstructorMutation(req)) throw new LiveError(403, 'forbidden');
    const actor = await staff();
    const b = await req.json();
    if (!validId(b.roomId)) throw new LiveError(400, 'invalid_input');
    if (!await allowRate(`live-calendar:${actor.id ?? 'admin'}`, 20, 3600000)) throw new LiveError(429, 'rate_limited');
    const result = await roomTransaction(actor, b.roomId, async (tx, room) => {
      if (room.phase === 'ended') throw new LiveError(409, 'session_ended');
      const teacher = await tx.instructor.findUniqueOrThrow({ where: { id: room.instructorId } });
      const guests = await tx.liveLabGuest.findMany({ where: { roomId: room.id, revoked: false } });
      const calendar = await syncLiveCalendar(room, guests.map(g => g.email), teacher.email);
      await tx.liveLabRoom.update({ where: { id: room.id }, data: {
        meetUrl: calendar.meetUrl, calendarStatus: calendar.meetUrl ? 'ready' : 'pending',
      } });
      await tx.liveLabGuest.updateMany({ where: { roomId: room.id, revoked: false, invitedAt: null }, data: { invitedAt: new Date() } });
      return { ...calendar, emailGuestIds: guests.filter(g => g.emailConsentAt && !g.privateEmailSentAt).map(g => g.id) };
    });
    // Calendar acceptance is independent of private-email acceptance. Failures
    // remain on each guest row and never roll back a successful calendar sync.
    for (const id of result.emailGuestIds) await tryPrivateLabEmail(actor, b.roomId, id);
    return reply({ ok: true, meetUrl: result.meetUrl });
  } catch (e) { return failure(e); }
}
