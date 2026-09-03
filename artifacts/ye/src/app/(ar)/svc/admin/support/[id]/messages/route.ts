import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../../../guard';
import { chatExpiry } from '@/lib/chat-auth';
import { detectSensitivePaymentInput } from '@/lib/chat-safety';
import { normalizeWhatsAppPhone, sendWhatsAppText, whatsappSendConfig } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
const DISPATCH_STALE_MS = 2 * 60_000;

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin || (req.headers.get('sec-fetch-site') && req.headers.get('sec-fetch-site') !== 'same-origin')) return false;
  try {
    return new URL(origin).host.toLowerCase() ===
      (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(',')[0].trim().toLowerCase();
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!sameOrigin(req)) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  const body = await req.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  if (!content || content.length > 4000 || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  if (detectSensitivePaymentInput(content)) {
    return NextResponse.json({ error: 'sensitive_content_rejected' }, { status: 400 });
  }
  const { id } = await params;
  const conversation = await prisma.chatConversation.findFirst({
    where: { id, expiresAt: { gt: new Date() } },
    include: { family: { select: { phone: true } } },
  });
  if (!conversation) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (conversation.status === 'closed') {
    return NextResponse.json({ error: 'conversation_closed' }, { status: 409 });
  }
  if (conversation.channel !== 'whatsapp' && conversation.contactMethod !== 'whatsapp') {
    return NextResponse.json({ error: 'not_whatsapp_conversation' }, { status: 409 });
  }

  const phone = normalizeWhatsAppPhone(conversation.contactValue ?? conversation.family?.phone ?? '');
  const config = whatsappSendConfig();
  let message;
  try {
    message = await prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content,
          channel: 'whatsapp',
          direction: 'outbound',
          deliveryStatus: config && phone ? 'queued' : 'failed',
          deliveryError: !config ? 'not_configured' : !phone ? 'recipient_unavailable' : null,
          idempotencyKey,
          expiresAt: chatExpiry(),
        },
      });
      await tx.chatAudit.create({
        data: {
          conversationId: conversation.id,
          familyId: conversation.familyId,
          event: 'admin_whatsapp_reply',
          detail: { messageId: created.id, outcome: config && phone ? 'queued' : 'failed' },
          expiresAt: chatExpiry(),
        },
      });
      return created;
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    const existing = await prisma.chatMessage.findUnique({
      where: { conversationId_idempotencyKey: { conversationId: conversation.id, idempotencyKey } },
    });
    if (!existing || existing.content !== content) {
      return NextResponse.json({ error: 'idempotency_conflict' }, { status: 409 });
    }
    if (existing.deliveryStatus === 'queued') {
      message = existing;
    } else {
      if (
        existing.deliveryStatus === 'sending' &&
        existing.dispatchStartedAt &&
        existing.dispatchStartedAt.getTime() < Date.now() - DISPATCH_STALE_MS
      ) {
        await prisma.chatMessage.updateMany({
          where: { id: existing.id, deliveryStatus: 'sending' },
          data: { deliveryStatus: 'uncertain', deliveryError: 'dispatch_interrupted' },
        });
        existing.deliveryStatus = 'uncertain';
        existing.deliveryError = 'dispatch_interrupted';
      }
      const status = ['sent', 'delivered', 'read'].includes(existing.deliveryStatus ?? '')
        ? 200
        : existing.deliveryStatus === 'failed'
          ? 502
          : 202;
      return NextResponse.json({
        message: {
          id: existing.id,
          deliveryStatus: existing.deliveryStatus,
          deliveryError: existing.deliveryError,
        },
        duplicate: true,
      }, { status });
    }
  }
  if (!config || !phone) {
    return NextResponse.json({
      message: { id: message.id, deliveryStatus: 'failed', deliveryError: !config ? 'not_configured' : 'recipient_unavailable' },
    }, { status: 503 });
  }

  const claim = await prisma.chatMessage.updateMany({
    where: { id: message.id, deliveryStatus: 'queued' },
    data: { deliveryStatus: 'sending', dispatchStartedAt: new Date() },
  });
  if (claim.count !== 1) {
    const current = await prisma.chatMessage.findUniqueOrThrow({ where: { id: message.id } });
    return NextResponse.json({
      message: {
        id: current.id,
        deliveryStatus: current.deliveryStatus,
        deliveryError: current.deliveryError,
      },
      duplicate: true,
    }, { status: 202 });
  }

  try {
    const providerId = await sendWhatsAppText(phone, content, config);
    const sent = await prisma.chatMessage.update({
      where: { id: message.id },
      data: { providerId, deliveryStatus: 'sent', deliveryError: null },
    });
    return NextResponse.json({ message: { id: sent.id, deliveryStatus: sent.deliveryStatus, deliveryError: null } }, { status: 201 });
  } catch (error) {
    const providerCode = typeof (error as { providerCode?: unknown })?.providerCode === 'string'
      ? (error as { providerCode: string }).providerCode
      : null;
    const deliveryStatus = providerCode ? 'failed' : 'uncertain';
    await prisma.$transaction([
      prisma.chatMessage.update({
        where: { id: message.id },
        data: { deliveryStatus, deliveryError: providerCode ?? 'provider_outcome_unknown' },
      }),
      prisma.chatAudit.create({
        data: {
          conversationId: conversation.id,
          familyId: conversation.familyId,
          event: 'whatsapp_send_failed',
          detail: { messageId: message.id, providerCode: providerCode ?? 'outcome_unknown' },
          expiresAt: chatExpiry(),
        },
      }),
    ]);
    return NextResponse.json({
      message: {
        id: message.id,
        deliveryStatus,
        deliveryError: providerCode ?? 'provider_outcome_unknown',
      },
    }, { status: 502 });
  }
}