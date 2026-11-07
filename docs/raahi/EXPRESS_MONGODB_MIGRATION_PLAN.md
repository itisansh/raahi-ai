# Express + MongoDB migration module

Status: M0 feasibility completed 2026-11-03; I0 source cleanup implemented, acceptance partial.
See [M0 evidence and limitations](M0_BASELINE_AND_COMPATIBILITY.md).
See [I0 work and remaining gates](I0_INDIA_PRODUCT_PROGRESS.md).
The user requested M1 despite I0's open gates; [Express source work is implemented](M1_EXPRESS_TRANSPORT.md), with live acceptance still partial.
The user subsequently requested M2; [the backend folder map](M2_BACKEND_LAYOUT.md)
supersedes the source paths in the original audit below.
Originally requested as planning only; the user subsequently authorized M0.
The user explicitly selected Mongoose and subsequently
requested removal of WeChat and an India-specific product with no Japan-themed
content, images, default maps or Tokyo sample itineraries.

## Objective and precedence

Move Raahi AI from Hono and SQL to Express 5, MongoDB and Mongoose, with a
backend layout familiar from the user's music-platform project. Preserve
existing product behavior, data, API contracts and security. Keep strict
TypeScript and ESM; Express does not require changing `.ts` files to `.js`.

This is the user's requested future architecture and supersedes the older
roadmap's prohibition on MongoDB for this migration. Current runtime docs still
describe the working Hono/SQL implementation. M0 is now authorized; this document
alone is not permission to deploy, delete user data or cut over the running app.
Product phases 0–8 remain PARTIAL and phase 9 remains NOT STARTED.

No existing BUILD_MODULE file was found in this repository. This document is
the migration module, linked from the roadmap, agent rules and progress log.

Preserving behavior is an acceptance requirement, not a promise that a rewrite
cannot introduce bugs. Use sequential, independently tested stages and retain
a recoverable baseline. Existing uncommitted work must be included in that
baseline; a Git HEAD alone does not capture the current implementation.

## Audit: what must change

Paths below are relative to the repository root and were inspected during planning.

| Current source | Finding and migration work |
| --- | --- |
| `apps/api/src/interfaces/http/app.ts` | Large Hono app with auth, trips, invites, reservations, uploads, agent streaming, planning, budget, voice, medical and travel handlers. Extract resource routers/controllers; preserve every method/path and middleware behavior. |
| `apps/api/src/interfaces/http/{response,errors}.ts` | Hono context helpers. Replace with Express response/error middleware, preserving envelopes, statuses and error codes. |
| `apps/api/src/node-server.ts` | Uses `@hono/node-server` and Hono Sentry integration. Replace startup/instrumentation, add graceful HTTP/WebSocket/DB shutdown. |
| `apps/api/src/worker.ts` | Separate Workers entry, Hyperdrive, realtime upgrades, rate limits, caching and deferred cleanup. Replace these runtime responsibilities for Node before retiring this entry. |
| `apps/api/src/infrastructure/composition/container.ts` | Constructs SQL repositories and auth pools. Proposal, speech and budget services have PostgreSQL-specific gates. Replace composition with injected Mongo repositories; do not accidentally disable these features. |
| `apps/api/src/infrastructure/persistence/` | Trip, invite, agent, reservation, preference repositories plus proposal and budget stores use SQL. Rewrite all adapters, not just the connection file. |
| `apps/api/src/infrastructure/persistence/{proposal-store,budget-store,trip-repository}.db.ts` | Uses transactions and `FOR UPDATE`; approval can create a trip and record its result atomically. Translate guarantees into Mongo transactions and revision predicates. |
| `apps/api/src/infrastructure/auth/` | Better Auth uses SQL driver input plus user provisioning/profile hooks, OTP, bearer, OAuth and other plugins. Keep its behavior through the supported Mongo adapter. |
| `apps/api/src/application/`, `apps/api/src/domain/` | Existing planning, finance, permissions, tool registry and provider contracts are reusable. Move application workflows into `services/` mechanically after HTTP parity; keep pure domain rules. |
| `apps/api/prisma/`, `apps/api/prisma.config.ts` | SQL snapshot/migrations/seed/reset tooling. Preserve historical artifacts; introduce explicit Mongo initialization, indexes, validation and versioned data migrations. |
| `apps/api/test/`, `apps/api/scripts/` | HTTP tests use Hono request helpers; verification scripts assume SQL. Replace harness/fixtures and run equivalent real Mongo integration cases. |
| `apps/web/src/shared/api/`, `apps/web/src/shared/auth/`, `apps/miniapp/` | Preserve web DTOs, cookies, URLs and stream protocols. Remove the WeChat miniapp and its dedicated integration under the India module below. |
| `deploy/`, `.github/workflows/`, root/API package scripts, `Makefile` | Replace active SQL/Worker deployment, database commands and health checks. Update CI, environment templates and developer documentation together. |

