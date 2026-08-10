import { prisma } from './db';
import { BRICK_KEY } from './constants';

/**
 * The brick counter lives in public.campaign_counters (shared with the
 * original standalone campaign page + api-server). Prisma only manages the
 * "ye" schema, so we use raw SQL for this table. NEVER add it to
 * schema.prisma — `prisma db push` would then try to manage (and drop)
 * other apps' tables in the public schema.
 */

export async function getBrickCount(): Promise<number> {
  // Read-only, used during static prerender (/watanona) — must never crash
  // a `next build` at publish time if the DB/table is unavailable.
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT count FROM public.campaign_counters WHERE key = ${BRICK_KEY}
    `;
    return rows[0]?.count ?? 0;
  } catch (err) {
    console.error('[bricks] getBrickCount failed, falling back to 0:', err instanceof Error ? err.message : err);
    return 0;
  }
}

export async function incrementBricks(by: number): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO public.campaign_counters (key, count)
    VALUES (${BRICK_KEY}, ${by})
    ON CONFLICT (key) DO UPDATE SET count = campaign_counters.count + ${by}
    RETURNING count
  `;
  return rows[0]?.count ?? 0;
}

export async function resetBricks(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE public.campaign_counters SET count = 0 WHERE key = ${BRICK_KEY}
  `;
}

export async function setBricks(count: number): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO public.campaign_counters (key, count)
    VALUES (${BRICK_KEY}, ${count})
    ON CONFLICT (key) DO UPDATE SET count = ${count}
  `;
}
