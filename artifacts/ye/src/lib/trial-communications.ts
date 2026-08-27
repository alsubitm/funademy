import { prisma } from '@/lib/db';
import { sendCalendarNotice } from '@/lib/google-calendar';
import { siteUrl } from '@/lib/site-url';
import { randomUUID } from 'crypto';

const MAX_ATTEMPTS = 5;
const CLAIM_LEASE_MS = 15 * 60_000;

/**
 * Claims and sends due trial emails. Claims are atomic across server replicas;
 * deterministic Calendar event ids make a retry after an unknown outcome safe.
 */
export async function processDueTrialCommunications(now = new Date()) {
  // A deploy/crash can interrupt a worker after it claims a row. Reclaim the
  // lease; the deterministic Calendar event id makes an unknown prior send
  // safe to retry (409 is treated as already delivered).
  await prisma.trialCommunication.updateMany({
    where: {
      status: 'sending',
      claimedAt: { lt: new Date(now.getTime() - CLAIM_LEASE_MS) },
    },
    data: { status: 'pending', claimedAt: null, claimToken: null },
  });

  const due = await prisma.trialCommunication.findMany({
    where: {
      status: 'pending',
      dueAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
      booking: {
        contactConsentAt: { not: null },
        contactChannel: 'email',
        email: { not: null },
      },
      OR: [
        { kind: 'reminder' },
        { kind: 'follow_up', booking: { trialAttendance: 'present' } },
      ],
    },
    include: { booking: { include: { program: true } } },
    take: 25,
    orderBy: { dueAt: 'asc' },
  });

  let sent = 0;
  let failed = 0;
  for (const item of due) {
    const claimToken = randomUUID();
    const claimed = await prisma.trialCommunication.updateMany({
      where: { id: item.id, status: 'pending' },
      data: {
        status: 'sending',
        attempts: { increment: 1 },
        claimedAt: now,
        claimToken,
        lastError: null,
      },
    });
    if (!claimed.count) continue;

    const enrollmentUrl = `${siteUrl()}/enroll?program=${encodeURIComponent(item.booking.program.slug)}&trial=${item.bookingId}`;
    const isReminder = item.kind === 'reminder';
    try {
      await sendCalendarNotice({
        communicationId: item.id,
        startsAt: now,
        attendeeEmail: item.booking.email!,
        summary: isReminder
          ? `تذكير بحصة ${item.booking.childFirstName} التجريبية — FunAdemy`
          : `الخطوة التالية بعد حصة ${item.booking.childFirstName} — FunAdemy`,
        description: isReminder
          ? `موعد الحصة: ${item.booking.trialStartsAt?.toISOString() ?? ''}\nرابط الدخول: ${
              (await prisma.appointment.findFirst({ where: { bookingId: item.bookingId }, select: { meetUrl: true } }))?.meetUrl ?? ''
            }`
          : `سعدنا بحضور ${item.booking.childFirstName}. أكمل التسجيل والدفع من هنا:\n${enrollmentUrl}`,
      });
      await prisma.trialCommunication.updateMany({
        where: { id: item.id, status: 'sending', claimToken },
        data: {
          status: 'sent',
          sentAt: new Date(),
          claimedAt: null,
          claimToken: null,
          lastError: null,
        },
      });
      sent++;
    } catch (error) {
      const lastError = error instanceof Error ? error.message.slice(0, 300) : 'unknown_error';
      const attempts = item.attempts + 1;
      await prisma.trialCommunication.updateMany({
        where: { id: item.id, status: 'sending', claimToken },
        data: {
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          claimedAt: null,
          claimToken: null,
          lastError,
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}