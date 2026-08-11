#!/usr/bin/env bash
# Fail-closed wrapper around `prisma db push`.
#
# Prisma owns the whole `public` schema in this project: a plain `db push`
# DROPS every public table that is not declared in prisma/schema.prisma.
# This wrapper refuses to push while any undeclared public table still holds
# rows, so data can never be dropped silently — either declare the table as a
# Prisma model (like CampaignCounter / CampaignBrickEvent) or delete it
# deliberately, then rerun. Empty undeclared tables are listed as a warning
# and left to the push to drop. Bypass (emergencies only): pnpm run db:push:unsafe
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?DATABASE_URL must be set}"

declared=$(pnpm exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script |
  sed -nE 's/^CREATE TABLE (IF NOT EXISTS )?("public"\.)?"([A-Za-z0-9_]+)".*/\3/p' | sort -u)
if [ -z "$declared" ]; then
  echo "guarded-db-push: could not derive the declared table set from schema.prisma — refusing to push." >&2
  exit 1
fi

existing=$(psql "$DATABASE_URL" -tAc "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")

blockers=()
droppable=()
for t in $existing; do
  if ! grep -qx "$t" <<<"$declared"; then
    has_rows=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT 1 FROM public.\"$t\" LIMIT 1)")
    if [ "$has_rows" = "t" ]; then blockers+=("$t"); else droppable+=("$t"); fi
  fi
done

if [ ${#droppable[@]} -gt 0 ]; then
  echo "guarded-db-push: WARNING — undeclared but EMPTY public tables will be dropped by the push: ${droppable[*]}"
fi
if [ ${#blockers[@]} -gt 0 ]; then
  echo "guarded-db-push: REFUSING to push — undeclared public tables still hold rows:" >&2
  for t in "${blockers[@]}"; do echo "  - public.$t" >&2; done
  echo "Declare them as Prisma models (so push preserves them) or delete them deliberately, then rerun." >&2
  exit 1
fi

# Push. Prisma exits non-zero on ANY "possible data loss" warning unless
# --accept-data-loss is passed. Most such warnings are real (dropped columns/
# tables) and must stay fatal — but "unique constraint will be added" is safe
# when the table currently holds no duplicate non-null values for those
# columns (a brand-new column trivially qualifies), and task merges add such
# columns routinely. Verify and auto-accept ONLY that case.
set +e
out=$(pnpm exec prisma db push --skip-generate 2>&1)
code=$?
set -e
printf '%s\n' "$out"
if [ $code -eq 0 ]; then
  exit 0
fi
if ! grep -q -- '--accept-data-loss' <<<"$out"; then
  exit $code # failed for an unrelated reason (connectivity, schema error, …)
fi
mapfile -t warns < <(grep -E '^[[:space:]]*•' <<<"$out")
if [ ${#warns[@]} -eq 0 ]; then
  exit $code
fi
for w in "${warns[@]}"; do
  parsed=$(sed -nE 's/^[[:space:]]*• A unique constraint covering the columns .\[([^]]+)\]. on the table .([A-Za-z0-9_]+). will be added.*/\1|\2/p' <<<"$w")
  if [ -z "$parsed" ]; then
    echo "guarded-db-push: REFUSING — data-loss warning is not a verifiable-safe unique-constraint addition:" >&2
    echo "  $w" >&2
    echo "Review it deliberately; bypass only via pnpm run db:push:unsafe." >&2
    exit 1
  fi
  cols="${parsed%%|*}"
  tbl="${parsed##*|}"
  collist=""
  notnull=""
  IFS=',' read -ra carr <<<"$cols"
  for c in "${carr[@]}"; do
    c=$(echo "$c" | xargs)
    collist+="${collist:+, }\"$c\""
    notnull+="${notnull:+ AND }\"$c\" IS NOT NULL"
  done
  dup=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT 1 FROM public.\"$tbl\" WHERE $notnull GROUP BY $collist HAVING COUNT(*) > 1)" 2>&1) || true
  if grep -qi 'does not exist' <<<"$dup"; then
    continue # brand-new column/table — the constraint cannot conflict with anything
  fi
  if [ "$dup" != "f" ]; then
    echo "guarded-db-push: REFUSING — public.$tbl holds duplicate values in [$cols]; the unique constraint would fail or require data changes." >&2
    exit 1
  fi
done
echo "guarded-db-push: every data-loss warning is a verified-safe unique-constraint addition — re-running with --accept-data-loss."
exec pnpm exec prisma db push --skip-generate --accept-data-loss
