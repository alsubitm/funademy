/**
 * Weekly parent digest — summarizes each child's week and emails the parent.
 * Scheduled from index.ts; also safe to invoke manually.
 */
import { eq, gte, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  childrenTable,
  completionsTable,
} from "@workspace/db";
import { activeEmailProvider } from "./email";

const WEEK_MS = 7 * 86400000;

export async function sendWeeklyDigests(): Promise<number> {
  const parents = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "parent"));
  let sent = 0;
  for (const parent of parents) {
    if (parent.lastDigestAt && Date.now() - parent.lastDigestAt.getTime() < WEEK_MS) {
      continue;
    }
    const children = await db
      .select()
      .from(childrenTable)
      .where(eq(childrenTable.parentId, parent.id));
    if (children.length === 0) continue;
    const completions = await db
      .select()
      .from(completionsTable)
      .where(
        inArray(
          completionsTable.childId,
          children.map((c) => c.id),
        ),
      );
    const weekAgo = new Date(Date.now() - WEEK_MS);
    const rows = children.map((child) => {
      const week = completions.filter(
        (c) => c.childId === child.id && c.createdAt >= weekAgo,
      );
      const minutes = Math.round(
        week.reduce((s, c) => s + c.timeSpentSeconds, 0) / 60,
      );
      const avg =
        week.length > 0
          ? Math.round(week.reduce((s, c) => s + c.score, 0) / week.length)
          : null;
      return `<tr><td>${child.name}</td><td>${week.length} درساً</td><td>${minutes} دقيقة</td><td>${avg === null ? "—" : avg + "%"}</td><td>${child.streak} أيام</td></tr>`;
    });
    await activeEmailProvider.send({
      to: parent.email,
      subject: "ملخص الأسبوع التعليمي لأبنائك — منارة",
      html:
        `<div dir="rtl"><h2>مرحباً ${parent.name}،</h2>` +
        `<p>هذا ملخص أسبوع أبنائك في منارة:</p>` +
        `<table border="1" cellpadding="6"><tr><th>الطفل</th><th>الدروس</th><th>الوقت</th><th>متوسط الدرجات</th><th>السلسلة</th></tr>` +
        rows.join("") +
        `</table><p>لمزيد من التفاصيل، افتح لوحة الوالدين.</p></div>`,
    });
    await db
      .update(usersTable)
      .set({ lastDigestAt: new Date() })
      .where(eq(usersTable.id, parent.id));
    sent++;
  }
  return sent;
}

/** Check every 6 hours; each parent receives at most one digest per 7 days. */
export function scheduleWeeklyDigests(): void {
  const run = () =>
    sendWeeklyDigests().catch((err) =>
      console.error("weekly digest failed", err),
    );
  setTimeout(run, 30_000); // shortly after boot
  setInterval(run, 6 * 60 * 60 * 1000);
}
