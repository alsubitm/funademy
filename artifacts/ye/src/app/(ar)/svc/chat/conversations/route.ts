import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { allowRate, clientIp } from '@/lib/rate-limit';
import {
  CHAT_COOKIE_OPTIONS,
  CHAT_VISITOR_COOKIE,
  chatExpiry,
  chatIdentity,
  newVisitorToken,
  requireChatCsrf,
  visitorTokenHash,
} from '@/lib/chat-auth';
import { purgeExpiredChat } from '@/lib/chat-retention';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { familyId, visitorHash } = await chatIdentity(req);
  if (!familyId && !visitorHash) return NextResponse.json({ conversations: [] });
  const conversations = await prisma.chatConversation.findMany({
    where: {
      expiresAt: { gt: new Date() },
      OR: [
        ...(familyId ? [{ familyId }] : []),
        ...(visitorHash ? [{ familyId: null, visitorTokenHash: visitorHash }] : []),
      ],
    },
    select: { id: true, title: true, locale: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ conversations, hasFamilyAccount: Boolean(familyId) });
}

const createSchema = z.object({
  consent: z.literal(true),
  locale: z.enum(['ar', 'en']).default('ar'),
  title: z.string().trim().min(1).max(100).optional(),
}).strict();

export async function POST(req: NextRequest) {
  const csrf = requireChatCsrf(req);
  if (csrf) return csrf;
  void purgeExpiredChat().catch(() => {});
  if (!(await allowRate(`chat:create:${clientIp(req)}`, 10, 60 * 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const familyId = await import('@/lib/family-auth').then((m) => m.getFamilyId());
  const familyContact = familyId
    ? await prisma.family.findUnique({ where: { id: familyId }, select: { phone: true, email: true } })
    : null;
  let visitorToken = req.cookies.get(CHAT_VISITOR_COOKIE)?.value;
  if (!familyId && !visitorToken) visitorToken = newVisitorToken();
  const now = new Date();
  const conversation = await prisma.chatConversation.create({
    data: {
      familyId,
      visitorTokenHash: familyId ? null : visitorTokenHash(visitorToken!),
      // Titles are server-owned metadata. Never persist client free text here:
      // callers may create the conversation immediately before safety checks.
      title: parsed.data.locale === 'ar' ? 'محادثة دعم' : 'Support conversation',
      locale: parsed.data.locale,
      contactMethod: familyContact?.email ? 'email' : familyContact?.phone ? 'phone' : null,
      contactValue: familyContact?.email || familyContact?.phone || null,
      consentAt: now,
      familyVerifiedAt: familyId ? now : null,
      expiresAt: chatExpiry(),
    },
    select: { id: true, title: true, locale: true, createdAt: true },
  });
  await prisma.chatAudit.create({ data: { conversationId: conversation.id, familyId, event: 'consent_recorded', detail: { version: 'chat-v1' }, expiresAt: chatExpiry() } });
  const response = NextResponse.json({ conversation, hasFamilyAccount: Boolean(familyId) }, { status: 201 });
  if (!familyId && visitorToken) response.cookies.set(CHAT_VISITOR_COOKIE, visitorToken, CHAT_COOKIE_OPTIONS);
  return response;
}