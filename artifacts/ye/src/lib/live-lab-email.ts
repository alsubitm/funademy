import { ReplitConnectors } from '@replit/connectors-sdk';
import type { LiveLabGuest, LiveLabRoom, Prisma } from '@prisma/client';
import { LiveError, roomTransaction, unexpired, type Staff } from './live-lab';
import { siteUrl } from './site-url';

// Resend retains idempotency keys for 24h. Stop early rather than risk a
// duplicate after an ambiguous response or a lost database commit.
const RETRY_WINDOW = 23 * 60 * 60 * 1000;
type EmailPayload = { from: string; to: string[]; subject: string; text: string };
export function privateLabEmail(room: LiveLabRoom, guest: LiveLabGuest): EmailPayload {
  const origin = new URL(siteUrl());
  if (origin.protocol !== 'https:') throw new Error('invalid_email_site_url');
  const link = new URL(`/windmill/live/${encodeURIComponent(guest.token)}`, origin).href;
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short',
  }).format(room.startsAt);
  return {
    from: 'FunAdemy <info@funademy.io>',
    to: [guest.email],
    subject: 'FunAdemy — رابط المختبر الخاص / Your private lab link',
    text: `مرحباً / Hello,\n\n${guest.name}\n${room.title}\n${when} (Asia/Riyadh / توقيت الرياض)\n${room.durationMin} دقيقة / minutes\n\nرابط الطالب الخاص / Private student link:\n${link}\n\nاحتفظ بهذا الرابط ولا تشاركه مع الآخرين. يفتح المختبر ورابط Meet عند توفره. ينتهي بعد 24 ساعة من نهاية الموعد، أو عند إلغاء الدعوة.\nKeep this link private. It opens your student's lab and the shared Meet link when available. It expires 24 hours after the scheduled end, or when the invitation is revoked.\n\nهذه رسالة تخص الحصة المطلوبة وليست رسالة تسويقية.\nThis is a transactional message for the requested class, not marketing.`,
  };
}

/** Durable payload is committed BEFORE contacting the provider. Replays must
 * use both the same key and exact body, even after a student's name changes.
 * The send lock also serializes against revocation and session cancellation.
 * No raw provider body/error is stored, logged or exposed to staff. */
export async function sendPrivateLabEmail(actor: Staff, roomId: string, guestId: string, consent = false) {
  await roomTransaction(actor, roomId, async (tx, room) => {
    const guest = await tx.liveLabGuest.findFirst({ where: { id: guestId, roomId } });
    if (!guest) throw new LiveError(404, 'not_found');
    if (guest.revoked || room.phase === 'ended' || !unexpired(room)) return;
    if (!guest.emailConsentAt && !consent) return;
    if (guest.privateEmailSentAt) return;
    await tx.liveLabGuest.update({ where: { id: guestId }, data: {
      emailConsentAt: guest.emailConsentAt ?? new Date(),
      privateEmailStatus: guest.privateEmailStatus === 'not_requested' ? 'pending' : guest.privateEmailStatus,
      ...(!guest.privateEmailPayload ? { privateEmailPayload: privateLabEmail(room, guest) as Prisma.InputJsonValue } : {}),
      // This commit survives a process crash before/after the provider call.
      privateEmailAttemptedAt: guest.privateEmailAttemptedAt ?? new Date(),
    } });
  });
  return roomTransaction(actor, roomId, async (tx, room) => {
    const guest = await tx.liveLabGuest.findFirstOrThrow({ where: { id: guestId, roomId } });
    if (guest.revoked || room.phase === 'ended' || !unexpired(room)) return 'skipped';
    if (!guest.emailConsentAt || !guest.privateEmailPayload || !guest.privateEmailAttemptedAt) return 'not_requested';
    if (guest.privateEmailSentAt) return 'sent';
    if (Date.now() - guest.privateEmailAttemptedAt.getTime() >= RETRY_WINDOW) {
      await tx.liveLabGuest.update({ where: { id: guestId }, data: {
        privateEmailStatus: 'review_required', privateEmailError: 'retry_window_expired',
      } });
      return 'review_required';
    }
    let providerId: string | undefined;
    let error = 'provider_unavailable';
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        new ReplitConnectors().proxy('resend', '/emails', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `live-lab-${guest.id}` },
          body: JSON.stringify(guest.privateEmailPayload),
        }),
        new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('email_timeout')), 12000); }),
      ]);
      if (response.ok) {
        const body = await response.json() as { id?: unknown };
        if (typeof body.id === 'string' && body.id.length > 0) providerId = body.id;
        else error = 'provider_response_unknown';
      } else {
        error = response.status === 401 || response.status === 403 ? 'sender_not_authorized'
          : response.status === 429 ? 'provider_rate_limited' : 'provider_rejected';
      }
    } catch { /* May have sent: retain the same key and immutable payload. */ }
    finally { clearTimeout(deadline); }
    await tx.liveLabGuest.update({ where: { id: guestId }, data: providerId ? {
      privateEmailStatus: 'sent', privateEmailSentAt: new Date(), privateEmailProviderId: providerId, privateEmailError: null,
    } : { privateEmailStatus: 'failed', privateEmailError: error } });
    return providerId ? 'sent' : 'failed';
  });
}

/** Invitation creation must stay successful if email or its status commit
 * fails. A persisted pending/failed row remains visible and retryable. */
export async function tryPrivateLabEmail(actor: Staff, roomId: string, guestId: string) {
  try { return await sendPrivateLabEmail(actor, roomId, guestId); }
  catch { return 'pending'; }
}
