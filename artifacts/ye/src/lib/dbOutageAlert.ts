import { WHATSAPP_NUMBER } from '@/lib/constants';
import {
  authenticaConfigured,
  sendDbOutageAlertViaAuthentica,
} from '@/lib/smsAuthentica';

const ALERT_COOLDOWN_MS = 60 * 60_000;
const ALERT_AFTER_MS = process.env.VITEST ? 0 : 60_000;

declare global {
  // One alert per running autoscale instance per hour. This deliberately
  // cannot use the unavailable database for deduplication.
  // eslint-disable-next-line no-var
  var __yeDbOutageAlertedAt: number | undefined;
  // eslint-disable-next-line no-var
  var __yeDbOutageStartedAt: number | undefined;
}

function adminPhone(): string {
  const env = process.env.ADMIN_ALERT_PHONE?.trim();
  if (env) return env.startsWith('+') ? env : `+${env}`;
  return `+${WHATSAPP_NUMBER}`;
}

/**
 * Alert after all short retries are exhausted. It has no database dependency,
 * never throws, and is cooldown-limited to avoid an SMS storm.
 */
export async function maybeSendDbOutageAlert(operation: string): Promise<'sent' | 'skipped' | 'failed'> {
  if (!authenticaConfigured()) return 'skipped';
  const now = Date.now();
  globalThis.__yeDbOutageStartedAt ??= now;
  if (now - globalThis.__yeDbOutageStartedAt < ALERT_AFTER_MS) return 'skipped';
  if (
    globalThis.__yeDbOutageAlertedAt &&
    now - globalThis.__yeDbOutageAlertedAt < ALERT_COOLDOWN_MS
  ) {
    return 'skipped';
  }
  const result = await sendDbOutageAlertViaAuthentica(adminPhone());
  if (!result.ok) {
    console.error(`[db] persistent outage alert failed (operation=${operation})`);
    return 'failed';
  }
  globalThis.__yeDbOutageAlertedAt = now;
  console.warn(`[db] persistent outage alert sent (operation=${operation})`);
  return 'sent';
}