/**
 * Payment amounts are stored as whole riyals (Int). A run price that is not
 * divisible by 10 used to produce a fractional sibling price (10% off 1375 =
 * 1237.5), which crashed multi-child checkout with a 500.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { priceCart } from '@/lib/cart';
import { effectiveMonthlySar } from '@/lib/billing';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));

const tag = `rounding-${randomUUID()}`;
let programId: number;
let familyId: number;
let studentIds: number[] = [];
let runId: number;

beforeAll(async () => {
  const program = await prisma.program.create({
    data: {
      slug: tag, kitCode: 'KIT-01', nameEn: 'Rounding', nameAr: 'تقريب',
      ageMin: 4, ageMax: 14, format: 'in_person', color: '#123456', level: 1,
      taglineEn: 't', taglineAr: 'ت', descEn: 'd', descAr: 'د',
      buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
    },
  });
  programId = program.id;
  const now = Date.now();
  const run = await prisma.courseRun.create({
    data: {
      programId, titleEn: 'Run', titleAr: 'دورة', startDate: new Date(now - 86_400_000),
      endDate: new Date(now + 90 * 86_400_000), weekday: 2, time: '17:00', format: 'in_person',
      capacity: 12, seatsLeft: 12, monthlyPriceSar: 1375,
    },
  });
  runId = run.id;
  const family = await prisma.family.create({
    data: {
      phone: tag, parentName: 'Rounding test',
      students: { create: [
        { firstName: 'Older', birthYear: new Date().getFullYear() - 9 },
        { firstName: 'Younger', birthYear: new Date().getFullYear() - 7 },
      ] },
    },
    include: { students: true },
  });
  familyId = family.id;
  studentIds = family.students.map((s) => s.id);
});

afterAll(async () => {
  await prisma.courseRun.deleteMany({ where: { programId } });
  await prisma.program.deleteMany({ where: { id: programId } });
  await prisma.family.deleteMany({ where: { phone: tag } });
});

describe('sibling discount rounding', () => {
  it('rounds the discounted fee to whole riyals', () => {
    expect(effectiveMonthlySar(1375, 10)).toBe(1238);
    expect(effectiveMonthlySar(1399, 10)).toBe(1259);
    expect(effectiveMonthlySar(1380, 10)).toBe(1242);
    expect(effectiveMonthlySar(1380, 0)).toBe(1380);
  });

  it('prices a two-child cart in whole riyals that checkout can store', async () => {
    const cart = await priceCart(familyId, studentIds.map((studentId) => ({ studentId, courseRunId: runId })));
    expect(cart.items).toHaveLength(2);
    for (const amount of [cart.totalSar, cart.subtotalSar, cart.discountSar, ...cart.items.map((i) => i.totalSar)]) {
      expect(Number.isInteger(amount)).toBe(true);
    }
    expect(cart.subtotalSar).toBe(2750);
    expect(cart.totalSar).toBe(1375 + 1238);
    expect(cart.discountSar).toBe(2750 - (1375 + 1238));
  });
});
