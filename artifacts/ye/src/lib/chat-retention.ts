import { prisma } from '@/lib/db';

/** Bounded opportunistic purge; safe to call from requests or a scheduler. */
export async function purgeExpiredChat(limit = 100) {
  const now = new Date();
  const [messages, actions, escalations, audits, conversations] = await Promise.all([
    prisma.chatMessage.findMany({ where: { expiresAt: { lte: now } }, select: { id: true }, take: limit }),
    prisma.chatActionAudit.findMany({ where: { expiresAt: { lte: now } }, select: { id: true }, take: limit }),
    prisma.chatEscalation.findMany({ where: { expiresAt: { lte: now } }, select: { id: true }, take: limit }),
    prisma.chatAudit.findMany({ where: { expiresAt: { lte: now } }, select: { id: true }, take: limit }),
    prisma.chatConversation.findMany({ where: { expiresAt: { lte: now } }, select: { id: true }, take: limit }),
  ]);
  await Promise.all([
    prisma.chatMessage.deleteMany({ where: { id: { in: messages.map((x) => x.id) } } }),
    prisma.chatActionAudit.deleteMany({ where: { id: { in: actions.map((x) => x.id) } } }),
    prisma.chatEscalation.deleteMany({ where: { id: { in: escalations.map((x) => x.id) } } }),
    prisma.chatAudit.deleteMany({ where: { id: { in: audits.map((x) => x.id) } } }),
    prisma.chatConversation.deleteMany({ where: { id: { in: conversations.map((x) => x.id) } } }),
  ]);
  return { purged: messages.length + actions.length + escalations.length + audits.length + conversations.length };
}