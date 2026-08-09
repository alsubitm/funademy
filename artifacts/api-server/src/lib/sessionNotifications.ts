/**
 * Session notification queue + reminder scheduler.
 *
 * Notifications are written to `session_notifications` and dispatched by a
 * periodic job (same pattern as the weekly digest scheduler). Dispatch sends
 * via the active email provider (dev/log provider in development) and stamps
 * `dispatchedAt` so records remain queryable for later delivery channels.
 */
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import {
  db,
  usersTable,
  liveSessionsTable,
  sessionBookingsTable,
  sessionNotificationsTable,
} from "@workspace/db";
import { activeEmailProvider } from "./email";
import { logger } from "./logger";

export type SessionNotificationType =
  | "booking_confirmed"
  | "booking_cancelled"
  | "session_cancelled"
  | "waitlist_promoted"
  | "reminder_24h"
  | "reminder_1h";

const RIYADH_FMT = new Intl.DateTimeFormat("ar-SA", {
  timeZone: "Asia/Riyadh",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatRiyadh(date: Date): string {
  return RIYADH_FMT.format(date);
}

/**
 * Queue a notification. Deduped per (user, session, type) by a unique index —
 * conflicts are silently ignored so reminders are generated at most once.
 */
export async function queueNotification(opts: {
  userId: number;
  sessionId: number | null;
  type: SessionNotificationType;
  message: string;
  scheduledFor?: Date;
}): Promise<void> {
  await db
    .insert(sessionNotificationsTable)
    .values({
      userId: opts.userId,
      sessionId: opts.sessionId,
      type: opts.type,
      message: opts.message,
      scheduledFor: opts.scheduledFor ?? new Date(),
    })
    .onConflictDoNothing();
}

/** Catch-up grace: a reminder scheduled ≤1h ago may still be created late. */
const REMINDER_GRACE_MS = 3600_000;

/**
 * Generate 24h/1h reminder records for upcoming booked sessions.
 *
 * Reminders are *scheduled* at exactly `startsAt - 24h` / `startsAt - 1h`
 * (via `scheduledFor`; dispatch only sends once that time arrives). If the
 * scheduler was down when the slot passed, it catches up within a 1h grace
 * window; older missed slots are skipped rather than sent misleadingly late.
 */
export async function generateReminders(): Promise<void> {
  const now = Date.now();
  const lookahead = new Date(now + 25 * 3600_000);
  const upcoming = await db
    .select()
    .from(liveSessionsTable)
    .where(
      and(
        eq(liveSessionsTable.status, "scheduled"),
        gte(liveSessionsTable.startsAt, new Date(now)),
        lte(liveSessionsTable.startsAt, lookahead),
      ),
    );
  if (upcoming.length === 0) return;
  const bookings = await db
    .select()
    .from(sessionBookingsTable)
    .where(
      and(
        inArray(
          sessionBookingsTable.sessionId,
          upcoming.map((s) => s.id),
        ),
        eq(sessionBookingsTable.status, "booked"),
      ),
    );
  for (const booking of bookings) {
    const session = upcoming.find((s) => s.id === booking.sessionId)!;
    const when = formatRiyadh(session.startsAt);
    const t24 = session.startsAt.getTime() - 24 * 3600_000;
    const t1 = session.startsAt.getTime() - 3600_000;
    if (now <= t24 + REMINDER_GRACE_MS) {
      await queueNotification({
        userId: booking.userId,
        sessionId: session.id,
        type: "reminder_24h",
        message: `تذكير: جلسة «${session.title}» غداً — ${when} بتوقيت الرياض.`,
        scheduledFor: new Date(t24),
      });
    }
    if (now <= t1 + REMINDER_GRACE_MS) {
      await queueNotification({
        userId: booking.userId,
        sessionId: session.id,
        type: "reminder_1h",
        message: `جلسة «${session.title}» تبدأ خلال ساعة — ${when}. رابط الانضمام متاح الآن في حسابك.`,
        scheduledFor: new Date(t1),
      });
    }
  }
}

/** Dispatch queued notifications whose scheduled time has arrived. */
export async function dispatchPending(): Promise<number> {
  const pending = await db
    .select()
    .from(sessionNotificationsTable)
    .where(
      and(
        isNull(sessionNotificationsTable.dispatchedAt),
        lte(sessionNotificationsTable.scheduledFor, new Date()),
      ),
    );
  let sent = 0;
  for (const n of pending) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, n.userId));
    if (user) {
      await activeEmailProvider.send({
        to: user.email,
        subject: "إشعار الجلسات — Funademy",
        html: `<div dir="rtl"><p>مرحباً ${user.name}،</p><p>${n.message}</p></div>`,
      });
    }
    await db
      .update(sessionNotificationsTable)
      .set({ dispatchedAt: new Date() })
      .where(eq(sessionNotificationsTable.id, n.id));
    sent++;
  }
  return sent;
}

export async function runNotificationJob(): Promise<void> {
  await generateReminders();
  await dispatchPending();
}

/** Check every 5 minutes (reminders are deduped, dispatch is idempotent). */
export function scheduleSessionNotifications(): void {
  const run = () =>
    runNotificationJob().catch((err) =>
      logger.error({ err }, "session notification job failed"),
    );
  setTimeout(run, 20_000); // shortly after boot
  setInterval(run, 5 * 60 * 1000);
}
