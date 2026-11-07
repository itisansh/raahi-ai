# M0 baseline and MongoDB compatibility

Status: **DONE for M0 feasibility scope**, 2026-11-03. Runtime migration is not
complete. I0 and M1–M6 have not started. Product phases retain their existing
partial states and browser/provider acceptance gaps.

## Recovery baseline

Branch `dev/raahi`, HEAD `253ff744c3022d4deea1ce0de0aaab585c120512`.
Before edits, 1,090 tracked and nonignored files were archived to
`.workspace/m0/source-baseline.tar.gz`, including earlier uncommitted source.
Every archived file was read back and compared with its SHA-256 in
`source-sha256.json`. `status.txt` records pre-existing changes/deletions;
`tracked.patch` preserves the tracked diff against HEAD. Artifacts are local,
ignored and not uploaded. HEAD alone cannot recover the current implementation.

To recover, extract the archive into a **new empty directory**, compare files
against the hash manifest, then inspect before replacing anything. This is a
source snapshot, not a database or `.git` backup. Ignored `.env`, uploads,
dependencies and build outputs are excluded and remain untouched. Retain the
archive until migration acceptance; M4/M6 require separate data backups.

## Contract and data inventory

[Generated manifest](M0_ROUTE_DATA_MANIFEST.json) contains 62 method/path entries,
including delegated Better Auth GET/POST handlers and Worker-only realtime,
all 23 Prisma models, and historical Prisma migration statements. Regenerate
with `node scripts/migration-m0/manifest.mjs` from the repository root.
It is a source inventory, not live introspection or a list of every auth plugin
endpoint. Migration statements retain constraints omitted by Prisma introspection.

M1 must preserve role checks, CORS credentials/origins, private/no-store defaults,
request IDs, error envelopes, body/upload limits, redirects/cookies, streaming
audio/agent responses, disconnect cancellation and deferred persistence. Mount
auth before body parsing. M5 must replace Worker realtime/rate-limit/cache wiring.

M3/M4 must preserve every source ID, ordering, default, relation and index. Map
participant rows into bounded expense arrays; retain the other collections as
specified in the migration plan. Preserve agent sequence ordering without unsafe
BigInt conversion. Convert expense decimal rupees exactly; allocations and
reservation minor-unit amounts must not be multiplied again. Implement referential
checks/deletion behavior explicitly. Complete conversion/import tools belong to M4.

## Compatibility evidence

The isolated [spike](../../scripts/migration-m0/README.md) pins Better Auth
1.6.23 (matching the application), Mongoose 9.11.4 and mongodb-memory-server
11.3.0. MongoDB 8.2.1 ran as a real disposable local replica set. Nine checks passed:

1. Replica-set connection through Mongoose.
2. Imported synthetic string user/account IDs, unchanged password hash and cookie login.
3. Imported synthetic session token through bearer authentication.
4. Incorrect password rejection.
5. String-ID signup, OTP verification and unverified-login rejection.
6. Session revocation.
7. Better Auth transaction rollback using the Mongoose-owned native client.
8. Rollback across trip revision and expense collections.
9. One concurrent revision winner, stale-write rejection, unique retry key,
   integer minor-unit money and preserved auth-to-business references.

The future auth configuration should use
`advanced.database.generateId: () => crypto.randomUUID()`: the pinned adapter
preserves string IDs/references with a custom generator. Its default ObjectId
coercion is unsuitable for arbitrary legacy IDs. Auth collections remain owned
by Better Auth, not competing Mongoose models. The synthetic import renames
`id` to `_id` without changing hashes or linked user IDs.

Passing `connection.db` and `connection.getClient()` to
`mongodbAdapter(db, { client })` passed the spike. Its lockfile resolves the
adapter's Mongo driver to 7.5.0 and Mongoose's to 7.7.0; the tested paths work
across that combination. Recheck the actual application dependency graph and
TypeScript compatibility in M3. One Mongoose connection owns client shutdown.

The pinned 1.6.23 auth adapter explicitly starts/commits/aborts transactions but
does **not** implement retries described by current online docs. Mongoose's
transaction helper retries transient conflicts; the spike verifies the original
expected revision still rejects stale writes. Keep external side effects outside
retryable transaction callbacks and operations sequential within each session.

These are synthetic source-shaped rows, not real SQL account exports. Full plugin
flows, TOTP/OAuth, existing signed browser cookies, provisioning/profile hooks,
real data reconciliation and TypeScript integration remain M3/M4 gates. Preserve
the actual auth secret at cutover; this spike does not authorize forced re-login.

## Checks and limitations

| Command | Result |
| --- | --- |
| `BASE_URL=http://localhost:8780 pnpm check` | PASS: workspace typecheck, lint, tests, UI check and all builds, including docs/miniapp/API/web |
| `node scripts/migration-m0/manifest.mjs` | PASS: 62 routes, 23 models and migration SQL |
| `MONGOMS_DOWNLOAD_DIR=/tmp/raahi-m0-mongodb node scripts/migration-m0/compatibility.mjs` | PASS: nine checks; approved execution after sandbox denied local bind |
| `node --env-file=.env --import tsx apps/api/scripts/verify-trip-integrity.ts` | UNVERIFIED: sandbox EPERM, approved retry ECONNREFUSED; old PostgreSQL was not running |
| `node scripts/docs-check.mjs` | PASS |

The user explicitly directed MongoDB/Mongoose work and declined restarting
PostgreSQL. Do not require SQL startup to continue. Its failed connection is an
understood baseline limitation; earlier SQL checks remain historical evidence.
No browser/provider/deployment or real-data import success is claimed. Logs are
local under `.workspace/m0/`. Initial spike package-version lookup was corrected
to read package metadata from disk because Better Auth does not export it.

The user will supply **`MONGO_URI`** in the ignored root `.env`. Use a dedicated
development Atlas database or another transaction-capable replica set. Runtime
does not consume this key yet; wiring is M3 work. Never print or commit the URI.
The disposable spike must not load it: it manages only its own temporary server.

Next module: I0 India cleanup, then the ordered migration modules. The running
product has not yet switched from Hono/SQL.

## References

- [Better Auth Mongo adapter](https://better-auth.com/docs/adapters/mongo),
  compared with installed 1.6.23 source rather than assuming latest APIs.
- [Mongoose transactions](https://mongoosejs.com/docs/transactions.html),
  including sequential operations within a transaction.
