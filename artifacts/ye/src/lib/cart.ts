import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

/**
 * Enrollment cart — items live in a signed httpOnly cookie tied to the family
 * session; ALL pricing (1,380 SAR/child/month, 10% sibling discount from the
 * 2nd item) is computed server-side from the database, never from the client.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

function getSecret(): string {
  const v = process.env.SESSION_SECRET;
  if (v) return v;
  if (IS_PROD) throw new Error('SESSION_SECRET must be set in production');
  return 'ye-dev-secret';
}

export const CART_COOKIE = 'ye_cart';
export const CART_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: IS_PROD,
  maxAge: 7 * 24 * 60 * 60,
};

export type CartItem = { studentId: number; courseRunId: number };

const sign = (v: string) => createHmac('sha256', getSecret()).update(v).digest('hex');

export function encodeCart(familyId: number, items: CartItem[]): string {
  const payload = Buffer.from(JSON.stringify({ f: familyId, i: items })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export async function readCart(familyId: number): Promise<CartItem[]> {
  const store = await cookies();
  const raw = store.get(CART_COOKIE)?.value;
  if (!raw) return [];
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return [];
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(sign(payload)))) return [];
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.f !== familyId || !Array.isArray(data.i)) return [];
    return data.i
      .filter((x: CartItem) => Number.isInteger(x?.studentId) && Number.isInteger(x?.courseRunId))
      .slice(0, 20);
  } catch {
    return [];
  }
}

export const SIBLING_DISCOUNT_PCT = 10;

export type PricedItem = {
  studentId: number;
  studentName: string;
  birthYear: number;
  courseRunId: number;
  programSlug: string;
  programNameAr: string;
  programNameEn: string;
  runTitleAr: string | null;
  runTitleEn: string | null;
  weekday: number;
  time: string;
  format: string;
  location: string | null;
  seatsLeft: number;
  baseSar: number;
  discountPct: number;
  totalSar: number;
};

export type PricedCart = {
  items: PricedItem[];
  subtotalSar: number;
  discountSar: number;
  totalSar: number;
};

/**
 * Validate cart items against the DB (ownership, active run, age eligibility)
 * and price them. Invalid items are dropped. Discount: full price for the
 * item with the highest base price, 10% off every additional item.
 */
export async function priceCart(familyId: number, items: CartItem[]): Promise<PricedCart> {
  const currentYear = new Date().getFullYear();
  const [students, runs] = await Promise.all([
    prisma.student.findMany({ where: { familyId, id: { in: items.map((i) => i.studentId) } } }),
    prisma.courseRun.findMany({
      where: { id: { in: items.map((i) => i.courseRunId) }, active: true, endDate: { gte: new Date() } },
      include: { program: true },
    }),
  ]);
  const sMap = new Map(students.map((s) => [s.id, s]));
  const rMap = new Map(runs.map((r) => [r.id, r]));

  const valid = items.flatMap((it) => {
    const s = sMap.get(it.studentId);
    const r = rMap.get(it.courseRunId);
    if (!s || !r) return [];
    const age = currentYear - s.birthYear;
    if (age < r.program.ageMin || age > r.program.ageMax) return [];
    return [{ s, r }];
  });

  // deterministic order: most expensive first pays full price
  valid.sort((a, b) => b.r.monthlyPriceSar - a.r.monthlyPriceSar || a.s.id - b.s.id);

  const priced: PricedItem[] = valid.map(({ s, r }, idx) => {
    const discountPct = idx === 0 ? 0 : SIBLING_DISCOUNT_PCT;
    const totalSar = Math.round(r.monthlyPriceSar * (100 - discountPct)) / 100;
    return {
      studentId: s.id,
      studentName: s.firstName,
      birthYear: s.birthYear,
      courseRunId: r.id,
      programSlug: r.program.slug,
      programNameAr: r.program.nameAr,
      programNameEn: r.program.nameEn,
      runTitleAr: r.titleAr,
      runTitleEn: r.titleEn,
      weekday: r.weekday,
      time: r.time,
      format: r.format,
      location: r.location,
      seatsLeft: r.seatsLeft,
      baseSar: r.monthlyPriceSar,
      discountPct,
      totalSar,
    };
  });

  const subtotalSar = priced.reduce((sum, i) => sum + i.baseSar, 0);
  const totalSar = priced.reduce((sum, i) => sum + i.totalSar, 0);
  return { items: priced, subtotalSar, discountSar: subtotalSar - totalSar, totalSar };
}
