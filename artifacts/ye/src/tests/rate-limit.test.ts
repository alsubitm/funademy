/**
 * Tests for the durable (DB-backed) rate limiter:
 *  - limits enforced within the window
 *  - counters survive a "server restart" (state lives in the DB, so a fresh
 *    module instance sees the same counts)
 *  - expired hits fall out of the sliding window
 *  - the appointments route returns 429 after the per-phone daily cap
 *
 * Runs against the isolated ye_test database.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/google-calendar', () => ({
  createMeetEvent: vi.fn(async () => ({ eventId: 'evt-x', meetUrl: 'https://meet.google.com/x' })),
  addAttendeeToEvent: vi.fn(),
}));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { allowRate } from '@/lib/rate-limit';
import { POST as appointmentsPOST } from '@/app/svc/appointments/route';

const RUN = `rl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

describe('allowRate (DB-backed)', () => {
  it('allows up to max hits then rejects within the window', async () => {
    const key = `${RUN}:basic`;
    for (let i = 0; i < 3; i++) {
      expect(await allowRate(key, 3, 60_000)).toBe(true);
    }
    expect(await allowRate(key, 3, 60_000)).toBe(false);
  });

  it('counters survive a server restart (persisted in the DB)', async () => {
    const key = `${RUN}:restart`;
    for (let i = 0; i < 3; i++) {
      expect(await allowRate(key, 3, 60_000)).toBe(true);
    }
    // Simulate a restart: re-import the module fresh so any in-process state
    // is gone. The DB rows must still enforce the limit.
    vi.resetModules();
    const fresh = await import('@/lib/rate-limit');
    expect(await fresh.allowRate(key, 3, 60_000)).toBe(false);
  });

  it('never admits more than max under concurrent parallel requests', async () => {
    const key = `${RUN}:parallel`;
    const results = await Promise.all(
      Array.from({ length: 12 }, () => allowRate(key, 5, 60_000)),
    );
    expect(results.filter(Boolean).length).toBe(5);
    // The DB holds exactly the admitted hits.
    expect(await prisma.rateLimitHit.count({ where: { key } })).toBe(5);
  });

  it('hits outside the sliding window no longer count', async () => {
    const key = `${RUN}:window`;
    // Backdate two hits beyond the window.
    const old = new Date(Date.now() - 11 * 60_000);
    await prisma.rateLimitHit.createMany({
      data: [
        { key, at: old },
        { key, at: old },
      ],
    });
    expect(await allowRate(key, 2, 10 * 60_000)).toBe(true);
    expect(await allowRate(key, 2, 10 * 60_000)).toBe(true);
    expect(await allowRate(key, 2, 10 * 60_000)).toBe(false);
  });

  it('appointments route returns 429 once the per-phone daily cap is hit', async () => {
    const phone = `05${Math.floor(10000000 + Math.random() * 89999999)}`;
    // Pre-seed 3 hits for this phone (the daily cap for consults).
    await prisma.rateLimitHit.createMany({
      data: Array.from({ length: 3 }, () => ({ key: `appt:ph:${phone}` })),
    });
    const req = new NextRequest('http://test.local/svc/appointments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`,
      },
      body: JSON.stringify({
        parentName: 'Test Parent',
        phone,
        startsAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      }),
    });
    const res = await appointmentsPOST(req);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('rate_limited');
  });
});
