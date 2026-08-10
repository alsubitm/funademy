import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getBrickCount } from '@/lib/bricks';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

const NATIONAL_DAY = '2026-09-23';
const DEFAULT_GOAL = 100000;
const GOAL_KEY = 'watan-goal';
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

function riyadhDayString(d: Date): string {
  return new Date(d.getTime() + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Campaign tracking stats (ported from the legacy standalone campaign site).
 * Totals come from the shared public.campaign_counters row; the daily series
 * merges ye_brick_events with the legacy public.campaign_brick_events so
 * history from the old site stays visible.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard) return guard;

  const now = new Date();
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(riyadhDayString(new Date(now.getTime() - i * 86400000)));
  const fromDay = days[0];

  const [total, goalRows, yeRows] = await Promise.all([
    getBrickCount(),
    prisma.$queryRaw<{ count: number }[]>`
      SELECT count FROM public.campaign_counters WHERE key = ${GOAL_KEY}
    `,
    prisma.$queryRaw<{ day: string; total: number }[]>`
      SELECT day, SUM(amount)::int AS total
      FROM ye_brick_events
      WHERE day >= ${fromDay}
      GROUP BY day
    `,
  ]);

  // Legacy events written by the old standalone campaign site / api-server.
  // Kept in a separate guarded query so fresh environments without that
  // table still render the ye-side series.
  let legacyRows: { day: string; total: number }[] = [];
  try {
    legacyRows = await prisma.$queryRaw<{ day: string; total: number }[]>`
      SELECT to_char((created_at AT TIME ZONE 'Asia/Riyadh')::date, 'YYYY-MM-DD') AS day,
             SUM(amount)::int AS total
      FROM public.campaign_brick_events
      WHERE key = 'watan-bricks'
        AND created_at >= now() - interval '15 days'
      GROUP BY 1
    `;
  } catch {
    // public.campaign_brick_events does not exist in this environment
  }

  const byDay = new Map<string, number>();
  for (const r of [...yeRows, ...legacyRows]) {
    if (r.day >= fromDay) byDay.set(r.day, (byDay.get(r.day) ?? 0) + Number(r.total));
  }

  const daily = days.map((date) => ({ date, count: byDay.get(date) ?? 0 }));
  const todayStr = days[13];
  const yesterdayStr = days[12];
  const today = byDay.get(todayStr) ?? 0;
  const yesterday = byDay.get(yesterdayStr) ?? 0;
  const growthPercent = yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 1000) / 10 : null;

  const goal = goalRows[0]?.count ?? DEFAULT_GOAL;
  const nationalDayDate = new Date(`${NATIONAL_DAY}T00:00:00+03:00`);
  const daysRemaining = Math.max(0, Math.ceil((nationalDayDate.getTime() - now.getTime()) / 86400000));
  const progressPercent = Math.round(Math.min(100, (total / goal) * 100) * 10) / 10;

  return NextResponse.json({
    total,
    goal,
    remaining: Math.max(0, goal - total),
    progressPercent,
    today,
    yesterday,
    growthPercent,
    daysRemaining,
    nationalDay: NATIONAL_DAY,
    daily,
  });
}
