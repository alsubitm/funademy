import { NextRequest, NextResponse } from 'next/server';
import { formatRiyadh } from '@/lib/appointments';
import { allowRate, clientIp } from '@/lib/rate-limit';
import { createConsultation } from '@/lib/chat-booking';

export const dynamic = 'force-dynamic';

/** Book a consultation appointment: reserves the slot, creates the Google
 *  Meet event, and (when an email is given) Google emails the calendar
 *  invitation automatically. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const parentName = String(b.parentName ?? '').trim();
  const phone = String(b.phone ?? '').trim().replace(/[\s-]/g, '');
  const email = String(b.email ?? '').trim() || null;
  const notes = String(b.notes ?? '').trim().slice(0, 500) || null;
  const startsAtRaw = String(b.startsAt ?? '');
  const startsAt = new Date(startsAtRaw);

  if (
    !parentName ||
    !/^(\+?966|0)?5\d{8}$/.test(phone) ||
    Number.isNaN(startsAt.getTime()) ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  // Throttle: each accepted request creates a real Google Calendar event.
  if (
    !(await allowRate(`appt:ip:${clientIp(req)}`, 5, 10 * 60_000)) ||
    !(await allowRate(`appt:ph:${phone}`, 3, 24 * 60 * 60_000))
  ) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let appt;
  try {
    appt = await createConsultation({ parentName, phone, email, notes, startsAt });
  } catch (e) {
    if (e instanceof Error && e.message === 'slot_unavailable') {
      return NextResponse.json({ error: 'slot_unavailable' }, { status: 409 });
    }
    if (e instanceof Error && e.message === 'calendar_failed') return NextResponse.json({ error: 'calendar_failed' }, { status: 502 });
    throw e;
  }

  return NextResponse.json(
    {
      id: appt.id,
      startsAt: appt.startsAt.toISOString(),
      meetUrl: appt.meetUrl,
      whenAr: formatRiyadh(appt.startsAt, 'ar'),
      whenEn: formatRiyadh(appt.startsAt, 'en'),
      emailInvited: Boolean(email),
    },
    { status: 201 },
  );
}