Also cover weather, geo, FX, lodging, covers, street-view caching, file storage,
observability, request IDs and rate limits. Their provider logic can remain;
runtime-specific wiring must change. Frontend FSD, maps, shared packages,
and documentation site are retained. The WeChat miniapp is explicitly removed
from the target product by the user's follow-up request.

## Proposed final folders

Keep workspace names to avoid unrelated pnpm/build/deployment path churn.
`apps/api` is the backend; `apps/web` is its sibling frontend.

```text
raahi-ai/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── app.ts                 Express assembly; no listening here
│   │   │   ├── routes/                trip.routes.ts, auth.routes.ts, etc.
│   │   │   ├── controllers/           Parse input, call services, respond
│   │   │   ├── middlewares/           Auth, errors, requests, limits, uploads
│   │   │   ├── db/
│   │   │   │   ├── db.ts              Mongo/Mongoose connection lifecycle
│   │   │   │   └── migrations/        Versioned Mongo data/index migrations
│   │   │   ├── models/                Mongoose schemas and collection names
│   │   │   ├── repositories/          Queries implementing existing ports
│   │   │   ├── services/              Existing application workflows
│   │   │   ├── domain/                Pure trip, money and permission rules
│   │   │   ├── integrations/          Auth, AI, voice, geo, email, storage
│   │   │   ├── realtime/              Node WebSockets and event publisher
│   │   │   └── config/                Typed env and dependency assembly
│   │   ├── server.ts                  Connect DB, listen, graceful shutdown
│   │   ├── scripts/                   Import, reconciliation, verification
│   │   ├── test/
│   │   └── package.json
│   ├── web/                          Existing React/Vite frontend
│   └── docs/                         Existing documentation website
├── packages/                         Shared contracts/UI catalog
├── docs/
├── deploy/                           Node service + Mongo deployment setup
├── .env                              Ignored local configuration
└── package.json                      Workspace commands
```

Request flow: route → middleware → controller → service → repository/model →
MongoDB. Services also call the pure domain rules. Models and Express request
objects must not leak into the domain. Controllers must not acquire the existing
finance/approval logic. This adds a few folders to the user's familiar layout
so that the project's tested rules survive the move.

## India product module (I0): remove WeChat and replace inherited content

This follow-up changes the earlier preserve-all-clients scope. Implement I0 as
its own verified module after M0 and before M1 so removed routes/features are not
ported unnecessarily. This planning session makes no source or data changes.

### WeChat removal

- Remove `apps/miniapp`, its Taro dependencies/configuration, workspace scripts,
  build/check references, deployment paths and package-lock entries through the
  package manager. Audit shared packages before removing dependencies.
- Remove the WeChat login option from `apps/web/src/features/auth/AuthForm.tsx`,
  provider discovery responses, locale copy and shared auth types.
- Remove the WeChat web provider and mini-program plugin from
  `apps/api/src/infrastructure/auth/auth.ts`, `wechat-mini-program.ts`, related
  exports, HTTP handlers, config types and credential parsing. Preserve Google
  and email authentication and unrelated mobile/bearer mechanisms if still used.
- Remove WeChat-only environment key names from examples, Docker configuration,
  Cloudflare secret synchronization and workflows. Do not edit real credentials
  or delete external provider accounts as part of source cleanup.
- Remove active WeChat setup/user guides and public navigation. Keep historical
  decision records clearly marked as superseded and preserve required attribution.
