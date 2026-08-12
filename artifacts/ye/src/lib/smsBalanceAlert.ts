import { prisma } from '@/lib/db';
import { authenticaConfigured, sendLowBalanceAlertViaAuthentica } from '@/lib/smsAuthentica';
import { getCachedBalance, LOW_BALANCE_THRESHOLD_SAR } from '@/lib/smsHealth';
import { WHATSAPP_NUMBER } from '@/lib/constants';

/**
 * Out-of-band low-SMS-balance alert to the admin.
 *
 * Hooked after every OTP request (fire-and-forget) so the balance is
 * watched exactly when it is being consumed — no cron needed. The balance
 * read reuses the 5-minute in-module cache, so most OTP requests trigger
 * zero extra provider calls.
 *
 * Guarantees:
 * - Never throws and is never awaited on the login path — a failure here
 *   can NEVER break family login.
 * - No fake sends: runs only when Authentica is configured (a low balance
 *   can only be observed through the provider anyway).
 * - At most ONE alert per cooldown window (24h), enforced atomically in
 *   the DB (INSERT ... ON CONFLICT ... WHERE), so concurrent OTP requests
 *   and multiple server instances cannot double-send. The claim is taken
 *   BEFORE the send — a failed send waits out the cooldown instead of
 *   retrying on every request (provider calls cost money).
 *
 * Recipient: ADMIN_ALERT_PHONE env override, defaulting to the business
 * WhatsApp/contact number from constants.
 */

export const ALERT_KEY = 'sms_low_balance';
export const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function adminPhone(): string {
  const env = process.env.ADMIN_ALERT_PHONE?.trim();
  if (env) return env.startsWith('+') ? env : `+${env}`;
  return `+${WHATSAPP_NUMBER}`;
}

/**
 * Atomically claim the right to send: inserts the row, or refreshes
 * sentAt only when the previous alert is older than the cooldown.
 * Returns true iff this caller won the claim.
 */
async function claimAlert(now: Date): Promise<boolean> {
  const cutoff = new Date(now.getTime() - ALERT_COOLDOWN_MS);
  const rows = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO ye_admin_alerts (key, sent_at)
    VALUES (${ALERT_KEY}, ${now})
    ON CONFLICT (key) DO UPDATE SET sent_at = ${now}
    WHERE ye_admin_alerts.sent_at < ${cutoff}
    RETURNING key
  `;
  return rows.length > 0;
}

/**
 * Check the (cached) balance and send at most one admin alert per 24h
 * when it is below the threshold. Never throws.
 */
export async function maybeSendLowBalanceAlert(): Promise<
  'sent' | 'send_failed' | 'skipped'
> {
  try {
    if (!authenticaConfigured()) return 'skipped';
    const { balanceSar } = await getCachedBalance();
    if (balanceSar === null || balanceSar >= LOW_BALANCE_THRESHOLD_SAR) return 'skipped';

    if (!(await claimAlert(new Date()))) return 'skipped';

    const res = await sendLowBalanceAlertViaAuthentica(adminPhone(), balanceSar);
    if (!res.ok) {
      console.error('[sms] low-balance admin alert send failed');
      return 'send_failed';
    }
    console.warn(`[sms] low-balance admin alert sent (balance ${balanceSar} SAR)`);
    return 'sent';
  } catch (e) {
    // Absolute guard: this path must never break OTP/login.
    console.error(
      '[sms] low-balance alert check error:',
      e instanceof Error ? e.message : String(e),
    );
    return 'skipped';
  }
}
