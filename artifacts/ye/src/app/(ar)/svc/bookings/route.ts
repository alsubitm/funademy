import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createMeetEvent, addAttendeeToEvent } from '@/lib/google-calendar';
import { allowRate, clientIp } from '@/lib/rate-limit';
import { nextOccurrence, formatRiyadh } from '@/lib/appointments';
import { CATALOG } from '@/lib/catalog';

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

  const outcome = await prisma.$transaction(async (tx) => {
    const slot = await tx.scheduleSlot.findUnique({
      where: { id: slotId },
      include: { program: true },
    });
    if (!slot || slot.programId !== programId || !slot.active) return 'slot_not_found' as const;
    // Validity + seat decrement inside the transaction to avoid races with
    // concurrent bookings or admin deactivation.
    const updated = await tx.scheduleSlot.updateMany({
      where: { id: slotId, programId, active: true, seatsLeft: { gt: 0 } },
      data: { seatsLeft: { decrement: 1 } },
    });
    if (updated.count === 0) {
      return 'slot_full' as const;
    }
    const trialStartsAt = nextOccurrence(slot.weekday, slot.time);
    const reminderAt = new Date(trialStartsAt.getTime() - 24 * 60 * 60_000);
    const followUpAt = new Date(trialStartsAt.getTime() + 60 * 60_000);
    return tx.booking.create({
      data: {
        programId,
        slotId,
        parentName,
        phone,
        childFirstName,
        childBirthYear,
        neighborhood,
        email,
        contactChannel: contactChannel as 'whatsapp' | 'email' | 'phone',
        contactConsentAt: new Date(),
        trialStartsAt,
        reminderAt,
        followUpAt,
        communications: {
          create: [
            { kind: 'reminder', dueAt: reminderAt },
            { kind: 'follow_up', dueAt: followUpAt },
          ],
        },
      },
    });
  });

  if (outcome === 'slot_not_found') return NextResponse.json({ error: 'slot_not_found' }, { status: 404 });
  if (outcome === 'slot_full') return NextResponse.json({ error: 'slot_full' }, { status: 409 });

  // Auto-schedule the trial meeting: next occurrence of the slot's weekday/
  // time, with an auto-created Google Meet link. Calendar failure must not
  // undo the booking — the family is contacted manually in that case.
  let appointment: { startsAt: string; meetUrl: string | null; whenAr: string; whenEn: string } | null = null;
  try {
    const slot = await prisma.scheduleSlot.findUnique({ where: { id: slotId }, include: { program: true } });
    if (slot) {
      // Newly-created bookings always persist this value. The fallback keeps
      // the route type-safe while legacy nullable rows remain migration-safe.
      const startsAt = outcome.trialStartsAt ?? nextOccurrence(slot.weekday, slot.time);
      const durationMin = CATALOG[slot.program.slug]?.lessonMin ?? 45;

      // One class occurrence = one meeting: reuse the event already created
      // for another trial booking into the same program/time, adding this
      // guest to it instead of creating a parallel meeting.
      const existing = await prisma.appointment.findFirst({
        where: { kind: 'trial', programId, startsAt, status: 'scheduled', calendarEventId: { not: null } },
      });
      let meet: { eventId: string; meetUrl: string | null };
      if (existing?.calendarEventId) {
        meet = { eventId: existing.calendarEventId, meetUrl: existing.meetUrl };
        if (email) {
          await addAttendeeToEvent(existing.calendarEventId, email).catch((e) =>
            console.error('[bookings] add attendee failed:', e),
          );
        }
      } else {
        meet = await createMeetEvent({
          summary: `حصة تجريبية FunAdemy — ${slot.program.nameAr}`,
          description: `حصة تجريبية عبر موقع FunAdemy\nالبرنامج: ${slot.program.nameAr} / ${slot.program.nameEn}`,
          startsAt,
          durationMin,
          attendeeEmail: email,
        });
      }
      const appt = await prisma.appointment.create({
        data: {
          kind: 'trial',
          parentName,
          phone,
          email,
          childFirstName,
          programId,
          bookingId: outcome.id,
          startsAt,
          durationMin,
          meetUrl: meet.meetUrl,
          calendarEventId: meet.eventId,
        },
      });
      appointment = {
        startsAt: appt.startsAt.toISOString(),
        meetUrl: appt.meetUrl,
        whenAr: formatRiyadh(appt.startsAt, 'ar'),
        whenEn: formatRiyadh(appt.startsAt, 'en'),
      };
    }
  } catch (e) {
    console.error('[bookings] trial appointment scheduling failed:', e);
  }

  return NextResponse.json({ id: outcome.id, appointment }, { status: 201 });
}