- Inventory existing WeChat-linked accounts before retirement. Do not delete users
  or trip ownership; ensure an existing verified alternative sign-in method, or
  explicitly agree a recovery path before disabling their sole login method.

### Indian cities, maps and demo provisioning

- Replace the seeded Japan itinerary in
  `apps/api/src/infrastructure/persistence/seed-data.ts`, the `japan-2025` template
  reference in `application/user/provision-sample-trip.ts` and the loader in
  `infrastructure/persistence/sample-trip-template.ts` together. Use a versioned
  Indian demo identifier; do not rename only the visible title.
- Proposed primary demo: Lucknow → Rishikesh → Chopta → Haridwar, matching the
  Raahi hero scenario. Additional city examples: Delhi, Jaipur and Varanasi.
  Replace stops, coordinates, days, transit descriptions, food/stays, comments,
  sample people, reservations and expenses consistently. Label costs/availability
  as demonstration estimates; validate geography rather than transplanting Tokyo
  coordinates or claiming live travel verification.
- Update landing/trip locale resources and `ScheduleBoard.tsx` city inference,
  placeholders, AI examples, screenshots, tests and published guides. Prefer
  structured itinerary city data over adding another hardcoded city guessing list.
- `shared/ui/map/TripMap.tsx` currently starts from `[0, 20]` when no destination
  is available; it is not itself a Tokyo center. Set the empty map to an India
  overview using centralized bounds/zoom. Existing Tokyo views also come from the
  demo stops, so replace that data. For a chosen trip, fit its actual Indian stops
  or destination; explicit user location/search controls continue to work.
- Set INR defaults across auth (`defaultCurrency`), creation wizard, backend trip
  creation, money formatting and seeds; use `Asia/Kolkata` for Indian demo dates
  and `en-IN` formatting where appropriate. Never relabel an existing JPY ledger
  as INR: preserve historical amounts/currencies or explicitly migrate demo-only
  records with a documented replacement policy.
- Existing persisted demo copies require a provenance-aware migration: replace
  only verified, untouched generated demos. User-edited trips and real expenses
  must not be silently overwritten. Preview affected records first; provide an
  explicit replacement/archive choice for ambiguous or edited legacy demos.

### Languages and imagery

- No Japanese-language UI or Japan-themed authored product content in the final
  release. Audit native-script text as well as English city names and filenames.
- Current `shared/i18n/index.ts` registers English (`en`) and Chinese (`zh`), not
  Japanese (`ja`). Do not mislabel or automatically delete Chinese as Japanese.
  English remains the default; Hindi UI localization is a separately scoped
  enhancement, with Hindi/Hinglish voice requirements preserved. Confirm removal
  of Chinese separately if the user wants an English/Hindi-only language menu.
- Replace Japan-bearing landing captures in `pages/landing/assets/` referenced
  by `pages/landing/lib/content.ts`, and audit `docs/assets/screenshots`, videos,
  promotional assets, README images, trip covers, error-page photos and social
  previews. Inspect rendered images: filenames and text searches cannot prove
  that a photograph contains no Japanese landmarks.
- Use verified India photographs with appropriate source/license records and
  fresh captures of the actual Indian demo. Do not merely change image captions
  while continuing to show the old Japan screens. Audit cover search queries and
  empty/error image defaults so they cannot reintroduce Japan-themed examples.
- Product-authored defaults, examples, imagery and public documentation must be
  India-specific. This does not authorize erasing user-authored historical trips,
  rewriting Git history, deleting license notices or removing countries from a
  world-map provider. A country-restricted planning/search policy is a separate
  explicit product constraint, not inferred from changing defaults.

### I0 acceptance gate

Fresh signup shows an INR Indian sample trip; landing, planner, map, schedule,
budget and screenshots agree. Empty map opens over India; opening the sample
fits its Indian stops. No WeChat button, route, app, active configuration or build
dependency remains. No Japan-themed stock/demo imagery or Japanese product copy
is served. Test existing-account login and data preservation, cold/offline asset
caches, new demo provisioning, currency arithmetic, responsive screens and all
remaining auth flows. Clear/version old service-worker asset caches on release.

