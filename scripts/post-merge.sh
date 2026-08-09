#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/ye run db:push
