import { createHash, createHmac, timingSafeEqual } from 'crypto';

export type WhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  appSecret: string;
};

export function whatsappConfig(): WhatsAppConfig | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  return accessToken && phoneNumberId && verifyToken && appSecret
    ? { accessToken, phoneNumberId, verifyToken, appSecret }
    : null;
}

export function whatsappWebhookConfig(): Pick<WhatsAppConfig, 'verifyToken' | 'appSecret'> | null {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  return verifyToken && appSecret ? { verifyToken, appSecret } : null;
}

export function whatsappSendConfig(): Pick<WhatsAppConfig, 'accessToken' | 'phoneNumberId'> | null {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  return accessToken && phoneNumberId ? { accessToken, phoneNumberId } : null;
}

export function whatsappHealth() {
  const missing = [
    ['WHATSAPP_ACCESS_TOKEN', process.env.WHATSAPP_ACCESS_TOKEN],
    ['WHATSAPP_PHONE_NUMBER_ID', process.env.WHATSAPP_PHONE_NUMBER_ID],
    ['WHATSAPP_VERIFY_TOKEN', process.env.WHATSAPP_VERIFY_TOKEN],
    ['WHATSAPP_APP_SECRET', process.env.WHATSAPP_APP_SECRET],
  ].filter(([, value]) => !value?.trim()).map(([name]) => name);
  return {
    configured: missing.length === 0,
    sendConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()),
    webhookConfigured: Boolean(process.env.WHATSAPP_VERIFY_TOKEN?.trim() && process.env.WHATSAPP_APP_SECRET?.trim()),
    missing,
  };
}

export function validWhatsAppSignature(raw: string, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const supplied = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(supplied, 'hex'));
}

export function normalizeWhatsAppPhone(value: string): string | null {
  let digits = value.normalize('NFKC')
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
  // Existing Saudi contacts may predate the canonical +966 storage rule.
  if (/^05\d{8}$/.test(digits)) digits = `966${digits.slice(1)}`;
  else if (/^5\d{8}$/.test(digits)) digits = `966${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Stable, non-reversible key used to serialize one retained WhatsApp thread per sender. */
export function whatsappPhoneHash(phone: string): string {
  return createHash('sha256').update(phone).digest('hex');
}

export async function sendWhatsAppText(to: string, content: string, config: Pick<WhatsAppConfig, 'accessToken' | 'phoneNumberId'>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(config.phoneNumberId)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace(/^\+/, ''), type: 'text', text: { body: content, preview_url: false } }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  const body = await response.json().catch(() => null) as { messages?: Array<{ id?: string }>; error?: { code?: number } } | null;
  const providerId = body?.messages?.[0]?.id;
  if (!response.ok || !providerId) {
    const error = new Error('whatsapp_provider_failed');
    Object.assign(error, { providerCode: body?.error?.code ? String(body.error.code) : `http_${response.status}` });
    throw error;
  }
  return providerId;
}