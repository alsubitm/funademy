/**
 * Secret-check hardening:
 * - /svc/pay/sweep accepts ONLY its own SWEEP_SECRET (never ADMIN_PASSWORD),
 *   compared in constant time.
 * - Admin step-up re-auth is constant-time and throttles wrong passwords.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/pay-core', () => ({
  sweepStalePayments: vi.fn().mockResolvedValue({ settled: 0, expired: 0, errors: 0 }),
}));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { POST as sweepPOST } from '@/app/(ar)/svc/pay/sweep/route';
import { verifyAdminStepUp } from '@/lib/admin-step-up';
import { secretsEqual } from '@/lib/secure-compare';

const sweepReq = (token?: string) =>
  new NextRequest('http://localhost/svc/pay/sweep', {
    method: 'POST',
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('secretsEqual', () => {
  it('matches only identical secrets, including different lengths', () => {
    expect(secretsEqual('abc', 'abc')).toBe(true);
    expect(secretsEqual('abc', 'abd')).toBe(false);
    expect(secretsEqual('abc', 'abcd')).toBe(false);
    expect(secretsEqual('', 'abc')).toBe(false);
  });
});

describe('POST /svc/pay/sweep', () => {
  it('does not fall back to ADMIN_PASSWORD when SWEEP_SECRET is unset', async () => {
    vi.stubEnv('SWEEP_SECRET', '');
    vi.stubEnv('ADMIN_PASSWORD', 'admin-pass-for-test');
    const res = await sweepPOST(sweepReq('admin-pass-for-test'));
    expect(res.status).toBe(503);
  });

  it('rejects the admin password and accepts only SWEEP_SECRET', async () => {
    vi.stubEnv('SWEEP_SECRET', 'sweep-secret-for-test');
    vi.stubEnv('ADMIN_PASSWORD', 'admin-pass-for-test');
    expect((await sweepPOST(sweepReq('admin-pass-for-test'))).status).toBe(401);
    expect((await sweepPOST(sweepReq())).status).toBe(401);
    expect((await sweepPOST(sweepReq(''))).status).toBe(401);
    const ok = await sweepPOST(sweepReq('sweep-secret-for-test'));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, settled: 0, expired: 0, errors: 0 });
  });
});

describe('verifyAdminStepUp', () => {
  beforeEach(async () => {
    vi.stubEnv('ADMIN_PASSWORD', 'step-up-pass-for-test');
    await prisma.rateLimitHit.deleteMany({ where: { key: 'admin-stepup-failure' } });
  });
  afterEach(async () => {
    await prisma.rateLimitHit.deleteMany({ where: { key: 'admin-stepup-failure' } });
  });

  it('accepts the right password and rejects a wrong one', async () => {
    expect(await verifyAdminStepUp('step-up-pass-for-test')).toBe('ok');
    expect(await verifyAdminStepUp('nope')).toBe('wrong');
    expect(await verifyAdminStepUp(undefined)).toBe('wrong');
  });

  it('locks step-up after repeated wrong passwords, even for the right one', async () => {
    for (let i = 0; i < 10; i++) expect(await verifyAdminStepUp(`guess-${i}`)).toBe('wrong');
    expect(await verifyAdminStepUp('step-up-pass-for-test')).toBe('locked');
  });

  it('does not count successful step-ups toward the lockout', async () => {
    for (let i = 0; i < 15; i++) expect(await verifyAdminStepUp('step-up-pass-for-test')).toBe('ok');
  });
});
