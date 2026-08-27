/**
 * Integration tests for the payments path:
 * checkout records a payment → renewal extends paidThrough from the later
 * date → renewing another family's enrollment is refused (404) → the
 * receipt requires login and is owner-only.
 *
 * Same structure as family-account.test.ts: runs against the isolated
 * ye_test database, calling the Next.js route handlers directly with a
 * mocked cookie store.
 */
import { describe, it, expect, beforeAll, afterAll, vi, afterEach, beforeEach } from 'vitest';

// ——— mocked cookie store (next/headers) ———
const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { FAMILY_COOKIE, familyToken } from '@/lib/family-auth';
import { CART_COOKIE, encodeCart } from '@/lib/cart';
import { addOneMonth, effectiveMonthlySar } from '@/lib/billing';
import { POST as checkoutPOST } from '@/app/(ar)/svc/enroll/checkout/route';
import { POST as renewPOST } from '@/app/(ar)/svc/account/renew/route';
import { GET as paymentsGET } from '@/app/(ar)/svc/account/payments/route';
import { GET as receiptGET } from '@/app/(ar)/svc/account/payments/[id]/receipt/route';
import { finalizePayment, releasePayment, sweepStalePayments } from '@/lib/pay-core';
import { adminToken, ADMIN_COOKIE } from '@/lib/auth';
import { GET as adminPaymentsGET, POST as adminRefundPOST } from '@/app/(ar)/svc/admin/payments/route';

const RUN = `pay-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://test.local${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? 'not json' : JSON.stringify(body),
  });
}

const asFamily = (id: number | null) => {
  if (id === null) cookieJar.delete(FAMILY_COOKIE);
  else cookieJar.set(FAMILY_COOKIE, familyToken(id));
};

const receipt = (id: number | string, lang?: string) =>
  receiptGET(
    new NextRequest(`http://test.local/svc/account/payments/${id}/receipt${lang ? `?lang=${lang}` : ''}`),
    { params: Promise.resolve({ id: String(id) }) },
  );

// ——— seeded fixtures ———
let programId: number;
let familyA: { id: number };
let familyB: { id: number };
let studentA1: { id: number };
let studentA2: { id: number };
let studentB1: { id: number };
let runId: number;
const BASE_SAR = 1380;

function freshPhone(): string {
  return `+9665${Math.floor(10000000 + Math.random() * 89999999)}`;
}