Run scoped text/import/dependency scans plus visual browser review of every
authored surface. Classify remaining hits as archived history, required notices,
third-party metadata or preserved user data; do not use a global string replace
as a data migration. Update phase 0B and BUILD_PROGRESS only with verified results.

## MongoDB and Mongoose design

Use Mongoose for business collections. Better Auth owns its auth collections
through its official MongoDB adapter; do not independently model/write those
collections with competing Mongoose auth schemas. Prove compatible driver
versions and connection ownership before sharing a native client. Otherwise use
explicitly owned bounded pools connected to the same database.

Proposed initial mapping prioritizes preserving relationships over redesign:

| SQL data | Mongo collection / representation |
| --- | --- |
| `trips` | `trips`: original ID, owner, intake, dates, currency, revision |
| `trip_members` | `trip_members`: trip/user references, roles and display projection |
| `trip_days`, `stops` | Separate `trip_days` and `stops`, retaining ordering and original IDs |
| `stop_votes`, `stop_comments` | Separate collections; prevent duplicate member votes |
| `expenses`, `expense_participants` | `expenses` with participant IDs and exact allocations embedded per expense |
| `reservations` | `reservations`, retaining stop/expense references and idempotency key |
| `trip_invites`, allowed emails, acceptances | `trip_invites`, bounded allowlist; separate `trip_invite_acceptances` |
| `planning_proposals` | `planning_proposals`: evidence, payload, owner, base revision, approval result |
| Agent messages, suggestions, dismissals | Separate collections retaining event order and approval history |
| `user_preferences` | `user_preferences`, uniquely keyed by user |
| User, account, session, verification, two-factor | Exact collection/field/ID conventions required by the pinned Better Auth adapter |
| SQL migration bookkeeping | Archive as source history; separate Mongo migration journal |

Do not embed an entire growing trip, ledger or chat history in one document.
Use explicit collection names to avoid Mongoose pluralization surprises. Preserve
public string IDs: business documents can use string `_id`; auth IDs require an
adapter compatibility proof and mapping if necessary. Return existing `id` DTOs,
not `_id`, `__v`, Mongoose documents or BSON values.

Before implementing models, inventory every source column, default, nullability,
index and delete action. Establish Zod/DTO validation plus Mongoose validation;
all update paths must validate. Never pass arbitrary client objects as Mongo
filters or update operators. Reproduce database uniqueness with actual indexes,
including partial indexes for optional user references/idempotency fields.
Required query indexes include trip membership, ordered stops/days, expenses by
trip, reservation dates, proposal owner and agent sequence. Explicitly implement
referential checks and cascades; Mongo does not provide SQL foreign keys.

Money needs a field-level conversion manifest: SQL `expenses.amount` is currently
decimal major units, custom allocation JSON contains major-unit shares (verified
during M3 against the domain and DTO code), and reservations
already contain `amount_minor`. Do not multiply all monetary fields by 100.
Target expense storage uses validated integer minor units within safe bounds;
parse decimal strings exactly and map back to unchanged public DTOs. Keep
currency-specific precision and existing mixed-currency restrictions. Reconcile
each expense total, participant allocation, ledger balance and budget forecast.

Use a transaction-capable Mongo replica set locally and in integration tests;
use a managed replica set (such as Atlas) or equivalent for hosting. A standalone
Mongo process is insufficient for the proposed multi-document guarantees.
Create required collections and indexes explicitly before serving traffic.

### Concurrency and transaction requirements

- Replace row locks with transactions plus conditional trip updates using the
  expected revision; increment revision atomically. Stale proposals still return
  the existing conflict response. Retry transient database conflicts only within
  bounded driver behavior; never silently rebase a stale user decision.
- Every relevant write/authorization path must participate in the trip revision
  protocol so concurrent membership removal cannot authorize a stale write.
- Proposal approval, trip creation and approval-result recording commit together.
  Repeated approval returns the same trip, including after proposal expiry.
- Budget approval checks the trip revision and updates future itinerary and
  history together; paid bookings and historical expenses remain unchanged.
- Persist expense and reservation idempotency through unique constraints; handle
  concurrent duplicate keys by returning the already committed result when valid.
- Pass the same session through all operations in a transaction. Execute its
  operations sequentially. Keep AI calls, email, speech and WebSocket publication
  outside retryable transaction callbacks.
