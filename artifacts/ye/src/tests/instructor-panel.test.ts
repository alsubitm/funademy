import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined }),
}));
import { prisma } from '@/lib/db';
import { adminToken, ADMIN_COOKIE } from '@/lib/auth';
import { hashInstructorPassword, instructorToken, INSTRUCTOR_COOKIE, parseInstructorToken, verifyInstructorPassword } from '@/lib/instructor-auth';
import { GET as dashboard } from '@/app/(ar)/svc/instructor/dashboard/route';
import { POST as login, DELETE as logout } from '@/app/(ar)/svc/instructor/session/route';
import { POST as note } from '@/app/(ar)/svc/instructor/notes/route';
import { GET as list, POST as create, PATCH as edit } from '@/app/(ar)/svc/admin/instructors/route';

const prefix = `instructor-test-${Date.now()}`;
const password = 'Classroom-test-12345';
let teacherId: number, secondId: number, runId: number, otherRunId: number, sessionId: number, otherSessionId: number, programId: number;
const request = (body: unknown, method = 'POST') => new Request('http://localhost/svc/instructor/test', {
  method, headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify(body),
});
const teacher = () => jar.set(INSTRUCTOR_COOKIE, instructorToken(teacherId, 1));

beforeAll(async () => {
  vi.stubEnv('SESSION_SECRET', 'isolated-instructor-test-signing-key');
  const hash = await hashInstructorPassword(password);
  const program = await prisma.program.create({ data: {
    slug: prefix, kitCode: 'TEST', nameEn: 'Bricks Challenge', nameAr: 'Bricks Challenge',
    ageMin: 6, ageMax: 12, format: 'in_person', color: '#11388E', level: 1,
    taglineEn: '', taglineAr: '', descEn: '', descAr: '', buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
  } });
  programId = program.id;
  for (let n = 0; n < 2; n++) {
    const run = await prisma.courseRun.create({ data: {
      programId, startDate: new Date(), endDate: new Date(), weekday: 3, time: '17:00', format: 'in_person',
      sessions: { create: { date: new Date() } },
    }, include: { sessions: true } });
    if (n === 0) { runId = run.id; sessionId = run.sessions[0].id; }
    else { otherRunId = run.id; otherSessionId = run.sessions[0].id; }
  }
  const a = await prisma.instructor.create({ data: {
    name: 'Test instructor', email: `${prefix}@example.invalid`, passwordHash: hash,
    assignments: { create: { courseRunId: runId } },
  } });
  teacherId = a.id;
  const b = await prisma.instructor.create({ data: {
    name: 'Other instructor', email: `${prefix}-other@example.invalid`, passwordHash: hash,
    assignments: { create: { courseRunId: otherRunId } },
  } });
  secondId = b.id;
});
beforeEach(() => jar.clear());
afterAll(async () => {
  await prisma.instructor.deleteMany({ where: { email: { startsWith: prefix } } });
  if (programId) await prisma.program.delete({ where: { id: programId } });
  vi.unstubAllEnvs();
});

describe('instructor access and teaching data', () => {
  it('requires login for teaching data and denies instructor admin APIs', async () => {
    expect((await dashboard()).status).toBe(401);
    teacher();
    expect((await list()).status).toBe(401);
    expect((await create(request({}))).status).toBe(401);
  });
  it('authenticates a provisioned instructor and sets a dedicated HttpOnly cookie', async () => {
    const result = await login(request({ email: `${prefix}@example.invalid`, password }));
    expect(result.status).toBe(200);
    expect(result.headers.get('set-cookie')).toContain('ye_instructor=');
    expect(result.headers.get('set-cookie')).toContain('HttpOnly');
    expect((await login(request({ email: `${prefix}@example.invalid`, password: 'wrong' }))).status).toBe(401);
    expect((await login(request({ email: 'unknown@example.invalid', password }))).status).toBe(401);
  });
  it('scopes data to assigned classes without hashes, finance or parent details', async () => {
    teacher();
    const response = await dashboard();
    const data = await response.json();
    expect(data.runs.map((r: { id: number }) => r.id)).toEqual([runId]);
    expect(data.viewer.role).toBe('instructor');
    expect(response.headers.get('cache-control')).toContain('no-store');
    const json = JSON.stringify(data);
    for (const field of ['passwordHash', 'monthlyPriceSar', 'nationalId', 'phone']) expect(json).not.toContain(field);
  });
  it('saves notes only for assigned sessions and keeps them private between instructors', async () => {
    teacher();
    expect((await note(request({ sessionId, text: 'Prepare the Windmill kit' }))).status).toBe(200);
    expect((await note(request({ sessionId: otherSessionId, text: 'No access' }))).status).toBe(403);
    expect((await note(request({ sessionId, text: 'x'.repeat(5001) }))).status).toBe(400);
    expect((await (await dashboard()).json()).runs[0].sessions[0].preparationNote).toBe('Prepare the Windmill kit');
    jar.set(INSTRUCTOR_COOKIE, instructorToken(secondId, 1));
    expect((await (await dashboard()).json()).runs[0].sessions[0].preparationNote).toBe('');
  });
  it('rejects cross-origin mutation and tampered tokens; logout expires the cookie', async () => {
    const req = new Request('http://localhost/svc/instructor/session', {
      method: 'POST', headers: { origin: 'https://other.example', 'content-type': 'application/json' }, body: '{}',
    });
    expect((await login(req)).status).toBe(403);
    expect(parseInstructorToken(instructorToken(teacherId, 1) + 'a')).toBeNull();
    const res = await logout(new Request('http://localhost/svc/instructor/session', { method: 'DELETE' }));
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('supports admin account creation and assignment edits without disclosing credentials', async () => {
    jar.set(ADMIN_COOKIE, adminToken());
    expect((await create(request({ name: 'New', email: `${prefix}-new@example.invalid`, password: 'short', courseRunIds: [] }))).status).toBe(400);
    expect((await create(request({ name: 'New', email: `${prefix}-new@example.invalid`, password, courseRunIds: [runId] }))).status).toBe(200);
    expect((await create(request({ name: 'Duplicate', email: `${prefix}-new@example.invalid`, password, courseRunIds: [] }))).status).toBe(409);
    expect(JSON.stringify(await (await list()).json())).not.toContain('passwordHash');
    const result = await edit(request({ id: teacherId, name: 'Test instructor', email: `${prefix}@example.invalid`, active: false, courseRunIds: [] }, 'PATCH'));
    expect(result.status).toBe(200);
    jar.clear(); teacher();
    expect((await dashboard()).status).toBe(401);
    expect((await login(request({ email: `${prefix}@example.invalid`, password }))).status).toBe(401);
  });
  it('uses salted password hashes and rejects incorrect passwords', async () => {
    const one = await hashInstructorPassword(password), two = await hashInstructorPassword(password);
    expect(one).not.toBe(two);
    expect(await verifyInstructorPassword(password, one)).toBe(true);
    expect(await verifyInstructorPassword('wrong', one)).toBe(false);
  });
});