beforeAll(async () => {
  const program = await prisma.program.create({
    data: {
      slug: `prog-${RUN}`,
      kitCode: 'KIT-01',
      nameEn: `Test Program ${RUN}`,
      nameAr: `برنامج اختبار ${RUN}`,
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
  programId = program.id;

  const now = new Date();
  const run = await prisma.courseRun.create({
    data: {
      programId,
      startDate: now,
      endDate: new Date(now.getTime() + 90 * 24 * 3600 * 1000),
      weekday: 0,
      time: '17:00',
      format: 'in_person',
      capacity: 12,
      seatsLeft: 12,
      monthlyPriceSar: BASE_SAR,
    },
  });
  runId = run.id;

  familyA = await prisma.family.create({ data: { phone: freshPhone(), parentName: `أ ${RUN}` } });
  familyB = await prisma.family.create({ data: { phone: freshPhone(), parentName: `ب ${RUN}` } });
  studentA1 = await prisma.student.create({ data: { familyId: familyA.id, firstName: `سعد ${RUN}`, birthYear: 2016 } });
  studentA2 = await prisma.student.create({ data: { familyId: familyA.id, firstName: `لمى ${RUN}`, birthYear: 2015 } });
  studentB1 = await prisma.student.create({ data: { familyId: familyB.id, firstName: `نوف ${RUN}`, birthYear: 2016 } });
});

afterAll(async () => {
  cookieJar.clear();
  // Program cascade removes runs/enrollments/payment items via FK cascades;
  // payments hang off families, so delete families explicitly.
  await prisma.payment.deleteMany({ where: { familyId: { in: [familyA.id, familyB.id] } } });
  await prisma.program.deleteMany({ where: { id: programId } });
  await prisma.family.deleteMany({ where: { id: { in: [familyA.id, familyB.id] } } });
  await prisma.$disconnect();
});

let enrollmentA1: number; // studentA1's enrollment, created at checkout
let checkoutPaymentId: number;

describe('checkout records a payment', () => {
  it('requires login (401)', async () => {
    asFamily(null);
    const res = await checkoutPOST(jsonReq('/svc/enroll/checkout', 'POST', { provider: 'moyasar_mada' }));
    expect(res.status).toBe(401);
  });

  it('creates paid payment + receipt lines with the sibling discount and sets paidThrough', async () => {
    asFamily(familyA.id);
    cookieJar.set(
      CART_COOKIE,
      encodeCart(familyA.id, [
        { studentId: studentA1.id, courseRunId: runId },
        { studentId: studentA2.id, courseRunId: runId },
      ]),
    );

    const before = new Date();
    const res = await checkoutPOST(jsonReq('/svc/enroll/checkout', 'POST', { provider: 'moyasar_mada' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.paid).toBe(true);
    expect(json.enrollmentIds).toHaveLength(2);

    // 2nd child gets 10% off → total = base + 0.9*base
    const expectedTotal = BASE_SAR + Math.round(effectiveMonthlySar(BASE_SAR, 10));
    expect(json.totalSar).toBe(expectedTotal);

    const payment = await prisma.payment.findFirst({
      where: { familyId: familyA.id, kind: 'enrollment' },
      include: { items: true },
    });
    expect(payment).not.toBeNull();
    expect(payment!.status).toBe('paid');
    expect(payment!.totalSar).toBe(expectedTotal);
    expect(payment!.subtotalSar).toBe(BASE_SAR * 2);
    expect(payment!.discountSar).toBe(BASE_SAR * 2 - expectedTotal);
    expect(payment!.items).toHaveLength(2);
    checkoutPaymentId = payment!.id;

    // paidThrough covers one month from checkout
    const enrollments = await prisma.enrollment.findMany({ where: { id: { in: json.enrollmentIds } } });
    for (const e of enrollments) {
      expect(e.paidThrough).not.toBeNull();
      expect(e.paidThrough!.getTime()).toBeGreaterThan(before.getTime());
      expect(e.paidThrough!.getTime()).toBeLessThanOrEqual(addOneMonth(new Date()).getTime() + 60_000);
    }
    const a1 = enrollments.find((e) => e.studentId === studentA1.id)!;
    enrollmentA1 = a1.id;

    // seats consumed
    const run = await prisma.courseRun.findUnique({ where: { id: runId } });
    expect(run!.seatsLeft).toBe(10);
  });

  it('payment history lists the checkout payment with its items', async () => {
    asFamily(familyA.id);
    const res = await paymentsGET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.payments.map((p: { id: number }) => p.id)).toContain(checkoutPaymentId);
    const p = json.payments.find((x: { id: number }) => x.id === checkoutPaymentId);
    expect(p.items).toHaveLength(2);
    expect(json.subscriptions.map((s: { enrollmentId: number }) => s.enrollmentId)).toContain(enrollmentA1);
  });
});

describe('renewal', () => {
  const renew = (body: unknown) => renewPOST(jsonReq('/svc/account/renew', 'POST', body));

  it('requires login (401) and validates input (400)', async () => {
    asFamily(null);
    expect((await renew({ enrollmentId: 1, provider: 'moyasar_mada' })).status).toBe(401);

    asFamily(familyA.id);
    expect((await renew({ enrollmentId: 'x', provider: 'moyasar_mada' })).status).toBe(400);
    expect((await renew({ enrollmentId: enrollmentA1, provider: 'visa' })).status).toBe(400);
  });

  it('extends paidThrough by one month from the FUTURE paidThrough date', async () => {
    asFamily(familyA.id);
    const beforeEnrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentA1 } });
    const prevPaidThrough = beforeEnrollment!.paidThrough!;
    expect(prevPaidThrough.getTime()).toBeGreaterThan(Date.now()); // still in the future

    const res = await renew({ enrollmentId: enrollmentA1, provider: 'moyasar_stcpay' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.paid).toBe(true);
    expect(json.totalSar).toBe(BASE_SAR); // no discount on this enrollment

    const after = await prisma.enrollment.findUnique({ where: { id: enrollmentA1 } });
    expect(after!.paidThrough!.getTime()).toBe(addOneMonth(prevPaidThrough).getTime());

    // renewal payment recorded with one receipt line covering the period
    const payment = await prisma.payment.findUnique({ where: { id: json.paymentId }, include: { items: true } });
    expect(payment!.kind).toBe('renewal');
    expect(payment!.familyId).toBe(familyA.id);
    expect(payment!.items).toHaveLength(1);
    expect(payment!.items[0].periodStart.getTime()).toBe(prevPaidThrough.getTime());
    expect(payment!.items[0].periodEnd.getTime()).toBe(addOneMonth(prevPaidThrough).getTime());
  });

  it('extends from NOW when paidThrough is in the past', async () => {
    // lapse the subscription
    const past = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    await prisma.enrollment.update({ where: { id: enrollmentA1 }, data: { paidThrough: past } });

    asFamily(familyA.id);
    const before = Date.now();
    const res = await renew({ enrollmentId: enrollmentA1, provider: 'moyasar_mada' });
    expect(res.status).toBe(200);

    const after = await prisma.enrollment.findUnique({ where: { id: enrollmentA1 } });
    // new paidThrough ≈ addOneMonth(now), definitely later than addOneMonth(past)
    expect(after!.paidThrough!.getTime()).toBeGreaterThan(addOneMonth(past).getTime());
    expect(after!.paidThrough!.getTime()).toBeGreaterThanOrEqual(addOneMonth(new Date(before)).getTime() - 60_000);
  });

  it("refuses to renew another family's enrollment (404, unchanged)", async () => {
    const snapshot = await prisma.enrollment.findUnique({ where: { id: enrollmentA1 } });

    asFamily(familyB.id);
    const res = await renew({ enrollmentId: enrollmentA1, provider: 'moyasar_mada' });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');

    const untouched = await prisma.enrollment.findUnique({ where: { id: enrollmentA1 } });
    expect(untouched!.paidThrough!.getTime()).toBe(snapshot!.paidThrough!.getTime());
    expect(await prisma.payment.count({ where: { familyId: familyB.id } })).toBe(0);
  });

  it('refuses non-renewable enrollment states (409)', async () => {
    const cancelled = await prisma.enrollment.create({
      data: { studentId: studentA2.id, courseRunId: runId, status: 'cancelled', monthlyPriceSar: BASE_SAR },
    }).catch(async () => {
      // studentA2 already enrolled in this run from checkout — flip its status instead
      const e = await prisma.enrollment.findFirst({ where: { studentId: studentA2.id, courseRunId: runId } });
      return prisma.enrollment.update({ where: { id: e!.id }, data: { status: 'cancelled' } });
    });

    asFamily(familyA.id);
    const res = await renew({ enrollmentId: cancelled.id, provider: 'moyasar_mada' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('not_renewable');
  });
});

// ────────────────────────────────────────────────────────────
// Tamara settlement semantics (provider fetch mocked)
// ────────────────────────────────────────────────────────────
describe('Tamara settlement: authorization vs capture', () => {
  // Set TAMARA_API_TOKEN so `tamaraLive()` returns true (needed for
  // verifyPayment to call the real verify path, not the SIM shortcut).
  const TAMARA_REF = `TAMARA-TEST-${Date.now()}`;
  let initiatedPaymentId: number;
  let initiatedEnrollmentId: number;

  beforeAll(async () => {
    // Seed an active enrollment for studentB1 if not already enrolled.
    const existing = await prisma.enrollment.findFirst({ where: { studentId: studentB1.id, courseRunId: runId } });
    const enr = existing ?? await prisma.enrollment.create({
      data: { studentId: studentB1.id, courseRunId: runId, status: 'pending', monthlyPriceSar: BASE_SAR },
    });
    initiatedEnrollmentId = enr.id;

    // Create an 'initiated' payment row as if a live Tamara checkout was started.
    const now = new Date();
    const p = await prisma.payment.create({
      data: {
        familyId: familyB.id,
        kind: 'enrollment',
        provider: 'tamara',
        reference: TAMARA_REF,
        status: 'initiated',
        subtotalSar: BASE_SAR,
        discountSar: 0,
        totalSar: BASE_SAR,
        simulated: false,
        items: {
          create: [{
            enrollmentId: initiatedEnrollmentId,
            studentName: `نوف`,
            programAr: 'برنامج',
            programEn: 'Program',
            periodStart: now,
            periodEnd: addOneMonth(now),
            baseSar: BASE_SAR,
            discountPct: 0,
            totalSar: BASE_SAR,
          }],
        },
      },
    });
    initiatedPaymentId = p.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TAMARA_API_TOKEN;
  });

  it('leaves payment initiated (pending) when Tamara reports authorised but capture fails', async () => {
    process.env.TAMARA_API_TOKEN = 'test-token';

    // Mock fetch: GET /orders/:id → authorised, POST /payments/capture → 500
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/orders/') && !url.includes('authorise')) {
        return new Response(JSON.stringify({ status: 'authorised', total_amount: { amount: BASE_SAR, currency: 'SAR' } }), { status: 200 });
      }
      if (url.includes('/payments/capture')) {
        return new Response(JSON.stringify({ message: 'capture error' }), { status: 500 });
      }
      return new Response('{}', { status: 404 });
    });

    const outcome = await finalizePayment(initiatedPaymentId);
    expect(outcome).toBe('pending');

    // Payment must still be 'initiated', enrollment still 'pending'.
    const payment = await prisma.payment.findUnique({ where: { id: initiatedPaymentId } });
    expect(payment!.status).toBe('initiated');
    const enrollment = await prisma.enrollment.findUnique({ where: { id: initiatedEnrollmentId } });
    expect(enrollment!.status).toBe('pending');
  });

  it('settles payment as paid when Tamara reports fully_captured (no capture call needed)', async () => {
    process.env.TAMARA_API_TOKEN = 'test-token';

    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/orders/')) {
        return new Response(JSON.stringify({ status: 'fully_captured', total_amount: { amount: BASE_SAR, currency: 'SAR' } }), { status: 200 });
      }
      // capture should NOT be called for fully_captured; fail loudly if it is.
      if (url.includes('/payments/capture')) {
        return new Response(JSON.stringify({ message: 'should not capture' }), { status: 500 });
      }
      return new Response('{}', { status: 404 });
    });

    const outcome = await finalizePayment(initiatedPaymentId);
    expect(outcome).toBe('paid');

    const payment = await prisma.payment.findUnique({ where: { id: initiatedPaymentId } });
    expect(payment!.status).toBe('paid');
    const enrollment = await prisma.enrollment.findUnique({ where: { id: initiatedEnrollmentId } });
    expect(enrollment!.status).toBe('active');
  });
});

