/**
 * NELC production outbox — queues REAL learner statements (built by
 * xapiProduction.ts) and delivers them to NELC's production LRS.
 *
 * WHY AN OUTBOX
 * -------------
 *  - A child's lesson completion must NEVER wait on (or fail because of)
 *    NELC's LRS — statements are queued in the same database and delivered
 *    asynchronously.
 *  - NELC's WAF geo-blocks our datacenter egress (every server request gets
 *    a Cloudflare HTML 403), so server-side delivery may never succeed. Rows
 *    then simply stay `pending` and the admin NELC tab flushes them through
 *    the OWNER'S BROWSER (inside Saudi Arabia) — same relay pattern the
 *    staging verification used. The server still tries first: if NELC ever
 *    allowlists our IPs, delivery becomes fully automatic with no change.
 *
 * WHEN IS THE OUTBOX ACTIVE
 * -------------------------
 * outboxActive() gates ENQUEUEING (not just sending): only the published
 * deployment (REPLIT_DEPLOYMENT=1) queues statements, because the dev
 * preview shares the production secrets but holds TEST children — its events
 * must never reach NELC's store (the 2026-08-10 burned-ID incident). Tests
 * opt in explicitly with NELC_OUTBOX_TEST=1 against the isolated test DB.
 *
 * ORDERING & DUPLICATES
 * ---------------------
 *  - Enqueue transactions lock the child row (FOR UPDATE), so concurrent
 *    completions by the same child serialize and `registered` is queued
 *    exactly once per learner+course.
 *  - Delivery is strictly in row order with stop-on-first-failure, so a
 *    learner's `registered` always lands before their completions.
 *  - `attempts` caps SERVER retries only (a geo-blocked row would otherwise
 *    burn retries forever); the browser flush ignores the cap — for it,
 *    pending is pending.
 */

import type { LrnBand, Prisma } from '@prisma/client';
import { prisma } from './db';
import {
  buildCourseCompleted,
  buildLessonCompleted,
  buildProgressed,
  buildRegistered,
  buildUnitCompleted,
  courseForSubject,
  prodLrsConfigured,
  sendProdStatement,
  type BuiltStatement,
} from './xapiProduction';

/** Server retry cap — pending rows beyond it wait for the browser flush. */
export const MAX_SERVER_ATTEMPTS = 5;

/**
 * True when real-learner statements may be QUEUED (and server-sent):
 * published deployment only — never the dev preview (test children, shared
 * NELC store). Tests opt in via NELC_OUTBOX_TEST=1 (isolated ye_test DB).
 */
export const outboxActive = (): boolean =>
  process.env.REPLIT_DEPLOYMENT === '1' || process.env.NELC_OUTBOX_TEST === '1';

type Tx = Prisma.TransactionClient;

/** Serialize all outbox work per child — concurrent completions queue here. */
const lockChildRow = async (tx: Tx, childId: number): Promise<void> => {
  await tx.$queryRawUnsafe(`SELECT id FROM ye_lrn_children WHERE id = $1 FOR UPDATE`, childId);
};

const hasRegistered = async (tx: Tx, nationalId: string, courseIri: string): Promise<boolean> =>
  Boolean(
    await tx.xapiOutbox.findFirst({
      where: { nationalId, courseIri, verb: 'registered' },
      select: { id: true },
    }),
  );

const insertRows = async (
  tx: Tx,
  childId: number,
  nationalId: string,
  courseIri: string,
  rows: BuiltStatement[],
): Promise<number> => {
  for (const r of rows) {
    await tx.xapiOutbox.create({
      data: {
        childId,
        nationalId,
        courseIri,
        verb: r.verb,
        statementId: r.statementId,
        statement: r.statement as Prisma.InputJsonValue,
      },
    });
  }
  return rows.length;
};

/**
 * Published lessons of one subject IN THE CHILD'S BAND + which of them the
 * child first-completed. Draft lessons/units never count toward progress,
 * and other bands' units are excluded — lesson access is band-scoped, so a
 * child must never be reported "progressing" against lessons they cannot
 * even open (their curriculum for a subject IS their band's slice of it).
 */