- Expiry is checked in application logic. Do not TTL-delete approved proposal
  records needed for audit/idempotency; define retention separately for drafts.

## Express, authentication and realtime compatibility

Use Express 5 on Node, retaining TypeScript/ESM. First implement Express against
the existing SQL-backed services. Use a parity harness to compare Hono and Express
in tests; do not create permanent competing production implementations.

Inventory all routes from source and the API docs, including new Raahi routes
that may not yet appear in the route index. Preserve status codes, error bodies,
cookie attributes, redirects, CORS credentials/preflights, cache-control, request
IDs, upload limits and multipart handling. Mount Better Auth's Node handler before
JSON body parsing, using Express 5-compatible route matching. Preserve the auth
base path, trusted origins, proxy/IP handling and session/bearer behavior.

Retain Better Auth rather than replacing it with a new JWT/password system.
Test email/password, OTP, password recovery, email changes, two-factor, OAuth,
retained mobile token exchange, sign-out and revocation, profile projection and sample-trip
hooks. The lockfile currently resolves Better Auth 1.6.23; its local package exports
`better-auth/adapters/mongodb`, while current online docs show a separate adapter
package. Verify the pinned API and compatibility in a small spike; do not blindly
copy latest documentation or combine this migration with an unnecessary auth upgrade.

Preserve password hashes and encrypted fields, auth secret, provider account IDs
and user relationships. Test imported accounts and sessions. If session continuity
cannot be preserved, record and obtain agreement on explicit re-login before
cutover; do not silently invalidate accounts or force password resets.

Agent responses are streamed Web `Response` objects, and speech returns audio.
Implement a Node response bridge preserving headers/chunks and backpressure;
do not convert streams into JSON or buffer entire responses. Propagate disconnect
cancellation and preserve deferred final message persistence and shutdown draining.

Proposed deployment target: one Node API instance initially, with a Node WebSocket
server implementing the existing `/api/trips/:tripId/realtime` protocol (`hello`,
`change`, `presence`, `resync_required`, `resume`). Check origin/session/membership
on upgrade, revoke access when membership changes, and publish only after commit.
Sequence/replay state must detect restarts and force refetch; it must not pretend
an in-memory history survived. Preserve multiple-tab presence and reconnection.
Multiple API instances require shared ordering/pub-sub and shared rate-limit state
before scaling; a single-process publisher is not a multi-instance solution.

This deliberately replaces the Workers API deployment path, not the React app.
Cloudflare may still host the frontend or provide S3-compatible R2 storage.
Replace Durable Object rate limiting and Cloudflare cache bindings with explicit
Node equivalents and test the existing limits. Keep file URLs/storage contracts.
Render or Docker is a proposed hosting choice, not a deployment action in this task.

## Ordered implementation modules and gates

| Module | Work | Gate before proceeding |
| --- | --- | --- |
| M0 — Baseline and compatibility spike | Capture current working tree, route/data manifest and known phase gaps; run existing checks. Prove pinned Better Auth + Mongoose IDs, imported login and transactions on a disposable replica set. | Every baseline failure identified; auth/data mapping proven; rollback baseline recoverable. |
| I0 — India product cleanup | Remove WeChat; replace Japanese/Japan demo content, imagery, city/map/currency defaults using the module above. | Indian onboarding and visuals verified; retained login and user data preserved; WeChat removed from active product. |
| M1 — Express transport | Add routes/controllers/middlewares/app/server, keeping existing SQL services. Replace Hono helpers and adapt HTTP tests. | Contract parity for every retained route, uploads, auth, streaming and failures; React client works. |
| M2 — Familiar folder layout | Move application → services, provider adapters → integrations, SQL adapters temporarily → repositories, composition → config. Keep domain rules and update imports/scripts. | Typecheck/build/tests pass with no behavior change and no stale path imports. |
| M3 — Mongo persistence | Add Mongoose connection, schemas/index migrations and all repository/store implementations; configure Better Auth Mongo adapter and remove Postgres-only service gating. | Real replica-set tests prove auth, rollback, authorization, idempotency, finance and concurrent revision handling. |
| M4 — Data migration rehearsal | Build export/import/reconciliation tools; migrate a consistent copy of existing SQL data into a new Mongo database. | Complete coverage manifest, matching DTOs/totals/relationships, working imported login, repeatable import and verified restore. |
| M5 — Node platform parity | Implement realtime, rate limits, storage/cache/observability and deployment/CI changes on staging. | Two clients see committed changes; disconnect/restart/access revocation tested; Node deployment streams and uploads correctly. |
| M6 — Cutover and cleanup | Freeze writes, final backup/import/reconciliation, switch configuration and verify. Retire active Hono/SQL runtime dependencies and old deploy jobs only after gates. | Full deployed user journey passes; no active Hono/SQL runtime requirement; rollback procedure rehearsed. |