// ────────────────────────────────────────────────────────────
// Stale payment sweep: abandoned checkouts release seats
// ────────────────────────────────────────────────────────────
describe('stale payment sweep', () => {
  let sweepPaymentId: number;
  let sweepEnrollmentId: number;
  let sweepRunId: number;

  beforeAll(async () => {
    // Create a dedicated run with limited seats so we can verify seat return.
    const now = new Date();
    const sweepRun = await prisma.courseRun.create({
      data: {
        programId,
        startDate: now,
        endDate: new Date(now.getTime() + 90 * 24 * 3600 * 1000),
        weekday: 1,
        time: '10:00',
        format: 'in_person',
        capacity: 2,
        seatsLeft: 1, // one seat already taken (simulated)
        monthlyPriceSar: BASE_SAR,
      },
    });
    sweepRunId = sweepRun.id;

    const enr = await prisma.enrollment.create({
      data: { studentId: studentA1.id, courseRunId: sweepRunId, status: 'pending', monthlyPriceSar: BASE_SAR },
    });
    sweepEnrollmentId = enr.id;

    // Create an initiated payment dated 2 hours ago — well past the 45-min window.
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    const p = await prisma.payment.create({
      data: {
        familyId: familyA.id,
        kind: 'enrollment',
        provider: 'moyasar_mada',
        reference: `INIT-STALE-${Date.now()}`,
        status: 'initiated',
        subtotalSar: BASE_SAR,
        discountSar: 0,
        totalSar: BASE_SAR,
        simulated: false,
        createdAt: twoHoursAgo,
        items: {
          create: [{
            enrollmentId: sweepEnrollmentId,
            studentName: 'سعد',
            programAr: 'برنامج',
            programEn: 'Program',
            periodStart: twoHoursAgo,
            periodEnd: addOneMonth(twoHoursAgo),
            baseSar: BASE_SAR,
            discountPct: 0,
            totalSar: BASE_SAR,
          }],
        },
      },
    });
    sweepPaymentId = p.id;
    // Manually backdate createdAt since Prisma default ignores the provided value on create
    await prisma.$executeRawUnsafe(
      `UPDATE ye_payments SET "createdAt" = $1 WHERE id = $2`,
      twoHoursAgo,
      sweepPaymentId,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MOYASAR_SECRET_KEY;
  });

  it('marks payment expired (not failed) and releases seats when provider is still pending after timeout', async () => {
    process.env.MOYASAR_SECRET_KEY = 'sk_test_fake';

    // Provider still says pending (parent abandoned the checkout page).
    vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ status: 'initiated' }), { status: 200 }),
    );

    const runBefore = await prisma.courseRun.findUnique({ where: { id: sweepRunId } });
    expect(runBefore!.seatsLeft).toBe(1); // seat is currently held

    const { settled, expired } = await sweepStalePayments(45);
    expect(settled).toBe(0);
    expect(expired).toBeGreaterThanOrEqual(1);

    // Payment must now be 'expired' (NOT 'failed') so it can still be reconciled.
    const payment = await prisma.payment.findUnique({ where: { id: sweepPaymentId } });
    expect(payment!.status).toBe('expired');

    // Enrollment cancelled (not deleted) so PaymentItem.enrollmentId is preserved for late settlement.
    const enrollment = await prisma.enrollment.findUnique({ where: { id: sweepEnrollmentId } });
    expect(enrollment).not.toBeNull();
    expect(enrollment!.status).toBe('cancelled');

    // Seat returned.
    const runAfter = await prisma.courseRun.findUnique({ where: { id: sweepRunId } });
    expect(runAfter!.seatsLeft).toBe(2);
  });

  it('re-seats and activates enrollment when provider confirms paid after timeout (late webhook)', async () => {
    process.env.MOYASAR_SECRET_KEY = 'sk_test_fake';

    // Payment must be in 'expired' state from the previous test.
    const paymentBefore = await prisma.payment.findUnique({ where: { id: sweepPaymentId } });
    expect(paymentBefore!.status).toBe('expired');

    // Enrollment must be 'cancelled' (not deleted) from the sweep.
    const enrollmentBefore = await prisma.enrollment.findUnique({ where: { id: sweepEnrollmentId } });
    expect(enrollmentBefore!.status).toBe('cancelled');

    // Seat was returned during sweep — verify there's capacity.
    const runBefore = await prisma.courseRun.findUnique({ where: { id: sweepRunId } });
    expect(runBefore!.seatsLeft).toBe(2);

    // Provider now says paid (family completed payment on another device/window).
    vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ status: 'paid' }), { status: 200 }),
    );

    const outcome = await finalizePayment(sweepPaymentId);
    expect(outcome).toBe('paid');

    // Payment settled.
    const paymentAfter = await prisma.payment.findUnique({ where: { id: sweepPaymentId } });
    expect(paymentAfter!.status).toBe('paid');

    // Enrollment re-activated and seat consumed.
    const enrollmentAfter = await prisma.enrollment.findUnique({ where: { id: sweepEnrollmentId } });
    expect(enrollmentAfter!.status).toBe('active');
    expect(enrollmentAfter!.paidThrough).not.toBeNull();

    const runAfter = await prisma.courseRun.findUnique({ where: { id: sweepRunId } });
    expect(runAfter!.seatsLeft).toBe(1); // one seat consumed by re-activation
  });

  it('does not release recently-created initiated payments (within the window)', async () => {
    // Create a fresh initiated payment (seconds old).
    const freshEnr = await prisma.enrollment.create({
      data: { studentId: studentB1.id, courseRunId: sweepRunId, status: 'pending', monthlyPriceSar: BASE_SAR },
    }).catch(async () => {
      const e = await prisma.enrollment.findFirst({ where: { studentId: studentB1.id, courseRunId: sweepRunId } });
      return prisma.enrollment.update({ where: { id: e!.id }, data: { status: 'pending' } });
    });

    const freshPayment = await prisma.payment.create({
      data: {
        familyId: familyB.id,
        kind: 'enrollment',
        provider: 'moyasar_mada',
        reference: `INIT-FRESH-${Date.now()}`,
        status: 'initiated',
        subtotalSar: BASE_SAR,
        discountSar: 0,
        totalSar: BASE_SAR,
        simulated: false,
        items: {
          create: [{
            enrollmentId: freshEnr.id,
            studentName: 'نوف',
            programAr: 'برنامج',
            programEn: 'Program',
            periodStart: new Date(),
            periodEnd: addOneMonth(new Date()),
            baseSar: BASE_SAR,
            discountPct: 0,
            totalSar: BASE_SAR,
          }],
        },
      },
    });

    process.env.MOYASAR_SECRET_KEY = 'sk_test_fake';
    vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ status: 'initiated' }), { status: 200 }),
    );

    await sweepStalePayments(45);

    // Fresh payment must be untouched.
    const p = await prisma.payment.findUnique({ where: { id: freshPayment.id } });
    expect(p!.status).toBe('initiated');

    // Cleanup
    await prisma.payment.delete({ where: { id: freshPayment.id } });
    await prisma.enrollment.deleteMany({ where: { id: freshEnr.id } });
  });
});

