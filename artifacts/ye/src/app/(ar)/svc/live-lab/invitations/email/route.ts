import { safeInstructorMutation } from '@/lib/instructor-auth';
import { failure, LiveError, reply, staff, validId } from '@/lib/live-lab';
import { sendPrivateLabEmail } from '@/lib/live-lab-email';
import { allowRate } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    if (!safeInstructorMutation(req)) throw new LiveError(403, 'forbidden');
    const actor = await staff();
    const b = await req.json();
    if (!validId(b.roomId) || !validId(b.guestId) ||
      (b.consent !== undefined && typeof b.consent !== 'boolean')) throw new LiveError(400, 'invalid_input');
    if (!await allowRate(`live-email:${actor.id ?? 'admin'}`, 60, 3600000)) throw new LiveError(429, 'rate_limited');
    const status = await sendPrivateLabEmail(actor, b.roomId, b.guestId, b.consent === true);
    return reply({ ok: status === 'sent', status });
  } catch (e) { return failure(e); }
}
