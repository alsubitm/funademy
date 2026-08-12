/**
 * Authentica (authentica.sa) — Saudi OTP delivery provider.
 *
 * Delivery-only integration: WE generate, store (HMAC), rate-limit, and
 * verify the login code in src/lib/otp.ts. Authentica's send-otp API
 * supports custom OTPs, so it acts purely as the SMS/WhatsApp carrier —
 * their verify endpoint is never used and the peek-without-consume flow
 * (new-family name step) keeps working unchanged.
 *
 * Live/sim switching follows the payments pattern: the provider goes live
 * purely by secret presence (AUTHENTICA_API_KEY). Without the key,
 * development shows the code on screen and production fails closed
 * (sms_not_configured) — codes are never silently undeliverable.
 *
 * Optional env:
 *   AUTHENTICA_OTP_METHOD   'sms' (default) or 'whatsapp'
 *   AUTHENTICA_TEMPLATE_ID  numeric template id from the Authentica dashboard
 *   (sender name is configured on the Authentica dashboard, not per call)
 *
 * API (confirmed 2026-08-11 from docs.authentica.sa):
 *   POST https://api.authentica.sa/api/v2/send-otp
 *   Header  X-Authorization: <api key>   (portal.authentica.sa/applications)
 *   Body    { method, phone: '+9665XXXXXXXX', otp: '123456', template_id? }
 *   200 → { success: true, ... } ; errors → { errors: [{ message }] }
 * api.authentica.sa is reachable from US egress (verified — unlike NELC's
 * LRS there is no Saudi-only geo-block), so the server sends directly.
 */

const SEND_URL = 'https://api.authentica.sa/api/v2/send-otp';
const BALANCE_URL = 'https://api.authentica.sa/api/v2/balance';
const TIMEOUT_MS = 15_000;

export const authenticaConfigured = (): boolean => !!process.env.AUTHENTICA_API_KEY;

export type AuthenticaSendResult = { ok: true } | { ok: false; httpStatus?: number };

/** Deliver OUR code via Authentica. Never throws; never logs the code. */
export async function sendOtpViaAuthentica(
  phone: string,
  code: string,
): Promise<AuthenticaSendResult> {
  const apiKey = process.env.AUTHENTICA_API_KEY;
  if (!apiKey) return { ok: false };

  const method = process.env.AUTHENTICA_OTP_METHOD === 'whatsapp' ? 'whatsapp' : 'sms';
  const templateRaw = process.env.AUTHENTICA_TEMPLATE_ID;
  const templateId = templateRaw && /^\d+$/.test(templateRaw) ? Number(templateRaw) : undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Authorization': apiKey,
      },
      body: JSON.stringify({
        method,
        phone,
        otp: code,
        ...(templateId !== undefined ? { template_id: templateId } : {}),
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      // Status only — never the body (it could echo the code) and never the key.
      console.error(`[sms] Authentica send-otp failed: HTTP ${res.status}`);
      return { ok: false, httpStatus: res.status };
    }
    return { ok: true };
  } catch (e) {
    console.error('[sms] Authentica send-otp error:', e instanceof Error ? e.message : String(e));
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

export type AuthenticaBalanceResult =
  | { ok: true; balanceSar: number }
  | { ok: false; error: 'not_configured' | 'provider_error' };

/**
 * Fetch the prepaid SMS balance (SAR) from Authentica. Never throws and
 * never exposes the key. Callers cache; this always hits the provider.
 *
 * Response shape is parsed defensively: the docs show { balance: <number> }
 * but we also accept a string number or a { data: { balance } } wrapper.
 */
export async function getAuthenticaBalance(): Promise<AuthenticaBalanceResult> {
  const apiKey = process.env.AUTHENTICA_API_KEY;
  if (!apiKey) return { ok: false, error: 'not_configured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BALANCE_URL, {
      method: 'GET',
      headers: { Accept: 'application/json', 'X-Authorization': apiKey },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error(`[sms] Authentica balance failed: HTTP ${res.status}`);
      return { ok: false, error: 'provider_error' };
    }
    const body: unknown = await res.json().catch(() => null);
    const raw =
      body && typeof body === 'object'
        ? ((body as Record<string, unknown>).balance ??
          ((body as Record<string, unknown>).data as Record<string, unknown> | undefined)?.balance)
        : undefined;
    const balance = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof balance !== 'number' || !Number.isFinite(balance)) {
      console.error('[sms] Authentica balance: unexpected response shape');
      return { ok: false, error: 'provider_error' };
    }
    return { ok: true, balanceSar: balance };
  } catch (e) {
    console.error('[sms] Authentica balance error:', e instanceof Error ? e.message : String(e));
    return { ok: false, error: 'provider_error' };
  } finally {
    clearTimeout(timer);
  }
}
