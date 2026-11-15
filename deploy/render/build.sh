#!/usr/bin/env bash
set -euo pipefail

# BASE_URL is embedded into the frontend bundle at build time (__WETRAVEL_BASE_URL__).
# Deploying with a localhost value means the browser will call localhost instead of
# the live service. Fail fast so this is never silently deployed.
if [[ "${BASE_URL:-}" =~ ^https?://localhost ]]; then
  echo "ERROR: BASE_URL is set to a localhost address (${BASE_URL})." >&2
  echo "       Set BASE_URL to the production HTTPS origin in the Render environment before building." >&2
  exit 1
fi
if [[ -z "${BASE_URL:-}" ]]; then
  echo "ERROR: BASE_URL is not set. Set it to the production HTTPS origin (e.g. https://raahi.onrender.com)." >&2
  exit 1
fi

corepack enable
corepack pnpm install --frozen-lockfile --prod=false
corepack pnpm --filter @opentrip/api exec tsc --project tsconfig.node.json
corepack pnpm --filter @opentrip/web build
