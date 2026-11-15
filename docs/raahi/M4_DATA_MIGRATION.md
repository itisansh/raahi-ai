# M4 migration tooling and fresh-start decision

Updated 2026-11-04. The user explicitly selected **start fresh; no existing data
to migrate**. A live SQL-to-Mongo transfer is therefore unnecessary for this
project. M4 includes optional offline rehearsal tools for future use. Hosted
Mongo setup and M5/M6 platform/cutover work remain separate.

## Delivered tooling

`apps/api/scripts/migrate-mongo.ts` supports `export`, `import`, `reconcile`, and
`restore-export`. It uses dedicated `MIGRATION_SOURCE_SQL_URL` and
`MIGRATION_TARGET_MONGO_URI` variables rather than implicitly using application
databases. No import, export, reset or seed has run against a user database.

The PostgreSQL exporter uses one connection and a repeatable-read, read-only
transaction. It checks all live public table/column names against the committed
Prisma snapshot and refuses unknown/missing fields. Decimal and bigint columns
are exported as strings; timestamps become ISO dates. Prisma bookkeeping is
archived alongside all 23 source tables. MySQL export is not implemented.

The versioned source-column manifest is generated from the unchanged Prisma
snapshot in `repositories/migration/source-schema.ts`; schema changes require a
new mapping version. Transformations validate the manifest and source shape,
preserve public IDs and auth hashes, map dates/JSON explicitly, and parse expense
money with decimal-string arithmetic. Custom shares become integer minor units;
reservation amounts already use minor units. Participants/allowlists are joined
into their owning records. Comment IDs determine stable internal IDs and source
creation time determines display order. Full original comment metadata remains
in the archived source snapshot. Auth users are inserted directly through the
adapter's collection conventions, so importing does not trigger signup/email or
sample-trip provisioning hooks.

The importer requires an empty target database. A unique import ownership record
fences the target before index initialization. All transformed records, restored
agent sequence counter and complete source archive commit together in one
transaction. A failure rolls back imported application data and leaves a visible
incomplete ownership record. Inspect the failure and use another fresh database;
the tool deliberately refuses to overwrite an incomplete or unrelated target.

This is an **offline rehearsal tool limited to 8 MiB of source JSON**. It does
not implement large-dataset batching/checkpoints or online migration. A completed
repeat import reconciles the existing result rather than overwriting it. The
target must remain offline with writes frozen: login/session creation and normal
application writes are expected to make later exact reconciliation fail.

Reconciliation compares every transformed document/field and collection count,
plus the agent sequence counter, rather than counts alone. The private source
archive includes source-only tables, metadata and migration history; restoring
that archive into another fresh Mongo database reproduces the trip snapshot.
This is source-export restoration, not a Mongo backup product or a post-cutover
reverse migration to SQL.

## Optional manual commands

For the chosen fresh start, set application `MONGO_URI` in ignored `.env` and use
normal Node startup. No migration command below is required.

If migration is needed later, put dedicated migration connection variables in an
ignored local environment and use a fresh **offline** destination database:

```sh
pnpm --filter @raahi/api exec tsx --env-file-if-exists=../../.env scripts/migrate-mongo.ts export ../../.workspace/private-source.json
pnpm --filter @raahi/api exec tsx --env-file-if-exists=../../.env scripts/migrate-mongo.ts import ../../.workspace/private-source.json
pnpm --filter @raahi/api exec tsx --env-file-if-exists=../../.env scripts/migrate-mongo.ts reconcile ../../.workspace/private-source.json
pnpm --filter @raahi/api exec tsx --env-file-if-exists=../../.env scripts/migrate-mongo.ts restore-export ../../.workspace/private-restored-source.json
```

Export files are created exclusively with mode 0600 and never overwrite an
existing file. They contain auth tokens, password hashes, encrypted 2FA material
and private trip data; keep them in ignored/private storage. The target archive
contains the same sensitive data and requires the same database access controls.
Keep the existing `BETTER_AUTH_SECRET` when migrating encrypted auth material.
Uploads live in external storage; these tools preserve stored URLs but do not
copy or verify external objects. A future real migration still needs upload
inventory, real source/export validation, staging browser journeys and a
post-write recovery plan before cutover.

## Verification

`test/mongo-migration.test.ts` uses a synthetic fixture covering all 23 tables and
real disposable MongoDB replica sets. It verifies exact money and precision
rejection, read-only SQL query orchestration, complete import, matching public
trip values, imported password login, repeat import, source archive restoration,
agent cursor continuation, malformed/orphan/occupied-source rejection, rollback
on a late unique-index failure, incomplete-target fencing, and tamper detection.
The SQL export transaction test uses a fake connection; no live PostgreSQL source
was started. Mongo import/login/restore tests use actual database operations.

Full workspace checks passed: 395 API tests at that run, 88 web tests, typecheck,
lint, UI checks and builds. The final focused suite passed all six tests; final
API and standalone CLI typechecking plus API lint also passed.

Test/build evidence is recorded in BUILD_PROGRESS section 38 and ignored logs in
`.workspace/m4/`. The fresh-start decision removes the need for a real-data
rehearsal for the current project; synthetic tests do not establish live source
or hosted database acceptance.


## M4 follow-up review

The follow-up review added proposal owner/context/result reference checks before
any target writes. Reconciliation now verifies the complete archived source and
its digest as well as application records. This catches corruption in source-only
metadata needed for restoration even when all runtime collections still match.
Repeat import also refuses a corrupt archive. Eight disposable integration tests
pass, including these two regression cases. The fresh-start decision remains in
force; this is optional migration tooling, not a live data transfer.
