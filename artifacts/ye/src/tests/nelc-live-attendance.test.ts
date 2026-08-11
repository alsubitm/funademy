/**
 * NELC live-class attendance pipeline — real attendance marks become official
 * learning-record statements in the same production outbox.
 *
 * Covers:
 *   - courseForRun / buildAttended: stable run IRI (fixed origin, never the
 *     request host), attended verb (ADL), session sub-activity parented to
 *     the course run, en-US texts, no fabricated result values
 *   - admin attendance POST: present/late marks queue registered (once per
 *     learner+run) + attended (once per session); absent/excused queue
 *     nothing; re-marks and status flip-flops never duplicate; students
 *     without a national ID queue nothing; inactive outbox queues nothing
 *   - account children routes: national ID validation/uniqueness on create,
 *     backfill snapshot when an ID is added to a student with attendance
 *     history, and ID lock once statements exist
 *
 * Runs against the isolated ye_test database; LRS HTTP is mocked.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';

// ── cookie store mock (same pattern as nelc-production.test.ts) ────────────
const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => { cookieJar.set(name, value); },
    delete: (name: string) => { cookieJar.delete(name); },
  }),
}));

// admin session assumed valid for the attendance route
vi.mock('@/app/(ar)/svc/admin/guard', () => ({
  requireAdmin: vi.fn(async () => null),
}));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { FAMILY_COOKIE, familyToken } from '@/lib/family-auth';
import {
  ATTENDED_VERB_IRI,
  buildAttended,
  courseForRun,
  runCourseIri,
  sessionActivityIri,
} from '@/lib/xapiProduction';
import { NELC_EXTENSION_IRIS } from '@/lib/xapiParity';
import { POST as attendancePOST } from '@/app/(ar)/svc/admin/attendance/route';
import { POST as childrenPOST } from '@/app/(ar)/svc/account/children/route';
import { PATCH as childPATCH } from '@/app/(ar)/svc/account/children/[id]/route';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubEnv('NELC_OUTBOX_TEST', '1');
  vi.stubEnv('REPLIT_DEPLOYMENT', '');
  vi.stubEnv('NELC_LRS_PROD_ENDPOINT', '');
  vi.stubEnv('NELC_LRS_PROD_KEY', '');
  vi.stubEnv('NELC_LRS_PROD_SECRET', '');
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

// ── unique-per-run identifiers (ye_test DB persists across runs) ───────────
const RUN = `natt-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const ts9 = String(Date.now()).slice(-9);
const NID_A = `1${ts9.slice(0, 8)}2`; // studentA — has ID from the start
const NID_C = `2${ts9.slice(0, 8)}4`; // studentC — ID added after attending
const NID_NEW = `2${ts9.slice(0, 8)}6`; // created via children POST

let familyId: number;
let studentAId: number; // nationalId from the start
let studentBId: number; // never gets an ID
let studentCId: number; // attends first, ID added later (backfill path)
let runId: number;
let session1Id: number;
let session2Id: number;
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
const mark = (sessionId: number, studentId: number, status: string) =>
  attendancePOST(jsonReq('/svc/admin/attendance', 'POST', { sessionId, studentId, status }));
const rowsForStudent = (studentId: number) =>
  prisma.xapiOutbox.findMany({ where: { studentId }, orderBy: { id: 'asc' } });

beforeAll(async () => {
  const fam = await prisma.family.create({
    data: { phone: `+9665${RUN.slice(-8)}`, parentName: 'Att Parent' },
  });
  familyId = fam.id;

  const program = await prisma.program.create({
    data: {
      slug: `natt-prog-${RUN}`,
      kitCode: 'KIT-02', nameEn: 'Robo Live', nameAr: 'روبو', ageMin: 4, ageMax: 14,
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
      sessions: {
        createMany: {
          data: [
            { date: new Date('2026-08-02T17:00:00.000Z'), status: 'completed' },
            { date: new Date('2026-08-09T17:00:00.000Z'), status: 'completed' },
          ],
        },
      },
    },
    include: { sessions: { orderBy: { date: 'asc' } } },
  });
  runId = run.id;
  session1Id = run.sessions[0].id;
  session2Id = run.sessions[1].id;
  courseIri = runCourseIri(run.id);

  studentAId = (await prisma.student.create({
    data: { familyId, firstName: 'AttA', birthYear: 2017, nationalId: NID_A },
  })).id;
  studentBId = (await prisma.student.create({
    data: { familyId, firstName: 'AttB', birthYear: 2016 },
  })).id;
  studentCId = (await prisma.student.create({
    data: { familyId, firstName: 'AttC', birthYear: 2015 },
  })).id;

  for (const studentId of [studentAId, studentBId, studentCId]) {
    await prisma.enrollment.create({
      data: { studentId, courseRunId: run.id, status: 'active' },
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
describe('live-course identity & attended builder', () => {
  it('run IRI uses the fixed production origin, never a request host', () => {
    expect(runCourseIri(42)).toBe('https://funademy.io/course/run-42');
  });

  it('courseForRun prefers the run title, falls back to the program name', () => {
    const base = { id: 7, program: { nameEn: 'Robo Live' } };
    expect(courseForRun({ ...base, titleEn: 'Robotics Autumn' }).nameEn).toBe('Funademy — Robotics Autumn');
    expect(courseForRun({ ...base, titleEn: '  ' }).nameEn).toBe('Funademy — Robo Live');
    expect(courseForRun({ ...base, titleEn: null }).iri).toBe('https://funademy.io/course/run-7');
  });

  it('attended: ADL verb, session parented to the course run, platform-only extension', () => {
    const course = { iri: 'https://funademy.io/course/run-7', nameEn: 'Funademy — Robo Live', descEn: 'Robo desc.' };
    const at = new Date('2026-08-11T10:00:00.000Z');
    const b = buildAttended('1234512345', course, { id: 9, date: new Date('2026-08-09T17:00:00.000Z') }, at);
    const s = b.statement as Record<string, any>;
    expect(b.verb).toBe('attended');
    expect(s.id).toBe(b.statementId);
    expect(s.timestamp).toBe(at.toISOString());
    expect(s.actor).toEqual({ mbox: 'mailto:1234512345@gmail.com', name: '1234512345', objectType: 'Agent' });
    expect(s.verb).toEqual({ id: ATTENDED_VERB_IRI, display: { 'en-US': 'attended' } });
    expect(s.object.id).toBe(sessionActivityIri(course.iri, 9));
    expect(s.object.definition.name['en-US']).toBe('Live class session — 2026-08-09');
    // sub-activity rules: platform extension only + course as the parent
    expect(Object.keys(s.context.extensions)).toHaveLength(1);
    expect(s.context.contextActivities.parent).toHaveLength(1);
    expect(s.context.contextActivities.parent[0].id).toBe(course.iri);
    expect(s.result).toEqual({ completion: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('attendance marks enqueue statements', () => {
  it('student WITHOUT national ID: present mark queues nothing', async () => {
    const res = await mark(session1Id, studentBId, 'present');
    expect(res.status).toBe(200);
    expect(await rowsForStudent(studentBId)).toHaveLength(0);
  });

  it('first present mark: registered + attended, full NELC shapes', async () => {
    const res = await mark(session1Id, studentAId, 'present');
    expect(res.status).toBe(200);

    const rows = await rowsForStudent(studentAId);
    expect(rows.map((r) => r.verb)).toEqual(['registered', 'attended']);
    expect(rows.every((r) => r.status === 'pending' && r.nationalId === NID_A && r.courseIri === courseIri)).toBe(true);

    const reg = rows[0].statement as Record<string, any>;
    expect(reg.object.id).toBe(courseIri);
    expect(reg.object.definition.name['en-US']).toBe('Funademy — Robo Live');
    expect(Object.keys(reg.context.extensions).sort()).toEqual([...NELC_EXTENSION_IRIS].sort());

    const att = rows[1].statement as Record<string, any>;
    expect(att.object.id).toBe(sessionActivityIri(courseIri, session1Id));
    expect(att.context.contextActivities.parent[0].id).toBe(courseIri);
  });

  it('re-mark and status flip-flop never duplicate; absent queues nothing', async () => {
    expect((await mark(session1Id, studentAId, 'present')).status).toBe(200); // re-mark
    expect((await mark(session1Id, studentAId, 'absent')).status).toBe(200); // flip off
    expect((await mark(session1Id, studentAId, 'present')).status).toBe(200); // flip back
    expect(await rowsForStudent(studentAId)).toHaveLength(2);
  });

  it('second session: attended only (registered not repeated); late counts as attended', async () => {
    const res = await mark(session2Id, studentAId, 'late');
    expect(res.status).toBe(200);
    const rows = await rowsForStudent(studentAId);
    expect(rows.map((r) => r.verb)).toEqual(['registered', 'attended', 'attended']);
    expect((rows[2].statement as Record<string, any>).object.id).toBe(sessionActivityIri(courseIri, session2Id));
    expect(new Set(rows.map((r) => r.statementId)).size).toBe(3);
  });

  it('excused queues nothing; inactive outbox queues nothing (dev-preview safety)', async () => {
    expect((await mark(session2Id, studentCId, 'excused')).status).toBe(200);
    expect(await rowsForStudent(studentCId)).toHaveLength(0);

    vi.stubEnv('NELC_OUTBOX_TEST', '');
    // studentC has no ID yet anyway — give the mark that WOULD queue for A on
    // a fresh session and verify inactivity blocks even ID'd students.
    const s3 = await prisma.classSession.create({
      data: { courseRunId: runId, date: new Date('2026-08-16T17:00:00.000Z'), status: 'completed' },
    });
    expect((await mark(s3.id, studentAId, 'present')).status).toBe(200);
    expect(await rowsForStudent(studentAId)).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('account children routes — national ID', () => {
  beforeEach(() => asFamily(familyId));

  it('rejects malformed IDs on create; accepts valid; blank = none', async () => {
    const bad = await childrenPOST(
      jsonReq('/svc/account/children', 'POST', { firstName: 'X', birthYear: 2016, nationalId: '12345' }),
    );
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe('invalid_national_id');

    const ok = await childrenPOST(
      jsonReq('/svc/account/children', 'POST', { firstName: 'New', birthYear: 2016, nationalId: NID_NEW }),
    );
    expect(ok.status).toBe(201);
    expect((await ok.json()).nationalId).toBe(NID_NEW);

    const none = await childrenPOST(
      jsonReq('/svc/account/children', 'POST', { firstName: 'NoId', birthYear: 2016, nationalId: '  ' }),
    );
    expect(none.status).toBe(201);
    expect((await none.json()).nationalId).toBeNull();
  });

  it('rejects a duplicate ID with 409', async () => {
    const res = await childrenPOST(
      jsonReq('/svc/account/children', 'POST', { firstName: 'Dup', birthYear: 2016, nationalId: NID_A }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('national_id_taken');
  });

  it('adding an ID to a student with attendance history backfills registered + attended', async () => {
    // studentC attended session1 (present) before having an ID
    expect((await mark(session1Id, studentCId, 'present')).status).toBe(200);
    expect(await rowsForStudent(studentCId)).toHaveLength(0);

    const res = await childPATCH(
      jsonReq(`/svc/account/children/${studentCId}`, 'PATCH', { nationalId: NID_C }),
      params(studentCId),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).nationalId).toBe(NID_C);

    const rows = await rowsForStudent(studentCId);
    expect(rows.map((r) => r.verb)).toEqual(['registered', 'attended']);
    expect(rows.every((r) => r.nationalId === NID_C && r.courseIri === courseIri)).toBe(true);
    expect((rows[1].statement as Record<string, any>).object.id).toBe(
      sessionActivityIri(courseIri, session1Id),
    );
    // excused session2 mark from earlier must NOT be backfilled
  });

  it('later marks stream normally after the backfill, without duplicates', async () => {
    expect((await mark(session2Id, studentCId, 'present')).status).toBe(200); // was excused, now present
    expect((await mark(session1Id, studentCId, 'present')).status).toBe(200); // already reported
    const rows = await rowsForStudent(studentCId);
    expect(rows.map((r) => r.verb)).toEqual(['registered', 'attended', 'attended']);
  });

  it('locks the ID once statements exist (change AND clear); same value is a no-op', async () => {
    for (const nationalId of [`1${ts9.slice(0, 8)}8`, null]) {
      const res = await childPATCH(
        jsonReq(`/svc/account/children/${studentCId}`, 'PATCH', { nationalId }),
        params(studentCId),
      );
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('national_id_locked');
    }
    const same = await childPATCH(
      jsonReq(`/svc/account/children/${studentCId}`, 'PATCH', { nationalId: NID_C }),
      params(studentCId),
    );
    expect(same.status).toBe(200);
    expect(await rowsForStudent(studentCId)).toHaveLength(3);
  });
});
