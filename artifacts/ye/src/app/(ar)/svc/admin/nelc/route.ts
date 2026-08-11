import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { getAdminPassword } from '@/lib/auth';
import { requireAdmin } from '../guard';
import {
  buildJourneyStatements,
  DEFAULT_COURSE_IRI,
  JOURNEY_STEPS,
  lrsAuthorization,
  lrsConfigured,
  lrsEnvironment,
  lrsAgentStatementsQueryUrl,
  lrsStatementsQueryUrl,
  lrsStatementsUrl,
  sendStatement,
} from '@/lib/xapi';
import { MAX_SERVER_ATTEMPTS } from '@/lib/xapiOutbox';
import {
  prodLrsAuthorization,
  prodLrsConfigured,
  prodLrsStatementsUrl,
} from '@/lib/xapiProduction';

export const dynamic = 'force-dynamic';

/** GET — LRS config status + recent statement log for the admin «نيلك» tab. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [logs, obPending, obSent, obStalled, obVoided, childrenWithId, childrenTotal, obLastFailed, obHead] =
    await Promise.all([
      prisma.xapiStatement.findMany({ orderBy: { id: 'desc' }, take: 80 }),
      prisma.xapiOutbox.count({ where: { status: 'pending' } }),
      prisma.xapiOutbox.count({ where: { status: 'sent' } }),
      prisma.xapiOutbox.count({
        where: { status: 'pending', attempts: { gte: MAX_SERVER_ATTEMPTS } },
      }),
      prisma.xapiOutbox.count({ where: { status: 'voided' } }),
      prisma.lrnChild.count({ where: { nationalId: { not: null } } }),
      prisma.lrnChild.count(),
      prisma.xapiOutbox.findFirst({
        where: { status: 'pending', lastError: { not: null } },
        orderBy: { id: 'desc' },
        select: { lastError: true, lastHttpStatus: true },
      }),
      // HEAD OF THE QUEUE: delivery is strictly ordered, so if this row keeps
      // failing it blocks EVERY row behind it (all children). Surfaced so the
      // admin can judge — and, when the rejection is permanent, void it.
      prisma.xapiOutbox.findFirst({
        where: { status: 'pending' },
        orderBy: { id: 'asc' },
        select: {
          statementId: true,
          verb: true,
          nationalId: true,
          attempts: true,
          lastError: true,
          lastHttpStatus: true,
          createdAt: true,
        },
      }),
    ]);

  return NextResponse.json({
    configured: lrsConfigured(),
    environment: lrsEnvironment(),
    // REAL learner data → NELC PRODUCTION LRS (outbox status for the admin
    // panel). Separate credential set from the staging test tools above.
    production: {
      configured: prodLrsConfigured(),
      pending: obPending,
      sent: obSent,
      stalled: obStalled, // pending rows past the server retry cap — browser flush only
      childrenWithId,
      childrenWithoutId: childrenTotal - childrenWithId,
      lastError: obLastFailed?.lastError ?? null,
      lastHttpStatus: obLastFailed?.lastHttpStatus ?? null,
      voided: obVoided,
      // Queue head with its last delivery error — the row the admin decides
      // about. head.blocking=true when it has already failed at least once.
      head: obHead
        ? {
            statementId: obHead.statementId,
            verb: obHead.verb,
            nationalId: obHead.nationalId,
            attempts: obHead.attempts,
            lastError: obHead.lastError,
            lastHttpStatus: obHead.lastHttpStatus,
            createdAt: obHead.createdAt,
            blocking: obHead.lastError !== null || obHead.attempts > 0,
          }
        : null,
    },
    // SERVER-side runtime distinction (2026-08-10 burned-ID incident: the
    // journeys were fired from the DEV PREVIEW while NELC's LRS is ONE store
    // shared with the published site). REPLIT_DEPLOYMENT is set only in the
    // published deployment, so anything else — dev preview, local — must show
    // the «أنت في بيئة التطوير» warning in the UI. Determined here, never
    // from the browser's address bar.
    deployed: process.env.REPLIT_DEPLOYMENT === '1',
    defaultCourseIri: DEFAULT_COURSE_IRI,
    logs,
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prepared browser-relay runs expire quickly — the journey takes seconds. */
const PREPARED_RUN_TTL_MS = 15 * 60_000;

