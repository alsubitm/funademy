import { NextRequest, NextResponse } from 'next/server';
import { allowRate, clientIp } from '@/lib/rate-limit';
import { createTrialBooking } from '@/lib/chat-booking';
import { formatRiyadh } from '@/lib/appointments';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const programId = Number(b.programId);
  const slotId = Number(b.slotId);
  const parentName = String(b.parentName ?? '').trim();
  const phone = String(b.phone ?? '').trim();
  const childFirstName = String(b.childFirstName ?? '').trim();
  const childBirthYear = Number(b.childBirthYear);
  const neighborhood = String(b.neighborhood ?? '').trim();
  const email = String(b.email ?? '').trim() || null;
  const contactConsent = b.contactConsent === true;
  const contactChannel = String(b.contactChannel ?? 'email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  // Throttle: each accepted booking may create a real Google Calendar event.
  if (!(await allowRate(`book:ip:${clientIp(req)}`, 5, 10 * 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const currentYear = new Date().getFullYear();
  if (
    !programId ||
    !slotId ||
    !parentName ||
    !childFirstName ||
    !/^(\+?966|0)?5\d{8}$/.test(phone.replace(/[\s-]/g, '')) ||
    !(childBirthYear >= currentYear - 19 && childBirthYear <= currentYear - 3) ||
    !contactConsent ||
    contactChannel !== 'email' ||
    !email
  ) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  let outcome;
  try {
    outcome = await createTrialBooking({
      programId,
      slotId,
      parentName,
      phone,
      email,
      childFirstName,
      childBirthYear,
      neighborhood,
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : 'booking_failed';
    if (code === 'slot_not_found') return NextResponse.json({ error: code }, { status: 404 });
    if (['slot_full', 'already_booked', 'program_not_eligible'].includes(code)) {
      return NextResponse.json({ error: code }, { status: 409 });
    }
    throw e;
  }
  const appointment = outcome.appointment
    ? {
        startsAt: outcome.appointment.startsAt.toISOString(),
        meetUrl: outcome.appointment.meetUrl,
        whenAr: formatRiyadh(outcome.appointment.startsAt, 'ar'),
        whenEn: formatRiyadh(outcome.appointment.startsAt, 'en'),
      }
    : null;
  return NextResponse.json({ id: outcome.booking.id, appointment }, { status: 201 });
}
