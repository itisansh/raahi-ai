# M6 local migration cleanup

The user explicitly requested local M6 cleanup before deployment, overriding
the original M5 hosted-acceptance ordering. Render deployment remains deferred.
This is local cleanup, not a completed production cutover.

## Checkpoint

Before editing, created commit `9ab6726` (`chore: checkpoint Raahi implementation
before M6 cleanup`). It contains the previous project work; `.env` and local
`.workspace` artifacts remain ignored. Nothing was pushed.

## Changes

- SQL composition and Hono transport now live under `apps/api/src/legacy/`.
  Node's shared service composition and route table no longer import them.
- SQL/Prisma drivers, Hono and Worker Sentry are development dependencies for
  retained tools/tests. Unused Hono server/Sentry adapters were removed.
- A runtime import-graph regression test prevents the Node entry from importing
  project SQL adapters, legacy entry points or Worker/Hono external packages.
  This checks application imports, not third-party dependency internals.
- The old deployment workflow is archived outside `.github/workflows`; root
  Cloudflare deployment commands are explicitly prefixed `legacy:`.
- `make setup`, `make dev` and `make dev-api` no longer start PostgreSQL, run SQL
  migrations or require Docker. SQL commands remain explicitly documented as
  legacy tools. Prisma schemas and historical migrations are unchanged.

## Recovery and remaining gates

For source comparison/recovery, use the checkpoint in a separate checkout or
worktree; preserve current changes first. Do not reset the supplied database.
The checkpoint is a code recovery point, not a database backup. No real
Mongo data, hosting settings or provider accounts were modified by this cleanup.

Before release, complete M5 hosted acceptance, verify backup/restore for Mongo
and uploads, and run the full deployed user journey. No production cutover or
hosted rollback rehearsal is claimed. The requested final controllers/routes/db
folder layout remains a separate later task, after product work.

## Verification

The Node import-boundary regression passes. The full test run passes 410 API,
88 frontend and 15 shared-package tests. Documentation links, frozen lockfile
consistency and Make setup/API dry runs pass. The initial typecheck identified
legacy test imports that needed updating after moving the Worker entry; those
references were fixed before the successful test run. Logs are retained locally
under `.workspace/m6/`; hosted verification remains deferred.

Final full `pnpm check` completed with exit 0, including workspace typecheck,
lint, UI checks and all production builds. Local cleanup is complete; hosted
cutover and rollback acceptance remain deferred.
