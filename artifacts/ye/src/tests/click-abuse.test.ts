import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/rate-limit', () => ({ allowRate: vi.fn(async () => true), clientIp: () => 'test' }));
import { allowRate } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { riyadhDay } from '@/lib/constants';
import { POST } from '@/app/(ar)/svc/clicks/route';
import { sweepAbuseRetention } from '@/lib/abuse-retention';

const request = (body: unknown) => new NextRequest('http://test.local/svc/clicks', {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
});

beforeEach(async () => {
  vi.mocked(allowRate).mockReset().mockResolvedValue(true);
  await prisma.clickEvent.deleteMany({});
});

describe('bounded public click tracking', () => {
  it('rejects arbitrary dimensions and malformed bodies without writes or limiter rows', async () => {
    for (const body of [null, {}, [], { kind: 'random', page: 'home' },
      { kind: 'whatsapp', page: '/random' }, { kind: 'whatsapp', page: '/contact?random=1' }]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect(await prisma.clickEvent.count()).toBe(0);
    expect(allowRate).not.toHaveBeenCalled();
  });
  it('aggregates only known dimensions and deletes data older than 90 days', async () => {
    await prisma.clickEvent.create({ data: { kind: 'legacy', page: '/random', day: '2000-01-01' } });
    for (const page of ['home', 'home', '/contact']) {
      expect((await POST(request({ kind: 'whatsapp', page }))).status).toBe(200);
    }
    await sweepAbuseRetention();
    const rows = await prisma.clickEvent.findMany({ orderBy: { page: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.day === riyadhDay() && r.kind === 'whatsapp')).toBe(true);
    expect(rows.find((r) => r.page === 'home')?.count).toBe(2);
  });
  it('rejects excess traffic before any analytics write', async () => {
    vi.mocked(allowRate).mockResolvedValueOnce(false);
    expect((await POST(request({ kind: 'whatsapp', page: 'home' }))).status).toBe(429);
    expect(allowRate).toHaveBeenCalledTimes(1);
    expect(await prisma.clickEvent.count()).toBe(0);
    vi.mocked(allowRate).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await POST(request({ kind: 'whatsapp', page: '/contact' }))).status).toBe(429);
    expect(await prisma.clickEvent.count()).toBe(0);
  });
  it('cleans click limiter rows after one minute but preserves longer booking windows', async () => {
    const now = new Date();
    const prefix = `retention-${now.getTime()}`;
    await prisma.rateLimitHit.createMany({ data: [
      { key: `clicks:${prefix}:old`, at: new Date(now.getTime() - 120_000) },
      { key: `clicks:${prefix}:current`, at: now },
      { key: prefix, at: new Date(now.getTime() - 120_000) },
    ] });
    await sweepAbuseRetention(now);
    expect(await prisma.rateLimitHit.count({ where: { key: `clicks:${prefix}:old` } })).toBe(0);
    expect(await prisma.rateLimitHit.count({ where: { key: `clicks:${prefix}:current` } })).toBe(1);
    expect(await prisma.rateLimitHit.count({ where: { key: prefix } })).toBe(1);
    await prisma.rateLimitHit.deleteMany({ where: { key: { contains: prefix } } });
  });
  it('does not trigger cleanup under repeated rejected requests', async () => {
    const cleanup = vi.spyOn(prisma.clickEvent, 'deleteMany');
    const limiterCleanup = vi.spyOn(prisma.rateLimitHit, 'deleteMany');
    vi.mocked(allowRate).mockResolvedValue(false);
    for (let i = 0; i < 30; i++) {
      expect((await POST(request({ kind: 'whatsapp', page: 'home' }))).status).toBe(429);
    }
    expect(cleanup).not.toHaveBeenCalled();
    expect(limiterCleanup).not.toHaveBeenCalled();
    cleanup.mockRestore();
    limiterCleanup.mockRestore();
  });
  it('the real limiter does no retention scans or inserts once a quota is exhausted', async () => {
    const { allowRate: realAllowRate } = await vi.importActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit');
    const key = `clicks:exhausted:${Date.now()}`;
    await prisma.rateLimitHit.create({ data: { key } });
    const cleanup = vi.spyOn(prisma.rateLimitHit, 'deleteMany');
    for (let i = 0; i < 30; i++) expect(await realAllowRate(key, 1, 60_000)).toBe(false);
    expect(cleanup).not.toHaveBeenCalled();
    expect(await prisma.rateLimitHit.count({ where: { key } })).toBe(1);
    cleanup.mockRestore();
    await prisma.rateLimitHit.deleteMany({ where: { key } });
  });
});
