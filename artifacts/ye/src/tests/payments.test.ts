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
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

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