const subjectProgress = async (tx: Tx, childId: number, subjectId: number, band: LrnBand) => {
  const published = await tx.lrnLesson.findMany({
    where: { status: 'published', unit: { subjectId, status: 'published', band } },
    select: { id: true, unitId: true },
  });
  const doneRows = published.length
    ? await tx.lrnFirstCompletion.findMany({
        where: { childId, lessonId: { in: published.map((l) => l.id) } },
        select: { lessonId: true },
      })
    : [];
  const done = new Set(doneRows.map((r) => r.lessonId));
  const percent = published.length ? Math.round((done.size / published.length) * 100) : 0;
  return { published, done, percent };
};

/**
 * Queue the statements for one REAL first-completion (call AFTER the
 * completion transaction commits — reads must see the claimed row):
 * [registered once] → completed lesson → [completed unit] → progressed →
 * [completed course]. Returns the number of rows queued (0 when inactive or
 * the child has no national ID). Never throws — a delivery-telemetry bug
 * must not break a child's lesson; failures are logged loudly instead.
 */
export async function enqueueCompletionEvents(args: {
  childId: number;
  lessonId: number;
  score: number;
  timeSpentSeconds: number;
}): Promise<number> {
  const { childId, lessonId, score, timeSpentSeconds } = args;
  if (!outboxActive()) return 0;
  try {
    return await prisma.$transaction(async (tx) => {
      await lockChildRow(tx, childId);

      // Authoritative identity read INSIDE the lock — a parent setting or
      // clearing the ID concurrently cannot race this completion's events.
      const childRow = await tx.lrnChild.findUnique({
        where: { id: childId },
        select: { nationalId: true, band: true },
      });
      const nationalId = childRow?.nationalId;
      if (!childRow || !nationalId) return 0;

      const lesson = await tx.lrnLesson.findUnique({
        where: { id: lessonId },
        include: { unit: { include: { subject: true } } },
      });
      if (!lesson || lesson.status !== 'published' || lesson.unit.status !== 'published') return 0;
      // Access is band-guarded at completion time; skip rather than report
      // an out-of-band event if data ever drifts (e.g. band edited later).
      if (lesson.unit.band !== childRow.band) return 0;

      const subject = lesson.unit.subject;
      const course = courseForSubject(subject);
      const { published, done, percent } = await subjectProgress(
        tx,
        childId,
        subject.id,
        childRow.band,
      );
      if (!done.has(lessonId)) return 0; // no first-completion claim — repeat completions send nothing

      const at = new Date();
      let step = 0;
      const next = () => new Date(at.getTime() + step++ * 1000); // 1s apart, event order preserved

      const rows: BuiltStatement[] = [];
      if (!(await hasRegistered(tx, nationalId, course.iri))) {
        rows.push(buildRegistered(nationalId, course, next()));
      }
      rows.push(
        buildLessonCompleted(
          nationalId,
          course,
          {
            id: lesson.id,
            titleEn: lesson.titleEn,
            descEn: lesson.descEn,
            durationMinutes: lesson.durationMinutes,
          },
          score,
          timeSpentSeconds,
          next(),
        ),
      );
      const unitLessons = published.filter((l) => l.unitId === lesson.unitId);
      if (unitLessons.length > 0 && unitLessons.every((l) => done.has(l.id))) {
        rows.push(
          buildUnitCompleted(nationalId, course, { id: lesson.unit.id, titleEn: lesson.unit.titleEn }, next()),
        );
      }
      rows.push(buildProgressed(nationalId, course, percent, next()));
      if (percent === 100) rows.push(buildCourseCompleted(nationalId, course, next()));

      return insertRows(tx, childId, nationalId, course.iri, rows);
    });
  } catch (e) {
    console.error('[nelc-outbox] enqueueCompletionEvents failed (completion unaffected):', e);
    return 0;
  }
}

/**
 * Snapshot enqueue when a parent ADDS a national ID to a child who already
 * has learning history: `registered` + current `progressed` (+ `completed
 * course` at 100%) per subject the child has first-completions in. Past
 * individual lessons are NOT backfilled one-by-one — their progress is in
 * the percentage; future completions stream normally. Never throws.
 */
