/**
 * NELC xAPI journey — statement builders + admin /svc/admin/nelc endpoint.
 *
 *  - builders produce the exact 10-statement journey from NELC's wizard guide
 *    (mbox actor pattern, actor.name = national ID) with fresh UUIDs per run
 *  - endpoint validates input, refuses to send when the LRS is not
 *    configured (no fake success), stops on first LRS failure, and persists
 *    an audit row per attempted statement
 *
 * Runs against the isolated ye_test database; LRS HTTP calls are mocked —
 * no real network traffic to NELC.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';

vi.mock('@/app/svc/admin/guard', () => ({
  requireAdmin: vi.fn(async () => null), // admin session assumed valid in tests
}));

import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { buildJourneyStatements, JOURNEY_STEPS, lrsConfigured } from '@/lib/xapi';
import { GET as nelcGET, POST as nelcPOST } from '@/app/svc/admin/nelc/route';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

// The workspace may hold REAL NELC LRS secrets — clear them for every test so
// the suite never depends on (or leaks into) the real environment.
beforeEach(() => {
  vi.stubEnv('NELC_LRS_ENDPOINT', '');
  vi.stubEnv('NELC_LRS_KEY', '');
  vi.stubEnv('NELC_LRS_SECRET', '');
  vi.stubEnv('NELC_LRS_ENV', '');
});

const stubLrsEnv = () => {
  vi.stubEnv('NELC_LRS_ENDPOINT', 'https://lrs.staging.example/data/xAPI');
  vi.stubEnv('NELC_LRS_KEY', 'test-key');
  vi.stubEnv('NELC_LRS_SECRET', 'test-secret');
  // prepare requires step-up re-auth with the admin password
  vi.stubEnv('ADMIN_PASSWORD', 'test-admin-pass');
};

const postReq = (body: unknown) =>
  new NextRequest('http://localhost/svc/admin/nelc', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

describe('buildJourneyStatements', () => {
  it('builds the 10-statement NELC journey in the wizard order with NELC verb IRIs', () => {
    const journey = buildJourneyStatements('1234567890', 'https://funademy.io/course/CR001');
    expect(journey.map((s) => s.key)).toEqual([
      'registered',
      'initialized',
      'watched',
      'completed_lesson',
      'attempted',
      'completed_unit',
      'progressed',
      'completed_course',
      'rated',
      'earned',
    ]);
    const iris = journey.map((s) => (s.statement.verb as { id: string }).id);
    expect(iris).toEqual(JOURNEY_STEPS.map((v) => v.iri));
    // NELC-specific IRIs (verified against NELC's own integration packages)
    expect(iris[2]).toBe('https://w3id.org/xapi/acrossx/verbs/watched');
    expect(iris[8]).toBe('http://id.tincanapi.com/verb/rated');
    expect(iris[9]).toBe('http://id.tincanapi.com/verb/earned');
    expect(iris.filter((i) => i === 'http://adlnet.gov/expapi/verbs/completed')).toHaveLength(3);
  });

  it('uses the wizard mbox actor pattern and the same course IRI on every statement', () => {
    const journey = buildJourneyStatements('1098765432', 'https://funademy.io/course/CR001');
    for (const step of journey) {
      const actor = step.statement.actor as { mbox: string; name: string; objectType: string };
      expect(actor.mbox).toBe('mailto:1098765432@gmail.com');
      expect(actor.name).toBe('1098765432');
      expect(actor.objectType).toBe('Agent');
      // One course id across the whole journey — the wizard rejects multiple ids.
      expect((step.statement.object as { id: string }).id).toBe('https://funademy.io/course/CR001');
      const display = (step.statement.verb as { display: Record<string, string> }).display;
      expect(Object.keys(display)).toEqual(['en-US']);
    }
  });

  it('shares one registration per run, ascending timestamps, and result details on progressed/completed', () => {
    const journey = buildJourneyStatements('1234567890', 'https://funademy.io/course/CR001');
    const registrations = new Set(
      journey.map((s) => (s.statement.context as { registration: string }).registration),
    );
    expect(registrations.size).toBe(1);

    const times = journey.map((s) => new Date(s.statement.timestamp as string).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);

    const progressed = journey.find((s) => s.key === 'progressed')!;
    expect((progressed.statement.result as { score: { raw: number } }).score.raw).toBe(50);
    const completedCourse = journey.find((s) => s.key === 'completed_course')!;
    expect((completedCourse.statement.result as { completion: boolean }).completion).toBe(true);
    const rated = journey.find((s) => s.key === 'rated')!;
    expect((rated.statement.result as { score: { raw: number } }).score.raw).toBe(5);
  });

  it('generates fresh statement UUIDs on every run (safe wizard retries)', () => {
    const a = buildJourneyStatements('1234567890', 'https://funademy.io/course/CR001');
    const b = buildJourneyStatements('1234567890', 'https://funademy.io/course/CR001');
    const idsA = new Set(a.map((s) => s.statementId));
    for (const s of b) expect(idsA.has(s.statementId)).toBe(false);
  });
});

describe('POST /svc/admin/nelc', () => {
  beforeEach(async () => {
    await prisma.xapiStatement.deleteMany({});
  });

  it('rejects an invalid national ID', async () => {
    stubLrsEnv();
    const res = await nelcPOST(postReq({ nationalId: '12345', courseIri: 'https://funademy.io/course/CR001' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_national_id');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed course IRI', async () => {
    stubLrsEnv();
    const res = await nelcPOST(postReq({ nationalId: '1234567890', courseIri: 'not-a-url' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_course_iri');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 503 not_configured and sends/persists nothing without LRS secrets', async () => {
    expect(lrsConfigured()).toBe(false); // no NELC_* env in tests by default
    const res = await nelcPOST(postReq({ nationalId: '1234567890', courseIri: 'https://funademy.io/course/CR001' }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe('not_configured');
    expect(data.configured).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await prisma.xapiStatement.count()).toBe(0);
  });

  it('sends the journey in order, persists per-statement logs, and reports per-step results', async () => {
    stubLrsEnv();
    fetchMock.mockResolvedValue(new Response('["stored"]', { status: 200 }));

    const res = await nelcPOST(postReq({ nationalId: '1111111111', courseIri: 'https://funademy.io/course/CR001' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.environment).toBe('staging');
    expect(data.results.map((r: { verb: string }) => r.verb)).toEqual([
      'registered',
      'initialized',
      'watched',
      'completed_lesson',
      'attempted',
      'completed_unit',
      'progressed',
      'completed_course',
      'rated',
      'earned',
    ]);
    expect(data.results.every((r: { ok: boolean; httpStatus: number }) => r.ok && r.httpStatus === 200)).toBe(true);

    // Statements went to the LRS statements endpoint with Basic auth + xAPI version.
    expect(fetchMock).toHaveBeenCalledTimes(10);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://lrs.staging.example/data/xAPI/statements');
    expect(init.headers['X-Experience-API-Version']).toBe('1.0.3');
    expect(init.headers.Authorization).toMatch(/^Basic /);
    const sentBody = JSON.parse(init.body);
    expect(sentBody.actor.mbox).toBe('mailto:1111111111@gmail.com');
    expect(sentBody.actor.name).toBe('1111111111');

    // Audit rows persisted for every statement.
    const rows = await prisma.xapiStatement.findMany({ where: { runId: data.runId }, orderBy: { id: 'asc' } });
    expect(rows.map((r) => r.verb)).toEqual([
      'registered',
      'initialized',
      'watched',
      'completed_lesson',
      'attempted',
      'completed_unit',
      'progressed',
      'completed_course',
      'rated',
      'earned',
    ]);
    expect(rows.every((r) => r.ok && r.httpStatus === 200 && r.environment === 'staging')).toBe(true);
    expect(rows.every((r) => r.nationalId === '1111111111')).toBe(true);

    // Fresh statement ids on a second run.
    const res2 = await nelcPOST(postReq({ nationalId: '1111111111', courseIri: 'https://funademy.io/course/CR001' }));
    const data2 = await res2.json();
    const first = new Set(data.results.map((r: { statementId: string }) => r.statementId));
    for (const r of data2.results) expect(first.has(r.statementId)).toBe(false);
  });

  it('stops on the first LRS failure and records the rejected statement', async () => {
    stubLrsEnv();
    fetchMock
      .mockResolvedValueOnce(new Response('["stored"]', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"error":"invalid actor"}', { status: 400 }));

    const res = await nelcPOST(postReq({ nationalId: '2222222222', courseIri: 'https://funademy.io/course/CR001' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.results).toHaveLength(2); // registered ok, initialized failed, rest never sent
    expect(data.results[1]).toMatchObject({ verb: 'initialized', ok: false, httpStatus: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const rows = await prisma.xapiStatement.findMany({ where: { runId: data.runId }, orderBy: { id: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows[1].ok).toBe(false);
    expect(rows[1].response).toContain('invalid actor');
  });

  it('records a network error as a failed attempt (no HTTP status), never fake success', async () => {
    stubLrsEnv();
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await nelcPOST(postReq({ nationalId: '3333333333', courseIri: 'https://funademy.io/course/CR001' }));
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].httpStatus).toBeNull();
    expect(data.results[0].response).toContain('network_error');

    const rows = await prisma.xapiStatement.findMany({ where: { runId: data.runId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].ok).toBe(false);
    expect(rows[0].httpStatus).toBeNull();
  });
});

// NELC's WAF geo-blocks our server egress, so the admin UI uses a browser
// relay: the server PREPARES the journey (fresh UUIDs + LRS URL + Basic auth)
// and the owner's browser sends it, then RECORDS the outcomes for the audit log.
describe('POST /svc/admin/nelc — browser relay (prepare/record)', () => {
  beforeEach(async () => {
    await prisma.xapiStatement.deleteMany({});
    await prisma.xapiPreparedRun.deleteMany({});
  });

  it('prepare returns the LRS URL, Basic authorization, and the 10 prepared statements', async () => {
    stubLrsEnv();
    const res = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '4444444444', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe('https://lrs.staging.example/data/xAPI/statements');
    expect(data.authorization).toMatch(/^Basic /);
    expect(data.runId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(data.steps.map((s: { key: string }) => s.key)).toEqual([
      'registered',
      'initialized',
      'watched',
      'completed_lesson',
      'attempted',
      'completed_unit',
      'progressed',
      'completed_course',
      'rated',
      'earned',
    ]);
    expect(data.steps[0].statement.actor.mbox).toBe('mailto:4444444444@gmail.com');
    // prepare must not send or write audit rows by itself…
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await prisma.xapiStatement.count()).toBe(0);
    // …but it persists the prepared-run state that `record` will verify against
    const run = await prisma.xapiPreparedRun.findUnique({ where: { runId: data.runId } });
    expect(run?.consumed).toBe(false);
    expect(run?.nationalId).toBe('4444444444');

    // fresh statement ids on a second prepare (safe wizard retries)
    const res2 = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '4444444444', courseIri: 'https://funademy.io/course/CR001' }),
    );
    const data2 = await res2.json();
    const first = new Set(data.steps.map((s: { statementId: string }) => s.statementId));
    for (const s of data2.steps) expect(first.has(s.statementId)).toBe(false);
  });

  it('prepare requires re-entering the admin password (step-up) before exposing LRS credentials', async () => {
    stubLrsEnv();
    const bad = await nelcPOST(
      postReq({
        action: 'prepare',
        password: 'wrong-password',
        nationalId: '4444444444',
        courseIri: 'https://funademy.io/course/CR001',
      }),
    );
    expect(bad.status).toBe(401);
    expect((await bad.json()).error).toBe('reauth_failed');
    expect(await prisma.xapiPreparedRun.count()).toBe(0);
  });

  it('prepare refuses without LRS secrets (never hands out fake credentials)', async () => {
    const res = await nelcPOST(
      postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '4444444444', courseIri: 'https://funademy.io/course/CR001' }),
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('not_configured');
  });

  it('record persists browser-reported results (failures included) into the audit log', async () => {
    stubLrsEnv();
    const prep = await (
      await nelcPOST(
        postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '5555555555', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    const results = prep.steps
      .slice(0, 3)
      .map((s: { key: string; statementId: string }, i: number) => ({
        verb: s.key,
        statementId: s.statementId,
        ok: i < 2,
        httpStatus: i < 2 ? 200 : 403,
        response: i < 2 ? '["stored"]' : '<html>blocked</html>',
      }));
    const res = await nelcPOST(
      postReq({
        action: 'record',
        runId: prep.runId,
        nationalId: '5555555555',
        courseIri: 'https://funademy.io/course/CR001',
        results,
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false); // one step failed
    expect(data.recorded).toBe(3);

    const rows = await prisma.xapiStatement.findMany({ where: { runId: prep.runId }, orderBy: { id: 'asc' } });
    expect(rows.map((r) => r.verb)).toEqual(['registered', 'initialized', 'watched']);
    expect(rows[2].ok).toBe(false);
    expect(rows[2].httpStatus).toBe(403);
    expect(rows.every((r) => r.environment === 'staging' && r.nationalId === '5555555555')).toBe(true);
    // Browser-relay rows are explicitly labeled as browser-reported.
    expect(rows.every((r) => r.source === 'browser')).toBe(true);

    // The prepared run is consumed — recording the same run again is refused.
    const dup = await nelcPOST(postReq({ action: 'record', runId: prep.runId, results }));
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toBe('already_recorded');
    expect(await prisma.xapiStatement.count()).toBe(3);
  });

  it('record refuses well-formed results the server never prepared (no fabricated audit)', async () => {
    stubLrsEnv();
    const results = JOURNEY_STEPS.map((s) => ({
      verb: s.key,
      statementId: randomUUID(),
      ok: true,
      httpStatus: 200,
      response: '["stored"]',
    }));
    const res = await nelcPOST(postReq({ action: 'record', runId: randomUUID(), results }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('unknown_run');
    expect(await prisma.xapiStatement.count()).toBe(0);
  });

  it('record accepts only the exact prepared ids, in order, as a stop-on-failure prefix', async () => {
    stubLrsEnv();
    const prep = await (
      await nelcPOST(
        postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '7777777777', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    const mk = (i: number, ok = true) => ({
      verb: prep.steps[i].key,
      statementId: prep.steps[i].statementId,
      ok,
      httpStatus: ok ? 200 : 400,
      response: 'x',
    });
    // swapped statement id
    const swapped = { ...mk(0), statementId: prep.steps[1].statementId };
    expect((await nelcPOST(postReq({ action: 'record', runId: prep.runId, results: [swapped] }))).status).toBe(400);
    // not starting at the first step
    expect((await nelcPOST(postReq({ action: 'record', runId: prep.runId, results: [mk(1)] }))).status).toBe(400);
    // failure in the middle (the browser must stop on the first failure)
    expect(
      (await nelcPOST(postReq({ action: 'record', runId: prep.runId, results: [mk(0, false), mk(1)] }))).status,
    ).toBe(400);
    // none of the rejections consumed the run or wrote audit rows
    expect(await prisma.xapiStatement.count()).toBe(0);
    // the genuine stop-on-failure prefix is accepted
    const okRes = await nelcPOST(
      postReq({ action: 'record', runId: prep.runId, results: [mk(0), mk(1, false)] }),
    );
    expect(okRes.status).toBe(200);
    expect(await prisma.xapiStatement.count()).toBe(2);
  });

  it('record refuses an expired prepared run', async () => {
    stubLrsEnv();
    const prep = await (
      await nelcPOST(
        postReq({ action: 'prepare', password: 'test-admin-pass', nationalId: '8888888888', courseIri: 'https://funademy.io/course/CR001' }),
      )
    ).json();
    await prisma.xapiPreparedRun.update({
      where: { runId: prep.runId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await nelcPOST(
      postReq({
        action: 'record',
        runId: prep.runId,
        results: [{ verb: prep.steps[0].key, statementId: prep.steps[0].statementId, ok: true, httpStatus: 200, response: 'x' }],
      }),
    );
    expect(res.status).toBe(410);
    expect((await res.json()).error).toBe('run_expired');
    expect(await prisma.xapiStatement.count()).toBe(0);
  });

  it('record rejects tampered payloads (bad verb / uuid / status / empty)', async () => {
    stubLrsEnv();
    const runId = '3f2f0d68-6d4e-4a5e-9b1a-2c7f8e9a0b1c';
    const good = { verb: 'registered', statementId: runId, ok: true, httpStatus: 200, response: 'ok' };
    for (const bad of [
      { ...good, verb: 'hacked' },
      { ...good, statementId: 'not-a-uuid' },
      { ...good, httpStatus: 12345 },
    ]) {
      const res = await nelcPOST(
        postReq({
          action: 'record',
          runId,
          nationalId: '6666666666',
          courseIri: 'https://funademy.io/course/CR001',
          results: [bad],
        }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_results');
    }
    const resEmpty = await nelcPOST(
      postReq({
        action: 'record',
        runId,
        nationalId: '6666666666',
        courseIri: 'https://funademy.io/course/CR001',
        results: [],
      }),
    );
    expect(resEmpty.status).toBe(400);
    const resBadRun = await nelcPOST(
      postReq({
        action: 'record',
        runId: 'nope',
        nationalId: '6666666666',
        courseIri: 'https://funademy.io/course/CR001',
        results: [good],
      }),
    );
    expect(resBadRun.status).toBe(400);
    expect((await resBadRun.json()).error).toBe('invalid_run_id');
    expect(await prisma.xapiStatement.count()).toBe(0);
  });
});

describe('GET /svc/admin/nelc', () => {
  it('reports config status and returns the persisted log', async () => {
    const res = await nelcGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configured).toBe(false);
    expect(data.environment).toBe('staging');
    expect(data.defaultCourseIri).toBe('https://funademy.io/course/CR001');
    expect(Array.isArray(data.logs)).toBe(true);
  });
});
