/**
 * Integration tests for the family account flow:
 * request OTP → verify (new & returning family) → session cookie →
 * add/edit/delete children → logout.
 *
 * Same structure as brick-wall.test.ts: runs against the isolated ye_test
 * database, calling the Next.js route handlers directly with a mocked
 * cookie store.
 */
import { describe, it, expect, afterAll, vi } from 'vitest';

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

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { FAMILY_COOKIE, familyToken, familyIdFromToken } from '@/lib/family-auth';
import { POST as otpPOST } from '@/app/(ar)/svc/account/otp/route';
import { POST as verifyPOST } from '@/app/(ar)/svc/account/verify/route';
import { POST as childrenPOST } from '@/app/(ar)/svc/account/children/route';
import { PATCH as childPATCH, DELETE as childDELETE } from '@/app/(ar)/svc/account/children/[id]/route';
import { GET as meGET } from '@/app/(ar)/svc/account/me/route';
import { POST as logoutPOST } from '@/app/(ar)/svc/account/logout/route';

const RUN = `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const usedPhones: string[] = [];

/** Fresh Saudi mobile in local format; the +966 form is tracked for cleanup. */
function freshPhone(): { local: string; normalized: string } {
  const tail = String(Math.floor(10000000 + Math.random() * 89999999));
  const local = `05${tail.slice(0, 1)}${tail.slice(1)}`;
  const normalized = `+9665${tail}`;
  usedPhones.push(normalized);
  return { local, normalized };
}

function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://test.local${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? 'not json' : JSON.stringify(body),
  });
}

const requestOtpFor = (phone: string) => otpPOST(jsonReq('/svc/account/otp', 'POST', { phone }));

async function getDevCode(phone: string): Promise<string> {
  const res = await requestOtpFor(phone);
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.sent).toBe(true);
  expect(json.devCode).toMatch(/^\d{6}$/);
  return json.devCode;
}

const verify = (body: unknown) => verifyPOST(jsonReq('/svc/account/verify', 'POST', body));

/** Copy the session cookie a response set into the mocked request jar. */
function adoptSession(res: NextResponse) {
  const c = res.cookies.get(FAMILY_COOKIE);
  expect(c?.value).toBeTruthy();
  cookieJar.set(FAMILY_COOKIE, c!.value);
  return c!.value;
}

const asFamily = (id: number | null) => {
  if (id === null) cookieJar.delete(FAMILY_COOKIE);
  else cookieJar.set(FAMILY_COOKIE, familyToken(id));
};

const patchChild = (id: number | string, body?: unknown) =>
  childPATCH(jsonReq(`/svc/account/children/${id}`, 'PATCH', body), {
    params: Promise.resolve({ id: String(id) }),
  });
const deleteChild = (id: number | string) =>
  childDELETE(jsonReq(`/svc/account/children/${id}`, 'DELETE', {}), {
    params: Promise.resolve({ id: String(id) }),
  });

afterAll(async () => {
  cookieJar.clear();
  await prisma.otpCode.deleteMany({ where: { phone: { in: usedPhones } } });
  const families = await prisma.family.findMany({ where: { phone: { in: usedPhones } } });
  const ids = families.map((f) => f.id);
  await prisma.student.deleteMany({ where: { familyId: { in: ids } } });
  await prisma.family.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('OTP request', () => {
  it('rejects an invalid phone number (400)', async () => {
    const res = await requestOtpFor('123456');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_phone');
  });

  it('rejects a non-JSON body (400)', async () => {
    const res = await otpPOST(jsonReq('/svc/account/otp', 'POST'));
    expect(res.status).toBe(400);
  });

  it('sends a code for a valid phone (dev code returned outside production)', async () => {
    const { local } = freshPhone();
    const transaction = vi
      .spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(new Error('57P01 terminating connection due to administrator command'));
    await getDevCode(local);
    expect(transaction).toHaveBeenCalledTimes(2);
    transaction.mockRestore();
  });

  it('rate-limits after 5 requests in an hour (429)', async () => {
    const { local } = freshPhone();
    for (let i = 0; i < 5; i++) expect((await requestOtpFor(local)).status).toBe(200);
    const blocked = await requestOtpFor(local);
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toBe('rate_limited');
  });
});

describe('verify → session', () => {
  it('rejects a wrong code (401) and increments attempts until locked (429)', async () => {
    const { local } = freshPhone();
    const code = await getDevCode(local);
    const wrong = code === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) {
      const res = await verify({ phone: local, code: wrong });
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('invalid');
    }
    // attempts exhausted — even the correct code is now refused
    const locked = await verify({ phone: local, code });
    expect(locked.status).toBe(429);
    expect((await locked.json()).error).toBe('too_many_attempts');
  });

  it('rejects malformed input (400)', async () => {
    expect((await verify({ phone: 'nope', code: '123456' })).status).toBe(400);
    expect((await verify({ phone: '0512345678', code: '12ab' })).status).toBe(400);
  });

  it('new family: asks for the parent name without consuming the code, then creates the account and session', async () => {
    const { local, normalized } = freshPhone();
    const code = await getDevCode(local);

    // valid code, no name → needName (code NOT consumed)
    const first = await verify({ phone: local, code });
    expect(first.status).toBe(200);
    expect((await first.json()).needName).toBe(true);

    // resubmit the SAME code with the parent name → family created + cookie
    const loginTransaction = vi
      .spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(new Error('57P01 terminating connection due to administrator command'));
    const second = await verify({ phone: local, code, parentName: `أم فهد ${RUN}` });
    expect(loginTransaction).toHaveBeenCalledTimes(2);
    loginTransaction.mockRestore();
    expect(second.status).toBe(200);
    const json = await second.json();
    expect(json.parentName).toBe(`أم فهد ${RUN}`);

    const token = adoptSession(second as NextResponse);
    expect(familyIdFromToken(token)).toBe(json.id);

    const family = await prisma.family.findUnique({ where: { phone: normalized } });
    expect(family).not.toBeNull();
    expect(family!.id).toBe(json.id);

    // session works: /me returns the family
    const me = await meGET();
    expect(me.status).toBe(200);
    expect((await me.json()).id).toBe(json.id);
  });

  it('returning family logs in without a name; code is single-use', async () => {
    const { normalized, local } = freshPhone();
    const family = await prisma.family.create({
      data: { phone: normalized, parentName: `عائدة ${RUN}` },
    });
    const code = await getDevCode(local);

    const res = await verify({ phone: local, code });
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(family.id);
    adoptSession(res as NextResponse);

    // consumed — the same code cannot be replayed
    const replay = await verify({ phone: local, code });
    expect(replay.status).toBe(401);
  });
});

describe('children CRUD', () => {
  it('requires a session (401 without cookie)', async () => {
    asFamily(null);
    const res = await childrenPOST(
      jsonReq('/svc/account/children', 'POST', { firstName: 'سارة', birthYear: 2016 }),
    );
    expect(res.status).toBe(401);
    expect((await patchChild(1, { firstName: 'x' })).status).toBe(401);
    expect((await deleteChild(1)).status).toBe(401);
  });

  it('adds, edits, and deletes a child for the logged-in family', async () => {
    const { normalized } = freshPhone();
    const family = await prisma.family.create({
      data: { phone: normalized, parentName: `أبو ريان ${RUN}` },
    });
    asFamily(family.id);

    const created = await childrenPOST(
      jsonReq('/svc/account/children', 'POST', { firstName: `ريان ${RUN}`, birthYear: 2015 }),
    );
    expect(created.status).toBe(201);
    const child = await created.json();

    // validation: bad birth year
    const bad = await childrenPOST(
      jsonReq('/svc/account/children', 'POST', { firstName: 'خطأ', birthYear: 1980 }),
    );
    expect(bad.status).toBe(400);

    const edited = await patchChild(child.id, { firstName: `ريّان ${RUN}`, birthYear: 2014 });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ firstName: `ريّان ${RUN}`, birthYear: 2014 });

    const removed = await deleteChild(child.id);
    expect(removed.status).toBe(200);
    expect(await prisma.student.findUnique({ where: { id: child.id } })).toBeNull();
  });

  it("rejects editing or deleting another family's child (404, unchanged)", async () => {
    const { normalized: pa } = freshPhone();
    const { normalized: pb } = freshPhone();
    const familyA = await prisma.family.create({ data: { phone: pa, parentName: `A ${RUN}` } });
    const familyB = await prisma.family.create({ data: { phone: pb, parentName: `B ${RUN}` } });
    const childB = await prisma.student.create({
      data: { familyId: familyB.id, firstName: `نورة ${RUN}`, birthYear: 2016 },
    });

    asFamily(familyA.id);
    expect((await patchChild(childB.id, { firstName: 'اختراق' })).status).toBe(404);
    expect((await deleteChild(childB.id)).status).toBe(404);

    const untouched = await prisma.student.findUnique({ where: { id: childB.id } });
    expect(untouched!.firstName).toBe(`نورة ${RUN}`);
  });
});

describe('logout', () => {
  it('clears the family session cookie', async () => {
    const { normalized } = freshPhone();
    const family = await prisma.family.create({
      data: { phone: normalized, parentName: `خروج ${RUN}` },
    });
    asFamily(family.id);
    expect((await meGET()).status).toBe(200);

    const res = await logoutPOST();
    const cleared = res.cookies.get(FAMILY_COOKIE);
    expect(cleared?.value).toBe('');
    expect(cleared?.maxAge).toBe(0);

    // simulate the browser dropping the cookie
    cookieJar.delete(FAMILY_COOKIE);
    expect((await meGET()).status).toBe(401);
  });
});
