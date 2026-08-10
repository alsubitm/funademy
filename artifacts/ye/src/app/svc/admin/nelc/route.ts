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
  lrsStatementsUrl,
  sendStatement,
} from '@/lib/xapi';

export const dynamic = 'force-dynamic';

/** GET — LRS config status + recent statement log for the admin «نيلك» tab. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const logs = await prisma.xapiStatement.findMany({
    orderBy: { id: 'desc' },
    take: 80,
  });

  return NextResponse.json({
    configured: lrsConfigured(),
    environment: lrsEnvironment(),
    defaultCourseIri: DEFAULT_COURSE_IRI,
    logs,
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prepared browser-relay runs expire quickly — the journey takes seconds. */
const PREPARED_RUN_TTL_MS = 15 * 60_000;

/**
 * POST — three admin-only actions, all honest about configuration (503
 * not_configured when secrets are missing — success is never faked):
 *
 *  { action:'prepare', password, nationalId, courseIri }
 *      Build the full 10-statement NELC journey server-side, persist the run
 *      (runId + ordered statement IDs, 15-min expiry, one-time) and return it
 *      — together with the LRS statements URL + Basic Authorization value —
 *      to the owner's browser, which POSTs the statements itself. NELC's WAF
 *      geo-blocks our server egress (non-Saudi datacenter IP → Cloudflare
 *      HTML 403 on every request), while the owner's device is inside Saudi
 *      Arabia.
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
 *  { nationalId, courseIri }  (default — server-side send)
 *      Original server-side journey: send in order, stop on first failure,
 *      log every attempt with source='server' (the server saw the LRS
 *      responses itself). Kept for egress-allowed environments (e.g. if NELC
 *      allowlists our IPs later); currently blocked by NELC's WAF.
 *
 * ACCEPTED RISK — LRS credential in the admin browser: `prepare` returns the
 * raw Basic Authorization value so the owner's browser can POST directly to
 * the geo-fenced LRS. This is deliberate and explicitly accepted because:
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
    body.action === 'prepare' || body.action === 'record' ? (body.action as string) : 'server';

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

  // ---- prepare / server-send: validate inputs + require configuration -----
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

  // ---- action: prepare — hand the journey to the owner's browser ----------
  if (action === 'prepare') {
    // STEP-UP AUTHORIZATION: this response hands the LRS Basic credential to
    // the browser, so a session cookie alone is not enough — the owner must
    // re-enter the admin password for every prepared run.
    if (String(body.password ?? '') !== getAdminPassword()) {
      return NextResponse.json({ error: 'reauth_failed' }, { status: 401 });
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

  // ---- default: server-side send (kept for egress-allowed environments) ---
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
