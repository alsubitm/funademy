import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { getBrickCount } from '@/lib/bricks';
import { BRICK_DAILY_LIMIT, riyadhDay } from '@/lib/constants';
import { getFamilyId } from '@/lib/family-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [count, wall] = await Promise.all([
    getBrickCount(),
    prisma.watanBrick.findMany({
      where: { status: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { id: true, authorName: true, color: true, message: true },
    }),
  ]);
  return NextResponse.json({ count, wall });
}

// Brand palette only (blue / gold / cyan / sand) — never rainbow colors.
const BRICK_COLORS = ['#1C54CB', '#FFCA17', '#22DAFF', '#E5AE4A'];

function ipHashOf(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

export async function POST(req: NextRequest) {
  const ipHash = ipHashOf(req);
  const day = riyadhDay();

  // Optional signed message brick: { color?, authorName?, message?, studentId? } —
  // goes to the moderation queue (pending) and appears on the wall only once
  // approved. When the family is logged in, the brick links to their child.
  let brick: { authorName: string; message: string; color: string; studentId?: number } | null = null;
  const body = await req.json().catch(() => null);

  // studentId is validated independently of message presence: it always
  // requires a family session and child ownership.
  let linkedStudent: { id: number; firstName: string } | null = null;
  if (body && body.studentId !== undefined && body.studentId !== null) {
    const sid = Number(body.studentId);
    const familyId = await getFamilyId();
    if (!familyId || !Number.isInteger(sid)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const student = await prisma.student.findFirst({ where: { id: sid, familyId } });
    if (!student) return NextResponse.json({ error: 'not_your_child' }, { status: 403 });
    linkedStudent = { id: student.id, firstName: student.firstName };
  }

  if (body && String(body.message ?? '').trim()) {
    const message = String(body.message).trim();
    const color = BRICK_COLORS.includes(String(body.color)) ? String(body.color) : BRICK_COLORS[0];
    const authorName = (String(body.authorName ?? '').trim() || linkedStudent?.firstName || '').slice(0, 30);

    if (!authorName || message.length > 120) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }
    brick = { authorName, message, color, ...(linkedStudent ? { studentId: linkedStudent.id } : {}) };
  }

  // Atomic quota check + event insert + counter increment in one transaction.
  const result = await prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw<{ id: number }[]>`
      INSERT INTO ye.ye_brick_events ("ipHash", amount, day)
      SELECT ${ipHash}, 1, ${day}
      WHERE (
        SELECT COALESCE(SUM(amount), 0) FROM ye.ye_brick_events
        WHERE "ipHash" = ${ipHash} AND day = ${day}
      ) < ${BRICK_DAILY_LIMIT}
      RETURNING id
    `;
    if (inserted.length === 0) return null;
    if (brick) {
      await tx.watanBrick.create({ data: brick });
    }
    const rows = await tx.$queryRaw<{ count: number }[]>`
      INSERT INTO public.campaign_counters (key, count) VALUES ('watan-bricks', 1)
      ON CONFLICT (key) DO UPDATE SET count = campaign_counters.count + 1
      RETURNING count
    `;
    const used = await tx.brickEvent.aggregate({
      _sum: { amount: true },
      where: { ipHash, day },
    });
    return { count: rows[0]?.count ?? 0, used: used._sum.amount ?? 0 };
  }, { isolationLevel: 'Serializable' }).catch((e) => {
    // Serialization conflicts from concurrent taps → treat as retryable
    if (typeof e?.code === 'string' && e.code === 'P2034') return undefined;
    throw e;
  });

  if (result === undefined) {
    return NextResponse.json({ error: 'retry' }, { status: 503 });
  }
  if (result === null) {
    return NextResponse.json(
      { error: 'daily_limit', limit: BRICK_DAILY_LIMIT, count: await getBrickCount() },
      { status: 429 },
    );
  }
  return NextResponse.json({
    count: result.count,
    remainingToday: Math.max(0, BRICK_DAILY_LIMIT - result.used),
    pendingReview: !!brick,
  });
}