One module at a time. Do not continue unrelated product implementation while a
migration module is incomplete. Existing product gaps remain separately tracked:
migration parity cannot turn an unverified voice/browser feature into DONE.

## Data migration and rollback procedure

1. Capture schema and a consistent read-only SQL export; protect auth/private data
   in ignored storage. Include uploads or verify their object URLs remain usable.
2. Build a versioned mapping manifest and deterministic importer targeting a new
   Mongo database. Use explicit legacy-ID mappings and checkpointed upserts. Do
   not overwrite an existing target's unrelated data. Disable signup email/demo
   hooks during import; importing users is not a new signup operation.
3. Validate counts, duplicates, orphan references, timestamps/timezones, ordering,
   null/missing differences, currencies, exact money and every source table.
   Compare API-visible snapshots, not counts alone. Repeat the importer and prove
   it creates no duplicate accounts/trips/expenses.
4. Rehearse backup restoration and the entire user journey on staging. For final
   cutover, stop writes including background tasks, take the final consistent
   export, import, reconcile, switch, and smoke-test before reopening writes.
5. Retain the original SQL database and previous deploy artifact. Before Mongo
   accepts new writes, rollback can restore old configuration. After new Mongo
   writes, do NOT simply point back to stale SQL: freeze writes and reconcile or
   reverse-migrate new data before rollback, or fix forward. Rehearse the chosen
   post-write recovery strategy before opening the cutover to users.

No live reset, SQL deletion, credential rotation or automatic deployment is part
of this plan. Historical Prisma migrations and upstream license/attribution stay.

## Verification and completion criteria

- Keep pure domain/finance tests; replace transport-specific harnesses with real
  Express HTTP tests. Test Mongo adapters against a real replica set, including
  injected failures partway through multi-document writes.
- Test simultaneous approvals, stale edits, membership revocation, duplicate
  expenses/reservations, invite limits, trip deletion cascades, proposal expiry,
  exact allocations and unchanged booking links after reorder/save.
- Exercise actual React browser journeys: signup/login, create/edit/share trip,
  maps, comments/votes, reservations/uploads, voice transcript → preview → approval
  → refresh → second member, spoken reply, expenses, budget replan, medical search
  and offline export. Verify retained bearer/OAuth contracts and removal of
  WeChat-only endpoints separately.
- Run workspace typecheck, lint, tests, UI checks, builds and docs checks using
  the repository scripts. Record live provider tests separately from mocks.
- Update AGENTS, architecture/backend/database/auth/realtime docs, API docs,
  operations, environment templates, Makefile, CI, README and BUILD_PROGRESS when
  their implementation changes. Current SQL rules remain in force until retired;
  define Mongo migration conventions explicitly rather than editing Prisma by hand.
- Final audit finds no active imports of Hono, SQL repositories or SQL-only
  services. Legacy source history is allowed; no parallel permanent database or
  second auth/expense system. All product phase gates still apply.

## Official references checked for this plan

- [Express 5 migration guidance](https://expressjs.com/en/guide/migrating-5/)
- [Better Auth Express integration](https://better-auth.com/docs/integrations/express)
- [Better Auth MongoDB adapter](https://better-auth.com/docs/adapters/mongo)
- [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [Mongoose transactions](https://mongoosejs.com/docs/transactions.html)
- [Mongoose connections](https://mongoosejs.com/docs/connections.html)

These references establish supported integration patterns; they do not prove
compatibility with this checkout until M0 and the subsequent gates are executed.
