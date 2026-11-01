/**
 * Acceptance coverage for the trial-to-subscription pipeline:
 * explicit contact consent, durable reminder/follow-up dates, admin ownership
 * and attendance, a ready enrollment link, and conversion metrics.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

vi.mock('@/lib/google-calendar', () => ({
  createMeetEvent: vi.fn(async () => ({
    eventId: `trial-followup-${Date.now()}`,
    meetUrl: 'https://meet.google.com/trial-followup',
    htmlLink: null,
  })),
  addAttendeeToEvent: vi.fn(async () => undefined),
  sendCalendarNotice: vi.fn(async () => undefined),
}));

vi.mock('@/lib/payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/payments')>();
  return {
    ...actual,
    verifyPayment: vi.fn(async () => 'failed' as const),
  };
});

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ADMIN_COOKIE, adminToken } from '@/lib/auth';
import { FAMILY_COOKIE, familyToken } from '@/lib/family-auth';
import { CART_COOKIE } from '@/lib/cart';
import { POST as bookingPOST } from '@/app/(ar)/svc/bookings/route';
import { GET as adminGET, PATCH as adminPATCH } from '@/app/(ar)/svc/admin/bookings/route';
import { POST as cartPOST } from '@/app/(ar)/svc/enroll/cart/route';
import { POST as checkoutPOST } from '@/app/(ar)/svc/enroll/checkout/route';
import { processDueTrialCommunications } from '@/lib/trial-communications';
import { finalizePayment } from '@/lib/pay-core';

const RUN = `trial-followup-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let programId: number;
let slotId: number;
let bookingId: number;
let familyId: number;
const BOOKED_PHONE = `+9665${Math.floor(10000000 + Math.random() * 89999999)}`;
const CHILD_NAME = `طفل ${RUN}`;

const req = (path: string, method: string, body?: unknown) =>
  new NextRequest(`http://test.local${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.88.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const validBody = (contactConsent = true) => ({
  programId,
  slotId,
  parentName: `ولي أمر ${RUN}`,
  phone: BOOKED_PHONE,
  childFirstName: CHILD_NAME,
  childBirthYear: new Date().getFullYear() - 9,
  neighborhood: 'riyadh',
  email: 'trial@example.com',
  contactChannel: 'email',
  contactConsent,
});

beforeAll(async () => {
  const program = await prisma.program.create({
    data: {
      slug: RUN,
      kitCode: 'KIT-01',
      nameEn: RUN,
      nameAr: `برنامج ${RUN}`,
      ageMin: 4,
      ageMax: 14,
      format: 'online',
      color: '#1c54cb',
      level: 1,
      taglineEn: 'Trial',
      taglineAr: 'تجريبي',
      descEn: 'Trial',
      descAr: 'تجريبي',
      buildsEn: [],
      buildsAr: [],
      termsEn: [],
      termsAr: [],
    },
  });
  programId = program.id;
  const slot = await prisma.scheduleSlot.create({
    data: {
      programId,
      weekday: (new Date().getUTCDay() + 2) % 7,
      time: '17:00',
      format: 'online',
      capacity: 4,
      seatsLeft: 4,
    },
  });
  slotId = slot.id;
  const family = await prisma.family.create({
    data: { phone: BOOKED_PHONE, parentName: `ولي أمر ${RUN}`, email: 'trial@example.com' },
  });
  familyId = family.id;
  cookieJar.set(FAMILY_COOKIE, familyToken(familyId));
});

afterAll(async () => {
  cookieJar.clear();
  if (familyId) await prisma.family.delete({ where: { id: familyId } });
  await prisma.appointment.deleteMany({ where: { bookingId } });
  await prisma.booking.deleteMany({ where: { programId } });
  await prisma.scheduleSlot.deleteMany({ where: { programId } });
  await prisma.program.delete({ where: { id: programId } });
});

describe('trial follow-up pipeline', () => {
  it('rejects a booking without explicit follow-up consent', async () => {
    const response = await bookingPOST(req('/svc/bookings', 'POST', validBody(false)));
    expect(response.status).toBe(400);
    expect(await prisma.booking.count({ where: { programId } })).toBe(0);
  });

  it('persists consent and schedules reminder + post-class follow-up', async () => {
    const response = await bookingPOST(req('/svc/bookings', 'POST', validBody()));
    expect(response.status).toBe(201);
    bookingId = (await response.json()).id;

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.email).toBe('trial@example.com');
    expect(booking.contactChannel).toBe('email');
    expect(booking.contactConsentAt).toBeInstanceOf(Date);
    expect(booking.trialStartsAt).toBeInstanceOf(Date);
    expect(booking.reminderAt!.getTime()).toBe(booking.trialStartsAt!.getTime() - 24 * 60 * 60_000);
    expect(booking.followUpAt!.getTime()).toBe(booking.trialStartsAt!.getTime() + 60 * 60_000);
    const communications = await prisma.trialCommunication.findMany({ where: { bookingId } });
    expect(communications.map((item) => item.kind).sort()).toEqual(['follow_up', 'reminder']);

    await prisma.trialCommunication.updateMany({
      where: { bookingId, kind: 'reminder' },
      data: {
        dueAt: new Date(Date.now() - 1_000),
        status: 'sending',
        claimedAt: new Date(Date.now() - 20 * 60_000),
        claimToken: 'dead-worker',
      },
    });
    await processDueTrialCommunications();
    expect(
      (await prisma.trialCommunication.findUniqueOrThrow({
        where: { bookingId_kind: { bookingId, kind: 'reminder' } },
      })).status,
    ).toBe('sent');
  });

  it('shows the next action and lets admin own + mark attendance', async () => {
    cookieJar.set(ADMIN_COOKIE, adminToken());
    const listResponse = await adminGET(req('/svc/admin/bookings', 'GET'));
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json();
    const row = list.bookings.find((booking: { id: number }) => booking.id === bookingId);
    expect(row.enrollmentUrl).toBe(`/enroll?program=${RUN}&trial=${bookingId}`);
    expect(row.nextAction).toBeTruthy();
    expect(list.metrics.total).toBeGreaterThanOrEqual(1);

    const patchResponse = await adminPATCH(
      req('/svc/admin/bookings', 'PATCH', {
        id: bookingId,
        assignedTo: 'تركي',
        trialAttendance: 'present',
      }),
    );
    expect(patchResponse.status).toBe(200);
    const updated = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(updated.assignedTo).toBe('تركي');
    expect(updated.trialAttendance).toBe('present');
    expect(updated.attendedAt).toBeInstanceOf(Date);

    const student = await prisma.student.create({
      data: { familyId, firstName: CHILD_NAME, birthYear: new Date().getFullYear() - 9 },
    });
    const run = await prisma.courseRun.create({
      data: {
        programId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60_000),
        weekday: 0,
        time: '17:00',
        format: 'online',
        capacity: 5,
        seatsLeft: 5,
      },
    });
    cookieJar.set(FAMILY_COOKIE, familyToken(familyId));

    // A timed-out checkout remains reconcilable while the provider says
    // pending. Once the provider confirms failure, release the trial
    // attribution and allow the cancelled enrollment row to be reused.
    const cancelledEnrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseRunId: run.id,
        status: 'cancelled',
      },
    });
    const expiredPayment = await prisma.payment.create({
      data: {
        familyId,
        kind: 'enrollment',
        provider: 'moyasar_mada',
        reference: `expired-${RUN}`,
        status: 'expired',
        subtotalSar: 1380,
        totalSar: 1380,
        simulated: false,
        items: {
          create: {
            enrollmentId: cancelledEnrollment.id,
            studentName: CHILD_NAME,
            programAr: `برنامج ${RUN}`,
            programEn: RUN,
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60_000),
            baseSar: 1380,
            totalSar: 1380,
            trialBookingId: bookingId,
          },
        },
      },
    });
    expect(await finalizePayment(expiredPayment.id)).toBe('failed');
    expect(
      (await prisma.paymentItem.findFirstOrThrow({ where: { paymentId: expiredPayment.id } })).trialBookingId,
    ).toBeNull();

    const cartResponse = await cartPOST(req('/svc/enroll/cart', 'POST', {
      studentId: student.id,
      courseRunId: run.id,
      trialBookingId: bookingId,
    }));
    expect(cartResponse.status).toBe(201);
    cookieJar.set(CART_COOKIE, cartResponse.cookies.get(CART_COOKIE)!.value);
    const checkoutResponse = await checkoutPOST(req('/svc/enroll/checkout', 'POST', {
      provider: 'moyasar_mada',
      lang: 'ar',
    }));
    expect(checkoutResponse.status).toBe(200);

    await prisma.trialCommunication.updateMany({
      where: { bookingId, kind: 'follow_up' },
      data: {
        dueAt: new Date(Date.now() - 1_000),
        status: 'failed',
        attempts: 5,
        lastError: 'temporary Google failure',
      },
    });
    const failedFollowUp = await prisma.trialCommunication.findUniqueOrThrow({
      where: { bookingId_kind: { bookingId, kind: 'follow_up' } },
    });
    const retryResponse = await adminPATCH(req('/svc/admin/bookings', 'PATCH', {
      id: bookingId,
      retryCommunicationId: failedFollowUp.id,
    }));
    expect(retryResponse.status).toBe(200);
    await processDueTrialCommunications();
    expect(
      (await prisma.trialCommunication.findUniqueOrThrow({
        where: { bookingId_kind: { bookingId, kind: 'follow_up' } },
      })).status,
    ).toBe('sent');

    const converted = await (await adminGET(req('/svc/admin/bookings', 'GET'))).json();
    expect(converted.bookings.find((booking: { id: number }) => booking.id === bookingId).converted).toBe(true);
    expect(converted.metrics.enrolled).toBeGreaterThanOrEqual(1);
  });
});