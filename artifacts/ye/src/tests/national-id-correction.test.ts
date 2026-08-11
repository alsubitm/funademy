/**
 * Admin correction of a LOCKED child national ID (task 121).
 *
 * Covers:
 *   - parent PATCH stays locked (409 national_id_locked) once outbox rows exist
 *   - admin POST: validation, confirm flag required, not_locked guard,
 *     duplicate ID rejected, same ID rejected
 *   - successful correction: child updated, pending rows under the OLD ID
 *     superseded (never delivered), SENT rows untouched, audit row written,
 *     fresh registered+progressed snapshot queued under the NEW ID
 *   - GET lists locked children + audit log
 *
 * Runs against the isolated ye_test database (NELC_OUTBOX_TEST=1 enables
 * enqueueing; no real network traffic — nothing is flushed).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => { cookieJar.set(name, value); },
    delete: (name: string) => { cookieJar.delete(name); },
  }),
}));
vi.mock('@/app/(ar)/svc/admin/guard', () => ({
  requireAdmin: vi.fn(async () => null),
}));
// Real outbox module, but with the tx-scoped snapshot wrapped so one test
// can force it to fail and prove the whole correction rolls back.
vi.mock('@/lib/xapiOutbox', async (importOriginal) => {
  const m = await importOriginal<typeof import('@/lib/xapiOutbox')>();
  return { ...m, enqueueIdSetSnapshotTx: vi.fn(m.enqueueIdSetSnapshotTx) };
});

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { FAMILY_COOKIE, familyToken } from '@/lib/family-auth';
import { hashPin } from '@/lib/kid-auth';
import { PATCH as childPATCH } from '@/app/(ar)/svc/learn/children/[id]/route';
import { GET as fixGET, POST as fixPOST } from '@/app/(ar)/svc/admin/children/national-id/route';

const RUN = Date.now() % 1_000_000_000;
const OLD_ID = `1${String(RUN).padStart(9, '0')}`;
const NEW_ID = `2${String(RUN).padStart(9, '0')}`;
const OTHER_ID = `2${String((RUN + 1) % 1_000_000_000).padStart(9, '0')}`;

let familyId: number;
let childId: number;
let otherChildId: number;
let subjectId: number;
let lessonId: number;

function jsonReq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://test.local${url}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

beforeAll(async () => {
  process.env.NELC_OUTBOX_TEST = '1';
  const family = await prisma.family.create({
    data: { phone: `05${RUN}`, parentName: `IDFix ${RUN}` },
  });
  familyId = family.id;
  const pin = await hashPin('1234');
  const child = await prisma.lrnChild.create({
    data: { familyId, name: 'طفل التصحيح', pin, band: 'explorers', nationalId: OLD_ID },
  });
  childId = child.id;
  const other = await prisma.lrnChild.create({
    data: { familyId, name: 'طفل آخر', pin, band: 'explorers', nationalId: OTHER_ID },
  });
  otherChildId = other.id;

  // Learning history so the snapshot has something to report.
  const subject = await prisma.lrnSubject.create({
    data: { slug: `idfix-${RUN}`, nameAr: 'م', nameEn: 'IdFix', icon: '⭐', color: '#FFD400', position: 0 },
  });
  subjectId = subject.id;
  const unit = await prisma.lrnUnit.create({
    data: { subjectId, titleAr: 'و', titleEn: 'U', band: 'explorers', status: 'published', position: 0 },
  });
  const lesson = await prisma.lrnLesson.create({
    data: { unitId: unit.id, titleAr: 'د', titleEn: 'L', status: 'published', position: 0, durationMinutes: 10 },
  });
  lessonId = lesson.id;
  await prisma.lrnFirstCompletion.create({ data: { childId, lessonId } });

  // Simulate prior sends under the WRONG ID: one sent + one still pending.
  await prisma.xapiOutbox.createMany({
    data: [
      {
        childId, nationalId: OLD_ID, courseIri: `https://funademy.io/course/idfix-${RUN}`,
        verb: 'registered', statementId: crypto.randomUUID(), statement: {}, status: 'sent',
      },
      {
        childId, nationalId: OLD_ID, courseIri: `https://funademy.io/course/idfix-${RUN}`,
        verb: 'progressed', statementId: crypto.randomUUID(), statement: {}, status: 'pending',
      },
    ],
  });
});

afterAll(async () => {
  delete process.env.NELC_OUTBOX_TEST;
  await prisma.xapiOutbox.deleteMany({ where: { childId: { in: [childId, otherChildId] } } });
  await prisma.lrnChildIdCorrection.deleteMany({ where: { childId } });
  await prisma.lrnSubject.deleteMany({ where: { id: subjectId } });
  await prisma.family.deleteMany({ where: { id: familyId } });
});

describe('parent lock stays intact', () => {
  it('parent PATCH of a used national ID → 409 national_id_locked', async () => {
    cookieJar.set(FAMILY_COOKIE, familyToken(familyId));
    const res = await childPATCH(
      jsonReq(`/svc/learn/children/${childId}`, 'PATCH', { nationalId: NEW_ID }),
      params(childId),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('national_id_locked');
    cookieJar.clear();
  });
});

describe('admin correction route', () => {
  it('rejects a malformed national ID', async () => {
    const res = await fixPOST(jsonReq('/x', 'POST', { childId, newNationalId: '999', confirm: true }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_national_id');
  });

  it('requires the explicit confirm flag', async () => {
    const res = await fixPOST(jsonReq('/x', 'POST', { childId, newNationalId: NEW_ID }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('confirmation_required');
  });

  it('rejects a new ID already used by another child', async () => {
    const res = await fixPOST(jsonReq('/x', 'POST', { childId, newNationalId: OTHER_ID, confirm: true }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('national_id_taken');
  });

  it('rejects when the ID equals the current one', async () => {
    const res = await fixPOST(jsonReq('/x', 'POST', { childId, newNationalId: OLD_ID, confirm: true }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('same_national_id');
  });

  it('refuses children whose ID is not locked (parent path exists)', async () => {
    const res = await fixPOST(jsonReq('/x', 'POST', { childId: otherChildId, newNationalId: NEW_ID, confirm: true }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('not_locked');
  });

  it('refuses while the server flush is POSTing one of the child’s rows (sending claim)', async () => {
    await prisma.xapiOutbox.updateMany({
      where: { childId, verb: 'progressed', nationalId: OLD_ID },
      data: { status: 'sending', claimedAt: new Date() },
    });
    const res = await fixPOST(jsonReq('/x', 'POST', { childId, newNationalId: NEW_ID, confirm: true }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('delivery_in_flight');
    await prisma.xapiOutbox.updateMany({
      where: { childId, verb: 'progressed', nationalId: OLD_ID },
      data: { status: 'pending', claimedAt: null },
    });
    // Nothing changed.
    expect((await prisma.lrnChild.findUnique({ where: { id: childId } }))?.nationalId).toBe(OLD_ID);
  });

  it('refuses while an active browser flush run leases the child’s pending statements', async () => {
    const pending = await prisma.xapiOutbox.findFirst({
      where: { childId, status: 'pending' },
    });
    const run = await prisma.xapiOutboxFlushRun.create({
      data: {
        runId: crypto.randomUUID(),
        statementIds: [pending!.statementId],
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const res = await fixPOST(jsonReq('/x', 'POST', { childId, newNationalId: NEW_ID, confirm: true }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('browser_flush_active');
    await prisma.xapiOutboxFlushRun.delete({ where: { id: run.id } });
    expect((await prisma.lrnChild.findUnique({ where: { id: childId } }))?.nationalId).toBe(OLD_ID);
  });

  it('BLOCKS on the dispatch lock while a server claim is in progress, then refuses (409)', async () => {
    // Deterministic interleaving: a "server flush" transaction takes the
    // per-child dispatch lock and claims the row (pending → sending), then
    // pauses mid-transaction. The correction must WAIT on the lock (not
    // interleave), and once the claim commits, see `sending` and refuse.
    const outbox = await import('@/lib/xapiOutbox');
    let release!: () => void;
    const hold = new Promise<void>((r) => { release = r; });
    let claimedInsideTx = false;
    const claimTx = prisma.$transaction(
      async (tx) => {
        await outbox.lockChildDispatch(tx, childId);
        await tx.xapiOutbox.updateMany({
          where: { childId, status: 'pending' },
          data: { status: 'sending', claimedAt: new Date() },
        });
        claimedInsideTx = true;
        await hold;
      },
      { timeout: 20_000 },
    );
    while (!claimedInsideTx) await new Promise((r) => setTimeout(r, 25));

    const correctionP = fixPOST(
      jsonReq('/x', 'POST', { childId, newNationalId: NEW_ID, confirm: true }),
    );
    const raced = await Promise.race([
      correctionP.then(() => 'finished' as const),
      new Promise<'blocked'>((r) => setTimeout(() => r('blocked'), 500)),
    ]);
    expect(raced).toBe('blocked'); // correction is waiting on the advisory lock

    release();
    await claimTx;
    const res = await correctionP;
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('delivery_in_flight');
    expect((await prisma.lrnChild.findUnique({ where: { id: childId } }))?.nationalId).toBe(OLD_ID);
    await prisma.xapiOutbox.updateMany({
      where: { childId, status: 'sending' },
      data: { status: 'pending', claimedAt: null },
    });
  });

  it('rolls back the ENTIRE correction when the corrected-ID snapshot cannot be queued', async () => {
    const outbox = await import('@/lib/xapiOutbox');
    (outbox.enqueueIdSetSnapshotTx as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('snapshot enqueue failed (simulated)');
    });
    await expect(
      fixPOST(jsonReq('/x', 'POST', { childId, newNationalId: NEW_ID, confirm: true })),
    ).rejects.toThrow('snapshot enqueue failed');
    // Atomic rollback: ID unchanged, pending row NOT superseded, no audit row.
    expect((await prisma.lrnChild.findUnique({ where: { id: childId } }))?.nationalId).toBe(OLD_ID);
    const pending = await prisma.xapiOutbox.findFirst({ where: { childId, verb: 'progressed' } });
    expect(pending?.status).toBe('pending');
    expect(await prisma.lrnChildIdCorrection.count({ where: { childId } })).toBe(0);
  });

  it('GET lists the child as locked', async () => {
    const res = await fixGET();
    expect(res.status).toBe(200);
    const j = await res.json();
    const row = j.children.find((c: { id: number }) => c.id === childId);
    expect(row?.locked).toBe(true);
    const other = j.children.find((c: { id: number }) => c.id === otherChildId);
    expect(other?.locked).toBe(false);
  });

  it('corrects the ID: updates child, supersedes pending, audits, queues snapshot under NEW ID', async () => {
    const res = await fixPOST(jsonReq('/x', 'POST', { childId, newNationalId: NEW_ID, confirm: true }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.oldNationalId).toBe(OLD_ID);
    expect(j.supersededPending).toBe(1);
    expect(j.snapshotQueued).toBeGreaterThanOrEqual(2); // registered + progressed

    const child = await prisma.lrnChild.findUnique({ where: { id: childId } });
    expect(child?.nationalId).toBe(NEW_ID);

    // Old pending row cancelled; old sent row untouched (permanent audit).
    const oldRows = await prisma.xapiOutbox.findMany({ where: { childId, nationalId: OLD_ID } });
    expect(oldRows.find((r) => r.verb === 'progressed')?.status).toBe('superseded');
    expect(oldRows.find((r) => r.verb === 'registered')?.status).toBe('sent');

    // Snapshot rows queued under the NEW ID only.
    const newRows = await prisma.xapiOutbox.findMany({ where: { childId, nationalId: NEW_ID } });
    // 100% of the subject is done (its only lesson) → completed_course too.
    expect(newRows.map((r) => r.verb).sort()).toEqual(['completed_course', 'progressed', 'registered']);
    expect(newRows.every((r) => r.status === 'pending')).toBe(true);

    // Permanent audit row.
    const audit = await prisma.lrnChildIdCorrection.findFirst({ where: { childId }, orderBy: { id: 'desc' } });
    expect(audit).toMatchObject({
      childName: 'طفل التصحيح',
      oldNationalId: OLD_ID,
      newNationalId: NEW_ID,
      changedBy: 'admin',
      supersededPending: 1,
      snapshotQueued: newRows.length,
    });

    // And it shows up in the GET audit list.
    const list = await (await fixGET()).json();
    expect(list.corrections.some((c: { id: number }) => c.id === audit!.id)).toBe(true);
  });

  it('after the correction commits, browser prepare never hands out an old-ID statement', async () => {
    vi.stubEnv('ADMIN_PASSWORD', 'test-admin-pass');
    vi.stubEnv('NELC_LRS_PROD_ENDPOINT', 'https://lrs.prod.example/xAPI');
    vi.stubEnv('NELC_LRS_PROD_KEY', 'prod-key');
    vi.stubEnv('NELC_LRS_PROD_SECRET', 'prod-secret');
    try {
      const { POST: nelcPOST } = await import('@/app/(ar)/svc/admin/nelc/route');
      const prep = await nelcPOST(
        jsonReq('/svc/admin/nelc', 'POST', { action: 'outbox_prepare', password: 'test-admin-pass' }),
      );
      expect(prep.status).toBe(200);
      const pj = await prep.json();
      const actorIds = (pj.statements ?? []).map((s: { nationalId: string }) => s.nationalId);
      expect(actorIds).not.toContain(OLD_ID); // superseded rows are un-leasable
      expect(actorIds).toContain(NEW_ID); // corrected snapshot IS handed out
      // Consume the lease so it cannot linger into other suites.
      if (pj.runId) {
        await prisma.xapiOutboxFlushRun.updateMany({
          where: { runId: pj.runId },
          data: { consumed: true },
        });
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('prepare never leases a row that entered the pending set after its candidate read', async () => {
    // Deterministic interleaving for the "row enters the re-read window"
    // race: hold the dispatch lock of a candidate child so prepare blocks
    // AFTER its candidate read; while it is blocked, a NEW pending row for
    // another child appears (e.g. a claim reverted, a fresh enqueue). The
    // lease must contain ONLY the originally-locked candidates — the new
    // row's child holds no dispatch lock, so it must wait for the next run.
    vi.stubEnv('ADMIN_PASSWORD', 'test-admin-pass');
    vi.stubEnv('NELC_LRS_PROD_ENDPOINT', 'https://lrs.prod.example/xAPI');
    vi.stubEnv('NELC_LRS_PROD_KEY', 'prod-key');
    vi.stubEnv('NELC_LRS_PROD_SECRET', 'prod-secret');
    const outbox = await import('@/lib/xapiOutbox');
    const { POST: nelcPOST } = await import('@/app/(ar)/svc/admin/nelc/route');
    // Ensure there is at least one pending candidate row (childId set).
    const candidate = await prisma.xapiOutbox.findFirst({ where: { status: 'pending', childId: { not: null } } });
    expect(candidate).not.toBeNull();
    const lateStatementId = crypto.randomUUID();
    let release!: () => void;
    const hold = new Promise<void>((r) => { release = r; });
    let lockHeld = false;
    const blockTx = prisma.$transaction(
      async (tx) => {
        await outbox.lockChildDispatch(tx, candidate!.childId!);
        lockHeld = true;
        await hold;
      },
      { timeout: 20_000 },
    );
    while (!lockHeld) await new Promise((r) => setTimeout(r, 25));
    const prepP = nelcPOST(
      jsonReq('/svc/admin/nelc', 'POST', { action: 'outbox_prepare', password: 'test-admin-pass' }),
    );
    // Give prepare time to take its candidate read and block on the lock,
    // then let a brand-new pending row appear for a DIFFERENT child.
    await new Promise((r) => setTimeout(r, 400));
    await prisma.xapiOutbox.create({
      data: {
        childId: otherChildId,
        nationalId: OTHER_ID,
        courseIri: 'https://funademy.sa/xapi/course/late',
        verb: 'progressed',
        statementId: lateStatementId,
        statement: {},
        status: 'pending',
      },
    });
    release();
    await blockTx;
    try {
      const prep = await prepP;
      expect(prep.status).toBe(200);
      const pj = await prep.json();
      const leased = (pj.statements ?? []).map((s: { statementId: string }) => s.statementId);
      expect(leased).not.toContain(lateStatementId); // late row is NOT handed out
      if (pj.runId) {
        const run = await prisma.xapiOutboxFlushRun.findUnique({ where: { runId: pj.runId } });
        expect(run!.statementIds).not.toContain(lateStatementId); // nor leased
        await prisma.xapiOutboxFlushRun.update({ where: { runId: pj.runId }, data: { consumed: true } });
      }
    } finally {
      await prisma.xapiOutbox.deleteMany({ where: { statementId: lateStatementId } });
      vi.unstubAllEnvs();
    }
  });

  it('after the correction commits, the server flush never POSTs an old-ID statement (and stale claims recover)', async () => {
    vi.stubEnv('NELC_LRS_PROD_ENDPOINT', 'https://lrs.prod.example/xAPI');
    vi.stubEnv('NELC_LRS_PROD_KEY', 'prod-key');
    vi.stubEnv('NELC_LRS_PROD_SECRET', 'prod-secret');
    // Stale-claim recovery ordering: leave a NEW-ID row stuck in `sending`
    // from a "crashed" pass — the flush must revert it first and deliver it.
    const stale = await prisma.xapiOutbox.findFirst({
      where: { childId, nationalId: NEW_ID, status: 'pending' },
      orderBy: { id: 'asc' },
    });
    await prisma.xapiOutbox.update({
      where: { id: stale!.id },
      data: { status: 'sending', claimedAt: new Date(Date.now() - 10 * 60_000) },
    });
    const posted: string[] = [];
    const fetchSpy = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
      posted.push(String(init?.body ?? ''));
      return new Response('[]', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const { flushOutboxServer: flush } = await import('@/lib/xapiOutbox');
      const res = await flush();
      expect(res.sent).toBeGreaterThan(0);
      // No POST body ever carries the wrong identity.
      expect(posted.some((b) => b.includes(OLD_ID))).toBe(false);
      // The stale claim was recovered and delivered, not stuck.
      const recovered = await prisma.xapiOutbox.findUnique({ where: { id: stale!.id } });
      expect(recovered?.status).toBe('sent');
      // Old-ID rows remain superseded/sent — untouched by the flush.
      const oldStatuses = (
        await prisma.xapiOutbox.findMany({ where: { childId, nationalId: OLD_ID } })
      ).map((r) => r.status).sort();
      expect(oldStatuses).toEqual(['sent', 'superseded']);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
