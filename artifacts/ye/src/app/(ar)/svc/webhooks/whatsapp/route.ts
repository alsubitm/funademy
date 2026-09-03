import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { chatExpiry } from '@/lib/chat-auth';
import { detectSensitivePaymentInput } from '@/lib/chat-safety';
import {
  normalizeWhatsAppPhone,
  validWhatsAppSignature,
  whatsappPhoneHash,
  whatsappWebhookConfig,
} from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

type Incoming = { id: string; from: string; text: string };
type Status = { id: string; status: string; error?: string };

function events(payload: unknown): { incoming: Incoming[]; statuses: Status[] } {
  const incoming: Incoming[] = [];
  const statuses: Status[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return { incoming, statuses };
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: { messages?: unknown[]; statuses?: unknown[] } })?.value;
      for (const raw of value?.messages ?? []) {
        const message = raw as { id?: unknown; from?: unknown; type?: unknown; text?: { body?: unknown } };
        if (message.type === 'text' && typeof message.id === 'string' && typeof message.from === 'string' && typeof message.text?.body === 'string') {
          incoming.push({ id: message.id.slice(0, 200), from: message.from, text: message.text.body.slice(0, 4000) });
        }
      }
      for (const raw of value?.statuses ?? []) {
        const status = raw as { id?: unknown; status?: unknown; errors?: Array<{ code?: unknown }> };
        if (typeof status.id === 'string' && typeof status.status === 'string') {
          statuses.push({
            id: status.id.slice(0, 200),
            status: ['sent', 'delivered', 'read', 'failed'].includes(status.status) ? status.status : 'unknown',
            error: status.errors?.[0]?.code === undefined ? undefined : String(status.errors[0].code).slice(0, 80),
          });
        }
      }
    }
  }
  return { incoming, statuses };
}

const RECEIPT_ALLOWED_FROM: Record<string, string[]> = {
  sent: ['sending', 'uncertain'],
  delivered: ['sending', 'uncertain', 'sent'],
  read: ['sending', 'uncertain', 'sent', 'delivered'],
  failed: ['sending', 'uncertain', 'sent'],
};

async function applyDeliveryStatus(status: Status) {
  const allowedFrom = RECEIPT_ALLOWED_FROM[status.status];
  if (!allowedFrom) return;
  await prisma.chatMessage.updateMany({
    where: { providerId: status.id, deliveryStatus: { in: allowedFrom } },
    data: {
      deliveryStatus: status.status,
      deliveryError: status.status === 'failed' ? status.error ?? 'provider_failed' : null,
      deliveredAt: ['delivered', 'read'].includes(status.status) ? new Date() : undefined,
    },
  });
}

async function storeIncoming(event: Incoming, phone: string) {
  const phoneHash = whatsappPhoneHash(phone);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // Serialize first-contact creation and duplicate webhook deliveries by sender.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${phoneHash}, 0)) IS NULL AS locked`;
    if (await tx.chatMessage.findUnique({ where: { providerId: event.id }, select: { id: true } })) return;

    let conversation = await tx.chatConversation.findUnique({ where: { whatsappPhoneHash: phoneHash } });
    if (conversation && conversation.expiresAt <= now) {
      await tx.chatAudit.deleteMany({ where: { conversationId: conversation.id } });
      await tx.chatConversation.delete({ where: { id: conversation.id } });
      conversation = null;
    }
    if (!conversation) {
      const family = await tx.family.findUnique({ where: { phone } });
      conversation = await tx.chatConversation.create({
        data: {
          familyId: family?.id ?? null,
          title: 'WhatsApp support conversation',
          locale: 'ar',
          status: 'open',
          channel: 'whatsapp',
          whatsappPhoneHash: phoneHash,
          contactMethod: 'whatsapp',
          contactValue: phone,
          consentAt: now,
          consentVersion: 'whatsapp-inbound-v1',
          expiresAt: chatExpiry(),
        },
      });
      await tx.chatAudit.create({
        data: {
          conversationId: conversation.id,
          familyId: conversation.familyId,
          event: 'channel_consent_recorded',
          detail: { channel: 'whatsapp', version: 'whatsapp-inbound-v1' },
          expiresAt: chatExpiry(),
        },
      });
    }

    const sensitive = detectSensitivePaymentInput(event.text);
    const content = sensitive
      ? 'تم حجب رسالة واردة لاحتوائها على بيانات دفع أو اعتماد حساسة.'
      : event.text.trim();
    if (!content) return;
    await tx.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content,
        channel: 'whatsapp',
        direction: 'inbound',
        deliveryStatus: 'received',
        providerId: event.id,
        idempotencyKey: `whatsapp:${event.id}`,
        expiresAt: chatExpiry(),
      },
    });
    await tx.chatAudit.create({
      data: {
        conversationId: conversation.id,
        familyId: conversation.familyId,
        event: sensitive ? 'whatsapp_sensitive_message_redacted' : 'whatsapp_message_received',
        detail: { channel: 'whatsapp' },
        expiresAt: chatExpiry(),
      },
    });
    await tx.chatConversation.update({
      where: { id: conversation.id },
      data: {
        status: 'open',
        channel: 'whatsapp',
        contactMethod: 'whatsapp',
        expiresAt: chatExpiry(),
      },
    });
  });
}

export async function GET(req: NextRequest) {
  const config = whatsappWebhookConfig();
  if (!config) return NextResponse.json({ error: 'whatsapp_not_configured' }, { status: 503 });
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');
  if (mode !== 'subscribe' || !challenge || token !== config.verifyToken) {
    return NextResponse.json({ error: 'verification_failed' }, { status: 403 });
  }
  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

export async function POST(req: NextRequest) {
  const config = whatsappWebhookConfig();
  if (!config) return NextResponse.json({ error: 'whatsapp_not_configured' }, { status: 503 });
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 1_000_000) return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  if (!validWhatsAppSignature(raw, req.headers.get('x-hub-signature-256'), config.appSecret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = events(payload);

  for (const status of parsed.statuses) {
    await applyDeliveryStatus(status);
  }

  for (const event of parsed.incoming) {
    const phone = normalizeWhatsAppPhone(event.from);
    if (!phone) continue;
    try {
      await storeIncoming(event, phone);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
  }
  return NextResponse.json({ received: true });
}