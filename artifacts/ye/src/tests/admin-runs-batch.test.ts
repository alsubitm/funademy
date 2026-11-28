/**
 * Admin bulk timetable: POST /svc/admin/runs/batch creates many course runs in
 * one transaction with shared settings, is idempotent for retries, and keeps
 * in-person groups without a confirmed venue hidden.
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
vi.mock('@/lib/revalidate-programs', () => ({ revalidatePrograms: vi.fn() }));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ADMIN_COOKIE, adminToken } from '@/lib/auth';
import { POST as batchPOST } from '@/app/(ar)/svc/admin/runs/batch/route';

const RUN = `batch-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const programIds: number[] = [];
const req = (body: unknown) =>
  new NextRequest('http://test.local/svc/admin/runs/batch', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
const base = {
  format: 'online', capacity: 8, monthlyPriceSar: 1380, kitFeeSar: 570,
  startDate: '2027-01-03', endDate: '2027-06-03', titleAr: 'دفعة يناير ٢٠٢٧',
};

beforeAll(async () => {
  for (const suffix of ['a', 'b']) {
    const p = await prisma.program.create({
      data: {
        slug: `${RUN}-${suffix}`, kitCode: 'KIT', nameEn: `Batch ${suffix}`, nameAr: `دفعات ${suffix}`,
        ageMin: 4, ageMax: 14, format: 'online', color: '#7C3AED', level: 1,
        taglineEn: 't', taglineAr: 'ت', descEn: 'd', descAr: 'د', buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
      },
    });
    programIds.push(p.id);
  }
});
afterAll(async () => {
  await prisma.program.deleteMany({ where: { id: { in: programIds } } });
});
beforeEach(() => {
  cookieJar.clear();
  cookieJar.set(ADMIN_COOKIE, adminToken());
});

describe('POST /svc/admin/runs/batch', () => {
  it('requires admin', async () => {
    cookieJar.clear();
    expect((await batchPOST(req({ ...base, groups: [{ programId: programIds[0], weekday: 0, time: '17:00' }] }))).status).toBe(401);
  });

  it('creates a timetable of online groups with sessions, kit fee and shared settings', async () => {
    const groups = [
      { programId: programIds[0], weekday: 0, time: '17:00' },
      { programId: programIds[1], weekday: 0, time: '17:00' },
      { programId: programIds[0], weekday: 2, time: '19:00' },
    ];
    const res = await batchPOST(req({ ...base, groups }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ created: 3, skipped: 0, active: true });

    const runs = await prisma.courseRun.findMany({
      where: { id: { in: body.runIds } },
      include: { _count: { select: { sessions: true } } },
      orderBy: { id: 'asc' },
    });
    expect(runs).toHaveLength(3);
    for (const r of runs) {
      expect(r).toMatchObject({ format: 'online', capacity: 8, seatsLeft: 8, monthlyPriceSar: 1380, kitFeeSar: 570, active: true, titleAr: 'دفعة يناير ٢٠٢٧' });
      // 3 Jan → 3 Jun 2027 is 22 weekly occurrences for Sunday and Tuesday.
      expect(r._count.sessions).toBe(22);
    }
    // First Sunday session is 3 Jan 2027 at 17:00 Riyadh (14:00 UTC).
    const first = await prisma.classSession.findFirst({ where: { courseRunId: runs[0].id }, orderBy: { date: 'asc' } });
    expect(first?.date.toISOString()).toBe('2027-01-03T14:00:00.000Z');
  });

  it('skips groups that already exist on retry instead of duplicating them', async () => {
    const res = await batchPOST(req({
      ...base,
      groups: [
        { programId: programIds[0], weekday: 0, time: '17:00' }, // exists from the previous test
        { programId: programIds[1], weekday: 4, time: '19:00' }, // new
      ],
    }));
    expect(await res.json()).toMatchObject({ created: 1, skipped: 1 });
    expect(await prisma.courseRun.count({ where: { programId: programIds[0], weekday: 0, time: '17:00', format: 'online' } })).toBe(1);
  });

  it('creates in-person groups hidden until a real venue is confirmed, without a kit fee', async () => {
    const res = await batchPOST(req({ ...base, format: 'in_person', capacity: 16, location: 'الرياض', groups: [{ programId: programIds[1], weekday: 2, time: '17:00' }] }));
    const body = await res.json();
    expect(body).toMatchObject({ created: 1, active: false });
    const run = await prisma.courseRun.findUniqueOrThrow({ where: { id: body.runIds[0] } });
    expect(run).toMatchObject({ format: 'in_person', active: false, kitFeeSar: 0, capacity: 16 });
  });

  it('rejects invalid input without creating anything', async () => {
    const before = await prisma.courseRun.count({ where: { programId: { in: programIds } } });
    const bad = [
      { ...base, groups: [] },
      { ...base, capacity: 0, groups: [{ programId: programIds[0], weekday: 1, time: '17:00' }] },
      { ...base, endDate: '2026-12-01', groups: [{ programId: programIds[0], weekday: 1, time: '17:00' }] },
      { ...base, groups: [{ programId: programIds[0], weekday: 9, time: '17:00' }] },
      { ...base, groups: [{ programId: programIds[0], weekday: 1, time: '5pm' }] },
      { ...base, groups: [{ programId: programIds[0], weekday: 1, time: '17:00' }, { programId: programIds[0], weekday: 1, time: '17:00' }] },
    ];
    for (const body of bad) expect((await batchPOST(req(body))).status).toBe(400);
    expect((await batchPOST(req({ ...base, groups: [{ programId: 2147483647, weekday: 1, time: '17:00' }] }))).status).toBe(404);
    expect(await prisma.courseRun.count({ where: { programId: { in: programIds } } })).toBe(before);
  });
});
