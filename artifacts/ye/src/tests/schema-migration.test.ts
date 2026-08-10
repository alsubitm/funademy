/**
 * Tests for the one-time ye→public legacy schema cutover
 * (src/lib/migrate-ye-schema.ts).
 *
 * Recreates a miniature of the OLD production layout inside the isolated
 * ye_test database: a dedicated "ye" schema holding old-shape tables (enum
 * types living in the ye schema, ye_course_runs WITHOUT the newer meetingUrl
 * column) — then verifies the migration copies rows, casts enums, respects FK
 * order, fixes sequences, drops the ye schema, and refuses ambiguous states.
 */
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { migrateYeSchemaToPublic } from '@/lib/migrate-ye-schema';

async function dropYeSchema() {
  await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS ye CASCADE');
}

async function createOldYeSchema() {
  await dropYeSchema();
  await prisma.$executeRawUnsafe('CREATE SCHEMA ye');
  await prisma.$executeRawUnsafe(`CREATE TYPE ye.ye_format AS ENUM ('online', 'in_person')`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE ye.ye_programs (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE, "kitCode" TEXT NOT NULL, "nameEn" TEXT NOT NULL, "nameAr" TEXT NOT NULL,
      "ageMin" INT NOT NULL, "ageMax" INT NOT NULL, format ye.ye_format NOT NULL, color TEXT NOT NULL,
      level INT NOT NULL, "taglineEn" TEXT NOT NULL, "taglineAr" TEXT NOT NULL,
      "descEn" TEXT NOT NULL, "descAr" TEXT NOT NULL,
      "buildsEn" TEXT[] NOT NULL, "buildsAr" TEXT[] NOT NULL, "termsEn" TEXT[] NOT NULL, "termsAr" TEXT[] NOT NULL,
      position INT NOT NULL DEFAULT 0
    )`);
  // Old shape: NO meetingUrl column (added to the Prisma schema later).
  await prisma.$executeRawUnsafe(`
    CREATE TABLE ye.ye_course_runs (
      id SERIAL PRIMARY KEY,
      "programId" INT NOT NULL REFERENCES ye.ye_programs(id) ON DELETE CASCADE,
      "titleAr" TEXT, "titleEn" TEXT,
      "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL,
      weekday INT NOT NULL, time TEXT NOT NULL, format ye.ye_format NOT NULL, location TEXT,
      capacity INT NOT NULL DEFAULT 12, "seatsLeft" INT NOT NULL DEFAULT 12,
      "monthlyPriceSar" INT NOT NULL DEFAULT 1380, active BOOLEAN NOT NULL DEFAULT true
    )`);
  await prisma.$executeRawUnsafe(`
    INSERT INTO ye.ye_programs
      (slug, "kitCode", "nameEn", "nameAr", "ageMin", "ageMax", format, color, level,
       "taglineEn", "taglineAr", "descEn", "descAr", "buildsEn", "buildsAr", "termsEn", "termsAr", position)
    VALUES
      ('legacy-a', 'KIT-01', 'Legacy A', 'قديم أ', 4, 6, 'online',    '#111111', 1,
       't', 'ت', 'd', 'د', ARRAY['x'], ARRAY['س'], ARRAY['t1'], ARRAY['ف1'], 1),
      ('legacy-b', 'KIT-02', 'Legacy B', 'قديم ب', 7, 9, 'in_person', '#222222', 2,
       't', 'ت', 'd', 'د', ARRAY['y'], ARRAY['ص'], ARRAY['t2'], ARRAY['ف2'], 2)`);
  await prisma.$executeRawUnsafe(`
    INSERT INTO ye.ye_course_runs
      ("programId", "startDate", "endDate", weekday, time, format)
    SELECT id, '2026-01-01', '2026-03-01', 2, '17:00', 'online'::ye.ye_format
    FROM ye.ye_programs WHERE slug = 'legacy-b'`);
}

/** Empty the public counterparts so the cutover has a clean landing zone. */
async function truncatePublicCounterparts() {
  await prisma.$executeRawUnsafe('TRUNCATE public.ye_programs CASCADE');
}

afterAll(async () => {
  await dropYeSchema();
  // Leave the shared ye_test DB in a non-colliding state. The cutover fixture
  // setvals the programs/course-runs sequences down to the tiny copied MAXes,
  // so later runs would recycle historical ids. Appointments carry a plain
  // Int programId (no FK — TRUNCATE ... CASCADE does not reach them), and the
  // booking route reuses trial meetings by (programId, startsAt): stale rows
  // at a recycled id + the same weekly slot time made it "reuse" a phantom
  // meeting from a previous run (flaky appointments tests). Wipe this suite's
  // fixtures and stale reuse candidates, then park the lowered sequences far
  // above any historical id.
  await prisma.$executeRawUnsafe('TRUNCATE public.ye_programs CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE public.ye_appointments');
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('public.ye_programs', 'id'), 100000, true)`);
  await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('public.ye_course_runs', 'id'), 100000, true)`);
});

describe('migrateYeSchemaToPublic', () => {
  beforeEach(async () => {
    await dropYeSchema();
  });

  it('no-ops instantly when there is no legacy ye schema', async () => {
    const res = await migrateYeSchemaToPublic(prisma);
    expect(res).toMatchObject({ skipped: true });
  });

  it('moves data, casts enums, fills drifted columns and fixes sequences (publish sequence: DDL pre-exists)', async () => {
    await createOldYeSchema();
    await truncatePublicCounterparts();
    // Pre-existing shared PUBLIC table with live rows (the watanona campaign
    // counter) — it has no "ye" counterpart and must sail through untouched.
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.campaign_counters (key, count) VALUES ('watan-bricks', 1884) ON CONFLICT (key) DO NOTHING`,
    );
    const counterBefore = await prisma.campaignCounter.findUniqueOrThrow({ where: { key: 'watan-bricks' } });

    const res = await migrateYeSchemaToPublic(prisma);
    expect(res).toMatchObject({ skipped: false });
    if ('copied' in res) {
      expect(res.copied.ye_programs).toBe(2);
      expect(res.copied.ye_course_runs).toBe(1);
    }
    // This mirrors the real publish sequence: the publish schema diff (here:
    // global-setup's db push) already created every public table/enum/FK, so
    // the DDL replay must recognize them all as duplicates — the only
    // statement that "runs" is the idempotent CREATE SCHEMA IF NOT EXISTS.
    if ('ddlCreated' in res) expect(res.ddlCreated).toBe(1);

    // Shared public campaign table survived with its live data intact.
    const counterAfter = await prisma.campaignCounter.findUniqueOrThrow({ where: { key: 'watan-bricks' } });
    expect(counterAfter.count).toBe(counterBefore.count);

    // ye schema is gone.
    const yeLeft = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM pg_tables WHERE schemaname = 'ye'`,
    );
    expect(Number(yeLeft[0].n)).toBe(0);

    // Rows landed in public with enum values preserved (via Prisma itself).
    const progs = await prisma.program.findMany({ orderBy: { position: 'asc' } });
    expect(progs.map((p) => p.slug)).toEqual(['legacy-a', 'legacy-b']);
    expect(progs[1].format).toBe('in_person');

    // Drifted column exists and defaulted to NULL; FK survived the move.
    const runs = await prisma.courseRun.findMany({ include: { program: true } });
    expect(runs).toHaveLength(1);
    expect(runs[0].meetingUrl).toBeNull();
    expect(runs[0].program.slug).toBe('legacy-b');

    // Sequence continues past copied ids — inserts must not collide.
    const created = await prisma.program.create({
      data: {
        slug: 'post-cutover', kitCode: 'KIT-03', nameEn: 'New', nameAr: 'جديد',
        ageMin: 4, ageMax: 6, format: 'online', color: '#333333', level: 1,
        taglineEn: 't', taglineAr: 'ت', descEn: 'd', descAr: 'د',
        buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
      },
    });
    expect(created.id).toBeGreaterThan(Math.max(...progs.map((p) => p.id)));

    // Second run is a clean no-op.
    const again = await migrateYeSchemaToPublic(prisma);
    expect(again).toMatchObject({ skipped: true });
  });

  it('aborts without touching anything when a table has rows on BOTH sides', async () => {
    await createOldYeSchema();
    await truncatePublicCounterparts();
    // Conflicting row on the public side.
    await prisma.program.create({
      data: {
        slug: 'conflict', kitCode: 'KIT-09', nameEn: 'C', nameAr: 'ت',
        ageMin: 4, ageMax: 6, format: 'online', color: '#444444', level: 1,
        taglineEn: 't', taglineAr: 'ت', descEn: 'd', descAr: 'د',
        buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
      },
    });

    const counterBefore = await prisma.campaignCounter.findUniqueOrThrow({ where: { key: 'watan-bricks' } });

    const res = await migrateYeSchemaToPublic(prisma);
    expect(res).toMatchObject({ aborted: true });
    if ('conflicts' in res) expect(res.conflicts).toContain('ye_programs');

    // Old data untouched, ye schema still present.
    const yeRows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM ye.ye_programs`,
    );
    expect(Number(yeRows[0].n)).toBe(2);
    // Public side untouched (only the conflict row), shared table untouched.
    expect(await prisma.program.count()).toBe(1);
    const counterAfter = await prisma.campaignCounter.findUniqueOrThrow({ where: { key: 'watan-bricks' } });
    expect(counterAfter.count).toBe(counterBefore.count);
  });
});
