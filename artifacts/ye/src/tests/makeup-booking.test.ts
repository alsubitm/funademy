/**
 * Integration tests for booking a real makeup session on approval:
 * approve requires a valid target session (same program, future, active run,
 * still scheduled, not the missed session) → the booked child appears on the
 * makeup session's attendance roster and can be marked → invalid targets are
 * refused.
 *
 * Same structure as payments.test.ts: runs against the isolated ye_test
 * database, calling the Next.js route handlers directly with a mocked
 * cookie store.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

// ——— mocked cookie store (next/headers) ———
const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ADMIN_COOKIE, adminToken } from '@/lib/auth';
import { GET as makeupGET, PATCH as makeupPATCH } from '@/app/svc/admin/makeup/route';
import { GET as attendanceGET, POST as attendancePOST } from '@/app/svc/admin/attendance/route';

const RUN = `mk-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const DAY = 24 * 60 * 60 * 1000;

function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://test.local${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? 'not json' : JSON.stringify(body),
  });
}
const getReq = (url: string) => new NextRequest(`http://test.local${url}`);

function freshPhone(): string {
  return `+9665${Math.floor(10000000 + Math.random() * 89999999)}`;
}

async function createProgram(tag: string) {
  return prisma.program.create({
    data: {
      slug: `prog-${tag}-${RUN}`,
      kitCode: 'KIT-01',
      nameEn: `Prog ${tag} ${RUN}`,
      nameAr: `برنامج ${tag} ${RUN}`,
      ageMin: 4,
      ageMax: 14,
      format: 'in_person',
      color: '#1c54cb',
      level: 1,
      taglineEn: 't',
      taglineAr: 'ت',
      descEn: 'd',
      descAr: 'د',
      buildsEn: [],
      buildsAr: [],
      termsEn: [],
      termsAr: [],
    },
  });
}

async function createRun(programId: number, opts: { active?: boolean } = {}) {
  return prisma.courseRun.create({
    data: {
      programId,
      startDate: new Date(Date.now() - 30 * DAY),
      endDate: new Date(Date.now() + 60 * DAY),
      weekday: 0,
      time: '17:00',
      format: 'in_person',
      capacity: 12,
      seatsLeft: 10,
      active: opts.active ?? true,
    },
  });
}

// ——— fixtures ———
let programId: number;
let otherProgramId: number;
let runAId: number; // the child's own run (missed session lives here)
let runBId: number; // another run of the same program (makeup target)
let inactiveRunId: number;
let otherProgramRunId: number;
let studentId: number;
let missedSessionId: number;
let futureSessionB1: number; // valid makeup target
let futureSessionB2: number;
let pastSessionB: number;
let cancelledSessionB: number;
let inactiveRunSession: number;
let otherProgramSession: number;

beforeAll(async () => {
  cookieJar.set(ADMIN_COOKIE, adminToken());

  const [progA, progB] = await Promise.all([createProgram('a'), createProgram('b')]);
  programId = progA.id;
  otherProgramId = progB.id;

  const [runA, runB, runInactive, runOther] = await Promise.all([
    createRun(programId),
    createRun(programId),
    createRun(programId, { active: false }),
    createRun(otherProgramId),
  ]);
  runAId = runA.id;
  runBId = runB.id;
  inactiveRunId = runInactive.id;
  otherProgramRunId = runOther.id;

  const family = await prisma.family.create({
    data: { phone: freshPhone(), parentName: `Parent ${RUN}` },
  });
  const student = await prisma.student.create({
    data: { familyId: family.id, firstName: `Kid ${RUN}`, birthYear: 2016 },
  });
  studentId = student.id;
  await prisma.enrollment.create({
    data: { studentId, courseRunId: runAId, status: 'active' },
  });

  const mk = (courseRunId: number, date: Date, status: 'scheduled' | 'cancelled' = 'scheduled') =>
    prisma.classSession.create({ data: { courseRunId, date, status } });

  const [missed, b1, b2, bPast, bCancelled, inact, other] = await Promise.all([
    mk(runAId, new Date(Date.now() - 7 * DAY)),
    mk(runBId, new Date(Date.now() + 3 * DAY)),
    mk(runBId, new Date(Date.now() + 10 * DAY)),
    mk(runBId, new Date(Date.now() - 3 * DAY)),
    mk(runBId, new Date(Date.now() + 5 * DAY), 'cancelled'),
    mk(inactiveRunId, new Date(Date.now() + 4 * DAY)),
    mk(otherProgramRunId, new Date(Date.now() + 4 * DAY)),
  ]);
  missedSessionId = missed.id;
  futureSessionB1 = b1.id;
  futureSessionB2 = b2.id;
  pastSessionB = bPast.id;
  cancelledSessionB = bCancelled.id;
  inactiveRunSession = inact.id;
  otherProgramSession = other.id;

  await prisma.attendance.create({
    data: { sessionId: missedSessionId, studentId, status: 'absent' },
  });
});

async function newRequest(): Promise<number> {
  // (studentId, sessionId) is unique — reuse or recreate per test group.
  await prisma.makeupRequest.deleteMany({ where: { studentId } });
  const r = await prisma.makeupRequest.create({
    data: { studentId, sessionId: missedSessionId },
  });
  return r.id;
}

describe('makeup candidates listing', () => {
  it('lists only future scheduled sessions of the same program in active runs', async () => {
    const reqId = await newRequest();
    const res = await makeupGET(getReq(`/svc/admin/makeup?candidates=${reqId}`));
    expect(res.status).toBe(200);
    const ids = ((await res.json()).sessions as { id: number }[]).map((s) => s.id);
    expect(ids).toContain(futureSessionB1);
    expect(ids).toContain(futureSessionB2);
    expect(ids).not.toContain(missedSessionId);
    expect(ids).not.toContain(pastSessionB);
    expect(ids).not.toContain(cancelledSessionB);
    expect(ids).not.toContain(inactiveRunSession);
    expect(ids).not.toContain(otherProgramSession);
  });
});

describe('approval requires a valid makeup session', () => {
  it('rejects approval without a makeup session', async () => {
    const reqId = await newRequest();
    const res = await makeupPATCH(jsonReq('/svc/admin/makeup', 'PATCH', { id: reqId, status: 'approved' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('makeup_session_required');
  });

  it('rejects the missed session itself, past, cancelled, inactive-run and cross-program targets', async () => {
    const reqId = await newRequest();
    const attempt = (makeupSessionId: number) =>
      makeupPATCH(jsonReq('/svc/admin/makeup', 'PATCH', { id: reqId, status: 'approved', makeupSessionId }));

    expect((await attempt(missedSessionId)).status).toBe(400);
    expect((await attempt(pastSessionB)).status).toBe(409);
    expect((await attempt(cancelledSessionB)).status).toBe(409);
    expect((await attempt(inactiveRunSession)).status).toBe(409);
    expect((await attempt(otherProgramSession)).status).toBe(409);
    expect((await attempt(999999999)).status).toBe(404);

    // Still pending after all refused attempts.
    const fresh = await prisma.makeupRequest.findUnique({ where: { id: reqId } });
    expect(fresh?.status).toBe('pending');
    expect(fresh?.makeupSessionId).toBeNull();
  });

  it('rejection works without a makeup session and never stores one', async () => {
    const reqId = await newRequest();
    const res = await makeupPATCH(
      jsonReq('/svc/admin/makeup', 'PATCH', { id: reqId, status: 'rejected', makeupSessionId: futureSessionB1 }),
    );
    expect(res.status).toBe(200);
    const fresh = await prisma.makeupRequest.findUnique({ where: { id: reqId } });
    expect(fresh?.status).toBe('rejected');
    expect(fresh?.makeupSessionId).toBeNull();
  });
});

describe('successful booking → roster and attendance', () => {
  it('approves with a valid session, stores the booking, and puts the child on that roster', async () => {
    const reqId = await newRequest();
    const res = await makeupPATCH(
      jsonReq('/svc/admin/makeup', 'PATCH', { id: reqId, status: 'approved', makeupSessionId: futureSessionB1 }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).request.makeupSessionId).toBe(futureSessionB1);

    // Child appears in the makeup session's attendance roster, flagged as makeup.
    const roster = await attendanceGET(getReq(`/svc/admin/attendance?sessionId=${futureSessionB1}`));
    expect(roster.status).toBe(200);
    const students = (await roster.json()).students as { id: number; makeup: boolean }[];
    const entry = students.find((s) => s.id === studentId);
    expect(entry).toBeDefined();
    expect(entry?.makeup).toBe(true);

    // …and NOT on an unrelated session's roster.
    const other = await attendanceGET(getReq(`/svc/admin/attendance?sessionId=${futureSessionB2}`));
    const otherStudents = (await other.json()).students as { id: number }[];
    expect(otherStudents.find((s) => s.id === studentId)).toBeUndefined();

    // The teacher can mark the makeup child in that session…
    const mark = await attendancePOST(
      jsonReq('/svc/admin/attendance', 'POST', { sessionId: futureSessionB1, studentId, status: 'present' }),
    );
    expect(mark.status).toBe(200);

    // …but not in a session where the child is neither enrolled nor booked.
    const badMark = await attendancePOST(
      jsonReq('/svc/admin/attendance', 'POST', { sessionId: futureSessionB2, studentId, status: 'present' }),
    );
    expect(badMark.status).toBe(409);
    expect((await badMark.json()).error).toBe('not_enrolled');
  });

  it('requires admin auth', async () => {
    cookieJar.delete(ADMIN_COOKIE);
    const res = await makeupGET(getReq('/svc/admin/makeup'));
    expect(res.status).toBe(401);
    cookieJar.set(ADMIN_COOKIE, adminToken());
  });
});
