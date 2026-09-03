import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { chatExpiry } from '@/lib/chat-auth';
import { GET as webhookGET, POST as webhookPOST } from '@/app/(ar)/svc/webhooks/whatsapp/route';
import { POST as adminReplyPOST } from '@/app/(ar)/svc/admin/support/[id]/messages/route';
import {
  normalizeWhatsAppPhone,
  sendWhatsAppText,
  validWhatsAppSignature,
  whatsappHealth,
  whatsappPhoneHash,
} from '@/lib/whatsapp';

vi.mock('@/app/(ar)/svc/admin/guard', () => ({ requireAdmin: vi.fn(async () => null) }));

const original = {
  access: process.env.WHATSAPP_ACCESS_TOKEN,
  phone: process.env.WHATSAPP_PHONE_NUMBER_ID,
  verify: process.env.WHATSAPP_VERIFY_TOKEN,
  secret: process.env.WHATSAPP_APP_SECRET,
};
const conversationIds: string[] = [];
const familyIds: number[] = [];

function signedWebhook(payload: unknown) {
  const raw = JSON.stringify(payload);
  return new NextRequest('http://test.local/svc/webhooks/whatsapp', {
    method: 'POST',
    headers: { 'x-hub-signature-256': `sha256=${createHmac('sha256', 'secret-test').update(raw).digest('hex')}` },
    body: raw,
  });
}

afterEach(() => {
  process.env.WHATSAPP_ACCESS_TOKEN = original.access;
  process.env.WHATSAPP_PHONE_NUMBER_ID = original.phone;
  process.env.WHATSAPP_VERIFY_TOKEN = original.verify;
  process.env.WHATSAPP_APP_SECRET = original.secret;
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await prisma.chatAudit.deleteMany({ where: { conversationId: { in: conversationIds } } });
  await prisma.chatConversation.deleteMany({ where: { id: { in: conversationIds } } });
  await prisma.family.deleteMany({ where: { id: { in: familyIds } } });
});

