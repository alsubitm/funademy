/**
 * Real persistence → public quote → enrollment pricing regression.
 * global-setup/setup-env enforce ye_test and strip payment-provider keys.
 * Only Next's request cookie boundary is mocked; no checkout/provider is used.
 */
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { loadProgramPricing } from '@/lib/program-pricing';
import { priceCart } from '@/lib/cart';
import { ADMIN_COOKIE, adminToken } from '@/lib/auth';
import { arabicDigits } from '@/lib/constants';
import { ProgramPricing } from '@/app/(ar)/programs/[slug]/ProgramPricing';
import { PATCH } from '@/app/(ar)/svc/admin/runs/route';

const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.has(name) ? { value: cookieJar.get(name)! } : undefined,
  }),
}));

const tag = `pricing-${randomUUID()}`;
const programIds: number[] = [];
let familyId: number;
let studentId: number;
let runs: Awaited<ReturnType<typeof prisma.courseRun.create>>[] = [];

beforeAll(async () => {
  vi.stubEnv('SESSION_SECRET', 'program-pricing-test-only-secret');
  for (const suffix of ['a', 'b']) {
    const program = await prisma.program.create({
      data: {
        slug: `${tag}-${suffix}`, kitCode: 'KIT-01',
        nameEn: `Pricing ${suffix}`, nameAr: `برنامج ${suffix}`,
        ageMin: 4, ageMax: 14, format: 'online', color: '#123456', level: 1,
        taglineEn: 'Test', taglineAr: 'اختبار', descEn: 'Test', descAr: 'اختبار',
        buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
      },
    });
    programIds.push(program.id);
  }
  const family = await prisma.family.create({
    data: {
      phone: tag, parentName: 'Pricing test',
      students: { create: { firstName: 'Test child', birthYear: new Date().getFullYear() - 8 } },
    },
    include: { students: true },
  });
  familyId = family.id;
  studentId = family.students[0].id;
  const now = Date.now();
  const day = 86_400_000;
  // Same-format runs intentionally differ in fee; the other program is cheaper.
  for (const [index, overrides] of [
    { monthlyPriceSar: 725 },
    { monthlyPriceSar: 1425 },
    { monthlyPriceSar: 0 },
    { monthlyPriceSar: 111, active: false },
    { monthlyPriceSar: 222, endDate: new Date(now - day) },
    { monthlyPriceSar: 333, seatsLeft: 0 },
    { monthlyPriceSar: 490, programId: programIds[1] },
  ].entries()) {
    runs.push(await prisma.courseRun.create({
      data: {
        programId: programIds[0], titleEn: `Run ${index}`, titleAr: `دورة ${index}`,
        startDate: new Date(now - 2 * day), endDate: new Date(now + 90 * day),
        weekday: 2, time: '17:00', format: 'online', capacity: 12, seatsLeft: 12,
        ...overrides,
      },
    }));
  }
});

afterAll(async () => {
  cookieJar.clear();
  vi.unstubAllEnvs();
  // Delete only this suite's fixtures, including after partially failed setup.
  await prisma.program.deleteMany({ where: { id: { in: programIds } } });
  await prisma.family.deleteMany({ where: { phone: tag } });
});

async function assertQuoteMatchesCart(programId: number, expected: Map<number, number>) {
  const quotes = await loadProgramPricing(programId);
  expect(quotes).not.toBeNull();
  expect(quotes!.map(run => run.id).sort((a, b) => a - b))
    .toEqual([...expected.keys()].sort((a, b) => a - b));
  for (const quote of quotes!) {
    expect(quote.monthlyPriceSar).toBe(expected.get(quote.id));
    const cart = await priceCart(familyId, [{ studentId, courseRunId: quote.id }]);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({
      courseRunId: quote.id, baseSar: expected.get(quote.id), discountPct: 0,
    });
    expect(cart.items[0].baseSar).toBe(quote.monthlyPriceSar);
    for (const lang of ['ar', 'en'] as const) {
      const html = renderToStaticMarkup(createElement(ProgramPricing, { runs: quotes, lang }));
      const block = html.split(`data-course-run-id="${quote.id}"`)[1].split('data-course-run-id=')[0];
      const amount = lang === 'ar' ? arabicDigits(cart.items[0].baseSar) : String(cart.items[0].baseSar);
      expect(block).toContain(`<div class="amt">${amount} <small>`);
    }
  }
}

describe('persisted program tuition agrees with enrollment base fees', () => {
  it('isolates programs and excludes inactive, expired and sold-out public quotes', async () => {
    await assertQuoteMatchesCart(programIds[0], new Map([
      [runs[0].id, 725], [runs[1].id, 1425], [runs[2].id, 0],
    ]));
    await assertQuoteMatchesCart(programIds[1], new Map([[runs[6].id, 490]]));
    const invalidCart = await priceCart(familyId, [runs[3], runs[4]].map(run => ({
      studentId, courseRunId: run.id,
    })));
    expect(invalidCart.items).toEqual([]);
    // Sold-out runs are excluded from quotes; seat enforcement belongs to
    // checkout, not priceCart, which may still describe an existing cart item.
  });

  it('reloads the administrator-updated fee in both public quotes and the cart', async () => {
    const selected = runs[0];
    const before = await priceCart(familyId, [{ studentId, courseRunId: selected.id }]);
    expect(before.items[0].baseSar).toBe(725);
    cookieJar.set(ADMIN_COOKIE, adminToken());
    const response = await PATCH(new NextRequest('http://test.local/svc/admin/runs', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: selected.id, monthlyPriceSar: 975 }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).run.monthlyPriceSar).toBe(975);
    await assertQuoteMatchesCart(programIds[0], new Map([
      [selected.id, 975], [runs[1].id, 1425], [runs[2].id, 0],
    ]));
    await assertQuoteMatchesCart(programIds[1], new Map([[runs[6].id, 490]]));
  });
});
