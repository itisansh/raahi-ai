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
