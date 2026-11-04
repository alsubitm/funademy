import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined }),
}));
import { prisma } from '@/lib/db';
import { hashInstructorPassword, instructorToken, INSTRUCTOR_COOKIE, currentInstructor, verifyInstructorPassword } from '@/lib/instructor-auth';
import { POST } from '@/app/(ar)/svc/instructor/password/route';
import { POST as login } from '@/app/(ar)/svc/instructor/session/route';
import { ADMIN_COOKIE, adminToken } from '@/lib/auth';

const email = `password-test-${Date.now()}@example.invalid`;
const password = 'Original-classroom-123';
const newPassword = 'Replacement-classroom-456';
let id: number, hash: string;
const request = (body: unknown = { currentPassword: password, newPassword }, headers: Record<string, string> = {}) =>
  new Request('https://localhost/svc/instructor/password', {
    method: 'POST', headers: { origin: 'https://localhost', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });

beforeAll(async () => {
  vi.stubEnv('SESSION_SECRET', 'isolated-password-test-signing-key');
  hash = await hashInstructorPassword(password);
  id = (await prisma.instructor.create({ data: { name: 'Password test', email, passwordHash: hash } })).id;
});
beforeEach(async () => {
  vi.useRealTimers();
  await prisma.instructor.update({ where: { id }, data: { active: true, authVersion: 1, passwordHash: hash } });
  await prisma.rateLimitHit.deleteMany({ where: { key: `instructor-password:${id}` } });
  jar.clear(); jar.set(INSTRUCTOR_COOKIE, instructorToken(id, 1));
});
afterAll(async () => {
  vi.useRealTimers();
  await prisma.instructor.delete({ where: { id } });
  await prisma.rateLimitHit.deleteMany({ where: { key: `instructor-password:${id}` } });
  vi.unstubAllEnvs();
});

describe('instructor self-service password changes', () => {
  it('rejects incorrect current password without changing credentials or version', async () => {
    const response = await POST(request({ currentPassword: 'wrong', newPassword }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'incorrect_password' });
    const record = await prisma.instructor.findUniqueOrThrow({ where: { id } });
    expect(record.passwordHash).toBe(hash);
    expect(record.authVersion).toBe(1);
  });
  it('requires a valid instructor session, not administrator access', async () => {
    jar.clear(); jar.set(ADMIN_COOKIE, adminToken());
    expect((await POST(request())).status).toBe(401);
    jar.set(INSTRUCTOR_COOKIE, instructorToken(id, 1));
    await prisma.instructor.update({ where: { id }, data: { active: false } });
    expect((await POST(request())).status).toBe(401);
  });
  it('rejects expired and previously invalidated sessions', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() - 9 * 60 * 60 * 1000);
    const expired = instructorToken(id, 1);
    vi.useRealTimers();
    jar.set(INSTRUCTOR_COOKIE, expired);
    expect((await POST(request())).status).toBe(401);
    jar.set(INSTRUCTOR_COOKIE, instructorToken(id, 1));
    await prisma.instructor.update({ where: { id }, data: { authVersion: 2 } });
    expect((await POST(request())).status).toBe(401);
  });
  it('enforces same origin, JSON, and new-password validation', async () => {
    const rejectedHeaders: Record<string, string>[] = [{ origin: 'https://evil.example' }, { origin: '' }, { origin: 'http://localhost' },
      { 'sec-fetch-site': 'cross-site' }, { 'content-type': 'text/plain' }];
    for (const headers of rejectedHeaders) {
      expect((await POST(request(undefined, headers))).status).toBe(403);
    }
    for (const next of ['short', 'x'.repeat(129), password, ' '.repeat(12)]) {
      expect((await POST(request({ currentPassword: password, newPassword: next }))).status).toBe(400);
    }
    expect((await POST(request(null))).status).toBe(400);
  });
  it('uses persisted account-wide throttling, including concurrent attempts', async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () =>
      POST(request({ currentPassword: 'wrong', newPassword }))));
    expect(responses.filter(r => r.status === 400)).toHaveLength(5);
    expect(responses.filter(r => r.status === 429)).toHaveLength(3);
    expect(await prisma.rateLimitHit.count({ where: { key: `instructor-password:${id}` } })).toBe(5);
    jar.set(INSTRUCTOR_COOKIE, instructorToken(id, 1));
    expect((await POST(request(undefined, { 'x-forwarded-for': '198.51.100.99' }))).status).toBe(429);
  });
  it('atomically changes the hash, revokes all old sessions, and requires new sign-in', async () => {
    const oldToken = jar.get(INSTRUCTOR_COOKIE)!;
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const record = await prisma.instructor.findUniqueOrThrow({ where: { id } });
    expect(record.authVersion).toBe(2);
    expect(record.passwordHash).not.toContain(newPassword);
    expect(await verifyInstructorPassword(newPassword, record.passwordHash)).toBe(true);
    jar.set(INSTRUCTOR_COOKIE, oldToken);
    expect(await currentInstructor()).toBeNull();
    expect((await POST(request())).status).toBe(401);
    expect((await login(request({ email, password }))).status).toBe(401);
    const signedIn = await login(request({ email, password: newPassword }));
    expect(signedIn.status).toBe(200);
    jar.set(INSTRUCTOR_COOKIE, signedIn.cookies.get(INSTRUCTOR_COOKIE)!.value);
    expect((await currentInstructor())?.id).toBe(id);
  });
  it('allows only one concurrent change using the same old credentials', async () => {
    const responses = await Promise.all([POST(request()), POST(request())]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 401]);
    expect((await prisma.instructor.findUniqueOrThrow({ where: { id } })).authVersion).toBe(2);
  });
});
