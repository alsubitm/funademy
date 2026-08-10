/**
 * One-time legacy-schema cutover: moves all rows from the old dedicated
 * "ye" Postgres schema into the Prisma-managed **public** schema.
 *
 * Background (Aug 2026): Replit's publish schema-diff engine only manages the
 * `public` schema, so while Prisma models lived in a separate `ye` schema,
 * production silently drifted behind dev. All models were moved to `public`
 * (keeping the `ye_` table-name prefix); this migration carries the DATA of an
 * already-deployed database across that boundary, exactly once, at boot:
 *
 *   1. Skip instantly when no `ye` schema tables exist (the normal case).
 *   2. Take a transaction-scoped advisory lock (safe with multiple replicas).
 *   3. Ensure every target table/enum exists in `public` by replaying the
 *      build-time DDL snapshot `prisma/schema.sql`, skipping objects that
 *      already exist (the publish diff usually created them already).
 *   4. Copy rows table-by-table in foreign-key dependency order. Only the
 *      column intersection is copied (old tables may lack newer columns);
 *      enum columns are cast via text to the public enum type.
 *   5. Fix sequences, verify row counts, then DROP SCHEMA ye CASCADE.
 *
 * Safety rails — the transaction ABORTS (rolling everything back, old data
 * untouched) when:
 *   - a table has rows on BOTH sides (ambiguous — a human must decide), or
 *   - a `ye` table with rows has no counterpart in the current Prisma schema
 *     (dropping it would silently destroy data), or
 *   - a post-copy row-count check fails.
 */
import type { Prisma, PrismaClient } from '@prisma/client';

const LOG = '[legacy-schema-migration]';
/** App-unique advisory lock key for the cutover (any constant bigint). */
const LOCK_KEY = '779420260810';

export type MigrationResult =
  | { skipped: true; reason: string }
  | { aborted: true; conflicts: string[]; orphansWithRows: string[] }
  | { skipped: false; copied: Record<string, number>; ddlCreated: number; droppedEmptyOrphans: string[] };

type Tx = Prisma.TransactionClient;

class CutoverAbort extends Error {
  constructor(
    public conflicts: string[],
    public orphansWithRows: string[],
  ) {
    super(
      `${LOG} aborted — conflicts (rows on both sides): [${conflicts.join(', ')}]; ` +
        `orphans with rows (in "ye" but not in the current Prisma schema): [${orphansWithRows.join(', ')}]. ` +
        `Nothing was changed. Resolve manually, then restart.`,
    );
  }
}

/**
 * SQLSTATEs for "object already exists":
 * 42P07 duplicate table/index · 42710 duplicate object (type/constraint) ·
 * 42701 duplicate column · 42P06 duplicate schema
 */
const DUPLICATE_SQLSTATES = new Set(['42P07', '42710', '42701', '42P06']);

/**
 * True when the error is Postgres telling us the object already exists.
 * Prisma surfaces the SQLSTATE in `meta.code` (P2010 raw-query wrapper);
 * driver-level errors may carry it directly on `code`. A message match is
 * kept as a last resort for wrappers that drop the code entirely.
 */
function isDuplicateObjectError(e: unknown): boolean {
  const err = e as { code?: unknown; meta?: { code?: unknown; message?: unknown }; message?: unknown };
  for (const c of [err?.meta?.code, err?.code]) {
    if (typeof c === 'string' && DUPLICATE_SQLSTATES.has(c)) return true;
  }
  const msg = [err?.meta?.message, err?.message].filter((m): m is string => typeof m === 'string').join(' ');
  return /already exists/i.test(msg);
}

/** Replay prisma/schema.sql, skipping already-existing objects. */
async function ensureTargetObjects(tx: Tx): Promise<number> {
  // Lazy node imports with webpackIgnore: this module is reached from Next.js
  // instrumentation, which webpack also bundles for non-node targets — any
  // statically analyzable fs import breaks that compile. The ignored dynamic
  // import is resolved natively by Node at runtime (register() is guarded to
  // the nodejs runtime, so it never actually runs elsewhere).
  const { existsSync, readFileSync } = await import(/* webpackIgnore: true */ 'node:fs');
  const { join } = await import(/* webpackIgnore: true */ 'node:path');
  const sqlPath = join(process.cwd(), 'prisma', 'schema.sql');
  if (!existsSync(sqlPath)) {
    throw new Error(`${LOG} prisma/schema.sql not found (cwd=${process.cwd()}) — regenerate with "pnpm run db:schema-sql"`);
  }
  const statements = readFileSync(sqlPath, 'utf8')
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
  let created = 0;
  for (const stmt of statements) {
    await tx.$executeRawUnsafe('SAVEPOINT ddl_stmt');
    try {
      await tx.$executeRawUnsafe(stmt);
      created++;
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT ddl_stmt');
    } catch (e) {
      if (!isDuplicateObjectError(e)) throw e;
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ddl_stmt');
    }
  }
  return created;
}

async function tableNames(tx: Tx, schema: string): Promise<string[]> {
  const rows = await tx.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = '${schema}' ORDER BY tablename`,
  );
  return rows.map((r) => r.tablename);
}

async function rowCount(tx: Tx, schema: string, table: string): Promise<number> {
  const rows = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM "${schema}"."${table}"`);
  return Number(rows[0].n);
}

