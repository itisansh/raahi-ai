---
title: "Operations"
---

# Operations

## Local development

Use Node 24, pnpm 10.28.1 and a MongoDB replica set or Atlas database.

```bash
make setup   # install dependencies and create .env only if absent
make dev     # web + Express API; no Docker or SQL startup
```

Set `MONGO_URI`, `BETTER_AUTH_SECRET`, `BASE_URL` and storage settings privately
in the root `.env`. Node initializes required Mongo indexes before listening.
No SQL seed/reset is needed. The default web URL is `http://localhost:5170`;
Vite proxies `/api` to the API at `http://localhost:8780`.

`make dev-api`, `make dev-web` and `make dev-docs` start individual applications.
`make dev-nodb` remains an alias for web + API; Mongo is still required.

## Verification

`pnpm check` runs typechecking, lint, tests, UI checks and builds.
`pnpm docs:check` checks documentation. Mongo integration tests use disposable
replica sets and do not reset your configured database. Retained SQL tooling
requires Prisma client generation for whole-repository checks, but does not
require a running PostgreSQL server: `pnpm db:generate` generates code only.

## Configuration

See [the environment example](../../.env.example) for the current Node/Mongo
settings, grouped by app/database, auth, storage, AI, voice and travel providers.
Optional features and deployment settings are commented out until needed. Keep
one assignment per key in the private `.env`; remove retired WeChat and Worker
settings. Supply legacy SQL variables separately only when running retained SQL
utilities. `GEOAPIFY_API_KEY` is required with `GEO_PROVIDER=geoapify`; the adapter provides
places, medical search, geocoding and road routing.
Node uses `MONGO_URI`; `DATABASE_URL` and Prisma `db:*` commands are legacy SQL
utilities, not Mongo setup commands. `STORAGE_BACKEND=fs` requires `STORAGE_ROOT`;
S3-compatible storage is also supported. Secrets must stay out of Git and public
frontend variables. `TRUST_PROXY_CIDRS` must contain only verified proxy ranges.

## Deployment and recovery

Use the [Render guide](../../deploy/render/README.md) and its free-service
Blueprint. The app serves web and API from one origin. External S3-compatible
storage is required because free services cannot attach a persistent disk.
Cloudflare deployment scripts, Worker runtime adapters, Turnstile and Docker
configuration have been removed. Auth retains email verification and rate limits.
Historical design records describe previous implementations, not current setup.

Mongo backups and upload backups must be verified before a future production
release. A code checkout does not roll back database writes.

For structured logging and tracing, see [observability](observability.md).


## Private-project branding and development cleanup

The application and workspace packages are named Raahi AI / `@raahi/*`.
`pnpm-lock.yaml` is required dependency metadata, not a log. Regenerate it with
pnpm when package names change; do not delete it. `.agents/skills/` and
`skills-lock.json` are coding-assistant development resources, not app runtime
files. Redundant `CLAUDE.md` and `.claude` symlinks and the retired WeChat MCP
entry were removed; the optional Sentry MCP configuration remains.

Browser keys now use `raahi.*`. Reads migrate existing theme, onboarding,
per-user journal and saved-place values without overwriting new values or
removing the old copy. Authentication cookies, database contents and private
`.env` values are unchanged. Cached clients can still send `x-opentrip-lang`;
current clients send `x-raahi-lang`. The retained native OAuth bridge still uses
`opentrip://auth/callback` to avoid breaking previously installed native clients;
the current web/PWA product does not use this callback scheme.

Telemetry now uses `raahi.*` spans and attributes; update external saved queries
when deploying this change. Any manually configured Render start command must
use `corepack pnpm --filter @raahi/api start` (the committed blueprint is updated).

Historical audit/build records retain the names and commands actually used.
[Third-party notices](../../THIRD_PARTY_NOTICES.md) and the original upstream
license remain separate from the [private-project licensing statement](../../PROJECT_LICENSE.md).
This cleanup does not change remote repository visibility or deploy the app.
