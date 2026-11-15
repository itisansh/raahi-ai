#!/usr/bin/env bash
set -euo pipefail

# BASE_URL is embedded into the frontend bundle at build time (__WETRAVEL_BASE_URL__).
# Deploying with a localhost value means the browser will call localhost instead of
# the live service. Fail fast so this is never silently deployed.
node --input-type=module <<'NODE'
const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};
const value = process.env.BASE_URL ?? '';
let url;
try {
  url = new URL(value);
} catch {
  fail('BASE_URL must be the public HTTPS service origin.');
}
const hostname = url.hostname;
if (url.protocol !== 'https:' || value !== url.origin ||
    hostname === 'localhost' || hostname.endsWith('.localhost') ||
    hostname === '[::1]' || hostname === '0.0.0.0' || hostname.startsWith('127.')) {
  fail('BASE_URL must be a public HTTPS origin without a path, trailing slash, or credentials.');
}
const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? '').split(',').map(value => value.trim());
if (!trustedOrigins.includes(url.origin)) {
  fail('TRUSTED_ORIGINS must include the exact BASE_URL origin.');
}
NODE

corepack enable
corepack pnpm install --frozen-lockfile --prod=false
corepack pnpm --filter @opentrip/api exec tsc --project tsconfig.node.json
corepack pnpm --filter @opentrip/web build