/** Parents-first topological order of `tables` using public-schema FKs. */
async function topoOrder(tx: Tx, tables: string[]): Promise<string[]> {
  const inSet = new Set(tables);
  const fks = await tx.$queryRawUnsafe<{ child: string; parent: string }[]>(`
    SELECT src.relname AS child, tgt.relname AS parent
    FROM pg_constraint c
    JOIN pg_class src ON src.oid = c.conrelid
    JOIN pg_class tgt ON tgt.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = src.relnamespace
    JOIN pg_namespace tn ON tn.oid = tgt.relnamespace
    WHERE c.contype = 'f' AND n.nspname = 'public' AND tn.nspname = 'public'
  `);
  const deps = new Map<string, Set<string>>(tables.map((t) => [t, new Set<string>()]));
  for (const { child, parent } of fks) {
    if (child !== parent && inSet.has(child) && inSet.has(parent)) deps.get(child)!.add(parent);
  }
  const order: string[] = [];
  const done = new Set<string>();
  while (order.length < tables.length) {
    const ready = tables.filter((t) => !done.has(t) && [...deps.get(t)!].every((p) => done.has(p)));
    if (ready.length === 0) {
      throw new Error(`${LOG} FK cycle among tables: ${tables.filter((t) => !done.has(t)).join(', ')}`);
    }
    for (const t of ready) {
      order.push(t);
      done.add(t);
    }
  }
  return order;
}

type Col = { column_name: string; data_type: string; udt_schema: string; udt_name: string; column_default: string | null };

async function columns(tx: Tx, schema: string, table: string): Promise<Col[]> {
  return tx.$queryRawUnsafe<Col[]>(
    `SELECT column_name, data_type, udt_schema, udt_name, column_default
     FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${table}'`,
  );
}

async function copyTable(tx: Tx, table: string): Promise<number> {
  const src = await columns(tx, 'ye', table);
  const tgt = await columns(tx, 'public', table);
  const srcNames = new Set(src.map((c) => c.column_name));
  const shared = tgt.filter((c) => srcNames.has(c.column_name));
  if (shared.length === 0) throw new Error(`${LOG} no shared columns for table ${table}`);

  const colList = shared.map((c) => `"${c.column_name}"`).join(', ');
  const exprList = shared
    .map((c) =>
      c.data_type === 'USER-DEFINED'
        ? `"${c.column_name}"::text::"${c.udt_schema}"."${c.udt_name}"`
        : `"${c.column_name}"`,
    )
    .join(', ');
  await tx.$executeRawUnsafe(`INSERT INTO "public"."${table}" (${colList}) SELECT ${exprList} FROM "ye"."${table}"`);

  const srcN = await rowCount(tx, 'ye', table);
  const tgtN = await rowCount(tx, 'public', table);
  if (srcN !== tgtN) throw new Error(`${LOG} row-count mismatch for ${table}: ye=${srcN} public=${tgtN}`);

  // Bump sequences past the copied ids.
  for (const c of tgt) {
    if (c.column_default?.startsWith('nextval(') && srcNames.has(c.column_name) && tgtN > 0) {
      await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('public.${table}', '${c.column_name}'),
                       (SELECT MAX("${c.column_name}") FROM "public"."${table}"))`,
      );
    }
  }
  return tgtN;
}

/** Cheap probe: does this database still hold tables in the legacy "ye" schema? */
export async function hasLegacyYeSchema(prisma: PrismaClient): Promise<boolean> {
  const quick = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint AS n FROM pg_tables WHERE schemaname = 'ye'`,
  );
  return Number(quick[0].n) > 0;
}

/**
 * Runs the cutover. Idempotent and concurrency-safe; returns a summary.
 * Never partially applies: any failure rolls the whole transaction back.
 */
export async function migrateYeSchemaToPublic(prisma: PrismaClient): Promise<MigrationResult> {
  if (!(await hasLegacyYeSchema(prisma))) {
    return { skipped: true, reason: 'no "ye" schema tables — already migrated' };
  }

  console.log(`${LOG} legacy "ye" schema detected — starting one-time cutover to public`);
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY})`);

        // Re-check inside the lock — another replica may have just finished.
        const yeTables = await tableNames(tx, 'ye');
        if (yeTables.length === 0) return { skipped: true as const, reason: 'another process completed the cutover' };

        const ddlCreated = await ensureTargetObjects(tx);
        const publicTables = new Set(await tableNames(tx, 'public'));

        const yeCounts = new Map<string, number>();
        for (const t of yeTables) yeCounts.set(t, await rowCount(tx, 'ye', t));

        const conflicts: string[] = [];
        const orphansWithRows: string[] = [];
        const emptyOrphans: string[] = [];
        const copySet: string[] = [];
        for (const t of yeTables) {
          const srcN = yeCounts.get(t)!;
          if (!publicTables.has(t)) {
            (srcN > 0 ? orphansWithRows : emptyOrphans).push(t);
          } else if (srcN === 0) {
            // nothing to copy
          } else if ((await rowCount(tx, 'public', t)) > 0) {
            conflicts.push(t);
          } else {
            copySet.push(t);
          }
        }
        if (conflicts.length > 0 || orphansWithRows.length > 0) throw new CutoverAbort(conflicts, orphansWithRows);

        const copied: Record<string, number> = {};
        for (const t of await topoOrder(tx, copySet)) {
          copied[t] = await copyTable(tx, t);
          console.log(`${LOG} copied ye.${t} → public.${t} (${copied[t]} rows)`);
        }

        await tx.$executeRawUnsafe('DROP SCHEMA ye CASCADE');
        console.log(
          `${LOG} DONE — ${Object.keys(copied).length} tables copied, "ye" schema dropped` +
            (emptyOrphans.length ? `, empty orphans dropped: [${emptyOrphans.join(', ')}]` : ''),
        );
        return { skipped: false as const, copied, ddlCreated, droppedEmptyOrphans: emptyOrphans };
      },
      { timeout: 180_000, maxWait: 30_000 },
    );
  } catch (e) {
    if (e instanceof CutoverAbort) {
      console.error(e.message);
      return { aborted: true, conflicts: e.conflicts, orphansWithRows: e.orphansWithRows };
    }
    throw e;
  }
}