describe('WhatsApp Cloud API contract', () => {
  it('disables cleanly when configuration is absent', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    delete process.env.WHATSAPP_APP_SECRET;
    expect(whatsappHealth()).toMatchObject({ configured: false, sendConfigured: false, webhookConfigured: false });
    const response = await webhookPOST(new NextRequest('http://test.local/svc/webhooks/whatsapp', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(503);
  });

  it('verifies subscription token and validates the exact signed POST bytes', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'access-test';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id';
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify-test';
    process.env.WHATSAPP_APP_SECRET = 'secret-test';
    const verification = await webhookGET(new NextRequest('http://test.local/svc/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=12345'));
    expect(verification.status).toBe(200);
    expect(await verification.text()).toBe('12345');

    const raw = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const signature = `sha256=${createHmac('sha256', 'secret-test').update(raw).digest('hex')}`;
    expect(validWhatsAppSignature(raw, signature, 'secret-test')).toBe(true);
    expect(validWhatsAppSignature(`${raw} `, signature, 'secret-test')).toBe(false);
    const rejected = await webhookPOST(new NextRequest('http://test.local/svc/webhooks/whatsapp', {
      method: 'POST',
      headers: { 'x-hub-signature-256': `sha256=${'0'.repeat(64)}` },
      body: raw,
    }));
    expect(rejected.status).toBe(401);
  });

  it('normalizes sender phones and sends only the documented minimal text payload', async () => {
    expect(normalizeWhatsAppPhone('٩٦٦ ٥٠ ١٢٣ ٤٥٦٧')).toBe('+966501234567');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendWhatsAppText('+966501234567', 'مرحباً', { accessToken: 'secret-token', phoneNumberId: '123' })).toBe('wamid.test');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/123/messages');
    expect(init.headers.Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '966501234567',
      type: 'text',
      text: { body: 'مرحباً', preview_url: false },
    });
  });

  it('serializes concurrent inbound delivery into one canonical WhatsApp thread', async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify-test';
    process.env.WHATSAPP_APP_SECRET = 'secret-test';
    const family = await prisma.family.create({
      data: { phone: '+966501112233', parentName: 'WhatsApp contract family' },
    });
    familyIds.push(family.id);
    const conversation = await prisma.chatConversation.create({
      data: {
        familyId: family.id,
        locale: 'ar',
        status: 'open',
        channel: 'website',
        consentAt: new Date(),
        expiresAt: chatExpiry(),
      },
    });
    conversationIds.push(conversation.id);
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: 'wamid.inbound.contract',
              from: '966501112233',
              type: 'text',
              text: { body: 'أحتاج مساعدة في موعد الحصة' },
            }],
          },
        }],
      }],
    };

    const responses = await Promise.all([
      webhookPOST(signedWebhook(payload)),
      webhookPOST(signedWebhook(payload)),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const whatsappConversation = await prisma.chatConversation.findUniqueOrThrow({
      where: { whatsappPhoneHash: whatsappPhoneHash('+966501112233') },
    });
    conversationIds.push(whatsappConversation.id);
    expect(whatsappConversation.id).not.toBe(conversation.id);
    expect(whatsappConversation).toMatchObject({
      familyId: family.id,
      channel: 'whatsapp',
      contactMethod: 'whatsapp',
      familyVerifiedAt: null,
      consentVersion: 'whatsapp-inbound-v1',
    });
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: whatsappConversation.id, providerId: 'wamid.inbound.contract' },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      content: 'أحتاج مساعدة في موعد الحصة',
      channel: 'whatsapp',
      direction: 'inbound',
      deliveryStatus: 'received',
    });
    expect(await prisma.chatMessage.count({ where: { conversationId: conversation.id } })).toBe(0);
  });

  it('sends an admin reply from an open WhatsApp conversation and records delivery', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'access-test';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id';
    const family = await prisma.family.create({
      data: { phone: '+966509998877', parentName: 'WhatsApp admin reply family' },
    });
    familyIds.push(family.id);
    const conversation = await prisma.chatConversation.create({
      data: {
        familyId: family.id,
        locale: 'ar',
        status: 'open',
        channel: 'whatsapp',
        contactMethod: 'whatsapp',
        consentAt: new Date(),
        consentVersion: 'whatsapp-cloud-v1',
        expiresAt: chatExpiry(),
      },
    });
    conversationIds.push(conversation.id);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ messages: [{ id: 'wamid.outbound.contract' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )));
    const request = new NextRequest(`http://test.local/svc/admin/support/${conversation.id}/messages`, {
      method: 'POST',
      headers: {
        origin: 'http://test.local',
        host: 'test.local',
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ content: 'تمت متابعة طلبكم', idempotencyKey: 'reply-contract-001' }),
    });

    const response = await adminReplyPOST(request, { params: Promise.resolve({ id: conversation.id }) });
    expect(response.status).toBe(201);
    const retry = await adminReplyPOST(new NextRequest(`http://test.local/svc/admin/support/${conversation.id}/messages`, {
      method: 'POST',
      headers: {
        origin: 'http://test.local',
        host: 'test.local',
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ content: 'تمت متابعة طلبكم', idempotencyKey: 'reply-contract-001' }),
    }), { params: Promise.resolve({ id: conversation.id }) });
    expect(retry.status).toBe(200);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(await prisma.chatMessage.findUnique({ where: { providerId: 'wamid.outbound.contract' } }))
      .toMatchObject({
        conversationId: conversation.id,
        content: 'تمت متابعة طلبكم',
        channel: 'whatsapp',
        direction: 'outbound',
        deliveryStatus: 'sent',
      });
    expect(await prisma.chatAudit.count({
      where: { conversationId: conversation.id, event: 'admin_whatsapp_reply' },
    })).toBe(1);

    const receipt = (status: string) => ({
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.outbound.contract', status }] } }] }],
    });
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify-test';
    process.env.WHATSAPP_APP_SECRET = 'secret-test';
    expect((await webhookPOST(signedWebhook(receipt('read')))).status).toBe(200);
    expect((await webhookPOST(signedWebhook(receipt('sent')))).status).toBe(200);
    expect(await prisma.chatMessage.findUnique({ where: { providerId: 'wamid.outbound.contract' } }))
      .toMatchObject({ deliveryStatus: 'read', deliveryError: null });
  });

  it('records an ambiguous provider outcome and never redispatches the same reply key', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'access-test';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id';
    const family = await prisma.family.create({
      data: { phone: '+966508887766', parentName: 'WhatsApp uncertain reply family' },
    });
    familyIds.push(family.id);
    const conversation = await prisma.chatConversation.create({
      data: {
        familyId: family.id,
        locale: 'ar',
        status: 'open',
        channel: 'whatsapp',
        contactMethod: 'whatsapp',
        consentAt: new Date(),
        consentVersion: 'whatsapp-inbound-v1',
        expiresAt: chatExpiry(),
      },
    });
    conversationIds.push(conversation.id);
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    vi.stubGlobal('fetch', fetchMock);
    const makeRequest = () => new NextRequest(`http://test.local/svc/admin/support/${conversation.id}/messages`, {
      method: 'POST',
      headers: {
        origin: 'http://test.local',
        host: 'test.local',
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ content: 'سنتحقق من الطلب', idempotencyKey: 'reply-uncertain-001' }),
    });

    const first = await adminReplyPOST(makeRequest(), { params: Promise.resolve({ id: conversation.id }) });
    expect(first.status).toBe(502);
    expect(await first.json()).toMatchObject({
      message: { deliveryStatus: 'uncertain', deliveryError: 'provider_outcome_unknown' },
    });
    const retry = await adminReplyPOST(makeRequest(), { params: Promise.resolve({ id: conversation.id }) });
    expect(retry.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await prisma.chatMessage.count({
      where: { conversationId: conversation.id, idempotencyKey: 'reply-uncertain-001' },
    })).toBe(1);
  });
});