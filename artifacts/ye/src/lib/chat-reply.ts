import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

const leaseMs = 120_000;

/** A database lease survives replicas without reserving a pool connection. */
export async function claimChatReply(conversationId: string, userMessageId: string) {
  const token = randomUUID();
  return prisma.$transaction(async tx => {
    const saved = await tx.chatMessage.findUnique({
      where: { conversationId_idempotencyKey: { conversationId, idempotencyKey: `reply:${userMessageId}` } },
    });
    if (saved) {
      const audit = await tx.chatAudit.findFirst({
        where: { conversationId, event: 'reply_completed', detail: { path: ['messageId'], equals: saved.id } },
      });
      if (!audit?.detail) throw new Error('missing_reply_metadata');
      return { saved: { content: saved.content, done: audit.detail }, token: null, history: [] };
    }
    const now = new Date();
    const claim = await tx.chatMessage.updateMany({
      where: { id: userMessageId, conversationId, role: 'user',
        OR: [{ replyLeaseUntil: null }, { replyLeaseUntil: { lte: now } }] },
      data: { replyLeaseToken: token, replyLeaseUntil: new Date(now.getTime() + leaseMs) },
    });
    if (!claim.count) throw new Error('reply_in_progress');
    // A previous worker may have committed between the first read and claim.
    const completed = await tx.chatMessage.findUnique({
      where: { conversationId_idempotencyKey: { conversationId, idempotencyKey: `reply:${userMessageId}` } },
    });
    if (completed) {
      const audit = await tx.chatAudit.findFirst({
        where: { conversationId, event: 'reply_completed', detail: { path: ['messageId'], equals: completed.id } },
      });
      if (!audit?.detail) throw new Error('missing_reply_metadata');
      await tx.chatMessage.update({ where: { id: userMessageId }, data: { replyLeaseToken: null, replyLeaseUntil: null } });
      return { saved: { content: completed.content, done: audit.detail }, token: null, history: [] };
    }
    const history = await tx.chatMessage.findMany({
      where: { conversationId, id: { not: userMessageId }, role: { in: ['user', 'assistant'] } },
      select: { role: true, content: true }, orderBy: { createdAt: 'desc' }, take: 12,
    });
    return { saved: null, token, history };
  });
}

/** Only the current lease owner can commit. Content and replay metadata are atomic. */
export async function commitChatReply(input: {
  conversationId: string; userMessageId: string; token: string;
  familyId: number | null; content: string; refs: Prisma.InputJsonValue;
  done: Prisma.JsonObject; expiresAt: Date;
  escalation?: { contactMethod: string | null };
}) {
  return prisma.$transaction(async tx => {
    const owned = await tx.chatMessage.updateMany({
      where: { id: input.userMessageId, replyLeaseToken: input.token, replyLeaseUntil: { gt: new Date() } },
      data: { replyLeaseToken: null, replyLeaseUntil: null },
    });
    if (!owned.count) throw new Error('reply_lease_lost');
    const assistant = await tx.chatMessage.create({
      data: { conversationId: input.conversationId, role: 'assistant', content: input.content,
        sourceRefs: input.refs, idempotencyKey: `reply:${input.userMessageId}`, expiresAt: input.expiresAt },
    });
    if (input.escalation) {
      const open = await tx.chatEscalation.findFirst({
        where: { conversationId: input.conversationId, reason: 'sensitive_request', status: 'open' },
      });
      if (!open) await tx.chatEscalation.create({
        data: { conversationId: input.conversationId, reason: 'sensitive_request', summary: 'Sensitive request',
          contactMethod: input.escalation.contactMethod, expiresAt: input.expiresAt },
      });
    }
    await tx.chatConversation.update({ where: { id: input.conversationId }, data: { expiresAt: input.expiresAt } });
    const done = { ...input.done, messageId: assistant.id };
    await tx.chatAudit.create({
      data: { conversationId: input.conversationId, familyId: input.familyId,
        event: 'reply_completed', detail: done, expiresAt: input.expiresAt },
    });
    return { content: assistant.content, done };
  });
}

export async function releaseChatReply(userMessageId: string, token: string) {
  await prisma.chatMessage.updateMany({
    where: { id: userMessageId, replyLeaseToken: token },
    data: { replyLeaseToken: null, replyLeaseUntil: null },
  });
}
