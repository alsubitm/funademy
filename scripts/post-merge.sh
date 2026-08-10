#!/bin/bash
set -e
pnpm install --frozen-lockfile
# One-time ye→public schema cutover (instant no-op once the "ye" schema is
# gone). Runs BEFORE the push so the dev DB is fully usable even if the
# guarded push below refuses.
pnpm --filter @workspace/ye run db:legacy-migrate
# Guarded push: refuses to drop any undeclared public table that holds rows.
pnpm --filter @workspace/ye run db:push
