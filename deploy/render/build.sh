#!/usr/bin/env bash
set -euo pipefail
corepack enable
corepack pnpm install --frozen-lockfile --prod=false
corepack pnpm --filter @opentrip/api exec tsc --project tsconfig.node.json
corepack pnpm --filter @opentrip/web build