// ────────────────────────────────────────────────────────────
// Webhook security: authentication + provider binding
// ────────────────────────────────────────────────────────────
import { createHmac as nodeCreateHmac } from 'crypto';

describe('webhook security', () => {
  // Import webhook handlers inline so their module reads updated env vars.
  // We import after vi.mock('next/headers') is already in effect.
  let moyasarWebhook: typeof import('@/app/(ar)/svc/pay/webhook/moyasar/route').POST;
  let tamaraWebhook: typeof import('@/app/(ar)/svc/pay/webhook/tamara/route').POST;

  beforeAll(async () => {
    const m = await import('@/app/(ar)/svc/pay/webhook/moyasar/route');
    const t = await import('@/app/(ar)/svc/pay/webhook/tamara/route');
    moyasarWebhook = m.POST;
    tamaraWebhook = t.POST;
  });

  beforeEach(() => {
    // Ensure secrets start cleared for each test; specific tests set them explicitly.
    delete process.env.MOYASAR_WEBHOOK_SECRET;
    delete process.env.TAMARA_NOTIFICATION_TOKEN;
  });

  afterEach(() => {
    delete process.env.MOYASAR_WEBHOOK_SECRET;
    delete process.env.TAMARA_NOTIFICATION_TOKEN;
  });

  function webhookReq(url: string, body: unknown, headers?: Record<string, string>) {
    return new NextRequest(`http://test.local${url}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  it('Moyasar webhook: 503 when MOYASAR_WEBHOOK_SECRET is not configured', async () => {
    // No secret set → fail closed. (The workspace may have a real secret in
    // the environment — remove it so this test is environment-independent.)
    delete process.env.MOYASAR_WEBHOOK_SECRET;
    const res = await moyasarWebhook(webhookReq('/svc/pay/webhook/moyasar', {}));
    expect(res.status).toBe(503);
  });

  it('Moyasar webhook: 401 with wrong or missing secret_token', async () => {
    process.env.MOYASAR_WEBHOOK_SECRET = 'correct-secret';
    const data = { id: 'inv_123', metadata: { order_ref: '999' } };

    // No secret_token in payload
    const res1 = await moyasarWebhook(webhookReq('/svc/pay/webhook/moyasar', { data }));
    expect(res1.status).toBe(401);

    // Wrong secret_token
    const res2 = await moyasarWebhook(webhookReq('/svc/pay/webhook/moyasar', { secret_token: 'wrong-secret', data }));
    expect(res2.status).toBe(401);

    // Correct secret_token passes auth (unknown payment → 200 payment_not_found)
    const res3 = await moyasarWebhook(webhookReq('/svc/pay/webhook/moyasar', { secret_token: 'correct-secret', data: { id: 'inv_unknown' } }));
    expect(res3.status).toBe(200);
    expect((await res3.json()).note).toBe('payment_not_found');
  });

  it('Tamara webhook: 503 when TAMARA_NOTIFICATION_TOKEN is not configured', async () => {
    delete process.env.TAMARA_NOTIFICATION_TOKEN;
    const res = await tamaraWebhook(webhookReq('/svc/pay/webhook/tamara', {}));
    expect(res.status).toBe(503);
  });

  function makeTamaraJwt(secret: string, payload: Record<string, unknown> = { iss: 'Tamara' }) {
    const b64u = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const h = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })));
    const p = b64u(Buffer.from(JSON.stringify(payload)));
    const sig = b64u(nodeCreateHmac('sha256', secret).update(`${h}.${p}`).digest());
    return `${h}.${p}.${sig}`;
  }

  it('Tamara webhook: 401 with wrong or missing tamaraToken JWT', async () => {
    process.env.TAMARA_NOTIFICATION_TOKEN = 'correct-token';
    const body = { order_id: 'tamara-order-123', order_reference_id: '999' };

    // No token at all
    const res1 = await tamaraWebhook(webhookReq('/svc/pay/webhook/tamara', body));
    expect(res1.status).toBe(401);

    // JWT signed with the wrong secret
    const badJwt = makeTamaraJwt('wrong-token');
    const res2 = await tamaraWebhook(webhookReq('/svc/pay/webhook/tamara', body, { authorization: `Bearer ${badJwt}` }));
    expect(res2.status).toBe(401);

    // Expired JWT signed with the correct secret
    const expiredJwt = makeTamaraJwt('correct-token', { iss: 'Tamara', exp: Math.floor(Date.now() / 1000) - 60 });
    const res3 = await tamaraWebhook(webhookReq('/svc/pay/webhook/tamara', body, { authorization: `Bearer ${expiredJwt}` }));
    expect(res3.status).toBe(401);

    // Valid JWT in Authorization header passes auth (unknown payment → 200)
    const goodJwt = makeTamaraJwt('correct-token', { iss: 'Tamara', exp: Math.floor(Date.now() / 1000) + 900 });
    const res4 = await tamaraWebhook(webhookReq('/svc/pay/webhook/tamara', { order_id: 'no-such-order' }, { authorization: `Bearer ${goodJwt}` }));
    expect(res4.status).toBe(200);
    expect((await res4.json()).note).toBe('payment_not_found');

    // Valid JWT via ?tamaraToken= query param also passes auth
    const res5 = await tamaraWebhook(
      new NextRequest(`http://test.local/svc/pay/webhook/tamara?tamaraToken=${goodJwt}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ order_id: 'no-such-order' }),
      }),
    );
    expect(res5.status).toBe(200);
  });

  it('Moyasar webhook cannot finalize a Tamara payment (cross-provider injection)', async () => {
    process.env.MOYASAR_WEBHOOK_SECRET = 'correct-secret';

    // Create a Tamara payment in 'initiated' state.
    const now = new Date();
    const tamaraPayment = await prisma.payment.create({
      data: {
        familyId: familyA.id,
        kind: 'renewal',
        provider: 'tamara',
        reference: `TAMARA-CROSS-${Date.now()}`,
        status: 'initiated',
        subtotalSar: 100,
        discountSar: 0,
        totalSar: 100,
        simulated: false,
        items: { create: [{ studentName: 'test', programAr: 'p', programEn: 'p', periodStart: now, periodEnd: addOneMonth(now), baseSar: 100, discountPct: 0, totalSar: 100 }] },
      },
    });

    // Attacker sends a Moyasar webhook with the Tamara payment's numeric ID as order_ref.
    const body = { secret_token: 'correct-secret', data: { id: 'inv_fake', metadata: { order_ref: String(tamaraPayment.id) } } };

    const res = await moyasarWebhook(
      new NextRequest('http://test.local/svc/pay/webhook/moyasar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.note).toBe('payment_not_found'); // cross-provider lookup blocked

    // Tamara payment must remain initiated — not settled via a Moyasar webhook.
    const p = await prisma.payment.findUnique({ where: { id: tamaraPayment.id } });
    expect(p!.status).toBe('initiated');

    // Cleanup
    await prisma.payment.delete({ where: { id: tamaraPayment.id } });
  });
});

