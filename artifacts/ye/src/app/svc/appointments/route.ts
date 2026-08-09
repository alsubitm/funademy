import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createMeetEvent } from '@/lib/google-calendar';
import { consultAvailability, formatRiyadh, CONSULT_DURATION_MIN } from '@/lib/appointments';
import { allowRate, clientIp } from '@/lib/rate-limit';
import { Prisma } from '@prisma/client';

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

  // The chosen time must be one of the currently open consultation slots.
  const open = await consultAvailability();
  if (!open.some((s) => s.startsAt === startsAt.toISOString())) {
    return NextResponse.json({ error: 'slot_unavailable' }, { status: 409 });
  }

  // Claim the slot atomically first — the unique consultKey guarantees two
  // concurrent requests can never book the same consultation window.
  let appt;
  try {
    appt = await prisma.appointment.create({
      data: {
        kind: 'consult',
        parentName,
        phone,
        email,
        notes,
        startsAt,
        durationMin: CONSULT_DURATION_MIN,
        consultKey: startsAt.toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'slot_unavailable' }, { status: 409 });
    }
    throw e;
  }

  // Then create the meeting; if Google fails, release the claim explicitly.
  let meet;
  try {
    meet = await createMeetEvent({
      summary: `استشارة FunAdemy — ${parentName}`,
      description: `موعد استشارة عبر موقع FunAdemy\nالاسم: ${parentName}\nالجوال: ${phone}${notes ? `\nملاحظات: ${notes}` : ''}`,
      startsAt,
      durationMin: CONSULT_DURATION_MIN,
      attendeeEmail: email,
    });
  } catch (e) {
    console.error('[appointments] calendar event failed:', e);
    await prisma.appointment.delete({ where: { id: appt.id } }).catch(() => {});
    return NextResponse.json({ error: 'calendar_failed' }, { status: 502 });
  }

  appt = await prisma.appointment.update({
    where: { id: appt.id },
    data: { meetUrl: meet.meetUrl, calendarEventId: meet.eventId },
  });

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