/**
 * Audit-log verb + prepared-run marker for the read-back self-check. Not a
 * journey step key, so self-check rows are distinguishable in the log and a
 * prepared check can never be consumed by the journey `record` action (and
 * vice versa).
 */
const SELF_CHECK_VERB = 'self_check';

/**
 * SEQ003: strongest prior-send signal for a learner+course+environment.
 *   1. a DELIVERED (ok, non-self-check) audit row — statements reached the
 *      LRS (strong; audit rows are permanent);
 *   2. an UNCONSUMED prepared JOURNEY run — the browser was handed the
 *      statements but never reported back, so they MAY have reached the LRS
 *      (weak; covers the crash-before-`record` gap; housekeeping trims these
 *      rows after ~24h, by which point signal 1 exists if anything was
 *      actually sent and recorded).
 * Consumed runs are skipped — their outcome is known via audit rows, and
 * failed-only journeys must NOT block (nothing reached the LRS; resending IS
 * the fix). Self-check runs/rows never count (read-only). Two concurrent
 * prepares could both pass this check (no atomic claim) — accepted: this app
 * has exactly ONE admin, and the guard exists to stop accidental re-sends,
 * not adversarial races.
 */
async function findPriorJourneySignal(
  nationalId: string,
  courseIri: string,
  environment: string,
): Promise<{ delivered: boolean; at: Date } | null> {
  const delivered = await prisma.xapiStatement.findFirst({
    where: { nationalId, courseIri, environment, ok: true, verb: { not: SELF_CHECK_VERB } },
    orderBy: { id: 'desc' },
    select: { createdAt: true },
  });
  if (delivered) return { delivered: true, at: delivered.createdAt };
  // Trim expired runs first so they cannot block retries after the TTL.
  await prisma.xapiPreparedRun.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  const runs = await prisma.xapiPreparedRun.findMany({
    // Only live (unexpired) unconsumed runs count — an expired run means the
    // browser crashed before recording; after the TTL it must not block retries.
    where: { nationalId, courseIri, environment, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { id: 'desc' },
    take: 10,
  });
  const prepared = runs.find((r) => {
    const steps = r.steps as unknown as { key?: string }[];
    return !(Array.isArray(steps) && steps[0]?.key === SELF_CHECK_VERB);
  });
  return prepared ? { delivered: false, at: prepared.createdAt } : null;
}

/**
 * POST — three admin-only actions, all honest about configuration (503
 * not_configured when secrets are missing — success is never faked):
 *
 *  { action:'prepare', password, nationalId, courseIri, confirmDuplicate? }
 *      Build the full 10-statement NELC journey server-side, persist the run
 *      (runId + ordered statement IDs, 15-min expiry, one-time) and return it
 *      — together with the LRS statements URL + Basic Authorization value —
 *      to the owner's browser, which POSTs the statements itself. NELC's WAF
 *      geo-blocks our server egress (non-Saudi datacenter IP → Cloudflare
 *      HTML 403 on every request), while the owner's device is inside Saudi
 *      Arabia.
 *      SEQ003 duplicate guard (shared with the default server-send): if a
 *      DELIVERED (ok) journey row OR an unconsumed prepared journey run
 *      already exists for the same nationalId+courseIri+environment, answer
 *      409 duplicate_journey {delivered, lastSentAt} unless the body carries
 *      confirmDuplicate:true — NELC's verifier flags re-sent journeys as
 *      duplicate statements and demands a fresh national ID per attempt.
 *      See findPriorJourneySignal for the full policy.
 *
 *  { action:'record', runId, results:[…] }
 *      Persist the per-statement outcomes reported back by the browser.
 *      Run provenance is enforced — accepted only for an unconsumed,
 *      unexpired server-prepared run, only as the exact ordered prefix of its
 *      prepared statement IDs (stop-on-failure shape: only the last reported
 *      step may fail), consumed atomically, and identity/course are taken
 *      from the stored run, never from the client. This guarantees every log
 *      row corresponds to a journey THIS server prepared. What it cannot
 *      guarantee is delivery: ok/status/response are as reported by the
 *      browser, so rows are stored with source='browser' and the UI labels
 *      them as browser-reported. The AUTHORITATIVE delivery check is NELC's
 *      own wizard («بدء الاختبار»), which reads NELC's LRS directly.
 *
 *  { action:'check', password, nationalId, courseIri }
 *      SELF-CHECK read-back: like `prepare` but READ-ONLY — persist a
 *      one-time check (same TTL) and hand the owner's browser a FILTERED
 *      statements GET url (agent + activity, limit 25) plus the Basic
 *      Authorization, so the owner can confirm what the LRS actually stored
 *      for that learner + course without burning a wizard attempt.
 *
 *  { action:'record_check', checkId, ok, httpStatus, matched, parityMatched,
 *    verbs, missingSteps, detail? }
 *      Persist the self-check outcome as ONE distinguishable audit row
 *      (verb='self_check', source='browser'); the matched statement count,
 *      the example-parity count (statements passing the FULL wizard-example
 *      validator shared in xapiParity — the only ones NELC's verifier
 *      counts), the missing journey verbs + verb list are stored in the
 *      row's response JSON. Same provenance rules as `record`:
 *      only an unconsumed, unexpired, server-prepared SELF-CHECK (never a
 *      journey run) is accepted, consumed atomically, with identity/course
 *      taken from the stored check, never the client.
 *
 *  { action:'precheck', password, nationalId, courseIri }
 *      PRE-SEND burned-ID check (SEQ003 layer 2 — asks NELC's own LRS, not
 *      our per-environment audit log): validate + step-up, then hand the
 *      owner's browser an AGENT-ONLY statements GET url (no activity filter —
 *      the LRS is one shared store across dev preview + published site and
 *      never deletes, so a prior statement for ANY course burns the ID) plus
 *      the Basic Authorization. READ-ONLY and deliberately record-free: it
 *      neither sends nor consumes anything, so no prepared-run row is
 *      created and no audit row is written. The browser classifies the LRS
 *      answer FAIL-CLOSED via xapiParity.classifyPrecheckResponse — only
 *      HTTP 200 with zero statements clears the ID; read-denied (our
 *      credentials are write-only) and every other failure force an explicit
 *      user confirmation in the UI instead of a silent pass.
 *
 *  { nationalId, courseIri, confirmDuplicate? }  (default — server-side send)
 *      Original server-side journey: send in order, stop on first failure,
 *      log every attempt with source='server' (the server saw the LRS
 *      responses itself). Kept for egress-allowed environments (e.g. if NELC
 *      allowlists our IPs later); currently blocked by NELC's WAF. The same
 *      SEQ003 duplicate guard applies — the transport differs, NELC's
 *      duplicate rule does not.
 *
 * ACCEPTED RISK — LRS credential in the admin browser: `prepare` and `check`
 * return the raw Basic Authorization value so the owner's browser can talk
 * directly to the geo-fenced LRS. This is deliberate and explicitly accepted
 * because:
 *   - this app has exactly ONE admin identity — the owner (a single
 *     ADMIN_PASSWORD, no other accounts or roles) — and the credential handed
 *     over is the owner's own LRS key for the platform's own statement store;
 *   - `prepare` requires RE-ENTERING the admin password (step-up), so a
 *     stolen session cookie alone cannot extract the credential;
 *   - prepared runs are one-time and expire after 15 minutes;
 *   - there is no alternative: NELC's WAF blocks every non-Saudi server IP,
 *     so neither sending nor delivery confirmation can happen server-side.
 * NEVER reuse this relay for non-admin users or production learner events —
 * those need NELC IP allowlisting or KSA egress instead.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const action =
    body.action === 'prepare' ||
    body.action === 'record' ||
    body.action === 'check' ||
    body.action === 'record_check' ||
    body.action === 'precheck' ||
    body.action === 'outbox_prepare' ||
    body.action === 'outbox_record' ||
    body.action === 'outbox_void'
      ? (body.action as string)
      : 'server';

  // ---- action: record — persist browser-reported results ------------------
  // Placed before the config check on purpose: outcomes of an already-sent
  // journey must be recordable even if secrets were removed meanwhile.
  if (action === 'record') {
    const runId = String(body.runId ?? '');
    if (!UUID_RE.test(runId)) {
      return NextResponse.json({ error: 'invalid_run_id' }, { status: 400 });
    }
    const raw = Array.isArray(body.results) ? (body.results as Record<string, unknown>[]) : null;
    if (!raw || raw.length === 0 || raw.length > JOURNEY_STEPS.length) {
      return NextResponse.json({ error: 'invalid_results' }, { status: 400 });
    }
    const validVerbs = new Set<string>(JOURNEY_STEPS.map((s) => s.key));
    const rows: {
      verb: string;
      statementId: string;
      ok: boolean;
      httpStatus: number | null;
      response: string;
    }[] = [];
    for (const r of raw) {
      const verb = String(r.verb ?? '');
      const statementId = String(r.statementId ?? '');
      const httpStatus =
        r.httpStatus === null || r.httpStatus === undefined ? null : Number(r.httpStatus);
      if (
        !validVerbs.has(verb) ||
        !UUID_RE.test(statementId) ||
        (httpStatus !== null &&
          (!Number.isInteger(httpStatus) || httpStatus < 0 || httpStatus > 999))
      ) {
        return NextResponse.json({ error: 'invalid_results' }, { status: 400 });
      }
      rows.push({
        verb,
        statementId,
        ok: r.ok === true,
        httpStatus,
        response: String(r.response ?? '').slice(0, 2000),
      });
    }

    // Provenance: the run must exist, be fresh, and be unconsumed…
    const run = await prisma.xapiPreparedRun.findUnique({ where: { runId } });
    if (!run) return NextResponse.json({ error: 'unknown_run' }, { status: 404 });
    if (run.consumed) return NextResponse.json({ error: 'already_recorded' }, { status: 409 });
    if (run.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'run_expired' }, { status: 410 });
    }

    // …and the reported steps must be EXACTLY the prepared ones, in order,
    // as a stop-on-failure prefix (only the last reported step may fail).
    const prepared = run.steps as unknown as { key: string; statementId: string }[];
    const isValidPrefix =
      Array.isArray(prepared) &&
      rows.length <= prepared.length &&
      rows.every((r, i) => r.verb === prepared[i].key && r.statementId === prepared[i].statementId) &&
      rows.every((r, i) => r.ok || i === rows.length - 1);
    if (!isValidPrefix) {
      return NextResponse.json({ error: 'results_mismatch' }, { status: 400 });
    }

    // Atomic one-time consume — a concurrent duplicate loses this claim.
    const claimed = await prisma.xapiPreparedRun.updateMany({
      where: { runId, consumed: false },
      data: { consumed: true },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: 'already_recorded' }, { status: 409 });
    }

    // Audit rows use the SERVER-stored identity/course, never client input,
    // and are explicitly labeled as browser-reported (unverified server-side).
    for (const row of rows) {
      await prisma.xapiStatement.create({
        data: {
          runId,
          environment: run.environment,
          nationalId: run.nationalId,
          courseIri: run.courseIri,
          source: 'browser',
          ...row,
        },
      });
    }
    return NextResponse.json({ ok: rows.every((r) => r.ok), recorded: rows.length, source: 'browser' });
  }

  // ---- action: record_check — persist the self-check outcome --------------
  // Also before the config check: a check that already ran must stay
  // recordable even if secrets were removed meanwhile.
  if (action === 'record_check') {
    const checkId = String(body.checkId ?? '');
    if (!UUID_RE.test(checkId)) {
      return NextResponse.json({ error: 'invalid_check_id' }, { status: 400 });
    }
    const ok = body.ok === true;
    const httpStatus =
      body.httpStatus === null || body.httpStatus === undefined ? null : Number(body.httpStatus);
    const matched = Number(body.matched);
    const parityMatched = Number(body.parityMatched);
    const rawVerbs = Array.isArray(body.verbs) ? (body.verbs as unknown[]) : null;
    const rawMissing = Array.isArray(body.missingSteps) ? (body.missingSteps as unknown[]) : null;
    if (
      (httpStatus !== null &&
        (!Number.isInteger(httpStatus) || httpStatus < 0 || httpStatus > 999)) ||
      !Number.isInteger(matched) ||
      matched < 0 ||
      matched > 1000 ||
      !Number.isInteger(parityMatched) ||
      parityMatched < 0 ||
      parityMatched > 1000 ||
      !rawVerbs ||
      rawVerbs.length > 60 ||
      rawVerbs.some((v) => typeof v !== 'string' || v.length > 300) ||
      !rawMissing ||
      rawMissing.length > 12 ||
      rawMissing.some((v) => typeof v !== 'string' || v.length > 60)
    ) {
      return NextResponse.json({ error: 'invalid_check_results' }, { status: 400 });
    }
    const verbs = rawVerbs as string[];
    const missingSteps = rawMissing as string[];
    const detail = String(body.detail ?? '').slice(0, 1200);

    const run = await prisma.xapiPreparedRun.findUnique({ where: { runId: checkId } });
    if (!run) return NextResponse.json({ error: 'unknown_check' }, { status: 404 });
    const prepared = run.steps as unknown as { key: string; statementId: string }[];
    const isCheckRun =
      Array.isArray(prepared) && prepared.length === 1 && prepared[0]?.key === SELF_CHECK_VERB;
    if (!isCheckRun) return NextResponse.json({ error: 'not_a_check' }, { status: 400 });
    if (run.consumed) return NextResponse.json({ error: 'already_recorded' }, { status: 409 });
    if (run.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'run_expired' }, { status: 410 });
    }

    // Atomic one-time consume — a concurrent duplicate loses this claim.
    const claimed = await prisma.xapiPreparedRun.updateMany({
      where: { runId: checkId, consumed: false },
      data: { consumed: true },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: 'already_recorded' }, { status: 409 });
    }

    await prisma.xapiStatement.create({
      data: {
        runId: checkId,
        environment: run.environment,
        nationalId: run.nationalId,
        courseIri: run.courseIri,
        verb: SELF_CHECK_VERB,
        statementId: prepared[0].statementId,
        ok,
        httpStatus,
        response: JSON.stringify({
          matched,
          parityMatched,
          missingSteps,
          verbs,
          ...(detail ? { detail } : {}),
        }).slice(0, 2000),
        source: 'browser',
      },
    });
    return NextResponse.json({ ok, matched, parityMatched, recorded: 1, source: 'browser' });
  }

  // ---- action: outbox_record — mark browser-flushed PRODUCTION rows -------
  // Also before the config check: outcomes of an already-run browser flush
  // must stay recordable even if secrets were removed meanwhile. Same
  // provenance rules as `record`: only an unconsumed, unexpired
  // outbox_prepare run, only the exact ordered prefix of its statement IDs
  // (stop-on-failure shape), consumed atomically.
  if (action === 'outbox_record') {
    const runId = String(body.runId ?? '');
    if (!UUID_RE.test(runId)) {
      return NextResponse.json({ error: 'invalid_run_id' }, { status: 400 });
    }
    const raw = Array.isArray(body.results) ? (body.results as Record<string, unknown>[]) : null;
    if (!raw || raw.length === 0 || raw.length > 200) {
      return NextResponse.json({ error: 'invalid_results' }, { status: 400 });
    }
    const rows: { statementId: string; ok: boolean; httpStatus: number | null; response: string }[] =
      [];
    for (const r of raw) {
      const statementId = String(r.statementId ?? '');
      const httpStatus =
        r.httpStatus === null || r.httpStatus === undefined ? null : Number(r.httpStatus);
      if (
        !UUID_RE.test(statementId) ||
        (httpStatus !== null &&
          (!Number.isInteger(httpStatus) || httpStatus < 0 || httpStatus > 999))
      ) {
        return NextResponse.json({ error: 'invalid_results' }, { status: 400 });
      }
      rows.push({
        statementId,
        ok: r.ok === true,
        httpStatus,
        response: String(r.response ?? '').slice(0, 2000),
      });
    }

    const run = await prisma.xapiOutboxFlushRun.findUnique({ where: { runId } });
    if (!run) return NextResponse.json({ error: 'unknown_run' }, { status: 404 });
    if (run.consumed) return NextResponse.json({ error: 'already_recorded' }, { status: 409 });
    if (run.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'run_expired' }, { status: 410 });
    }

    const isValidPrefix =
      rows.length <= run.statementIds.length &&
      rows.every((r, i) => r.statementId === run.statementIds[i]) &&
      rows.every((r, i) => r.ok || i === rows.length - 1);
    if (!isValidPrefix) {
      return NextResponse.json({ error: 'results_mismatch' }, { status: 400 });
    }

    const claimed = await prisma.xapiOutboxFlushRun.updateMany({
      where: { runId, consumed: false },
      data: { consumed: true },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: 'already_recorded' }, { status: 409 });
    }

    let sent = 0;
    for (const row of rows) {
      if (row.ok) {
        const updated = await prisma.xapiOutbox.updateMany({
          where: { statementId: row.statementId, status: 'pending' },
          data: {
            status: 'sent',
            sentAt: new Date(),
            source: 'browser',
            lastHttpStatus: row.httpStatus,
            lastError: null,
          },
        });
        sent += updated.count;
      } else {
        await prisma.xapiOutbox.updateMany({
          where: { statementId: row.statementId, status: 'pending' },
          data: {
            lastHttpStatus: row.httpStatus,
            lastError: (row.response || 'browser_reported_failure').slice(0, 2000),
          },
        });
      }
    }
    return NextResponse.json({ ok: rows.every((r) => r.ok), sent });
  }

  // ---- action: outbox_void — skip ONE permanently-rejected outbox row -----
  // Delivery is strictly ordered, so a row NELC rejects permanently (e.g. a
  // 400 for an unexpected shape) blocks every statement behind it — for ALL
  // children — forever. This lets the admin void exactly that row: never a
  // delete (the row, its statement, its last error, the reason, who and when
  // all stay in the DB) and never a fake success (status becomes 'voided',
  // not 'sent'). Step-up password required; sent rows can never be voided.
  if (action === 'outbox_void') {
    if (String(body.password ?? '') !== getAdminPassword()) {
      return NextResponse.json({ error: 'reauth_failed' }, { status: 401 });
    }
    const statementId = String(body.statementId ?? '');
    if (!UUID_RE.test(statementId)) {
      return NextResponse.json({ error: 'invalid_statement_id' }, { status: 400 });
    }
    const reason = String(body.reason ?? '').trim();
    if (!reason || reason.length > 500) {
      return NextResponse.json({ error: 'reason_required' }, { status: 400 });
    }
    // Atomic: only a still-pending row can be voided — a row that was sent
    // (or already voided) meanwhile is never touched.
    const voided = await prisma.xapiOutbox.updateMany({
      where: { statementId, status: 'pending' },
      data: {
        status: 'voided',
        voidReason: reason.slice(0, 500),
        voidedBy: 'admin',
        voidedAt: new Date(),
      },
    });
    if (voided.count === 0) {
      const row = await prisma.xapiOutbox.findUnique({
        where: { statementId },
        select: { status: true },
      });
      return NextResponse.json(
        { error: row ? 'not_pending' : 'unknown_statement', status: row?.status ?? null },
        { status: row ? 409 : 404 },
      );
    }
    console.warn(`[nelc-outbox] row ${statementId} VOIDED by admin — reason: ${reason.slice(0, 200)}`);
    return NextResponse.json({ ok: true, voided: 1 });
  }

  // ---- action: outbox_prepare — hand pending REAL statements to the browser
  if (action === 'outbox_prepare') {
    // STEP-UP AUTHORIZATION: the response hands the PRODUCTION LRS credential
    // to the browser — same accepted-risk rationale as the staging relay.
    if (String(body.password ?? '') !== getAdminPassword()) {
      return NextResponse.json({ error: 'reauth_failed' }, { status: 401 });
    }
    // REAL learner data leaves ONLY from the published deployment — no typed
    // override here (unlike the staging test journey): there is no legitimate
    // dev-preview use. Tests opt in via NELC_OUTBOX_TEST on the ye_test DB.
    if (process.env.REPLIT_DEPLOYMENT !== '1' && process.env.NELC_OUTBOX_TEST !== '1') {
      return NextResponse.json({ error: 'dev_environment_blocked' }, { status: 403 });
    }
    if (!prodLrsConfigured()) {
      return NextResponse.json({ error: 'prod_not_configured' }, { status: 503 });
    }
    await prisma.xapiOutboxFlushRun.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
    });
    // Strict id order = per-learner event order. The browser flush ignores
    // the SERVER attempts cap on purpose — for it, pending is pending.
    const rows = await prisma.xapiOutbox.findMany({
      where: { status: 'pending' },
      orderBy: { id: 'asc' },
      take: 25,
    });
    if (rows.length === 0) return NextResponse.json({ runId: null, statements: [] });
    const runId = randomUUID();
    await prisma.xapiOutboxFlushRun.create({
      data: {
        runId,
        statementIds: rows.map((r) => r.statementId),
        expiresAt: new Date(Date.now() + PREPARED_RUN_TTL_MS),
      },
    });
    return NextResponse.json({
      runId,
      url: prodLrsStatementsUrl(),
      authorization: prodLrsAuthorization(),
      statements: rows.map((r) => ({
        statementId: r.statementId,
        verb: r.verb,
        nationalId: r.nationalId,
        statement: r.statement,
      })),
    });
  }

  // ---- prepare / check / server-send: validate inputs + require config ----
  const nationalId = String(body.nationalId ?? '').trim();
  const courseIri = String(body.courseIri ?? '').trim() || DEFAULT_COURSE_IRI;

  if (!/^\d{10}$/.test(nationalId)) {
    return NextResponse.json({ error: 'invalid_national_id' }, { status: 400 });
  }
  let parsedIri: URL;
  try {
    parsedIri = new URL(courseIri);
  } catch {
    return NextResponse.json({ error: 'invalid_course_iri' }, { status: 400 });
  }
  if (!/^https?:$/.test(parsedIri.protocol) || courseIri.length > 300) {
    return NextResponse.json({ error: 'invalid_course_iri' }, { status: 400 });
  }

  if (!lrsConfigured()) {
    return NextResponse.json({ configured: false, error: 'not_configured' }, { status: 503 });
  }

  const environment = lrsEnvironment();

  // ---- DEV-ENVIRONMENT SEND BLOCK (server-side, not just the UI banner) ----
  // NELC's LRS is ONE store shared with the published site, and the
  // 2026-08-10 burned-ID incident came from sending out of the dev preview.
  // The yellow/red banner (task 118) only warns; here the SERVER refuses the
  // send actions (`prepare` and the default server-side send — the two paths
  // that put statements into the LRS; `check`/`precheck` are read-only)
  // whenever it is not running as the published deployment
  // (REPLIT_DEPLOYMENT=1), unless the request carries an EXPLICIT separate
  // confirmation flag that the UI only sets after a typed confirmation.
  if (
    (action === 'prepare' || action === 'server') &&
    process.env.REPLIT_DEPLOYMENT !== '1' &&
    body.confirmDevSend !== true
  ) {
    return NextResponse.json({ error: 'dev_environment_blocked' }, { status: 403 });
  }

  // ---- action: prepare — hand the journey to the owner's browser ----------
  if (action === 'prepare') {
    // STEP-UP AUTHORIZATION: this response hands the LRS Basic credential to
    // the browser, so a session cookie alone is not enough — the owner must
    // re-enter the admin password for every prepared run.
    if (String(body.password ?? '') !== getAdminPassword()) {
      return NextResponse.json({ error: 'reauth_failed' }, { status: 401 });
    }
    // SEQ003 duplicate guard — policy in findPriorJourneySignal.
    if (body.confirmDuplicate !== true) {
      const prior = await findPriorJourneySignal(nationalId, courseIri, environment);
      if (prior) {
        return NextResponse.json(
          { error: 'duplicate_journey', delivered: prior.delivered, lastSentAt: prior.at },
          { status: 409 },
        );
      }
    }
    const runId = randomUUID();
    const journey = buildJourneyStatements(nationalId, courseIri);
    // Housekeeping: drop long-expired prepared runs, then persist this one so
    // `record` can later verify provenance against it.
    await prisma.xapiPreparedRun.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
    });
    await prisma.xapiPreparedRun.create({
      data: {
        runId,
        environment,
        nationalId,
        courseIri,
        steps: journey.map((s) => ({ key: s.key, statementId: s.statementId })),
        expiresAt: new Date(Date.now() + PREPARED_RUN_TTL_MS),
      },
    });
    return NextResponse.json({
      configured: true,
      environment,
      runId,
      url: lrsStatementsUrl(),
      authorization: lrsAuthorization(),
      steps: journey.map((s) => ({
        key: s.key,
        statementId: s.statementId,
        statement: s.statement,
      })),
    });
  }

  // ---- action: check — prepared read-back self-check for the browser ------
  if (action === 'check') {
    // STEP-UP AUTHORIZATION: same rationale as `prepare` — the response
    // hands the LRS Basic credential to the browser.
    if (String(body.password ?? '') !== getAdminPassword()) {
      return NextResponse.json({ error: 'reauth_failed' }, { status: 401 });
    }
    const checkId = randomUUID();
    await prisma.xapiPreparedRun.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
    });
    await prisma.xapiPreparedRun.create({
      data: {
        runId: checkId,
        environment,
        nationalId,
        courseIri,
        // The single self_check step marks this run as a read-back check —
        // `record` can never consume it (verb mismatch) and `record_check`
        // refuses anything else.
        steps: [{ key: SELF_CHECK_VERB, statementId: randomUUID() }],
        expiresAt: new Date(Date.now() + PREPARED_RUN_TTL_MS),
      },
    });
    return NextResponse.json({
      configured: true,
      environment,
      checkId,
      url: lrsStatementsQueryUrl(nationalId, courseIri),
      authorization: lrsAuthorization(),
    });
  }

  // ---- action: precheck — pre-send burned-ID read-back for the browser ----
  if (action === 'precheck') {
    // STEP-UP AUTHORIZATION: same rationale as `prepare`/`check` — the
    // response hands the LRS Basic credential to the browser.
    if (String(body.password ?? '') !== getAdminPassword()) {
      return NextResponse.json({ error: 'reauth_failed' }, { status: 401 });
    }
    // Deliberately record-free (unlike `check`): nothing is sent and nothing
    // can be consumed later, so there is no prepared-run row to create or
    // steal. The url is AGENT-ONLY — see lrsAgentStatementsQueryUrl for why
    // course/environment scoping would miss burned IDs.
    return NextResponse.json({
      configured: true,
      environment,
      url: lrsAgentStatementsQueryUrl(nationalId),
      authorization: lrsAuthorization(),
    });
  }

  // ---- default: server-side send (kept for egress-allowed environments) ---
  // Same SEQ003 duplicate guard as `prepare` — the transport differs, NELC's
  // duplicate rule does not.
  if (body.confirmDuplicate !== true) {
    const prior = await findPriorJourneySignal(nationalId, courseIri, environment);
    if (prior) {
      return NextResponse.json(
        { error: 'duplicate_journey', delivered: prior.delivered, lastSentAt: prior.at },
        { status: 409 },
      );
    }
  }
  const runId = randomUUID();
  const journey = buildJourneyStatements(nationalId, courseIri);

  const results: {
    verb: string;
    statementId: string;
    ok: boolean;
    httpStatus: number | null;
    response: string;
  }[] = [];
  let allOk = true;

  for (const step of journey) {
    const sent = await sendStatement(step.statement);
    await prisma.xapiStatement.create({
      data: {
        runId,
        environment,
        nationalId,
        courseIri,
        verb: step.key,
        statementId: step.statementId,
        httpStatus: sent.httpStatus,
        response: sent.response,
        ok: sent.ok,
        source: 'server',
      },
    });
    results.push({
      verb: step.key,
      statementId: step.statementId,
      ok: sent.ok,
      httpStatus: sent.httpStatus,
      response: sent.response,
    });
    if (!sent.ok) {
      allOk = false;
      break; // stop on first failure — do not send later steps
    }
  }

  return NextResponse.json({ ok: allOk, configured: true, environment, runId, results });
}
