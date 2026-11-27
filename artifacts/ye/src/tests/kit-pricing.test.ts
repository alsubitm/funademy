/**
 * Online kit pricing and delivery (owner decisions, Nov 2026):
 * - first online month = class fee + one-time kit fee (CourseRun.kitFeeSar),
 *   one kit per child, every new online enrollment;
 * - the 10% sibling discount applies to the class fee only, never the kit;
 * - in-person runs never charge a kit;
 * - checkout requires a delivery address when a kit is in the cart;
 * - a kit shipment is created once when the payment settles;
 * - admin ships with an SMSA tracking number, then delivered/returned.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => { cookieJar.set(name, value); },
    delete: (name: string) => { cookieJar.delete(name); },
  }),
}));
// Live settlement path: only the provider verdict is mocked.
const verifyPayment = vi.hoisted(() => vi.fn());
vi.mock('@/lib/payments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/payments')>()),
  verifyPayment,
}));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { FAMILY_COOKIE, familyToken } from '@/lib/family-auth';
import { ADMIN_COOKIE, adminToken } from '@/lib/auth';
import { CART_COOKIE, encodeCart, kitFeeFor, priceCart } from '@/lib/cart';
import { addOneMonth } from '@/lib/billing';
import { parseDeliveryAddress } from '@/lib/kit-delivery';
import { finalizePayment } from '@/lib/pay-core';
import { POST as checkoutPOST } from '@/app/(ar)/svc/enroll/checkout/route';
import { GET as kitsGET, PATCH as kitsPATCH } from '@/app/(ar)/svc/admin/kits/route';
import { ProgramPricing } from '@/app/(ar)/programs/[slug]/ProgramPricing';

const RUN = `kit-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PRICE = 1380;
const KIT = 570;

const jsonReq = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://test.local${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const asFamily = (id: number | null) => (id === null ? cookieJar.delete(FAMILY_COOKIE) : cookieJar.set(FAMILY_COOKIE, familyToken(id)));
const asAdmin = (on: boolean) => (on ? cookieJar.set(ADMIN_COOKIE, adminToken()) : cookieJar.delete(ADMIN_COOKIE));
const freshPhone = () => `+9665${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;

const ADDRESS = {
  recipientName: 'أم سارة',
  recipientPhone: '٠٥٥٥١٢٣٤٥٦', // Arabic-Indic digits must normalize
  city: 'جدة',
  district: 'حي الروضة',
  addressLine: 'شارع الأمير سلطان، مبنى 12',
  nationalAddressCode: 'jeda1234',
  postalCode: '23435',
};

let programId: number;
let onlineRunId: number;
let inPersonRunId: number;
let family: { id: number; phone: string };
let kids: { id: number }[] = [];

beforeAll(async () => {
  const program = await prisma.program.create({
    data: {
      slug: `kit-program-${RUN}`, kitCode: 'KIT-ONLINE-01', nameEn: 'Kit Program', nameAr: 'برنامج الطقم',
      ageMin: 4, ageMax: 14, format: 'online', color: '#7C3AED', level: 1,
      taglineEn: 't', taglineAr: 'ت', descEn: 'd', descAr: 'د', buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
    },
  });
  programId = program.id;
  const now = Date.now();
  const common = {
    programId, startDate: new Date(now - 86_400_000), endDate: new Date(now + 90 * 86_400_000),
    weekday: 2, time: '17:00', capacity: 12, seatsLeft: 12, monthlyPriceSar: PRICE,
  };
  onlineRunId = (await prisma.courseRun.create({ data: { ...common, format: 'online', kitFeeSar: KIT } })).id;
  // A kit fee on an in-person run must never be charged (kits are provided in class).
  inPersonRunId = (await prisma.courseRun.create({ data: { ...common, format: 'in_person', location: 'Synthetic Test Centre', kitFeeSar: KIT } })).id;
  const f = await prisma.family.create({
    data: {
      phone: freshPhone(), parentName: `Kit parent ${RUN}`,
      students: { create: [
        { firstName: `Older ${RUN}`, birthYear: new Date().getFullYear() - 10 },
        { firstName: `Younger ${RUN}`, birthYear: new Date().getFullYear() - 8 },
      ] },
    },
    include: { students: true },
  });
  family = f;
  kids = f.students;
});

afterAll(async () => {
  cookieJar.clear();
  await prisma.kitShipment.deleteMany({ where: { familyId: family.id } });
  await prisma.payment.deleteMany({ where: { familyId: family.id } });
  await prisma.program.deleteMany({ where: { id: programId } });
  await prisma.family.deleteMany({ where: { id: family.id } });
});

beforeEach(() => {
  verifyPayment.mockReset();
  cookieJar.clear();
});

describe('kit pricing', () => {
  it('charges the kit only for online runs', () => {
    expect(kitFeeFor({ format: 'online', kitFeeSar: KIT })).toBe(KIT);
    expect(kitFeeFor({ format: 'in_person', kitFeeSar: KIT })).toBe(0);
    expect(kitFeeFor({ format: 'online', kitFeeSar: 0 })).toBe(0);
  });

  it('adds one kit per child and never discounts the kit', async () => {
    const cart = await priceCart(family.id, kids.map((k) => ({ studentId: k.id, courseRunId: onlineRunId })));
    expect(cart.items).toHaveLength(2);
    const [full, sibling] = cart.items;
    expect(full).toMatchObject({ discountPct: 0, kitSar: KIT, totalSar: PRICE + KIT }); // 1950
    expect(sibling).toMatchObject({ discountPct: 10, kitSar: KIT, totalSar: 1242 + KIT }); // 1812
    expect(cart.kitSar).toBe(2 * KIT);
    expect(cart.subtotalSar).toBe(2 * PRICE + 2 * KIT);
    expect(cart.discountSar).toBe(138); // 10% of the second class fee only
    expect(cart.totalSar).toBe(1950 + 1812);
    expect(cart.needsDelivery).toBe(true);
  });

  it('does not charge a kit or require delivery for in-person runs', async () => {
    const cart = await priceCart(family.id, [{ studentId: kids[0].id, courseRunId: inPersonRunId }]);
    expect(cart.items[0]).toMatchObject({ kitSar: 0, totalSar: PRICE });
    expect(cart).toMatchObject({ kitSar: 0, needsDelivery: false, totalSar: PRICE });
  });

  it('shows the one-time kit fee on public program pricing for online runs', () => {
    const run = {
      id: 1, titleAr: null, titleEn: null, startDate: new Date('2027-01-05T00:00:00Z'),
      weekday: 2, time: '17:00', format: 'online' as const, location: null, monthlyPriceSar: PRICE, kitFeeSar: KIT,
    };
    expect(renderToStaticMarkup(createElement(ProgramPricing, { runs: [run], lang: 'en' }))).toContain('570 SAR one-time engineering kit');
    expect(renderToStaticMarkup(createElement(ProgramPricing, { runs: [{ ...run, format: 'in_person' as const }], lang: 'en' }))).not.toContain('kit');
  });
});

describe('delivery address validation', () => {
  it('normalizes Arabic digits, phone and national address code', () => {
    const parsed = parseDeliveryAddress(ADDRESS, '+966500000000');
    expect(parsed).toEqual({
      ok: true,
      address: {
        recipientName: 'أم سارة', recipientPhone: '+966555123456', city: 'جدة', district: 'حي الروضة',
        addressLine: 'شارع الأمير سلطان، مبنى 12', nationalAddressCode: 'JEDA1234', postalCode: '23435',
      },
    });
  });

  it('falls back to the account phone and rejects bad fields', () => {
    const noPhone = parseDeliveryAddress({ ...ADDRESS, recipientPhone: '' }, '+966500000000');
    expect(noPhone.ok && noPhone.address.recipientPhone).toBe('+966500000000');
    expect(parseDeliveryAddress({ ...ADDRESS, city: '' }, '+966500000000')).toEqual({ ok: false, field: 'city' });
    expect(parseDeliveryAddress({ ...ADDRESS, recipientPhone: '12345' }, '+966500000000')).toEqual({ ok: false, field: 'recipientPhone' });
    expect(parseDeliveryAddress({ ...ADDRESS, nationalAddressCode: 'AB12' }, '+966500000000')).toEqual({ ok: false, field: 'nationalAddressCode' });
    expect(parseDeliveryAddress({ ...ADDRESS, postalCode: '123' }, '+966500000000')).toEqual({ ok: false, field: 'postalCode' });
    expect(parseDeliveryAddress(undefined, '+966500000000')).toEqual({ ok: false, field: 'recipientName' });
  });
});

describe('online checkout with a kit', () => {
  it('requires a delivery address before reserving anything', async () => {
    asFamily(family.id);
    cookieJar.set(CART_COOKIE, encodeCart(family.id, [{ studentId: kids[0].id, courseRunId: onlineRunId }]));
    const before = await prisma.courseRun.findUniqueOrThrow({ where: { id: onlineRunId } });
    const res = await checkoutPOST(jsonReq('/svc/enroll/checkout', 'POST', { provider: 'moyasar_mada' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'delivery_address_invalid', field: 'recipientName' });
    expect((await prisma.courseRun.findUniqueOrThrow({ where: { id: onlineRunId } })).seatsLeft).toBe(before.seatsLeft);
    expect(await prisma.payment.count({ where: { familyId: family.id } })).toBe(0);
  });

  it('charges class fee + kit, stores the address and creates one shipment per child', async () => {
    asFamily(family.id);
    cookieJar.set(CART_COOKIE, encodeCart(family.id, kids.map((k) => ({ studentId: k.id, courseRunId: onlineRunId }))));
    const res = await checkoutPOST(jsonReq('/svc/enroll/checkout', 'POST', { provider: 'moyasar_mada', delivery: ADDRESS }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ paid: true, simulated: true, totalSar: 1950 + 1812, kitSar: 2 * KIT });

    const payment = await prisma.payment.findFirstOrThrow({ where: { familyId: family.id, status: 'paid' }, include: { items: true } });
    expect(payment.totalSar).toBe(3762);
    expect(payment.items.map((i) => i.kitFeeSar)).toEqual([KIT, KIT]);
    expect(payment.items.map((i) => i.totalSar).sort()).toEqual([1812, 1950]);
    expect(payment.deliveryAddress).toMatchObject({ city: 'جدة', recipientPhone: '+966555123456', nationalAddressCode: 'JEDA1234' });
    expect((await prisma.family.findUniqueOrThrow({ where: { id: family.id } })).deliveryAddress).toMatchObject({ city: 'جدة' });

    const shipments = await prisma.kitShipment.findMany({ where: { familyId: family.id }, orderBy: { id: 'asc' } });
    expect(shipments).toHaveLength(2);
    for (const s of shipments) {
      expect(s).toMatchObject({ status: 'to_ship', carrier: 'SMSA', kitCode: 'KIT-ONLINE-01', kitFeeSar: KIT, city: 'جدة', district: 'حي الروضة' });
    }
    expect(new Set(shipments.map((s) => s.paymentItemId)).size).toBe(2);
  });
});

describe('live settlement creates the shipment exactly once', () => {
  it('creates a kit shipment when the provider confirms payment, and not again on replay', async () => {
    const enrollment = await prisma.enrollment.create({
      data: { studentId: kids[0].id, courseRunId: inPersonRunId, status: 'pending', monthlyPriceSar: PRICE },
    });
    const now = new Date();
    const reference = `KIT-LIVE-${RUN}`;
    const payment = await prisma.payment.create({
      data: {
        familyId: family.id, kind: 'enrollment', provider: 'moyasar_mada', reference, status: 'initiated',
        subtotalSar: PRICE + KIT, discountSar: 0, totalSar: PRICE + KIT, simulated: false,
        deliveryAddress: { ...ADDRESS, recipientPhone: '+966555123456', nationalAddressCode: 'JEDA1234' },
        items: { create: [{
          enrollmentId: enrollment.id, studentName: 'Live kid', programAr: 'برنامج الطقم', programEn: 'Kit Program',
          periodStart: now, periodEnd: addOneMonth(now), baseSar: PRICE, discountPct: 0, kitFeeSar: KIT, totalSar: PRICE + KIT,
        }] },
      },
      include: { items: true },
    });
    verifyPayment.mockResolvedValue('paid');

    expect(await finalizePayment(payment.id)).toBe('paid');
    expect(await finalizePayment(payment.id)).toBe('paid');
    const shipments = await prisma.kitShipment.findMany({ where: { paymentItemId: payment.items[0].id } });
    expect(shipments).toHaveLength(1);
    expect(shipments[0]).toMatchObject({ status: 'to_ship', studentName: 'Live kid', enrollmentId: enrollment.id });
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } })).status).toBe('active');
  });

  it('flags the payment for review instead of silently skipping a kit with no address', async () => {
    const enrollment = await prisma.enrollment.create({
      data: { studentId: kids[1].id, courseRunId: inPersonRunId, status: 'pending', monthlyPriceSar: PRICE },
    });
    const now = new Date();
    const payment = await prisma.payment.create({
      data: {
        familyId: family.id, kind: 'enrollment', provider: 'moyasar_mada', reference: `KIT-NOADDR-${RUN}`, status: 'initiated',
        subtotalSar: PRICE + KIT, discountSar: 0, totalSar: PRICE + KIT, simulated: false,
        items: { create: [{
          enrollmentId: enrollment.id, studentName: 'No address kid', programAr: 'ب', programEn: 'P',
          periodStart: now, periodEnd: addOneMonth(now), baseSar: PRICE, discountPct: 0, kitFeeSar: KIT, totalSar: PRICE + KIT,
        }] },
      },
    });
    verifyPayment.mockResolvedValue('paid');
    expect(await finalizePayment(payment.id)).toBe('review_required');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).enrollmentIssue).toBe('kit_address_missing');
  });
});

describe('admin kit shipments', () => {
  it('requires admin', async () => {
    expect((await kitsGET(jsonReq('/svc/admin/kits', 'GET'))).status).toBe(401);
    expect((await kitsPATCH(jsonReq('/svc/admin/kits', 'PATCH', { id: 1, action: 'deliver' }))).status).toBe(401);
  });

  it('ships with a tracking number, then delivered, then returned; rejects invalid transitions', async () => {
    asAdmin(true);
    const list = await (await kitsGET(jsonReq('/svc/admin/kits?status=to_ship', 'GET'))).json();
    const mine = list.shipments.filter((s: { familyId: number }) => s.familyId === family.id);
    expect(mine.length).toBeGreaterThan(0);
    const id = mine[0].id as number;

    expect((await kitsPATCH(jsonReq('/svc/admin/kits', 'PATCH', { id, action: 'deliver' }))).status).toBe(409);
    expect((await kitsPATCH(jsonReq('/svc/admin/kits', 'PATCH', { id, action: 'ship', trackingNumber: '12' }))).status).toBe(400);

    const shipped = await kitsPATCH(jsonReq('/svc/admin/kits', 'PATCH', { id, action: 'ship', trackingNumber: ' 2900 1234 5678 ' }));
    expect(shipped.status).toBe(200);
    expect((await shipped.json()).shipment).toMatchObject({ status: 'shipped', trackingNumber: '290012345678' });
    expect((await kitsPATCH(jsonReq('/svc/admin/kits', 'PATCH', { id, action: 'cancel' }))).status).toBe(409);

    const delivered = await (await kitsPATCH(jsonReq('/svc/admin/kits', 'PATCH', { id, action: 'deliver' }))).json();
    expect(delivered.shipment.status).toBe('delivered');
    expect(delivered.shipment.deliveredAt).toBeTruthy();

    const returned = await (await kitsPATCH(jsonReq('/svc/admin/kits', 'PATCH', { id, action: 'return', note: 'Parent returned the kit unused' }))).json();
    expect(returned.shipment).toMatchObject({ status: 'returned', adminNote: 'Parent returned the kit unused' });
    expect((await kitsPATCH(jsonReq('/svc/admin/kits', 'PATCH', { id: 2147483647, action: 'deliver' }))).status).toBe(404);
  });
});
