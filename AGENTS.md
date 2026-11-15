# Raahi AI — Agentic Coding Guidelines

> Travel Planner SaaS. Read this file first, then follow the documentation map
> below before writing any code. Template inspired by
> [`stvlynn/agentic-coding`](https://github.com/stvlynn/agentic-coding).

---

## Project identity and privacy

Raahi AI is a private project, not an open-source product. Use Raahi AI in
product copy and `@raahi/*` for workspace packages. Do not add upstream-brand
marketing or public contribution links. Preserve third-party licenses and
provenance in `THIRD_PARTY_NOTICES.md` and historical audit records. Legacy
storage/header/native-callback identifiers are compatibility contracts, not
branding; do not remove them without a migration. See `PROJECT_LICENSE.md`.

## Before you start

1. **Read the docs first.** Conventions are documented so agents do not guess.
2. **Ask when boundaries are unclear.** If a requirement, layer boundary, or
   technology choice is ambiguous, ask before proceeding.
3. **Check logs and docs before inventing workarounds.** Do not add fallback
   logic to bypass a problem you have not understood.

---

## Tech stack

- Monorepo: `pnpm` workspaces, TypeScript strict everywhere.
- Frontend: React + TypeScript + Vite, Feature-Sliced Design (FSD v2.1).
- Mobile: React browser app / PWA (WeChat client retired during I0).
- UI: cossUI primitives (Base UI + CVA style), cossUI design tokens.
- Map: mapcn-style MapLibre GL wrapper.
- Backend: Express 5 on Node; Worker transport removed.
  TypeScript, Domain-Driven Design + Hexagonal architecture.
- Database: MongoDB/Mongoose on Node; SQL retained for Worker and migration tooling.
- Auth: Better Auth (email + password).
- Deploy: native Node on Render free demo with external S3 storage. Cloudflare and Docker setup removed.

---

## Documentation map

### Understand the project

- [`docs/README.md`](docs/README.md) — top-level index.
- [`docs/project/README.md`](docs/project/README.md) — product overview.
- [`docs/project/architecture.md`](docs/project/architecture.md) — architecture.
- [`docs/project/handoff-implementation.md`](docs/project/handoff-implementation.md) — prototype-to-product mapping.

### Frontend (FSD)

- [`docs/frontend/README.md`](docs/frontend/README.md)
- [`docs/frontend/layers.md`](docs/frontend/layers.md)
- [`docs/frontend/ui-system.md`](docs/frontend/ui-system.md)
- [`docs/frontend/map.md`](docs/frontend/map.md)
- [`docs/frontend/data-caching.md`](docs/frontend/data-caching.md) — React Query
  write-echo (Hyperdrive read-after-write)
- [`docs/frontend/data-caching.md`](docs/frontend/data-caching.md) — React Query
  write-echo (Hyperdrive read-after-write)

### Backend (DDD)

- [`docs/backend/README.md`](docs/backend/README.md)
- [`docs/backend/domain.md`](docs/backend/domain.md)
- [`docs/backend/api/README.md`](docs/backend/api/README.md) — client HTTP contract
- [`docs/backend/database.md`](docs/backend/database.md)
- [`docs/backend/auth.md`](docs/backend/auth.md)
- [`docs/backend/agent.md`](docs/backend/agent.md)
- [`docs/backend/trip-ops.md`](docs/backend/trip-ops.md) — trip mutation registry
- [`docs/backend/weather.md`](docs/backend/weather.md) — weather proxy and cache
- [`docs/backend/cover.md`](docs/backend/cover.md) — Unsplash trip cover on create
- [`docs/backend/fx.md`](docs/backend/fx.md) — FX rates proxy for settle-up conversion
- [`docs/backend/geo.md`](docs/backend/geo.md) — geo places/routes and agent tools
- [`docs/backend/lodging.md`](docs/backend/lodging.md) — Airbnb lodging search and agent tools

### Operations and quality

- [`docs/operations/README.md`](docs/operations/README.md)
- [`docs/quality/README.md`](docs/quality/README.md)
- [`docs/decisions/README.md`](docs/decisions/README.md)

### Reference sources

- [`docs/reference/README.md`](docs/reference/README.md)

---

## Language and quality rules

- **English only** for code, comments, identifiers, and commit messages.
- **No hardcoded user-facing strings** scattered across components — centralize
  copy in a single place per surface and reference by identifier.
- **No redundant UI copy** — do not repeat what a title, icon, or state conveys.
- **No duplicated implementations** — reuse or extract to the right layer.
- **No fallback/clever bypass logic** — face the root cause or ask.
- **No environment-specific config in git.** Production endpoints, bucket names,
  API keys and credentials belong only in private environment configuration or
  Render environment settings. Commit variable names and placeholders only.
  The root `.env` stays ignored. Never put private keys in `VITE_*` variables.

---

## Frontend: Feature-Sliced Design

- Imports go only downward: `app` -> `pages` -> `widgets` -> `features` ->
  `entities` -> `shared`.
- Pages First: keep page-specific logic in the page until reuse emerges.
- Each slice exposes a public API via `index.ts`; never import slice internals.

See [`docs/frontend/README.md`](docs/frontend/README.md).

## Backend: Domain-Driven Design

- Dependencies point inward: `interfaces` -> `services` -> `domain`;
  `repositories` and `integrations` implement inward-facing ports.
- `config` assembles dependencies and parses environment configuration.
- Keep controllers thin: parse input, call a use case, format output.

See [`docs/backend/README.md`](docs/backend/README.md).

## Database: MongoDB on Node

- The Node runtime requires `MONGO_URI`; never require restarting PostgreSQL to
  develop or test Mongo persistence.
- Business schemas/indexes live in `apps/api/src/models/mongo.ts`. Version Mongo
  schema/index/data changes under `apps/api/src/config/migrations/`.
- Use replica-set transactions and preserve public IDs, revisions, idempotency,
  exact expense conversions and existing service permission checks.
- Better Auth owns its auth collections through its pinned Mongo adapter.
- Run the disposable Mongo integration tests; never reset a supplied database.
- Prisma rules below apply only to retained SQL artifacts. Mongo changes do not
  require regenerating a SQL schema from an unavailable database.

## Database: retained SQL / Prisma

- **Every database schema change must ship its snapshot.** `apps/api/prisma/schema.prisma`
  is the committed snapshot of the database structure. If a change touches the
  schema, the same change set must include an updated `schema.prisma` produced by
  command — never by hand.
- **Never edit `schema.prisma` by hand.** Always regenerate it from the live
  database with `make db-pull` (alias `make db-snapshot`). If you used
  `make db-migrate-dev` to create a migration, run `make db-pull && make db-generate`
  afterwards and commit both the migration directory and the updated snapshot.
- **Never hand-write migrations.** Create migration files with
  `pnpm --filter @raahi/api db:migrate-dev` (or `make db-migrate-dev`).
- **Generate the client after every schema change.** Run `make db-generate`
  (equivalent to `pnpm --filter @raahi/api db:generate`) after pulling or
  migrating.
- **Configuration lives in `apps/api/prisma.config.ts`.** It points to the
  schema, migrations directory, and seed command; `DATABASE_URL` is loaded from
  the root `.env` loaded from `prisma.config.ts` (and `tsx --env-file-if-exists`
  for reset/seed scripts).
- **SQL backend is env-selected.** `DATABASE_PROVIDER=postgres|mysql` (or
  inferred from `DATABASE_URL`). Runtime code uses `SqlClient`
  (`repositories/sql`); Postgres remains the Prisma Migrate source
  of truth, MySQL uses `prisma/mysql/schema.sql`.
- **Seed via `prisma/seed.ts`.** Run `make db-seed` or
  `pnpm --filter @raahi/api db:seed`.
- **Reset via `make db-reset`.** Drops the `public` schema, reapplies Prisma
  migrations, and re-seeds.

Legacy plain-SQL migrations remain in `apps/api/migrations/` for historical
reference; new schema changes go through Prisma Migrate.

See [`docs/backend/database.md`](docs/backend/database.md).

---

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org/):
`<type>(<scope>): <subject>` — e.g. `feat(budget): add settlement use case`.

---

## Self-evolution rule

After completing a task, update the relevant docs in the same change set when
product behavior, architecture, configuration, or conventions change.

## Raahi AI Development

This repository is being extended into Raahi AI.

Read these documents before implementation:

- RAAHI_PLAN.md
- BUILD_PROGRESS.md
- docs/raahi/RAAHI_AI_BUILD_v1.2.md
- docs/raahi/RAAHI_AI_REPOSITORY_AUDIT_AND_VOICE_PLAN.md
- docs/raahi/RAAHI_AGENT_RULES.md
- docs/raahi/RAAHI_API_ACCOUNTS_AND_KEYS.md

Preserve the existing Raahi AI architecture.
Implement one phase at a time.
Voice-first trip planning is the highest priority.
Run tests and update BUILD_PROGRESS.md after each phase.
## India-wide product scope

Raahi supports trip planning across India. Uttarakhand and the North India seed
trip are examples, not destination restrictions. Use varied Indian regions in
public copy and examples. Do not reintroduce inherited destination screenshots
or present a regional emergency number as nationwide. Keep supported currency
semantics and historical user data intact when changing product examples.
