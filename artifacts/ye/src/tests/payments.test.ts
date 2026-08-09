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
import { POST as checkoutPOST } from '@/app/svc/enroll/checkout/route';
import { POST as renewPOST } from '@/app/svc/account/renew/route';
import { GET as paymentsGET } from '@/app/svc/account/payments/route';
import { GET as receiptGET } from '@/app/svc/account/payments/[id]/receipt/route';
import { finalizePayment, sweepStalePayments } from '@/lib/pay-core';

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
      `UPDATE ye.ye_payments SET "createdAt" = $1 WHERE id = $2`,
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
describe('webhook security', () => {
  // Import webhook handlers inline so their module reads updated env vars.
  // We import after vi.mock('next/headers') is already in effect.
  let moyasarWebhook: typeof import('@/app/svc/pay/webhook/moyasar/route').POST;
  let tamaraWebhook: typeof import('@/app/svc/pay/webhook/tamara/route').POST;

  beforeAll(async () => {
    const m = await import('@/app/svc/pay/webhook/moyasar/route');
    const t = await import('@/app/svc/pay/webhook/tamara/route');
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
    // No secret set → fail closed.
    const res = await moyasarWebhook(webhookReq('/svc/pay/webhook/moyasar', {}));
    expect(res.status).toBe(503);
  });

  it('Moyasar webhook: 401 with wrong or missing signature', async () => {
    process.env.MOYASAR_WEBHOOK_SECRET = 'correct-secret';
    const body = { data: { id: 'inv_123', metadata: { order_ref: '999' } } };

    // No signature header
    const res1 = await moyasarWebhook(webhookReq('/svc/pay/webhook/moyasar', body));
    expect(res1.status).toBe(401);

    // Wrong signature
    const res2 = await moyasarWebhook(webhookReq('/svc/pay/webhook/moyasar', body, { 'x-moyasar-signature': 'deadbeef' }));
    expect(res2.status).toBe(401);
  });

  it('Tamara webhook: 503 when TAMARA_NOTIFICATION_TOKEN is not configured', async () => {
    const res = await tamaraWebhook(webhookReq('/svc/pay/webhook/tamara', {}));
    expect(res.status).toBe(503);
  });

  it('Tamara webhook: 401 with wrong or missing signature', async () => {
    process.env.TAMARA_NOTIFICATION_TOKEN = 'correct-token';
    const body = { order_id: 'tamara-order-123', order_reference_id: '999' };

    const res1 = await tamaraWebhook(webhookReq('/svc/pay/webhook/tamara', body));
    expect(res1.status).toBe(401);

    const res2 = await tamaraWebhook(webhookReq('/svc/pay/webhook/tamara', body, { 'tamara-signature': 'deadbeef' }));
    expect(res2.status).toBe(401);
  });

  it('Moyasar webhook cannot finalize a Tamara payment (cross-provider injection)', async () => {
    const { createHmac } = await import('crypto');
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
    const body = { data: { id: 'inv_fake', metadata: { order_ref: String(tamaraPayment.id) } } };
    const rawBody = JSON.stringify(body);
    const sig = createHmac('sha256', 'correct-secret').update(rawBody).digest('hex');

    const res = await moyasarWebhook(
      new NextRequest('http://test.local/svc/pay/webhook/moyasar', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-moyasar-signature': sig },
        body: rawBody,
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
