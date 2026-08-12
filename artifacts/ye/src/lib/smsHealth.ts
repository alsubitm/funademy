import { prisma } from '@/lib/db';
import { authenticaConfigured, getAuthenticaBalance } from '@/lib/smsAuthentica';

/**
 * Admin-facing SMS health: Authentica prepaid balance (cached a few minutes
 * so every dashboard open does not hit the provider) plus recent delivery
 * outcomes from ye_otp_codes.delivered. Provider errors are reported
 * honestly (balanceSar: null + balanceError) — never a fake number, and an
 * EXPIRED cached value is never substituted for a failed fetch.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;
export const LOW_BALANCE_THRESHOLD_SAR = 20;

let cache: { at: number; balanceSar: number } | null = null;

/** Test hook — clears the module-level balance cache. */
export function clearSmsBalanceCache() {
  cache = null;
}

export type SmsHealth = {
  configured: boolean;
  balanceSar: number | null;
  balanceError: 'not_configured' | 'provider_error' | null;
  cachedAt: string | null;
  lowThresholdSar: number;
  low: boolean;
  failed24h: number;
  sent24h: number;
};

export async function getSmsHealth(): Promise<SmsHealth> {
  const configured = authenticaConfigured();

  let balanceSar: number | null = null;
  let balanceError: SmsHealth['balanceError'] = null;
  let cachedAt: string | null = null;
  if (!configured) {
    balanceError = 'not_configured';
  } else if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    balanceSar = cache.balanceSar;
    cachedAt = new Date(cache.at).toISOString();
  } else {
    const res = await getAuthenticaBalance();
    if (res.ok) {
      cache = { at: Date.now(), balanceSar: res.balanceSar };
      balanceSar = res.balanceSar;
      cachedAt = new Date(cache.at).toISOString();
    } else {
      balanceError = res.error;
    }
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failed24h, sent24h] = await Promise.all([
    prisma.otpCode.count({ where: { delivered: false, createdAt: { gte: dayAgo } } }),
    prisma.otpCode.count({ where: { delivered: true, createdAt: { gte: dayAgo } } }),
  ]);

  return {
    configured,
    balanceSar,
    balanceError,
    cachedAt,
    lowThresholdSar: LOW_BALANCE_THRESHOLD_SAR,
    low: balanceSar !== null && balanceSar < LOW_BALANCE_THRESHOLD_SAR,
    failed24h,
    sent24h,
  };
}
