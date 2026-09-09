import { prisma, withDbRetry } from './db';

/** Live-class link for a session: per-session override, else run-level, online runs only. */
export function joinUrlFor(s: {
  meetingUrl: string | null;
  courseRun: { format: string; meetingUrl: string | null };
}): string | null {
  return s.courseRun.format === 'online' ? (s.meetingUrl ?? s.courseRun.meetingUrl) : null;
}

/**
 * Sessions shown in the parent portal for one child.
 * Scoped to the child's active/pending enrollments, so families never
 * receive meeting/recording links for runs they are not enrolled in.
 * Recorded sessions are enrollment-based (independent of attendance rows).
 */
export async function portalSessions(childId: number, now = new Date()) {
  const enrollments = await withDbRetry(
    () => prisma.enrollment.findMany({
      where: { studentId: childId, status: { in: ['active', 'pending'] } },
      select: { courseRunId: true },
    }),
    { operation: 'portal-session-enrollments', kind: 'read' },
  );
  const runIds = enrollments.map((e) => e.courseRunId);
  if (runIds.length === 0) return { upcoming: [], recorded: [] };

  const [upcoming, recorded] = await Promise.all([
    withDbRetry(() => prisma.classSession.findMany({
      where: { courseRunId: { in: runIds }, date: { gte: now }, status: 'scheduled' },
      include: { courseRun: { include: { program: true } } },
      orderBy: { date: 'asc' },
      take: 6,
    }), { operation: 'portal-upcoming-sessions', kind: 'read' }),
    withDbRetry(() => prisma.classSession.findMany({
      where: {
        courseRunId: { in: runIds },
        status: { not: 'cancelled' },
        recordingUrl: { not: null },
        OR: [{ date: { lt: now } }, { status: 'completed' }],
      },
      include: { courseRun: { include: { program: true } } },
      orderBy: { date: 'desc' },
      take: 12,
    }), { operation: 'portal-recorded-sessions', kind: 'read' }),
  ]);
  return { upcoming, recorded };
}
