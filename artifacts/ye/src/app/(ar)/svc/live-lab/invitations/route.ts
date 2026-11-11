import { randomBytes } from 'node:crypto';
import { safeInstructorMutation } from '@/lib/instructor-auth';
import { failure, LiveError, reply, roomTransaction, staff, validId } from '@/lib/live-lab';
export async function POST(req: Request) {
  try {
    if (!safeInstructorMutation(req)) throw new LiveError(403, 'forbidden');
    const actor = await staff();
    const b = await req.json();
    if (!validId(b.roomId) || typeof b.idempotencyKey !== 'string' || b.idempotencyKey.length < 16 || b.idempotencyKey.length > 128 ||
      typeof b.name !== 'string' || !b.name.trim() || b.name.length > 80 ||
      typeof b.email !== 'string' || b.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) throw new LiveError(400, 'invalid_input');
    await roomTransaction(actor, b.roomId, async (tx, room) => {
      const email = b.email.trim().toLowerCase();
      const name = b.name.trim();
      const existing = await tx.liveLabGuest.findUnique({
        where: { roomId_idempotencyKey: { roomId: room.id, idempotencyKey: b.idempotencyKey } },
      });
      if (existing) {
        if (existing.name !== name || existing.email !== email) throw new LiveError(409, 'idempotency_conflict');
        return;
      }
      if (room.phase !== 'waiting') throw new LiveError(409, 'session_started');
      // Email is the guardian's contact, not a student's identity. Each
      // invitation gets its own seat and capability, including siblings.
      if (await tx.liveLabGuest.count({ where: { roomId: room.id, revoked: false } }) >= 16) throw new LiveError(409, 'session_full');
      await tx.liveLabGuest.create({ data: { roomId: room.id, idempotencyKey: b.idempotencyKey, name, email, token: randomBytes(32).toString('hex') } });
      await tx.liveLabRoom.update({ where: { id: room.id }, data: { calendarStatus: 'needs_sync' } });
    });
    return reply({ ok: true });
  } catch (e) { return failure(e); }
}
export async function PATCH(req: Request) {
  try {
    if (!safeInstructorMutation(req)) throw new LiveError(403, 'forbidden');
    const actor = await staff();
    const b = await req.json();
    const isNameChange = typeof b.name === 'string' && b.revoked === undefined;
    const isRevocation = typeof b.revoked === 'boolean' && b.name === undefined;
    if (!validId(b.roomId) || !validId(b.guestId) ||
      (!isNameChange && !isRevocation) ||
      (isNameChange && (!b.name.trim() || b.name.length > 80))) throw new LiveError(400, 'invalid_input');
    await roomTransaction(actor, b.roomId, async (tx, room) => {
      if (room.phase === 'ended') throw new LiveError(409, 'session_ended');
      const guest = await tx.liveLabGuest.findFirst({ where: { id: b.guestId, roomId: room.id } });
      if (!guest) throw new LiveError(404, 'not_found');
      if (isNameChange) {
        // A correction changes only this invitation's label; keep its token,
        // guardian contact, seat and quiz state intact.
        await tx.liveLabGuest.update({ where: { id: guest.id }, data: { name: b.name.trim() } });
        return;
      }
      if (!b.revoked && guest.revoked && await tx.liveLabGuest.count({ where: { roomId: room.id, revoked: false } }) >= 16) throw new LiveError(409, 'session_full');
      await tx.liveLabGuest.update({ where: { id: guest.id }, data: { revoked: b.revoked } });
      await tx.liveLabRoom.update({ where: { id: room.id }, data: { calendarStatus: 'needs_sync' } });
    });
    return reply({ ok: true });
  } catch (e) { return failure(e); }
}
