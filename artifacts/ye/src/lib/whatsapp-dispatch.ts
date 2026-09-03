import { prisma } from '@/lib/db';

/** Surface abandoned dispatch intents without ever risking an automatic duplicate send. */
export async function reconcileStaleWhatsAppDispatches() {
  return prisma.chatMessage.updateMany({
    where: {
      direction: 'outbound',
      deliveryStatus: { in: ['queued', 'sending'] },
      createdAt: { lt: new Date(Date.now() - 2 * 60_000) },
    },
    data: { deliveryStatus: 'uncertain', deliveryError: 'dispatch_interrupted' },
  });
}