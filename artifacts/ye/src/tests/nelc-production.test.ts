/**
 * NELC PRODUCTION pipeline — real learner statements, outbox, delivery.
 *
 * Covers:
 *   - statement builders: NELC package shapes with REAL values (full
 *     4-extension context on `registered` only, course description on
 *     `registered` only, sub-activities parented to the course, en-US
 *     texts, real score/duration — no pinned journey values)
 *   - enqueue on completion: registered-once → completed_lesson →
 *     [completed_unit] → progressed(real %) → [completed_course at 100%];
 *     draft lessons excluded from %; no rows without a national ID; no rows
 *     on repeat completions; no rows when the outbox is inactive
 *   - children routes: national ID validation, uniqueness, lock-after-send,
 *     and the registration+progress snapshot when an ID is added later
 *   - flushOutboxServer: ordered delivery, atomic claims, stop-on-failure,
 *     server attempts cap, inactive/not-configured guards
 *   - admin outbox_prepare / outbox_record: step-up password, dev-env block,
 *     ordered-prefix provenance, atomic one-time consumption
 *
 * Runs against the isolated ye_test database; all LRS HTTP calls are mocked
 * (NELC_LRS_PROD_* stubs point at a fake host) — no real network traffic.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';

// ── cookie store mock (same pattern as learning.test.ts) ───────────────────
const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => { cookieJar.set(name, value); },
    delete: (name: string) => { cookieJar.delete(name); },
  }),
}));

// admin session assumed valid — step-up password still enforced per action
vi.mock('@/app/(ar)/svc/admin/guard', () => ({
  requireAdmin: vi.fn(async () => null),
}));

import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { FAMILY_COOKIE, familyToken } from '@/lib/family-auth';
import { KID_COOKIE, kidToken, hashPin } from '@/lib/kid-auth';
import {
  buildCourseCompleted,
  buildLessonCompleted,
  buildProgressed,
  buildRegistered,
  buildUnitCompleted,
  courseForSubject,
  prodLrsConfigured,
  subjectCourseIri,
} from '@/lib/xapiProduction';
import { flushOutboxServer, outboxActive } from '@/lib/xapiOutbox';
import { JOURNEY_STEP_CONTRACTS, NELC_EXTENSION_IRIS } from '@/lib/xapiParity';
import { POST as completePOST } from '@/app/(ar)/svc/learn/lessons/[id]/complete/route';
import { POST as childrenPOST } from '@/app/(ar)/svc/learn/children/route';
import { PATCH as childPATCH } from '@/app/(ar)/svc/learn/children/[id]/route';
import { GET as nelcGET, POST as nelcPOST } from '@/app/(ar)/svc/admin/nelc/route';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
afterAll(() => {
  vi.unstubAllGlobals();
});

// ── env: outbox active for tests, prod LRS unconfigured by default ─────────
beforeEach(() => {
  vi.stubEnv('NELC_OUTBOX_TEST', '1');
  vi.stubEnv('REPLIT_DEPLOYMENT', '');
  vi.stubEnv('NELC_LRS_PROD_ENDPOINT', '');
  vi.stubEnv('NELC_LRS_PROD_KEY', '');
  vi.stubEnv('NELC_LRS_PROD_SECRET', '');
  vi.stubEnv('ADMIN_PASSWORD', 'test-admin-pass');
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const stubProdEnv = () => {
  vi.stubEnv('NELC_LRS_PROD_ENDPOINT', 'https://lrs.prod.example/xAPI');
  vi.stubEnv('NELC_LRS_PROD_KEY', 'prod-key');
  vi.stubEnv('NELC_LRS_PROD_SECRET', 'prod-secret');
};

// ── unique-per-run identifiers (ye_test DB persists across runs) ───────────
const RUN = `nprod-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const ts9 = String(Date.now()).slice(-9);
const NID_A = `1${ts9.slice(0, 8)}1`; // childA — completes lessons
const NID_C = `1${ts9.slice(0, 8)}3`; // childC — ID added after completing
const NID_NEW = `2${ts9.slice(0, 8)}5`; // created via children POST

// ── fixture ids ─────────────────────────────────────────────────────────────
let familyId: number;
let childAId: number; // has NID_A from the start
let childBId: number; // never gets an ID
let childCId: number; // completes first, gets ID later (snapshot path)
let subjectId: number;
let unitId: number;
let lessonAId: number;
let lessonBId: number;
let courseIri: string;

function jsonReq(url: string, method = 'GET', body?: unknown): NextRequest {
  return new NextRequest(`http://test.local${url}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
const asFamily = (id: number) => cookieJar.set(FAMILY_COOKIE, familyToken(id));
const asKid = (fId: number, cId: number) => {
  cookieJar.set(FAMILY_COOKIE, familyToken(fId)); // kid session rides on the family session
  cookieJar.set(KID_COOKIE, kidToken(fId, cId));
};
const completeReq = (id: number, timeSpentSeconds = 120) =>
  jsonReq(`/svc/learn/lessons/${id}/complete`, 'POST', { answers: [], timeSpentSeconds });

const rowsForChild = (childId: number) =>
  prisma.xapiOutbox.findMany({ where: { childId }, orderBy: { id: 'asc' } });

const contract = (key: string) => JOURNEY_STEP_CONTRACTS.find((c) => c.key === key)!;

beforeAll(async () => {
  const fam = await prisma.family.create({
    data: {
      phone: `+9665${RUN.slice(-8)}`,
      parentName: 'Prod Parent',
      students: { create: { firstName: 'Nora', birthYear: 2018 } },
    },
    include: { students: true },
  });
  familyId = fam.id;

  const program = await prisma.program.create({
    data: {
      slug: `nprod-prog-${RUN}`,
      kitCode: 'KIT-01', nameEn: 'NP', nameAr: 'ن', ageMin: 4, ageMax: 14,
      format: 'online', color: '#1C54CB', level: 1,
      taglineEn: 't', taglineAr: 'ت', descEn: 'd', descAr: 'د',
      buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
    },
  });
  const run = await prisma.courseRun.create({
    data: {
      programId: program.id,
      startDate: new Date('2026-08-01'), endDate: new Date('2026-12-31'),
      weekday: 0, time: '17:00', format: 'online',
    },
  });
  await prisma.enrollment.create({
    data: { studentId: fam.students[0].id, courseRunId: run.id, status: 'active' },
  });

  const pin = await hashPin('1234');
  childAId = (await prisma.lrnChild.create({
    data: { familyId, name: 'A', avatar: '⭐', band: 'explorers', pin, nationalId: NID_A },
  })).id;
  childBId = (await prisma.lrnChild.create({
    data: { familyId, name: 'B', avatar: '⭐', band: 'explorers', pin },
  })).id;
  childCId = (await prisma.lrnChild.create({
    data: { familyId, name: 'C', avatar: '⭐', band: 'explorers', pin },
  })).id;

  const subject = await prisma.lrnSubject.create({
    data: { nameAr: 'روبوتيكس', nameEn: 'Robotics', slug: `robotics-${RUN}`, icon: '🤖', color: '#1C54CB' },
  });
  subjectId = subject.id;
  courseIri = subjectCourseIri(subject.slug);

  // 2 published lessons + 1 DRAFT (draft must not count toward progress %)
  const unit = await prisma.lrnUnit.create({
    data: {
      subjectId, band: 'explorers', titleAr: 'الوحدة ١', titleEn: 'Robots 101',
      position: 0, status: 'published',
      lessons: {
        createMany: {
          data: [
            { titleAr: 'درس أ', titleEn: 'Motors', position: 0, status: 'published', durationMinutes: 7 },
            { titleAr: 'درس ب', titleEn: 'Sensors', position: 1, status: 'published', durationMinutes: 5 },
            { titleAr: 'مسودة', titleEn: 'Draft L', position: 2, status: 'draft', durationMinutes: 5 },
          ],
        },
      },
    },
    include: { lessons: { orderBy: { position: 'asc' } } },
  });
  unitId = unit.id;
  lessonAId = unit.lessons[0].id;
  lessonBId = unit.lessons[1].id;

  // Same subject, OTHER band — must never count toward an explorers child's
  // progress (progress % and course completion are band-scoped).
  await prisma.lrnUnit.create({
    data: {
      subjectId, band: 'builders', titleAr: 'وحدة البنّائين', titleEn: 'Builders Unit',
      position: 0, status: 'published',
      lessons: {
        createMany: {
          data: [
            { titleAr: 'درس بنّائين', titleEn: 'Builders L', position: 0, status: 'published', durationMinutes: 5 },
          ],
        },
      },
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('production statement builders', () => {
  const course = { iri: 'https://funademy.io/course/subject-robotics', nameEn: 'Funademy — Robotics', descEn: 'Robotics desc.' };
  const at = new Date('2026-08-11T10:00:00.000Z');

  it('registered: full 4-extension context + course description, real actor', () => {
    const b = buildRegistered('1234512345', course, at);
    const s = b.statement as Record<string, any>;
    expect(s.id).toBe(b.statementId);
    expect(s.timestamp).toBe(at.toISOString());
    expect(s.actor).toEqual({ mbox: 'mailto:1234512345@gmail.com', name: '1234512345', objectType: 'Agent' });
    expect(s.verb.id).toBe(contract('registered').iri);
    expect(s.object.id).toBe(course.iri);
    expect(s.object.definition.description['en-US']).toBe(course.descEn);
    expect(Object.keys(s.context.extensions).sort()).toEqual([...NELC_EXTENSION_IRIS].sort());
    // program_url extension points at THIS course
    const programUrl = NELC_EXTENSION_IRIS.find((i) => i.includes('program_url'))!;
    expect(s.context.extensions[programUrl]).toBe(course.iri);
    expect(s.result).toBeUndefined();
  });

  it('completed lesson: real score + duration, course parent, single extension', () => {
    const b = buildLessonCompleted(
      '1234512345', course,
      { id: 7, titleEn: 'Motors', descEn: null, durationMinutes: 7 },
      80, 95, at,
    );
    const s = b.statement as Record<string, any>;
    expect(s.verb.id).toBe(contract('completed_lesson').iri);
    expect(s.object.id).toBe(`${course.iri}/lessons/7`);
    expect(s.object.definition.description).toBeUndefined(); // no descEn given
    expect(s.result.score).toEqual({ scaled: 0.8, raw: 80, min: 0, max: 100 });
    expect(s.result.duration).toBe('PT95S');
    expect(Object.keys(s.context.extensions)).toHaveLength(1); // platform only
    const parent = s.context.contextActivities.parent;
    expect(parent).toHaveLength(1);
    expect(parent[0].id).toBe(course.iri);
    expect(parent[0].definition.description['en-US']).toBe(course.descEn);
  });

  it('completed lesson: nominal-minutes duration fallback when no time tracked', () => {
    const b = buildLessonCompleted(
      '1234512345', course,
      { id: 7, titleEn: 'Motors', descEn: null, durationMinutes: 7 },
      100, 0, at,
    );
    expect((b.statement as Record<string, any>).result.duration).toBe('PT7M');
  });

  it('unit completed: unit object parented to the course', () => {
    const b = buildUnitCompleted('1234512345', course, { id: 3, titleEn: 'Robots 101' }, at);
    const s = b.statement as Record<string, any>;
    expect(s.verb.id).toBe(contract('completed_unit').iri);
    expect(s.object.id).toBe(`${course.iri}/units/3`);
    expect(s.result).toEqual({ completion: true, success: true });
    expect(s.context.contextActivities.parent[0].id).toBe(course.iri);
  });

  it('progressed + course completed: course object WITHOUT description', () => {
    const p = buildProgressed('1234512345', course, 50, at).statement as Record<string, any>;
    expect(p.verb.id).toBe(contract('progressed').iri);
    expect(p.object.id).toBe(course.iri);
    expect(p.object.definition.description).toBeUndefined();
    expect(p.result.score.raw).toBe(50);
    const c = buildCourseCompleted('1234512345', course, at).statement as Record<string, any>;
    expect(c.verb.id).toBe(contract('completed_course').iri);
    expect(c.result).toEqual({ completion: true, success: true });
    expect(c.context.contextActivities).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('enqueue on real completions', () => {
  it('outboxActive honors the test escape hatch', () => {
    expect(outboxActive()).toBe(true);
    vi.stubEnv('NELC_OUTBOX_TEST', '');
    expect(outboxActive()).toBe(false);
  });

  it('child WITHOUT national ID: completion queues nothing', async () => {
    asKid(familyId, childBId);
    const res = await completePOST(completeReq(lessonAId), params(lessonAId));
    expect(res.status).toBe(200);
    expect(await rowsForChild(childBId)).toHaveLength(0);
  });

  it('first lesson: registered + completed_lesson + progressed(50)', async () => {
    asKid(familyId, childAId);
    const res = await completePOST(completeReq(lessonAId, 95), params(lessonAId));
    expect(res.status).toBe(200);

    const rows = await rowsForChild(childAId);
    expect(rows.map((r) => r.verb)).toEqual(['registered', 'completed_lesson', 'progressed']);
    expect(rows.every((r) => r.status === 'pending' && r.nationalId === NID_A && r.courseIri === courseIri)).toBe(true);

    const reg = rows[0].statement as Record<string, any>;
    expect(reg.actor.mbox).toBe(`mailto:${NID_A}@gmail.com`);
    expect(reg.object.id).toBe(courseIri);
    expect(reg.object.definition.name['en-US']).toBe('Funademy — Robotics');
    expect(Object.keys(reg.context.extensions)).toHaveLength(4);

    const lsn = rows[1].statement as Record<string, any>;
    expect(lsn.object.definition.name['en-US']).toBe('Motors');
    expect(lsn.result.score.raw).toBe(100); // no exercises → server grades 100
    expect(lsn.result.duration).toBe('PT95S');
    expect(lsn.context.contextActivities.parent[0].id).toBe(courseIri);

    // 1 of 2 PUBLISHED lessons (draft excluded) = 50%
    const prg = rows[2].statement as Record<string, any>;
    expect(prg.result.score.raw).toBe(50);
  });

  it('repeat completion queues nothing new', async () => {
    asKid(familyId, childAId);
    const res = await completePOST(completeReq(lessonAId), params(lessonAId));
    expect(res.status).toBe(200);
    expect(await rowsForChild(childAId)).toHaveLength(3);
  });

  it('second lesson: unit + 100% + course completed, registered NOT repeated', async () => {
    asKid(familyId, childAId);
    const res = await completePOST(completeReq(lessonBId, 60), params(lessonBId));
    expect(res.status).toBe(200);

    const rows = await rowsForChild(childAId);
    expect(rows.map((r) => r.verb)).toEqual([
      'registered', 'completed_lesson', 'progressed',
      'completed_lesson', 'completed_unit', 'progressed', 'completed_course',
    ]);
    const unitRow = rows[4].statement as Record<string, any>;
    expect(unitRow.object.id).toBe(`${courseIri}/units/${unitId}`);
    expect((rows[5].statement as Record<string, any>).result.score.raw).toBe(100);
    // statement IDs are unique UUIDs
    expect(new Set(rows.map((r) => r.statementId)).size).toBe(rows.length);
  });

  it('inactive outbox: completion queues nothing (dev-preview safety)', async () => {
    vi.stubEnv('NELC_OUTBOX_TEST', '');
    asKid(familyId, childCId);
    const res = await completePOST(completeReq(lessonAId), params(lessonAId));
    expect(res.status).toBe(200);
    expect(await rowsForChild(childCId)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('children routes — national ID', () => {
  beforeEach(() => asFamily(familyId));

  it('rejects malformed IDs on create', async () => {
    for (const bad of ['12345', '3234567890', '12345678901', 'abcdefghij']) {
      const res = await childrenPOST(
        jsonReq('/svc/learn/children', 'POST', { name: 'X', pin: '1234', nationalId: bad }),
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_national_id');
    }
  });

  it('creates with a valid ID and echoes it (empty string = none)', async () => {
    const res = await childrenPOST(
      jsonReq('/svc/learn/children', 'POST', { name: 'New', pin: '1234', nationalId: NID_NEW }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).nationalId).toBe(NID_NEW);

    const res2 = await childrenPOST(
      jsonReq('/svc/learn/children', 'POST', { name: 'NoId', pin: '1234', nationalId: '  ' }),
    );
    expect(res2.status).toBe(201);
    expect((await res2.json()).nationalId).toBeNull();
  });

  it('rejects a duplicate ID with 409', async () => {
    const res = await childrenPOST(
      jsonReq('/svc/learn/children', 'POST', { name: 'Dup', pin: '1234', nationalId: NID_A }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('national_id_taken');
  });

  it('adding an ID to a child with history queues registered + progressed snapshot', async () => {
    const res = await childPATCH(
      jsonReq(`/svc/learn/children/${childCId}`, 'PATCH', { nationalId: NID_C }),
      params(childCId),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).nationalId).toBe(NID_C);

    const rows = await rowsForChild(childCId);
    expect(rows.map((r) => r.verb)).toEqual(['registered', 'progressed']);
    expect((rows[1].statement as Record<string, any>).result.score.raw).toBe(50);
    expect(rows.every((r) => r.nationalId === NID_C)).toBe(true);
  });

  it('later completions stream normally after the snapshot, with clamped duration', async () => {
    asKid(familyId, childCId);
    // absurd client-reported time must be clamped (4h cap) before it ever
    // reaches a NELC statement
    const res = await completePOST(completeReq(lessonBId, 10_000_000), params(lessonBId));
    expect(res.status).toBe(200);

    const rows = await rowsForChild(childCId);
    expect(rows.map((r) => r.verb)).toEqual([
      'registered', 'progressed', // snapshot when the ID was added
      'completed_lesson', 'completed_unit', 'progressed', 'completed_course',
    ]);
    const lsn = rows[2].statement as Record<string, any>;
    expect(lsn.result.duration).toBe('PT14400S');
    expect((rows[4].statement as Record<string, any>).result.score.raw).toBe(100);
  });

  it('locks the ID once statements exist (change AND clear)', async () => {
    for (const nationalId of [`1${ts9.slice(0, 8)}9`, null]) {
      const res = await childPATCH(
        jsonReq(`/svc/learn/children/${childAId}`, 'PATCH', { nationalId }),
        params(childAId),
      );
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('national_id_locked');
    }
    // unchanged value is a no-op, not a lock violation
    const same = await childPATCH(
      jsonReq(`/svc/learn/children/${childAId}`, 'PATCH', { nationalId: NID_A }),
      params(childAId),
    );
    expect(same.status).toBe(200);
    expect(await rowsForChild(childAId)).toHaveLength(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('flushOutboxServer', () => {
  const mkRow = (verb: string, extra: Record<string, unknown> = {}) =>
    prisma.xapiOutbox.create({
      data: {
        childId: null,
        nationalId: '1999999999',
        courseIri: 'https://funademy.io/course/subject-flush',
        verb,
        statementId: randomUUID(),
        statement: { test: verb },
        ...extra,
      },
    });

  beforeEach(async () => {
    await prisma.xapiOutbox.deleteMany({});
  });

  it('skips when inactive or unconfigured — nothing sent', async () => {
    vi.stubEnv('NELC_OUTBOX_TEST', '');
    expect((await flushOutboxServer()).skipped).toBe('inactive');
    vi.stubEnv('NELC_OUTBOX_TEST', '1');
    expect(prodLrsConfigured()).toBe(false);
    expect((await flushOutboxServer()).skipped).toBe('not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends pending rows in order with prod auth and marks them sent', async () => {
    stubProdEnv();
    await mkRow('registered');
    await mkRow('progressed');
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' });

    const result = await flushOutboxServer();
    expect(result).toMatchObject({ attempted: 2, sent: 2, stopped: false });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://lrs.prod.example/xAPI/statements');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Experience-API-Version']).toBe('1.0.3');
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('prod-key:prod-secret').toString('base64')}`,
    );

    const rows = await prisma.xapiOutbox.findMany({ orderBy: { id: 'asc' } });
    expect(rows.every((r) => r.status === 'sent' && r.source === 'server' && r.attempts === 1 && r.sentAt)).toBe(true);
  });

  it('stops on first failure, records the error, leaves the row pending', async () => {
    stubProdEnv();
    await mkRow('registered');
    await mkRow('progressed');
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => '<html>geo blocked</html>' });

    const result = await flushOutboxServer();
    expect(result).toMatchObject({ attempted: 1, sent: 0, stopped: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const rows = await prisma.xapiOutbox.findMany({ orderBy: { id: 'asc' } });
    expect(rows[0]).toMatchObject({ status: 'pending', attempts: 1, lastHttpStatus: 403 });
    expect(rows[0].lastError).toContain('geo blocked');
    expect(rows[1]).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('leaves rows past the server attempts cap for the browser flush', async () => {
    stubProdEnv();
    await mkRow('registered', { attempts: 5 });
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    const result = await flushOutboxServer();
    expect(result).toMatchObject({ attempted: 0, sent: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pauses while an active browser flush run leases the queue head', async () => {
    stubProdEnv();
    const first = await mkRow('registered');
    await mkRow('progressed');
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' });

    const run = await prisma.xapiOutboxFlushRun.create({
      data: {
        runId: crypto.randomUUID(),
        statementIds: [first.statementId],
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    // ordered delivery: the server must not skip past the leased head row
    const paused = await flushOutboxServer();
    expect(paused).toMatchObject({ attempted: 0, sent: 0 });
    expect(fetchMock).not.toHaveBeenCalled();

    // once the run is consumed (browser recorded), the server resumes
    await prisma.xapiOutboxFlushRun.update({ where: { id: run.id }, data: { consumed: true } });
    const resumed = await flushOutboxServer();
    expect(resumed).toMatchObject({ attempted: 2, sent: 2 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('admin outbox endpoints', () => {
  let rowIds: string[] = [];

  const seedRows = async () => {
    await prisma.xapiOutbox.deleteMany({});
    await prisma.xapiOutboxFlushRun.deleteMany({});
    rowIds = [];
    for (const verb of ['registered', 'completed_lesson'] as const) {
      const statementId = randomUUID();
      rowIds.push(statementId);
      await prisma.xapiOutbox.create({
        data: {
          childId: null,
          nationalId: '2888888888',
          courseIri: 'https://funademy.io/course/subject-admin',
          verb,
          statementId,
          statement: { test: verb },
        },
      });
    }
  };

  const prepare = () =>
    nelcPOST(jsonReq('/svc/admin/nelc', 'POST', { action: 'outbox_prepare', password: 'test-admin-pass' }));

  it('GET reports the production outbox status', async () => {
    await seedRows();
    const data = await (await nelcGET()).json();
    expect(data.production).toMatchObject({
      configured: false,
      pending: 2,
      sent: 0,
      stalled: 0,
    });
    expect(data.production.childrenWithId).toBeGreaterThanOrEqual(2);
  });

  it('outbox_prepare: step-up password, dev block, config required', async () => {
    await seedRows();
    stubProdEnv();
    const bad = await nelcPOST(jsonReq('/svc/admin/nelc', 'POST', { action: 'outbox_prepare', password: 'wrong' }));
    expect(bad.status).toBe(401);

    vi.stubEnv('NELC_OUTBOX_TEST', '');
    const dev = await prepare();
    expect(dev.status).toBe(403);
    expect((await dev.json()).error).toBe('dev_environment_blocked');
    vi.stubEnv('NELC_OUTBOX_TEST', '1');

    vi.stubEnv('NELC_LRS_PROD_ENDPOINT', '');
    const uncfg = await prepare();
    expect(uncfg.status).toBe(503);
    expect((await uncfg.json()).error).toBe('prod_not_configured');
  });

  it('prepare → browser results → record marks rows sent, run consumed once', async () => {
    await seedRows();
    stubProdEnv();
    const prep = await prepare();
    expect(prep.status).toBe(200);
    const pj = await prep.json();
    expect(pj.url).toBe('https://lrs.prod.example/xAPI/statements');
    expect(String(pj.authorization)).toMatch(/^Basic /);
    expect((pj.statements as any[]).map((s) => s.statementId)).toEqual(rowIds);

    // reversed order (non-prefix) refused
    const reversed = await nelcPOST(jsonReq('/svc/admin/nelc', 'POST', {
      action: 'outbox_record', runId: pj.runId,
      results: [...rowIds].reverse().map((statementId) => ({ statementId, ok: true, httpStatus: 200, response: '' })),
    }));
    expect(reversed.status).toBe(400);
    expect((await reversed.json()).error).toBe('results_mismatch');

    // failure NOT at the tail refused (stop-on-failure shape)
    const midFail = await nelcPOST(jsonReq('/svc/admin/nelc', 'POST', {
      action: 'outbox_record', runId: pj.runId,
      results: [
        { statementId: rowIds[0], ok: false, httpStatus: 500, response: 'x' },
        { statementId: rowIds[1], ok: true, httpStatus: 200, response: '' },
      ],
    }));
    expect(midFail.status).toBe(400);

    const good = await nelcPOST(jsonReq('/svc/admin/nelc', 'POST', {
      action: 'outbox_record', runId: pj.runId,
      results: rowIds.map((statementId) => ({ statementId, ok: true, httpStatus: 200, response: '' })),
    }));
    expect(good.status).toBe(200);
    expect(await good.json()).toMatchObject({ ok: true, sent: 2 });

    const rows = await prisma.xapiOutbox.findMany({ orderBy: { id: 'asc' } });
    expect(rows.every((r) => r.status === 'sent' && r.source === 'browser')).toBe(true);

    // one-time consumption
    const again = await nelcPOST(jsonReq('/svc/admin/nelc', 'POST', {
      action: 'outbox_record', runId: pj.runId,
      results: [{ statementId: rowIds[0], ok: true, httpStatus: 200, response: '' }],
    }));
    expect(again.status).toBe(409);

    // nothing pending → prepare returns an empty run
    const empty = await prepare();
    expect((await empty.json()).runId).toBeNull();
  });

  it('record with a failed tail keeps that row pending with the error', async () => {
    await seedRows();
    stubProdEnv();
    const pj = await (await prepare()).json();
    const res = await nelcPOST(jsonReq('/svc/admin/nelc', 'POST', {
      action: 'outbox_record', runId: pj.runId,
      results: [
        { statementId: rowIds[0], ok: true, httpStatus: 200, response: '' },
        { statementId: rowIds[1], ok: false, httpStatus: 403, response: 'blocked by WAF' },
      ],
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: false, sent: 1 });

    const rows = await prisma.xapiOutbox.findMany({ orderBy: { id: 'asc' } });
    expect(rows[0].status).toBe('sent');
    expect(rows[1]).toMatchObject({ status: 'pending', lastHttpStatus: 403 });
    expect(rows[1].lastError).toContain('blocked by WAF');

    // unknown / malformed runs
    const unknown = await nelcPOST(jsonReq('/svc/admin/nelc', 'POST', {
      action: 'outbox_record', runId: randomUUID(),
      results: [{ statementId: rowIds[0], ok: true, httpStatus: 200, response: '' }],
    }));
    expect(unknown.status).toBe(404);
    const malformed = await nelcPOST(jsonReq('/svc/admin/nelc', 'POST', {
      action: 'outbox_record', runId: 'not-a-uuid',
      results: [{ statementId: rowIds[0], ok: true, httpStatus: 200, response: '' }],
    }));
    expect(malformed.status).toBe(400);
  });
});
