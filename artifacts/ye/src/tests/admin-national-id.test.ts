/**
 * Admin national-ID entry/correction (RunsTab → PATCH /svc/admin/roster) —
 * the identity behind official NELC attendance records.
 *
 * Covers:
 *   - GET roster / GET attendance expose nationalId so the admin UI can flag
 *     children whose attendance is silently missing from the official record
 *   - PATCH validation (invalid_national_id), uniqueness (national_id_taken),
 *     and immutability once statements exist (national_id_locked)
 *   - Adding an ID backfills past present/late attendance via
 *     enqueueStudentIdSnapshot (registered + attended per session)
 *   - RACE regression: an attendance enqueue running concurrently with an ID
 *     correction can never leave old-ID statements alongside a committed new
 *     ID — the check + update hold the same per-student row lock the enqueue
 *     takes.
 *
 * Runs against the isolated ye_test database; LRS HTTP is mocked.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';

vi.mock('@/app/(ar)/svc/admin/guard', () => ({
  requireAdmin: vi.fn(async () => null),
}));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { sessionActivityIri, runCourseIri } from '@/lib/xapiProduction';
import { enqueueAttendanceEvents } from '@/lib/xapiOutbox';
import { GET as rosterGET, PATCH as rosterPATCH } from '@/app/(ar)/svc/admin/roster/route';
import { GET as attendanceGET, POST as attendancePOST } from '@/app/(ar)/svc/admin/attendance/route';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.stubEnv('NELC_OUTBOX_TEST', '1');
  vi.stubEnv('REPLIT_DEPLOYMENT', '');
  vi.stubEnv('NELC_LRS_PROD_ENDPOINT', '');
  vi.stubEnv('NELC_LRS_PROD_KEY', '');
  vi.stubEnv('NELC_LRS_PROD_SECRET', '');
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

// unique-per-run identifiers (ye_test DB persists across runs)
const RUN = `admid-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const ts9 = String(Date.now()).slice(-9);
const NID_TAKEN = `1${ts9.slice(0, 8)}1`;
const NID_NEW = `2${ts9.slice(0, 8)}3`;
const NID_OTHER = `2${ts9.slice(0, 8)}5`;
const NID_RACE = `1${ts9.slice(0, 8)}7`;
const NID_RACE2 = `1${ts9.slice(0, 8)}9`;

let familyId: number;
let runId: number;
let sessionId: number;
let noIdStudentId: number; // gets ID via admin PATCH (backfill path)
let takenStudentId: number; // owns NID_TAKEN
let raceStudentId: number; // starts with NID_RACE, correction raced

const jsonReq = (url: string, method = 'GET', body?: unknown) =>
  new NextRequest(`http://test.local${url}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
const patchId = (studentId: number, nationalId: string | null) =>
  rosterPATCH(jsonReq('/svc/admin/roster', 'PATCH', { studentId, nationalId }));
const mark = (sId: number, studentId: number, status: string) =>
  attendancePOST(jsonReq('/svc/admin/attendance', 'POST', { sessionId: sId, studentId, status }));
const rowsFor = (studentId: number) =>
  prisma.xapiOutbox.findMany({ where: { studentId }, orderBy: { id: 'asc' } });

beforeAll(async () => {
  const fam = await prisma.family.create({
    data: { phone: `+9664${RUN.slice(-8)}`, parentName: 'Adm Parent' },
  });
  familyId = fam.id;
  const program = await prisma.program.create({
    data: {
      slug: `admid-prog-${RUN}`,
      kitCode: 'KIT-03', nameEn: 'Adm Live', nameAr: 'إدارة', ageMin: 4, ageMax: 14,
      format: 'online', color: '#1C54CB', level: 1,
      taglineEn: 't', taglineAr: 'ت', descEn: 'd', descAr: 'د',
      buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
    },
  });
  const run = await prisma.courseRun.create({
    data: {
      programId: program.id,
      startDate: new Date('2026-08-01'), endDate: new Date('2026-12-31'),
      weekday: 1, time: '17:00', format: 'online',
      sessions: { create: { date: new Date('2026-08-03T17:00:00.000Z'), status: 'completed' } },
    },
    include: { sessions: true },
  });
  runId = run.id;
  sessionId = run.sessions[0].id;

  noIdStudentId = (await prisma.student.create({
    data: { familyId, firstName: 'AdmNoId', birthYear: 2016 },
  })).id;
  takenStudentId = (await prisma.student.create({
    data: { familyId, firstName: 'AdmTaken', birthYear: 2015, nationalId: NID_TAKEN },
  })).id;
  raceStudentId = (await prisma.student.create({
    data: { familyId, firstName: 'AdmRace', birthYear: 2014, nationalId: NID_RACE },
  })).id;

  for (const studentId of [noIdStudentId, takenStudentId, raceStudentId]) {
    await prisma.enrollment.create({ data: { studentId, courseRunId: runId, status: 'active' } });
  }
});

describe('admin visibility of missing national IDs', () => {
  it('GET roster exposes nationalId (null flags the child in the UI)', async () => {
    const res = await rosterGET(jsonReq(`/svc/admin/roster?runId=${runId}`));
    expect(res.status).toBe(200);
    const { roster } = await res.json();
    const byId = new Map(roster.map((r: any) => [r.student.id, r.student.nationalId]));
    expect(byId.get(noIdStudentId)).toBeNull();
    expect(byId.get(takenStudentId)).toBe(NID_TAKEN);
  });

  it('GET attendance exposes nationalId per student', async () => {
    const res = await attendanceGET(jsonReq(`/svc/admin/attendance?sessionId=${sessionId}`));
    expect(res.status).toBe(200);
    const { students } = await res.json();
    const byId = new Map(students.map((s: any) => [s.id, s.nationalId]));
    expect(byId.get(noIdStudentId)).toBeNull();
    expect(byId.get(takenStudentId)).toBe(NID_TAKEN);
  });
});

describe('admin PATCH national ID', () => {
  it('rejects malformed IDs', async () => {
    const res = await patchId(noIdStudentId, '12345');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_national_id');
  });

  it('rejects an ID already registered to another child', async () => {
    const res = await patchId(noIdStudentId, NID_TAKEN);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('national_id_taken');
  });

  it('adding an ID backfills past present attendance (registered + attended)', async () => {
    expect((await mark(sessionId, noIdStudentId, 'present')).status).toBe(200);
    expect(await rowsFor(noIdStudentId)).toHaveLength(0); // no ID yet → nothing queued

    const res = await patchId(noIdStudentId, NID_NEW);
    expect(res.status).toBe(200);
    expect((await res.json()).student.nationalId).toBe(NID_NEW);

    const rows = await rowsFor(noIdStudentId);
    expect(rows.map((r) => r.verb)).toEqual(['registered', 'attended']);
    expect(rows.every((r) => r.nationalId === NID_NEW)).toBe(true);
    expect((rows[1].statement as Record<string, any>).object.id).toBe(
      sessionActivityIri(runCourseIri(runId), sessionId),
    );
  });

  it('locks the ID once statements exist (change AND clear); same value is a no-op', async () => {
    for (const nationalId of [NID_OTHER, null]) {
      const res = await patchId(noIdStudentId, nationalId);
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe('national_id_locked');
    }
    const same = await patchId(noIdStudentId, NID_NEW);
    expect(same.status).toBe(200);
    expect(await rowsFor(noIdStudentId)).toHaveLength(2); // no re-backfill
  });

  it('RACE: concurrent attendance enqueue and ID correction never mix identities', async () => {
    // Mark attendance WITHOUT enqueueing (outbox inactive), so the student
    // has an attended mark but no statements yet — the correction is allowed.
    vi.stubEnv('NELC_OUTBOX_TEST', '');
    expect((await mark(sessionId, raceStudentId, 'present')).status).toBe(200);
    vi.stubEnv('NELC_OUTBOX_TEST', '1');
    expect(await rowsFor(raceStudentId)).toHaveLength(0);

    // Fire the enqueue (queues under the CURRENT ID) and the correction
    // concurrently. Both take the same per-student row lock, so exactly one
    // of two consistent outcomes is allowed:
    //   enqueue first → statements exist under old ID → PATCH rejected (locked)
    //   PATCH first   → enqueue reads the NEW ID → all statements new-ID
    const [, patchRes] = await Promise.all([
      enqueueAttendanceEvents({ studentId: raceStudentId, sessionId }),
      patchId(raceStudentId, NID_RACE2),
    ]);

    const student = await prisma.student.findUnique({ where: { id: raceStudentId } });
    const rows = await rowsFor(raceStudentId);
    expect(rows.length).toBeGreaterThan(0);
    if (patchRes.status === 200) {
      // Correction won the lock: every statement must carry the new ID.
      expect(student?.nationalId).toBe(NID_RACE2);
      expect(rows.every((r) => r.nationalId === NID_RACE2)).toBe(true);
    } else {
      // Enqueue won the lock: old-ID statements exist → correction rejected.
      expect(patchRes.status).toBe(409);
      expect((await patchRes.json()).error).toBe('national_id_locked');
      expect(student?.nationalId).toBe(NID_RACE);
      expect(rows.every((r) => r.nationalId === NID_RACE)).toBe(true);
    }
    // The integrity invariant either way: no old-ID rows next to a new ID.
    expect(
      rows.some((r) => r.nationalId === NID_RACE) && student?.nationalId === NID_RACE2,
    ).toBe(false);
  });
});
