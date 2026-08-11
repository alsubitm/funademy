import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../../guard';
import { NATIONAL_ID_RE } from '@/lib/learning';
import {
  enqueueIdSetSnapshotTx,
  flushOutboxServer,
  lockChildDispatch,
  outboxActive,
} from '@/lib/xapiOutbox';

export const dynamic = 'force-dynamic';

/**
 * Admin correction path for a LOCKED child national ID (task 121).
 *
 * The parent-facing PATCH refuses to change a national ID once ANY outbox
 * row exists for the child (409 national_id_locked) — changing the identity
 * would split the learner across two identities in NELC's permanent store.
 * When the locked ID itself was a TYPO, this admin-only route is the sole
 * correction path. It is deliberately cautious:
 *   - explicit confirm flag required (the UI additionally makes the admin
 *     retype the new ID);
 *   - the new ID must be valid and not used by another child;
 *   - pending (unsent) outbox rows under the WRONG ID are cancelled
 *     (status "superseded") so no further statements go out under it —
 *     already-SENT rows stay in NELC's LRS forever (it never deletes;
 *     the wrong ID is permanently "burned");
 *   - a permanent audit row records who/when/old/new;
 *   - a fresh registered+progressed snapshot is queued under the NEW ID.
 */

/** GET — children with a national ID + lock state, and the correction audit log. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [children, corrections] = await Promise.all([
    prisma.lrnChild.findMany({
      where: { nationalId: { not: null } },
      select: { id: true, name: true, nationalId: true },
      orderBy: { id: 'asc' },
    }),
    prisma.lrnChildIdCorrection.findMany({ orderBy: { id: 'desc' }, take: 50 }),
  ]);
  const lockedRows = await prisma.xapiOutbox.groupBy({
    by: ['childId'],
    where: { childId: { in: children.map((c) => c.id) } },
  });
  const locked = new Set(lockedRows.map((r) => r.childId));
  return NextResponse.json({
    children: children.map((c) => ({ ...c, locked: locked.has(c.id) })),
    corrections,
  });
}

/** POST { childId, newNationalId, confirm: true } — correct a locked ID. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const childId = Number(b?.childId);
  const newNationalId = String(b?.newNationalId ?? '').trim();
  if (!Number.isInteger(childId) || childId <= 0) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  if (!NATIONAL_ID_RE.test(newNationalId)) {
    return NextResponse.json({ error: 'invalid_national_id' }, { status: 400 });
  }
  if (b?.confirm !== true) {
    return NextResponse.json({ error: 'confirmation_required' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // DISPATCH lock first — the shared serialization protocol with the
      // server-flush claim and the browser outbox_prepare lease: any
      // claim/lease either happened before us (we detect it below and
      // refuse) or comes after our commit (the rows are superseded and
      // match nothing). Then the child row lock — no completion can enqueue
      // under the old ID while the correction is mid-flight.
      await lockChildDispatch(tx, childId);
      await tx.$queryRawUnsafe(`SELECT id FROM ye_lrn_children WHERE id = $1 FOR UPDATE`, childId);

      const child = await tx.lrnChild.findUnique({
        where: { id: childId },
        select: { id: true, name: true, nationalId: true },
      });
      if (!child) return { error: 'not_found' as const, status: 404 };
      if (!child.nationalId) return { error: 'no_national_id' as const, status: 409 };
      if (child.nationalId === newNationalId) {
        return { error: 'same_national_id' as const, status: 400 };
      }
      // Not locked ⇒ the parent can change it themselves; keep the cautious
      // admin path reserved for the case that actually needs it.
      const used = await tx.xapiOutbox.findFirst({
        where: { childId: child.id },
        select: { id: true },
      });
      if (!used) return { error: 'not_locked' as const, status: 409 };

      const taken = await tx.lrnChild.findFirst({
        where: { nationalId: newNationalId, id: { not: childId } },
        select: { id: true },
      });
      if (taken) return { error: 'national_id_taken' as const, status: 409 };

      // DISPATCH EXCLUSION — a correction must never race a delivery:
      //  (a) a `sending` row means the server flush is POSTing it right now;
      //  (b) an unexpired, unconsumed browser flush run that leases any of
      //      this child's pending statements means the admin's browser may
      //      POST them at any moment.
      // Either way the statement would leave under the WRONG identity while
      // we "correct" it — refuse and let the admin retry in a minute (the
      // server claim resolves in seconds; a browser lease expires in 15 min
      // or is consumed by its record call).
      const inFlight = await tx.xapiOutbox.findFirst({
        where: { childId, status: 'sending' },
        select: { id: true },
      });
      if (inFlight) return { error: 'delivery_in_flight' as const, status: 409 };
      const pendingIds = (
        await tx.xapiOutbox.findMany({
          where: { childId, status: 'pending' },
          select: { statementId: true },
        })
      ).map((r) => r.statementId);
      if (pendingIds.length > 0) {
        const activeRuns = await tx.xapiOutboxFlushRun.findMany({
          where: { consumed: false, expiresAt: { gt: new Date() } },
          select: { statementIds: true },
        });
        const leased = new Set(activeRuns.flatMap((r) => r.statementIds));
        if (pendingIds.some((id) => leased.has(id))) {
          return { error: 'browser_flush_active' as const, status: 409 };
        }
      }

      const oldNationalId = child.nationalId;
      await tx.lrnChild.update({ where: { id: childId }, data: { nationalId: newNationalId } });

      // Cancel UNSENT statements under the wrong identity — nothing further
      // may reach NELC under it. Sent rows are permanent audit; untouched.
      const superseded = await tx.xapiOutbox.updateMany({
        where: { childId, nationalId: oldNationalId, status: 'pending' },
        data: { status: 'superseded' },
      });

      // Fresh snapshot under the CORRECT ID (registered + current progressed,
      // + completed course at 100%) — same path as a parent first setting an
      // ID, but INSIDE this transaction: if queuing fails, the whole
      // correction rolls back rather than silently completing without the
      // promised replacement record. Gated like every enqueue — the dev
      // preview must never queue statements for NELC's shared store.
      const snapshotQueued = outboxActive()
        ? await enqueueIdSetSnapshotTx(tx, childId, newNationalId)
        : 0;

      await tx.lrnChildIdCorrection.create({
        data: {
          childId,
          childName: child.name,
          oldNationalId,
          newNationalId,
          changedBy: 'admin',
          supersededPending: superseded.count,
          snapshotQueued,
        },
      });
      return {
        ok: true as const,
        oldNationalId,
        superseded: superseded.count,
        snapshotQueued,
      };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const snapshotQueued = result.snapshotQueued;
    if (snapshotQueued > 0) void flushOutboxServer();

    return NextResponse.json({
      ok: true,
      oldNationalId: result.oldNationalId,
      newNationalId,
      supersededPending: result.superseded,
      snapshotQueued,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'national_id_taken' }, { status: 409 });
    }
    throw e;
  }
}
