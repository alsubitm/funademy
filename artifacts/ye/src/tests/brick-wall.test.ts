/**
 * Integration tests for the Watanona brick wall flow:
 * place brick → moderation → message appears on the wall.
 *
 * These run against an isolated, disposable test database (`ye_test`,
 * provisioned by global-setup.ts — never the shared dev DB), calling the
 * Next.js route handlers directly with a mocked cookie store. Rows are
 * still cleaned up in afterAll so repeated runs stay deterministic.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createHash } from 'crypto';

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
import { BRICK_DAILY_LIMIT, BRICK_KEY, riyadhDay } from '@/lib/constants';
import { familyToken, FAMILY_COOKIE } from '@/lib/family-auth';
import { adminToken, ADMIN_COOKIE } from '@/lib/auth';
import { GET as bricksGET, POST as bricksPOST } from '@/app/(ar)/svc/bricks/route';
import { GET as adminGET, PATCH as adminPATCH } from '@/app/(ar)/svc/admin/brick-wall/route';

const RUN = `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
// Captured once so cleanup targets the same day even across midnight.
const TEST_DAY = riyadhDay();
const usedIps: string[] = [];
let successfulPlacements = 0;

function freshIp(): string {
  const ip = `10.99.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  usedIps.push(ip);
  return ip;
}

const ipHashOf = (ip: string) => createHash('sha256').update(ip).digest('hex').slice(0, 32);

function postBrick(body: unknown, ip: string) {
  return bricksPOST(
    new NextRequest('http://test.local/svc/bricks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

async function place(body: unknown, ip: string) {
  const res = await postBrick(body, ip);
  if (res.status === 200) successfulPlacements += 1;
  return res;
}

const asFamily = (id: number | null) => {
  if (id === null) cookieJar.delete(FAMILY_COOKIE);
  else cookieJar.set(FAMILY_COOKIE, familyToken(id));
};
const asAdmin = (on: boolean) => {
  if (on) cookieJar.set(ADMIN_COOKIE, adminToken());
  else cookieJar.delete(ADMIN_COOKIE);
};

let familyA: { id: number };
let studentA: { id: number; firstName: string };
let familyB: { id: number };
let studentB: { id: number };

beforeAll(async () => {
  familyA = await prisma.family.create({
    data: { phone: `+96650${Math.floor(1000000 + Math.random() * 8999999)}`, parentName: `A ${RUN}` },
  });
  studentA = await prisma.student.create({
    data: { familyId: familyA.id, firstName: `سلمان-${RUN}`, birthYear: 2016 },
  });
  familyB = await prisma.family.create({
    data: { phone: `+96651${Math.floor(1000000 + Math.random() * 8999999)}`, parentName: `B ${RUN}` },
  });
  studentB = await prisma.student.create({
    data: { familyId: familyB.id, firstName: `نورة-${RUN}`, birthYear: 2015 },
  });
});

afterAll(async () => {
  cookieJar.clear();
  await prisma.watanBrick.deleteMany({ where: { message: { contains: RUN } } });
  for (const ip of usedIps) {
    await prisma.brickEvent.deleteMany({ where: { ipHash: ipHashOf(ip), day: TEST_DAY } });
  }
  if (successfulPlacements > 0) {
    await prisma.$executeRaw`
      UPDATE public.campaign_counters
      SET count = GREATEST(count - ${successfulPlacements}, 0)
      WHERE key = ${BRICK_KEY}
    `;
  }
  await prisma.family.deleteMany({ where: { id: { in: [familyA.id, familyB.id] } } });
  await prisma.$disconnect();
});

describe('placing bricks', () => {
  it('places a plain brick (no message) and increments the counter', async () => {
    cookieJar.clear();
    const res = await place({}, freshIp());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBeGreaterThan(0);
    expect(json.pendingReview).toBe(false);
    expect(json.remainingToday).toBe(BRICK_DAILY_LIMIT - 1);
  });

  it('places a signed message brick → goes to pending, not on the wall', async () => {
    cookieJar.clear();
    const res = await place(
      { message: `أحب وطني ${RUN}`, authorName: 'خالد', color: '#FFCA17' },
      freshIp(),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).pendingReview).toBe(true);

    const brick = await prisma.watanBrick.findFirst({ where: { message: `أحب وطني ${RUN}` } });
    expect(brick).not.toBeNull();
    expect(brick!.status).toBe('pending');
    expect(brick!.authorName).toBe('خالد');
    expect(brick!.color).toBe('#FFCA17');

    const wall = (await (await bricksGET()).json()).wall as { message: string }[];
    expect(wall.some((b) => b.message === `أحب وطني ${RUN}`)).toBe(false);
  });

  it('rejects invalid input: message too long or missing name', async () => {
    cookieJar.clear();
    const tooLong = await place({ message: 'أ'.repeat(121), authorName: 'خالد' }, freshIp());
    expect(tooLong.status).toBe(400);
    const noName = await place({ message: `بدون اسم ${RUN}` }, freshIp());
    expect(noName.status).toBe(400);
  });

  it('links the brick to a child with a valid family session (name defaults to child)', async () => {
    asFamily(familyA.id);
    const res = await place({ message: `مكعب طفلي ${RUN}`, studentId: studentA.id }, freshIp());
    expect(res.status).toBe(200);
    const brick = await prisma.watanBrick.findFirst({ where: { message: `مكعب طفلي ${RUN}` } });
    expect(brick!.studentId).toBe(studentA.id);
    expect(brick!.authorName).toBe(studentA.firstName.slice(0, 30));
  });

  it('rejects linking another family’s child (403)', async () => {
    asFamily(familyA.id);
    const res = await place({ message: `تسلل ${RUN}`, studentId: studentB.id }, freshIp());
    expect(res.status).toBe(403);
    expect(await prisma.watanBrick.findFirst({ where: { message: `تسلل ${RUN}` } })).toBeNull();
  });

  it('rejects a studentId without a family session (401)', async () => {
    cookieJar.clear();
    const res = await place({ message: `بدون جلسة ${RUN}`, studentId: studentA.id }, freshIp());
    expect(res.status).toBe(401);
  });

  it('enforces the daily limit per IP (429)', async () => {
    cookieJar.clear();
    const ip = freshIp();
    for (let i = 0; i < BRICK_DAILY_LIMIT; i++) {
      const res = await place({}, ip);
      expect(res.status).toBe(200);
    }
    const blocked = await place({}, ip);
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe('daily_limit');
  });
});

describe('moderation → wall', () => {
  it('admin endpoints require an admin session (401 otherwise)', async () => {
    asAdmin(false);
    const res = await adminGET(new NextRequest('http://test.local/svc/admin/brick-wall'));
    expect(res.status).toBe(401);
  });

  it('approved message appears on the wall; rejected does not', async () => {
    cookieJar.clear();
    const approveMsg = `للنشر ${RUN}`;
    const rejectMsg = `للرفض ${RUN}`;
    expect((await place({ message: approveMsg, authorName: 'ريم' }, freshIp())).status).toBe(200);
    expect((await place({ message: rejectMsg, authorName: 'ريم' }, freshIp())).status).toBe(200);

    const toApprove = await prisma.watanBrick.findFirst({ where: { message: approveMsg } });
    const toReject = await prisma.watanBrick.findFirst({ where: { message: rejectMsg } });

    asAdmin(true);
    // both visible in the pending queue
    const queue = await adminGET(new NextRequest('http://test.local/svc/admin/brick-wall?status=pending'));
    expect(queue.status).toBe(200);
    const pendingIds = ((await queue.json()).bricks as { id: number }[]).map((b) => b.id);
    expect(pendingIds).toContain(toApprove!.id);
    expect(pendingIds).toContain(toReject!.id);

    const patch = (id: number, status: string) =>
      adminPATCH(
        new NextRequest('http://test.local/svc/admin/brick-wall', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, status }),
        }),
      );
    expect((await patch(toApprove!.id, 'approved')).status).toBe(200);
    expect((await patch(toReject!.id, 'rejected')).status).toBe(200);

    const wall = (await (await bricksGET()).json()).wall as { message: string }[];
    expect(wall.some((b) => b.message === approveMsg)).toBe(true);
    expect(wall.some((b) => b.message === rejectMsg)).toBe(false);
  });

  it('PATCH validates input (400) and unknown id (404)', async () => {
    asAdmin(true);
    const bad = await adminPATCH(
      new NextRequest('http://test.local/svc/admin/brick-wall', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 1, status: 'published' }),
      }),
    );
    expect(bad.status).toBe(400);
    const missing = await adminPATCH(
      new NextRequest('http://test.local/svc/admin/brick-wall', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 999999999, status: 'approved' }),
      }),
    );
    expect(missing.status).toBe(404);
  });
});
