import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { allowRate, clientIp } from '@/lib/rate-limit';
import { chatExpiry, ownedConversation, requireChatCsrf } from '@/lib/chat-auth';
import { detectSensitivePaymentInput } from '@/lib/chat-safety';

export const dynamic = 'force-dynamic';

const schema = z.object({
  reason: z.enum(['human_requested', 'answer_unavailable', 'complaint', 'safety', 'technical']),
  summary: z.string().trim().max(1000).optional(),
}).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireChatCsrf(req);
  if (csrf) return csrf;
  const { id } = await params;
  if (!(await allowRate(`chat:escalate:${clientIp(req)}`, 5, 60 * 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const { conversation } = await ownedConversation(req, id);
  if (!conversation) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const contact = conversation.familyId
    ? await prisma.family.findUnique({ where: { id: conversation.familyId }, select: { email: true } })
    : null;
  // Direct API clients may submit text that the UI intentionally omits.
  // Sensitive text is discarded wholesale: no redaction derivative or audit.
  const sensitiveSummary = parsed.data.summary ? detectSensitivePaymentInput(parsed.data.summary) : null;
  const escalation = await prisma.chatEscalation.create({
    data: {
      conversationId: id,
      reason: sensitiveSummary ? 'safety' : parsed.data.reason,
      summary: sensitiveSummary ? null : parsed.data.summary,
      contactMethod: contact?.email ? 'email' : conversation.contactMethod,
      expiresAt: chatExpiry(),
    },
    select: { id: true, status: true, createdAt: true },
  });
  await prisma.chatAudit.create({
    data: { conversationId: id, familyId: conversation.familyId, event: 'escalation_created', detail: { reason: sensitiveSummary ? 'safety' : parsed.data.reason }, expiresAt: chatExpiry() },
  });
  return NextResponse.json({ escalation }, { status: 201 });
}