describe('admin refund', () => {
  const asAdmin = (on: boolean) => {
    if (on) cookieJar.set(ADMIN_COOKIE, adminToken());
    else cookieJar.delete(ADMIN_COOKIE);
  };
  const refundReq = (body?: unknown) =>
    adminRefundPOST(jsonReq('/svc/admin/payments', 'POST', body));

  it('requires an admin session (401) and validates input (400)', async () => {
    asAdmin(false);
    expect((await adminPaymentsGET()).status).toBe(401);
    expect((await refundReq({ id: checkoutPaymentId })).status).toBe(401);
    asAdmin(true);
    expect((await refundReq()).status).toBe(400);
    expect((await refundReq({ id: 'abc' })).status).toBe(400);
  });

  it('404 for an unknown payment, 409 for a non-paid payment', async () => {
    asAdmin(true);
    expect((await refundReq({ id: 999999999 })).status).toBe(404);
    const failed = await prisma.payment.create({
      data: {
        familyId: familyA.id, kind: 'renewal', provider: 'moyasar_mada',
        reference: `SIM-${RUN}-failed`, status: 'failed',
        subtotalSar: 10, totalSar: 10, simulated: true,
      },
    });
    expect((await refundReq({ id: failed.id })).status).toBe(409);
    await prisma.payment.delete({ where: { id: failed.id } });
  });

  it('refunds a simulated paid payment: status → refunded, visible in family history and receipt, idempotent', async () => {
    asAdmin(true);
    const res = await refundReq({ id: checkoutPaymentId });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('refunded');

    const p = await prisma.payment.findUnique({ where: { id: checkoutPaymentId } });
    expect(p?.status).toBe('refunded');

    // Listed as refunded in the admin panel.
    const list = await (await adminPaymentsGET()).json();
    expect(list.payments.find((x: any) => x.id === checkoutPaymentId)?.status).toBe('refunded');

    // Second refund is a no-op success.
    expect((await refundReq({ id: checkoutPaymentId })).status).toBe(200);

    // Family history + receipt reflect the refund.
    asFamily(familyA.id);
    const hist = await (await paymentsGET()).json();
    expect(hist.payments.find((x: any) => x.id === checkoutPaymentId)?.status).toBe('refunded');
    const rc = await receipt(checkoutPaymentId);
    expect(await rc.text()).toContain('تم استرجاع مبلغ هذه الدفعة');
  });

  it('refund with cancelEnrollment cancels the enrollment, frees the seat, and voids paidThrough', async () => {
    asAdmin(true);
    const run = await prisma.courseRun.create({
      data: {
        programId: (await prisma.courseRun.findUniqueOrThrow({ where: { id: runId } })).programId,
        startDate: new Date(), endDate: addOneMonth(new Date()), weekday: 0, time: '17:00',
        format: 'in_person', capacity: 5, seatsLeft: 4, monthlyPriceSar: BASE_SAR,
      },
    });
    const now = new Date();
    const enr = await prisma.enrollment.create({
      data: { studentId: studentA1.id, courseRunId: run.id, status: 'active', startedAt: now, paidThrough: addOneMonth(now), monthlyPriceSar: BASE_SAR },
    });
    const payment = await prisma.payment.create({
      data: {
        familyId: familyA.id, kind: 'enrollment', provider: 'moyasar_mada',
        reference: `SIM-${RUN}-cancel`, status: 'paid',
        subtotalSar: BASE_SAR, totalSar: BASE_SAR, simulated: true,
        items: { create: [{ enrollmentId: enr.id, studentName: 'سعد', programAr: 'p', programEn: 'p', periodStart: now, periodEnd: addOneMonth(now), baseSar: BASE_SAR, discountPct: 0, totalSar: BASE_SAR }] },
      },
    });

    const res = await refundReq({ id: payment.id, cancelEnrollment: true });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('refunded');
    expect(json.cancelledEnrollments).toBe(1);

    const after = await prisma.enrollment.findUnique({ where: { id: enr.id } });
    expect(after?.status).toBe('cancelled');
    expect(after?.paidThrough).toBeNull();
    const runAfter = await prisma.courseRun.findUnique({ where: { id: run.id } });
    expect(runAfter?.seatsLeft).toBe(5); // seat returned

    // Idempotent: a second refund request does not double-release the seat.
    expect((await refundReq({ id: payment.id, cancelEnrollment: true })).status).toBe(200);
    expect((await prisma.courseRun.findUnique({ where: { id: run.id } }))?.seatsLeft).toBe(5);

    await prisma.payment.delete({ where: { id: payment.id } });
    await prisma.enrollment.delete({ where: { id: enr.id } });
    await prisma.courseRun.delete({ where: { id: run.id } });
  });

  it('renewal refund with cancelEnrollment shrinks paidThrough back to the refunded period start', async () => {
    asAdmin(true);
    const run = await prisma.courseRun.create({
      data: {
        programId: (await prisma.courseRun.findUniqueOrThrow({ where: { id: runId } })).programId,
        startDate: new Date(), endDate: addOneMonth(new Date()), weekday: 0, time: '17:00',
        format: 'in_person', capacity: 5, seatsLeft: 4, monthlyPriceSar: BASE_SAR,
      },
    });
    const periodStart = new Date();
    const periodEnd = addOneMonth(periodStart);
    const enr = await prisma.enrollment.create({
      data: { studentId: studentA2.id, courseRunId: run.id, status: 'active', startedAt: periodStart, paidThrough: periodEnd, monthlyPriceSar: BASE_SAR },
    });
    const payment = await prisma.payment.create({
      data: {
        familyId: familyA.id, kind: 'renewal', provider: 'moyasar_mada',
        reference: `SIM-${RUN}-cancel-renewal`, status: 'paid',
        subtotalSar: BASE_SAR, totalSar: BASE_SAR, simulated: true,
        items: { create: [{ enrollmentId: enr.id, studentName: 'لمى', programAr: 'p', programEn: 'p', periodStart, periodEnd, baseSar: BASE_SAR, discountPct: 0, totalSar: BASE_SAR }] },
      },
    });

    const res = await refundReq({ id: payment.id, cancelEnrollment: true });
    expect(res.status).toBe(200);

    const after = await prisma.enrollment.findUnique({ where: { id: enr.id } });
    expect(after?.status).toBe('cancelled');
    expect(after?.paidThrough?.getTime()).toBe(periodStart.getTime());
    expect((await prisma.courseRun.findUnique({ where: { id: run.id } }))?.seatsLeft).toBe(5);

    await prisma.payment.delete({ where: { id: payment.id } });
    await prisma.enrollment.delete({ where: { id: enr.id } });
    await prisma.courseRun.delete({ where: { id: run.id } });
  });

  it('refund WITHOUT cancelEnrollment leaves the enrollment untouched', async () => {
    asAdmin(true);
    const run = await prisma.courseRun.create({
      data: {
        programId: (await prisma.courseRun.findUniqueOrThrow({ where: { id: runId } })).programId,
        startDate: new Date(), endDate: addOneMonth(new Date()), weekday: 0, time: '17:00',
        format: 'in_person', capacity: 5, seatsLeft: 4, monthlyPriceSar: BASE_SAR,
      },
    });
    const now = new Date();
    const paidThrough = addOneMonth(now);
    const enr = await prisma.enrollment.create({
      data: { studentId: studentB1.id, courseRunId: run.id, status: 'active', startedAt: now, paidThrough, monthlyPriceSar: BASE_SAR },
    });
    const payment = await prisma.payment.create({
      data: {
        familyId: familyB.id, kind: 'enrollment', provider: 'moyasar_mada',
        reference: `SIM-${RUN}-keep`, status: 'paid',
        subtotalSar: BASE_SAR, totalSar: BASE_SAR, simulated: true,
        items: { create: [{ enrollmentId: enr.id, studentName: 'نوف', programAr: 'p', programEn: 'p', periodStart: now, periodEnd: paidThrough, baseSar: BASE_SAR, discountPct: 0, totalSar: BASE_SAR }] },
      },
    });

    const res = await refundReq({ id: payment.id });
    expect(res.status).toBe(200);
    expect((await res.json()).cancelledEnrollments).toBe(0);

    const after = await prisma.enrollment.findUnique({ where: { id: enr.id } });
    expect(after?.status).toBe('active');
    expect(after?.paidThrough?.getTime()).toBe(paidThrough.getTime());
    expect((await prisma.courseRun.findUnique({ where: { id: run.id } }))?.seatsLeft).toBe(4);

    await prisma.payment.delete({ where: { id: payment.id } });
    await prisma.enrollment.delete({ where: { id: enr.id } });
    await prisma.courseRun.delete({ where: { id: run.id } });
  });

  it('concurrent refunds of one payment hit the provider exactly once', async () => {
    asAdmin(true);
    const payment = await prisma.payment.create({
      data: {
        familyId: familyA.id, kind: 'renewal', provider: 'moyasar_mada',
        reference: `inv_live_${RUN}`, status: 'paid',
        subtotalSar: 100, totalSar: 100, simulated: false,
      },
    });

    process.env.MOYASAR_SECRET_KEY = 'sk_test_fake';
    let refundCalls = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/v1/invoices/')) {
        return new Response(JSON.stringify({ payments: [{ id: 'pay_1', status: 'paid' }] }), { status: 200 });
      }
      if (url.includes('/v1/payments/pay_1/refund')) {
        refundCalls += 1;
        await new Promise((r) => setTimeout(r, 50)); // widen the race window
        return new Response(JSON.stringify({ status: 'refunded' }), { status: 200 });
      }
      throw new Error(`unexpected fetch in test: ${init?.method ?? 'GET'} ${url}`);
    });

    try {
      const [r1, r2] = await Promise.all([
        refundReq({ id: payment.id }),
        refundReq({ id: payment.id }),
      ]);
      expect(refundCalls).toBe(1); // the external financial operation ran once
      const statuses = [r1.status, r2.status].sort();
      expect(statuses[0]).toBe(200); // the winner succeeds
      expect([200, 409]).toContain(statuses[1]); // the loser sees in-progress/refunded
      const final = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(final?.status).toBe('refunded');
    } finally {
      fetchSpy.mockRestore();
      delete process.env.MOYASAR_SECRET_KEY;
      await prisma.payment.delete({ where: { id: payment.id } });
    }
  });

  it('lost response after provider executed: reconciliation confirms and records the refund', async () => {
    asAdmin(true);
    const payment = await prisma.payment.create({
      data: {
        familyId: familyA.id, kind: 'renewal', provider: 'moyasar_mada',
        reference: `inv_lost_${RUN}`, status: 'paid',
        subtotalSar: 100, totalSar: 100, simulated: false,
      },
    });
    process.env.MOYASAR_SECRET_KEY = 'sk_test_fake';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/v1/invoices/')) {
        return new Response(JSON.stringify({ payments: [{ id: 'pay_lost', status: 'paid' }] }), { status: 200 });
      }
      if (url.includes('/v1/payments/pay_lost/refund')) {
        throw new Error('socket hang up'); // provider executed, response lost
      }
      if (url.includes('/v1/payments/pay_lost')) {
        return new Response(JSON.stringify({ status: 'refunded' }), { status: 200 }); // reconciliation
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    try {
      const res = await refundReq({ id: payment.id });
      expect(res.status).toBe(200);
      const after = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(after?.status).toBe('refunded');
    } finally {
      fetchSpy.mockRestore();
      delete process.env.MOYASAR_SECRET_KEY;
      await prisma.payment.delete({ where: { id: payment.id } });
    }
  });

  it('unknown outcome keeps the payment in refunding and blocks retries (no duplicate provider refund)', async () => {
    asAdmin(true);
    const payment = await prisma.payment.create({
      data: {
        familyId: familyA.id, kind: 'renewal', provider: 'moyasar_mada',
        reference: `inv_unknown_${RUN}`, status: 'paid',
        subtotalSar: 100, totalSar: 100, simulated: false,
      },
    });
    process.env.MOYASAR_SECRET_KEY = 'sk_test_fake';
    let refundCalls = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/v1/invoices/')) {
        return new Response(JSON.stringify({ payments: [{ id: 'pay_unk', status: 'paid' }] }), { status: 200 });
      }
      if (url.includes('/v1/payments/pay_unk/refund')) {
        refundCalls += 1;
        throw new Error('timeout'); // outcome unknown
      }
      throw new Error('reconciliation also unavailable'); // GET payment fails too
    });
    try {
      const res = await refundReq({ id: payment.id });
      expect(res.status).toBe(502);
      expect((await res.json()).error).toBe('refund_status_unknown');
      const after = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(after?.status).toBe('refunding'); // fail closed — manual reconciliation required

      // A retry must NOT reach the provider again.
      const retry = await refundReq({ id: payment.id });
      expect(retry.status).toBe(409);
      expect((await retry.json()).error).toBe('refund_in_progress');
      expect(refundCalls).toBe(1);
    } finally {
      fetchSpy.mockRestore();
      delete process.env.MOYASAR_SECRET_KEY;
      await prisma.payment.delete({ where: { id: payment.id } });
    }
  });

  it('provider failure rolls the claim back to paid so the admin can retry', async () => {
    asAdmin(true);
    const payment = await prisma.payment.create({
      data: {
        familyId: familyA.id, kind: 'renewal', provider: 'moyasar_mada',
        reference: `inv_fail_${RUN}`, status: 'paid',
        subtotalSar: 100, totalSar: 100, simulated: false,
      },
    });
    process.env.MOYASAR_SECRET_KEY = 'sk_test_fake';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ message: 'boom' }), { status: 500 }),
    );
    try {
      const res = await refundReq({ id: payment.id });
      expect(res.status).toBe(502);
      const after = await prisma.payment.findUnique({ where: { id: payment.id } });
      expect(after?.status).toBe('paid'); // claim rolled back — retry allowed
    } finally {
      fetchSpy.mockRestore();
      delete process.env.MOYASAR_SECRET_KEY;
      await prisma.payment.delete({ where: { id: payment.id } });
    }
  });
});

