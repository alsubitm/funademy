import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

/** Scheduler only. Each statement is bounded and uses at most one connection. */
export async function purgeExpiredChat(limit = 100) {
  const batch = Math.max(1, Math.min(1000, Math.trunc(limit) || 100));
  let purged = 0;
  for (const table of ['ye_chat_messages', 'ye_chat_action_audit', 'ye_chat_escalations', 'ye_chat_audit', 'ye_chat_conversations']) {
    purged += await prisma.$executeRaw`
      DELETE FROM ${Prisma.raw(`"${table}"`)}
      WHERE id IN (
        SELECT id FROM ${Prisma.raw(`"${table}"`)}
        WHERE "expiresAt" <= NOW() ORDER BY "expiresAt" LIMIT ${batch}
        FOR UPDATE SKIP LOCKED
      )
    `;
  }
  return { purged };
}
