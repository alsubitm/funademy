import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTransientDatabaseError, withDbRetry } from '@/lib/db';
import { maybeSendDbOutageAlert } from '@/lib/dbOutageAlert';

describe('temporary database outage recovery', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    globalThis.__yeDbOutageAlertedAt = undefined;
    globalThis.__yeDbOutageStartedAt = undefined;
  });

  it.each([
    'P1001: Can’t reach database server',
    'Error in PostgreSQL connection: SqlState(E57P01), terminating connection due to administrator command',
    'server has closed the connection unexpectedly',
  ])('classifies a retryable connection failure: %s', (message) => {
    expect(isTransientDatabaseError(new Error(message))).toBe(true);
  });

  it('does not retry validation or constraint errors', async () => {
    const work = vi.fn().mockRejectedValue(new Error('Unique constraint failed'));
    await expect(
      withDbRetry(work, { operation: 'non-transient-test', delaysMs: [0, 0] }),
    ).rejects.toThrow('Unique constraint');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('does not replay a transaction after an ambiguous connection reset', async () => {
    const work = vi.fn().mockRejectedValue(new Error('connection reset by peer'));
    await expect(
      withDbRetry(work, {
        operation: 'unknown-commit-test',
        kind: 'transaction',
        delaysMs: [0, 0],
      }),
    ).rejects.toThrow('connection reset');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it.each([
    'login-otp-transaction',
    'booking-seat-transaction',
    'payment-finalization-transaction',
    'periodic-payment-sweep-read',
  ])('%s recovers after a short interruption', async (operation) => {
    const work = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('57P01 terminating connection due to administrator command'))
      .mockResolvedValue('ok');

    await expect(
      withDbRetry(work, { operation, kind: 'transaction', delaysMs: [0, 0] }),
    ).resolves.toBe('ok');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('alerts outside the database path after retries stay exhausted', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'fake-test-key');
    vi.stubEnv('AUTHENTICA_DB_ALERT_TEMPLATE_ID', '123');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const work = vi.fn().mockRejectedValue(
      new Error('P1001: Can’t reach database server'),
    );
    await expect(
      withDbRetry(work, { operation: 'persistent-test', delaysMs: [0, 0] }),
    ).rejects.toThrow('P1001');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(request.body)).toContain('"otp":"1001"');
    expect(String(request.body)).not.toContain('persistent-test');
  });

  it('cooldown prevents an alert storm without querying the failed database', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'fake-test-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await maybeSendDbOutageAlert('first')).toBe('sent');
    expect(await maybeSendDbOutageAlert('second')).toBe('skipped');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});