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

exec pnpm exec prisma db push --skip-generate
