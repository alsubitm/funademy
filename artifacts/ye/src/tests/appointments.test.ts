/**
 * Integration + unit tests for the appointment system:
 *  - consult double-booking: two concurrent requests for the same slot →
 *    exactly one succeeds, the other gets 409 (consultKey unique claim)
 *  - claim is released when Google Calendar creation fails
 *  - nextOccurrence / consultAvailability timing math (Riyadh UTC+3)
 *  - trial bookings reuse one calendar event per program+startsAt instead of
 *    creating a parallel meeting (Google layer mocked)
 *
 * Runs against the isolated ye_test database (see global-setup / setup-env),
 * calling the Next.js route handlers directly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ——— mock the Google Calendar layer: no real connector calls in tests ———
vi.mock('@/lib/google-calendar', () => ({
  createMeetEvent: vi.fn(),
  addAttendeeToEvent: vi.fn(),
}));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createMeetEvent, addAttendeeToEvent } from '@/lib/google-calendar';
import {
  nextOccurrence,
  consultAvailability,
  riyadhDateTime,
  RIYADH_OFFSET_MS,
} from '@/lib/appointments';
import { POST as appointmentsPOST } from '@/app/svc/appointments/route';
import { POST as bookingsPOST } from '@/app/svc/bookings/route';

const mockCreate = vi.mocked(createMeetEvent);
const mockAddAttendee = vi.mocked(addAttendeeToEvent);

const RUN = `appt-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

let ipCounter = 0;
function jsonReq(url: string, body: unknown) {
  // Fresh IP per request so the in-memory rate limiter never interferes.
  ipCounter += 1;
  return new NextRequest(`http://test.local${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.9.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`,
    },
    body: JSON.stringify(body),
  });
}

function freshPhone(): string {
  return `+9665${Math.floor(10000000 + Math.random() * 89999999)}`;
}

beforeEach(() => {
  mockCreate.mockReset();
  mockAddAttendee.mockReset();
  mockCreate.mockImplementation(async () => ({
    eventId: `evt-${Math.random().toString(36).slice(2, 10)}`,
    meetUrl: 'https://meet.google.com/test-mock',
    htmlLink: null,
  }));
  mockAddAttendee.mockResolvedValue(undefined as never);
});

// ——— timing math (pure) ———

describe('nextOccurrence', () => {
  // Sunday 2026-08-09 10:00 UTC = 13:00 Riyadh.
  const from = new Date('2026-08-09T10:00:00Z');

  it('returns the same day when the slot time is still ahead (Riyadh)', () => {
    const d = nextOccurrence(0, '17:00', from); // Sunday 17:00 Riyadh
    expect(d.toISOString()).toBe('2026-08-09T14:00:00.000Z');
    expect(new Date(d.getTime() + RIYADH_OFFSET_MS).getUTCDay()).toBe(0);
  });

  it('rolls to next week when the slot time already passed today', () => {
    const d = nextOccurrence(0, '10:00', from); // 10:00 Riyadh = 07:00 UTC, past
    expect(d.toISOString()).toBe('2026-08-16T07:00:00.000Z');
  });

  it('is strictly in the future — an occurrence exactly at `from` rolls a week', () => {
    const at = new Date('2026-08-09T14:00:00Z'); // exactly Sunday 17:00 Riyadh
    const d = nextOccurrence(0, '17:00', at);
    expect(d.toISOString()).toBe('2026-08-16T14:00:00.000Z');
  });

  it('finds a mid-week weekday correctly', () => {
    const d = nextOccurrence(3, '16:30', from); // Wednesday
    expect(d.toISOString()).toBe('2026-08-12T13:30:00.000Z');
    const local = new Date(d.getTime() + RIYADH_OFFSET_MS);
    expect(local.getUTCDay()).toBe(3);
    expect(local.getUTCHours()).toBe(16);
    expect(local.getUTCMinutes()).toBe(30);
  });
});

describe('consultAvailability', () => {
  // Far-future `now` so unrelated rows created by other suites can't collide.
  // 2030-01-01 is a Tuesday; 09:00 UTC = 12:00 Riyadh.
  const now = new Date('2030-01-01T09:00:00Z');

  it('offers only Sunday–Thursday 16:00–19:30 Riyadh slots with ≥3h lead', async () => {
    const slots = await consultAvailability(now);
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      const utc = new Date(s.startsAt);
      const local = new Date(utc.getTime() + RIYADH_OFFSET_MS);
      expect([0, 1, 2, 3, 4]).toContain(local.getUTCDay()); // Sun–Thu
      expect(local.getUTCHours()).toBeGreaterThanOrEqual(16);
      expect(local.getUTCHours()).toBeLessThan(20);
      expect([0, 30]).toContain(local.getUTCMinutes());
      expect(utc.getTime() - now.getTime()).toBeGreaterThanOrEqual(3 * 60 * 60 * 1000);
    }
    // Same-day (Tuesday) 16:00 Riyadh = 13:00 UTC is 4h ahead → must be offered.
    expect(slots.some((s) => s.startsAt === '2030-01-01T13:00:00.000Z')).toBe(true);
    // Friday/Saturday must never appear.
    expect(
      slots.some((s) => {
        const day = new Date(new Date(s.startsAt).getTime() + RIYADH_OFFSET_MS).getUTCDay();
        return day === 5 || day === 6;
      }),
    ).toBe(false);
  });

  it('excludes slots already booked as scheduled consults', async () => {
    const target = riyadhDateTime(2030, 0, 2, 17, 0); // Wednesday 17:00 Riyadh
    const before = await consultAvailability(now);
    expect(before.some((s) => s.startsAt === target.toISOString())).toBe(true);

    const appt = await prisma.appointment.create({
      data: {
        kind: 'consult',
        parentName: `Test ${RUN}`,
        phone: freshPhone(),
        startsAt: target,
        consultKey: target.toISOString(),
      },
    });
    try {
      const after = await consultAvailability(now);
      expect(after.some((s) => s.startsAt === target.toISOString())).toBe(false);
      // Cancelled consults free the slot again.
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { status: 'cancelled', consultKey: null },
      });
      const freed = await consultAvailability(now);
      expect(freed.some((s) => s.startsAt === target.toISOString())).toBe(true);
    } finally {
      await prisma.appointment.delete({ where: { id: appt.id } }).catch(() => {});
    }
  });
});

// ——— consult booking route: double-booking guard ———

describe('POST /svc/appointments', () => {
  async function openSlot(): Promise<string> {
    const slots = await consultAvailability();
    expect(slots.length).toBeGreaterThan(0);
    return slots[slots.length - 1].startsAt; // least likely to conflict
  }

  const validBody = (startsAt: string) => ({
    parentName: `Parent ${RUN}`,
    phone: freshPhone(),
    startsAt,
  });

  it('books an open slot and stores the calendar event', async () => {
    const startsAt = await openSlot();
    const res = await appointmentsPOST(jsonReq('/svc/appointments', validBody(startsAt)));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.startsAt).toBe(startsAt);
    expect(json.meetUrl).toBe('https://meet.google.com/test-mock');
    const row = await prisma.appointment.findUnique({ where: { consultKey: startsAt } });
    expect(row?.calendarEventId).toBeTruthy();
  });

  it('two concurrent requests for the same slot → one 201, one 409, one row', async () => {
    const startsAt = await openSlot();
    const [r1, r2] = await Promise.all([
      appointmentsPOST(jsonReq('/svc/appointments', validBody(startsAt))),
      appointmentsPOST(jsonReq('/svc/appointments', validBody(startsAt))),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    const loser = r1.status === 409 ? r1 : r2;
    expect((await loser.json()).error).toBe('slot_unavailable');
    const rows = await prisma.appointment.count({
      where: { kind: 'consult', consultKey: startsAt },
    });
    expect(rows).toBe(1);
    // Only the winner reached Google.
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects a slot outside the published availability', async () => {
    // Friday is never offered.
    const friday = nextOccurrence(5, '17:00');
    const res = await appointmentsPOST(jsonReq('/svc/appointments', validBody(friday.toISOString())));
    expect(res.status).toBe(409);
  });

  it('releases the slot claim when calendar creation fails', async () => {
    const startsAt = await openSlot();
    mockCreate.mockRejectedValueOnce(new Error('google down'));
    const res = await appointmentsPOST(jsonReq('/svc/appointments', validBody(startsAt)));
    expect(res.status).toBe(502);
    expect(await prisma.appointment.findUnique({ where: { consultKey: startsAt } })).toBeNull();
    // The slot is bookable again afterwards.
    const retry = await appointmentsPOST(jsonReq('/svc/appointments', validBody(startsAt)));
    expect(retry.status).toBe(201);
  });
});

// ——— trial booking: one class occurrence = one meeting ———

describe('POST /svc/bookings — trial meeting reuse', () => {
  async function createProgramWithSlot() {
    const program = await prisma.program.create({
      data: {
        slug: `prog-${RUN}-${Math.random().toString(36).slice(2, 8)}`,
        kitCode: 'KIT-01',
        nameEn: `Prog ${RUN}`,
        nameAr: `برنامج ${RUN}`,
        ageMin: 4,
        ageMax: 14,
        format: 'in_person',
        color: '#1c54cb',
        level: 1,
        taglineEn: 't',
        taglineAr: 'ت',
        descEn: 'd',
        descAr: 'د',
        buildsEn: [],
        buildsAr: [],
        termsEn: [],
        termsAr: [],
      },
    });
    const slot = await prisma.scheduleSlot.create({
      data: { programId: program.id, weekday: 0, time: '17:00', format: 'in_person', capacity: 12, seatsLeft: 12 },
    });
    return { program, slot };
  }

  const bookingBody = (programId: number, slotId: number, email?: string) => ({
    programId,
    slotId,
    parentName: `Parent ${RUN}`,
    phone: freshPhone(),
    childFirstName: 'Test',
    childBirthYear: new Date().getFullYear() - 8,
    neighborhood: 'Test',
    ...(email ? { email } : {}),
  });

  it('second booking into the same program/time reuses the event and adds the guest', async () => {
    const { program, slot } = await createProgramWithSlot();
    const expectedStart = nextOccurrence(slot.weekday, slot.time);

    const r1 = await bookingsPOST(jsonReq('/svc/bookings', bookingBody(program.id, slot.id)));
    expect(r1.status).toBe(201);
    const j1 = await r1.json();
    expect(j1.appointment?.startsAt).toBe(expectedStart.toISOString());
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const r2 = await bookingsPOST(
      jsonReq('/svc/bookings', bookingBody(program.id, slot.id, 'family@example.com')),
    );
    expect(r2.status).toBe(201);
    const j2 = await r2.json();
    expect(j2.appointment?.startsAt).toBe(expectedStart.toISOString());

    // No second meeting was created; the guest was added to the existing one.
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockAddAttendee).toHaveBeenCalledTimes(1);
    const firstEventId = (await prisma.appointment.findFirstOrThrow({
      where: { kind: 'trial', programId: program.id },
      orderBy: { id: 'asc' },
    })).calendarEventId!;
    expect(mockAddAttendee).toHaveBeenCalledWith(firstEventId, 'family@example.com');

    const appts = await prisma.appointment.findMany({
      where: { kind: 'trial', programId: program.id, startsAt: expectedStart },
    });
    expect(appts).toHaveLength(2);
    expect(new Set(appts.map((a) => a.calendarEventId)).size).toBe(1);
    expect(appts.every((a) => a.meetUrl === 'https://meet.google.com/test-mock')).toBe(true);
  });

  it('booking survives a Google failure (no appointment, booking still created)', async () => {
    const { program, slot } = await createProgramWithSlot();
    mockCreate.mockRejectedValueOnce(new Error('google down'));
    const res = await bookingsPOST(jsonReq('/svc/bookings', bookingBody(program.id, slot.id)));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBeTruthy();
    expect(json.appointment).toBeNull();
    expect(await prisma.booking.findUnique({ where: { id: json.id } })).toBeTruthy();
    // Cancelled/failed meeting must not be "reused" by the next booking.
    const r2 = await bookingsPOST(jsonReq('/svc/bookings', bookingBody(program.id, slot.id)));
    expect(r2.status).toBe(201);
    expect((await r2.json()).appointment?.meetUrl).toBe('https://meet.google.com/test-mock');
  });
});