// ────────────────────────────────────────────────────────────
// Production fail-closed: no simulated payments on the published site
// (incident 2026-08-12 — enrollment activated with no real money collected)
// ────────────────────────────────────────────────────────────
import {
  createPayment,
  paymentAvailability,
  resetTamaraPaymentTypesCache,
} from '@/lib/payments';

describe('production fail-closed (REPLIT_DEPLOYMENT=1)', () => {
  let prodRunId: number;

  beforeAll(async () => {
    const now = new Date();
    const run = await prisma.courseRun.create({
      data: {
        programId,
        startDate: now,
        endDate: new Date(now.getTime() + 90 * 24 * 3600 * 1000),
        weekday: 3,
        time: '18:00',
        format: 'in_person',
        capacity: 5,
        seatsLeft: 5,
        monthlyPriceSar: BASE_SAR,
      },
    });
    prodRunId = run.id;
  });

  beforeEach(() => {
    vi.stubEnv('REPLIT_DEPLOYMENT', '1');
    resetTamaraPaymentTypesCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetTamaraPaymentTypesCache();
  });

  async function expectIndeterminateCheckout(fetchImpl: typeof fetch, expectedReference: RegExp = /^INIT-/) {
    vi.stubEnv('MOYASAR_SECRET_KEY', 'sk_test_fake');
    vi.spyOn(global, 'fetch').mockImplementation(fetchImpl);
    asFamily(familyB.id);
    cookieJar.set(CART_COOKIE, encodeCart(familyB.id, [{ studentId: studentB1.id, courseRunId: prodRunId }]));

    const res = await checkoutPOST(jsonReq('/svc/enroll/checkout', 'POST', { provider: 'moyasar_mada' }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('payment_pending_reconciliation');

    const payment = await prisma.payment.findUnique({ where: { id: json.paymentId }, include: { items: true } });
    expect(payment?.status).toBe('initiated');
    expect(payment?.reference).toMatch(expectedReference);
    const enrollment = await prisma.enrollment.findUnique({ where: { id: payment!.items[0].enrollmentId! } });
    expect(enrollment?.status).toBe('pending');
    expect((await prisma.courseRun.findUnique({ where: { id: prodRunId } }))?.seatsLeft).toBe(4);

    await releasePayment(payment!.id);
    expect((await prisma.courseRun.findUnique({ where: { id: prodRunId } }))?.seatsLeft).toBe(5);
    await prisma.payment.delete({ where: { id: payment!.id } });
    await prisma.enrollment.delete({ where: { id: enrollment!.id } });
    cookieJar.delete(CART_COOKIE);
  }

  it('createPayment refuses to simulate for every provider (provider_not_configured)', async () => {
    for (const provider of ['moyasar_mada', 'moyasar_applepay', 'moyasar_stcpay', 'tamara'] as const) {
      const res = await createPayment(provider, 100, 'test');
      expect(res.status).toBe('failed');
      if (res.status === 'failed') expect(res.error).toBe('provider_not_configured');
    }
  });

  it('checkout without provider credentials fails (402), releases seats, records no active enrollment', async () => {
    asFamily(familyB.id);
    cookieJar.set(CART_COOKIE, encodeCart(familyB.id, [{ studentId: studentB1.id, courseRunId: prodRunId }]));

    const res = await checkoutPOST(jsonReq('/svc/enroll/checkout', 'POST', { provider: 'moyasar_mada' }));
    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe('payment_failed');

    // Seat returned, no lingering enrollment, payment marked failed (not paid/simulated).
    const run = await prisma.courseRun.findUnique({ where: { id: prodRunId } });
    expect(run!.seatsLeft).toBe(5);
    expect(await prisma.enrollment.count({ where: { studentId: studentB1.id, courseRunId: prodRunId } })).toBe(0);
    const p = await prisma.payment.findFirst({
      where: { familyId: familyB.id, kind: 'enrollment' },
      orderBy: { id: 'desc' },
    });
    expect(p!.status).toBe('failed');
    expect(p!.simulated).toBe(false);
    cookieJar.delete(CART_COOKIE);
  });

  it('treats a non-JSON provider 4xx as definitive and releases the seat immediately', async () => {
    vi.stubEnv('MOYASAR_SECRET_KEY', 'sk_test_fake');
    vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response('', { status: 422 }),
    );
    asFamily(familyB.id);
    cookieJar.set(CART_COOKIE, encodeCart(familyB.id, [{ studentId: studentB1.id, courseRunId: prodRunId }]));

    const res = await checkoutPOST(jsonReq('/svc/enroll/checkout', 'POST', { provider: 'moyasar_mada' }));
    expect(res.status).toBe(402);
    const payment = await prisma.payment.findFirst({
      where: { familyId: familyB.id, kind: 'enrollment' },
      orderBy: { id: 'desc' },
      include: { items: true },
    });
    expect(payment?.status).toBe('failed');
    expect((await prisma.courseRun.findUnique({ where: { id: prodRunId } }))?.seatsLeft).toBe(5);
    cookieJar.delete(CART_COOKIE);
  });

  it('keeps the hold reconcilable when provider creation times out', async () => {
    await expectIndeterminateCheckout(async () => {
      throw new DOMException('timed out', 'AbortError');
    });
  });

  it('keeps the hold reconcilable when provider creation returns a server error', async () => {
    await expectIndeterminateCheckout(async () =>
      new Response(JSON.stringify({ message: 'upstream unavailable' }), { status: 503 }),
    );
  });

  it('treats an incomplete Moyasar 2xx response as indeterminate, not a seat-releasing failure', async () => {
    await expectIndeterminateCheckout(
      async () => new Response(JSON.stringify({ id: 'inv_without_redirect' }), { status: 201 }),
      /^inv_without_redirect$/,
    );
  });

  it('does not release or recreate when the provider reference cannot be saved', async () => {
    vi.stubEnv('MOYASAR_SECRET_KEY', 'sk_test_fake');
    vi.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ id: 'inv_save_lost', url: 'https://moyasar.example/pay' }), { status: 201 }),
    );
    const updateSpy = vi.spyOn(prisma.payment, 'update').mockRejectedValueOnce(new Error('database disconnected'));
    asFamily(familyB.id);
    cookieJar.set(CART_COOKIE, encodeCart(familyB.id, [{ studentId: studentB1.id, courseRunId: prodRunId }]));

    const res = await checkoutPOST(jsonReq('/svc/enroll/checkout', 'POST', { provider: 'moyasar_mada' }));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe('payment_pending_reconciliation');

    updateSpy.mockRestore();
    const payment = await prisma.payment.findUnique({ where: { id: json.paymentId }, include: { items: true } });
    expect(payment?.status).toBe('initiated');
    expect(payment?.reference).toMatch(/^INIT-/);
    expect((await prisma.courseRun.findUnique({ where: { id: prodRunId } }))?.seatsLeft).toBe(4);

    // An early return/webhook must never verify INIT-* as a provider reference.
    vi.mocked(global.fetch).mockImplementationOnce(async () => new Response('{}', { status: 404 }));
    expect(await finalizePayment(payment!.id)).toBe('pending');
    expect((await prisma.payment.findUnique({ where: { id: payment!.id } }))?.status).toBe('initiated');
    expect((await prisma.courseRun.findUnique({ where: { id: prodRunId } }))?.seatsLeft).toBe(4);

    // Once lookup finds the checkout, central finalization stores the real
    // reference and settles without creating another provider operation.
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(typeof input === 'string' ? input : (input as Request).url);
      if (url.includes('?metadata')) {
        return new Response(JSON.stringify({ invoices: [{ id: 'inv_save_lost' }] }), { status: 200 });
      }
      if (url.endsWith('/v1/invoices/inv_save_lost')) {
        return new Response(JSON.stringify({ status: 'paid' }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });
    expect(await finalizePayment(payment!.id)).toBe('paid');
    expect((await prisma.payment.findUnique({ where: { id: payment!.id } }))?.reference).toBe('inv_save_lost');
    expect((await prisma.enrollment.findUnique({ where: { id: payment!.items[0].enrollmentId! } }))?.status).toBe('active');

    await prisma.payment.delete({ where: { id: payment!.id } });
    await prisma.enrollment.delete({ where: { id: payment!.items[0].enrollmentId! } });
    await prisma.courseRun.update({ where: { id: prodRunId }, data: { seatsLeft: 5 } });
    cookieJar.delete(CART_COOKIE);
  });

  it('renewal without provider credentials fails (402) and paidThrough is untouched', async () => {
    const before = await prisma.enrollment.findUnique({ where: { id: enrollmentA1 } });
    asFamily(familyA.id);
    const res = await renewPOST(jsonReq('/svc/account/renew', 'POST', { enrollmentId: enrollmentA1, provider: 'moyasar_mada' }));
    expect(res.status).toBe(402);

    const after = await prisma.enrollment.findUnique({ where: { id: enrollmentA1 } });
    expect(after!.paidThrough?.getTime()).toBe(before!.paidThrough?.getTime());
  });

  it('live Moyasar checkout still works in production (redirect)', async () => {
    vi.stubEnv('MOYASAR_SECRET_KEY', 'sk_test_fake');
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(typeof input === 'string' ? input : (input as Request).url);
      if (url.includes('/v1/invoices')) {
        return new Response(JSON.stringify({ id: 'inv_prod_1', url: 'https://moyasar.example/pay' }), { status: 201 });
      }
      return new Response('{}', { status: 404 });
    });

    asFamily(familyB.id);
    cookieJar.set(CART_COOKIE, encodeCart(familyB.id, [{ studentId: studentB1.id, courseRunId: prodRunId }]));
    const res = await checkoutPOST(jsonReq('/svc/enroll/checkout', 'POST', { provider: 'moyasar_mada' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.redirectUrl).toBe('https://moyasar.example/pay');

    // Cleanup: roll back the initiated payment + pending enrollment + seat.
    const p = await prisma.payment.findFirst({ where: { reference: 'inv_prod_1' }, include: { items: true } });
    await prisma.payment.delete({ where: { id: p!.id } });
    await prisma.enrollment.deleteMany({ where: { studentId: studentB1.id, courseRunId: prodRunId, status: 'pending' } });
    await prisma.courseRun.update({ where: { id: prodRunId }, data: { seatsLeft: 5 } });
    cookieJar.delete(CART_COOKIE);
  });

  it('payment availability hides everything when nothing is live in production', async () => {
    expect(await paymentAvailability()).toEqual({ moyasar: false, tamara: false });
  });

  it('payment availability offers everything in development (no REPLIT_DEPLOYMENT)', async () => {
    vi.unstubAllEnvs();
    expect(await paymentAvailability()).toEqual({ moyasar: true, tamara: true });
  });
});

