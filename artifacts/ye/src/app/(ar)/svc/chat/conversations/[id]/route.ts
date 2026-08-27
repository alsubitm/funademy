import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ownedConversation, requireChatCsrf } from '@/lib/chat-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { conversation } = await ownedConversation(req, id);
  if (!conversation) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const [messages, actions] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { conversationId: id, expiresAt: { gt: new Date() } },
      select: { id: true, role: true, content: true, sourceRefs: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.chatActionAudit.findMany({
      where: { conversationId: id, expiresAt: { gt: new Date() }, status: { in: ['prepared', 'confirmed'] } },
      select: { id: true, kind: true, status: true, payload: true, expiresAt: true, preparedAt: true },
      orderBy: { preparedAt: 'asc' },
    }),
  ]);
  return NextResponse.json({
    conversation: { id: conversation.id, title: conversation.title, locale: conversation.locale, status: conversation.status, createdAt: conversation.createdAt },
    messages,
    preparedActions: actions,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireChatCsrf(req);
  if (csrf) return csrf;
  const { id } = await params;
  const { conversation } = await ownedConversation(req, id);
  if (!conversation) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await prisma.$transaction([
    prisma.chatAudit.create({ data: { conversationId: id, familyId: conversation.familyId, event: 'conversation_deleted', expiresAt: new Date() } }),
    prisma.chatConversation.delete({ where: { id } }),
  ]);
  return new NextResponse(null, { status: 204 });
}