export async function enqueueIdSetSnapshot(args: {
  childId: number;
  nationalId: string;
}): Promise<number> {
  const { childId, nationalId } = args;
  if (!outboxActive()) return 0;
  try {
    return await prisma.$transaction(async (tx) => {
      await lockChildRow(tx, childId);

      const childRow = await tx.lrnChild.findUnique({
        where: { id: childId },
        select: { band: true },
      });
      if (!childRow) return 0;

      const firsts = await tx.lrnFirstCompletion.findMany({
        where: { childId },
        select: { lesson: { select: { unit: { select: { subjectId: true } } } } },
      });
      const subjectIds = [...new Set(firsts.map((f) => f.lesson.unit.subjectId))];
      let queued = 0;
      for (const subjectId of subjectIds) {
        const subject = await tx.lrnSubject.findUnique({ where: { id: subjectId } });
        if (!subject) continue;
        const course = courseForSubject(subject);
        const { done, percent } = await subjectProgress(tx, childId, subjectId, childRow.band);
        if (done.size === 0) continue;

        const at = new Date();
        let step = 0;
        const next = () => new Date(at.getTime() + step++ * 1000);

        const rows: BuiltStatement[] = [];
        if (!(await hasRegistered(tx, nationalId, course.iri))) {
          rows.push(buildRegistered(nationalId, course, next()));
        }
        rows.push(buildProgressed(nationalId, course, percent, next()));
        if (percent === 100) rows.push(buildCourseCompleted(nationalId, course, next()));
        queued += await insertRows(tx, childId, nationalId, course.iri, rows);
      }
      return queued;
    });
  } catch (e) {
    console.error('[nelc-outbox] enqueueIdSetSnapshot failed (profile update unaffected):', e);
    return 0;
  }
}

export type FlushResult = {
  attempted: number;
  sent: number;
  /** true = a delivery failed and the flush stopped (order preservation). */
  stopped: boolean;
  skipped: 'inactive' | 'not_configured' | null;
};

/**
 * Server-side delivery pass: send pending rows in id order, stop on first
 * failure. Claims each row atomically (attempts increment) so concurrent
 * passes (post-completion hook + periodic sweep) never double-send. Rows at
 * the attempts cap are left for the browser flush. Never throws.
 */
export async function flushOutboxServer(max = 25): Promise<FlushResult> {
  const result: FlushResult = { attempted: 0, sent: 0, stopped: false, skipped: null };
  if (!outboxActive()) return { ...result, skipped: 'inactive' };
  if (!prodLrsConfigured()) return { ...result, skipped: 'not_configured' };
  try {
    const rows = await prisma.xapiOutbox.findMany({
      where: { status: 'pending', attempts: { lt: MAX_SERVER_ATTEMPTS } },
      orderBy: { id: 'asc' },
      take: max,
    });
    if (rows.length === 0) return result;

    // TRANSPORT EXCLUSION: while an admin browser flush run is active
    // (prepared, not yet recorded/expired), its statements are "leased" to
    // the browser. Delivery is ordered, so the server does not skip past a
    // leased row either — it pauses at the boundary until the run is
    // recorded or expires (15 min). Any residual overlap (a server POST
    // already in flight when the run was prepared) is harmless: statement
    // UUIDs are the xAPI idempotency key, and an LRS stores a statement id
    // at most once — a duplicate POST cannot duplicate the record.
    const activeRuns = await prisma.xapiOutboxFlushRun.findMany({
      where: { consumed: false, expiresAt: { gt: new Date() } },
      select: { statementIds: true },
    });
    const leased = new Set(activeRuns.flatMap((r) => r.statementIds));

    for (const row of rows) {
      if (leased.has(row.statementId)) break; // browser owns from here — pause

      // Atomic claim — exactly one concurrent pass gets each attempt.
      const claimed = await prisma.xapiOutbox.updateMany({
        where: { id: row.id, status: 'pending', attempts: row.attempts },
        data: { attempts: { increment: 1 } },
      });
      if (claimed.count === 0) continue; // another pass owns this row now
      result.attempted++;

      const sent = await sendProdStatement(row.statement as Record<string, unknown>);
      if (sent.ok) {
        await prisma.xapiOutbox.update({
          where: { id: row.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
            source: 'server',
            lastHttpStatus: sent.httpStatus,
            lastError: null,
          },
        });
        result.sent++;
      } else {
        await prisma.xapiOutbox.update({
          where: { id: row.id },
          data: { lastHttpStatus: sent.httpStatus, lastError: sent.response.slice(0, 2000) },
        });
        result.stopped = true;
        break; // order preservation: later rows wait for the next pass
      }
    }
    if (result.attempted > 0) {
      console.log(
        `[nelc-outbox] server flush: attempted=${result.attempted} sent=${result.sent} stopped=${result.stopped}`,
      );
    }
    return result;
  } catch (e) {
    console.error('[nelc-outbox] server flush failed:', e);
    return { ...result, stopped: true };
  }
}