// ────────────────────────────────────────────────────────────
// Tamara payment-types gating (merchant account with no types enabled)
// ────────────────────────────────────────────────────────────
describe('Tamara payment-types gating', () => {
  beforeEach(() => {
    vi.stubEnv('TAMARA_API_TOKEN', 'test-token');
    resetTamaraPaymentTypesCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetTamaraPaymentTypesCache();
  });

  const mockTypes = (body: unknown, status = 200) =>
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(typeof input === 'string' ? input : (input as Request).url);
      if (url.includes('/checkout/payment-types')) {
        return new Response(JSON.stringify(body), { status });
      }
      if (url.includes('/checkout')) {
        return new Response(JSON.stringify({ order_id: 'tmr_1', checkout_url: 'https://tamara.example/pay' }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });

  it('hides Tamara when the account has NO payment types ([])', async () => {
    mockTypes([]);
    expect((await paymentAvailability()).tamara).toBe(false);
  });

  it('offers Tamara when payment types are enabled', async () => {
    mockTypes([{ name: 'PAY_BY_INSTALMENTS' }]);
    expect((await paymentAvailability()).tamara).toBe(true);
  });

  it('stays available on a transient payment-types error (unknown ≠ disabled)', async () => {
    mockTypes({ message: 'oops' }, 500);
    expect((await paymentAvailability()).tamara).toBe(true);
  });

  it('createPayment fails fast with payment_type_unsupported instead of a dead checkout', async () => {
    mockTypes([]);
    const res = await createPayment('tamara', 100, 'test', {
      callbackUrl: 'http://test.local/svc/pay/return?paymentId=1',
      orderRef: '1',
      consumer: { name: 'Test Parent', phone: '+966500000000' },
    });
    expect(res.status).toBe('failed');
    if (res.status === 'failed') expect(res.error).toBe('payment_type_unsupported');
  });

  it('createPayment proceeds to checkout when types are enabled', async () => {
    mockTypes([{ name: 'PAY_BY_INSTALMENTS' }]);
    const res = await createPayment('tamara', 100, 'test', {
      callbackUrl: 'http://test.local/svc/pay/return?paymentId=1',
      orderRef: '1',
      consumer: { name: 'Test Parent', phone: '+966500000000' },
    });
    expect(res.status).toBe('redirect');
  });

  it('treats an incomplete Tamara 2xx response as indeterminate', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(typeof input === 'string' ? input : (input as Request).url);
      if (url.includes('/checkout/payment-types')) {
        return new Response(JSON.stringify([{ name: 'PAY_BY_INSTALMENTS' }]), { status: 200 });
      }
      return new Response(JSON.stringify({ order_id: 'tmr_without_redirect' }), { status: 200 });
    });
    const res = await createPayment('tamara', 100, 'test', {
      callbackUrl: 'http://test.local/svc/pay/return?paymentId=1',
      orderRef: '1',
      consumer: { name: 'Test Parent', phone: '+966500000000' },
    });
    expect(res.status).toBe('indeterminate');
    if (res.status === 'indeterminate') expect(res.reference).toBe('tmr_without_redirect');
  });
});

describe('receipt', () => {
  it('requires login (401)', async () => {
    asFamily(null);
    expect((await receipt(checkoutPaymentId)).status).toBe(401);
  });

  it('rejects a non-numeric id (400)', async () => {
    asFamily(familyA.id);
    expect((await receipt('abc')).status).toBe(400);
  });

  it("is owner-only: another family gets 404", async () => {
    asFamily(familyB.id);
    expect((await receipt(checkoutPaymentId)).status).toBe(404);
  });

  it('renders the HTML receipt for the owner (ar + en)', async () => {
    asFamily(familyA.id);
    const ar = await receipt(checkoutPaymentId);
    expect(ar.status).toBe(200);
    const arHtml = await ar.text();
    expect(arHtml).toContain('إيصال دفع');
    expect(arHtml).toContain(`سعد ${RUN}`);

    const en = await receipt(checkoutPaymentId, 'en');
    expect(en.status).toBe(200);
    expect(await en.text()).toContain('Payment receipt');
  });
});
