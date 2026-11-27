import { prisma, withDbRetry } from '@/lib/db';
import { getAdminPassword } from '@/lib/auth';
import { secretsEqual } from '@/lib/secure-compare';

/**
 * Step-up re-authentication for sensitive admin actions (e.g. NELC actions
 * that hand the production LRS credential to the browser).
 *
 * The caller already holds an admin cookie, so this check exists to stop a
 * stolen cookie from being turned into the admin password itself: comparison
 * is constant-time and wrong passwords are throttled globally (single-admin
 * app) — after MAX_FAILURES wrong attempts in the window, every step-up is
 * refused until the window passes, even with the right password.
 */
const FAILURE_KEY = 'admin-stepup-failure';
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60_000;

export type StepUpResult = 'ok' | 'wrong' | 'locked';

export async function verifyAdminStepUp(password: unknown): Promise<StepUpResult> {
  const cutoff = new Date(Date.now() - WINDOW_MS);
  const failures = await withDbRetry(
    () => prisma.rateLimitHit.count({ where: { key: FAILURE_KEY, at: { gt: cutoff } } }),
    { operation: 'admin-step-up-failures', kind: 'read' },
  );
  if (failures >= MAX_FAILURES) return 'locked';
  if (secretsEqual(String(password ?? ''), getAdminPassword())) return 'ok';
  await prisma.rateLimitHit.create({ data: { key: FAILURE_KEY } });
  return 'wrong';
}

export function stepUpError(result: Exclude<StepUpResult, 'ok'>) {
  return result === 'locked'
    ? { body: { error: 'too_many_attempts' }, status: 429 }
    : { body: { error: 'reauth_failed' }, status: 401 };
}
