# M3 MongoDB/Mongoose persistence

Status: **DONE** for implementation and isolated acceptance. Full workspace
checks passed (389 API / 88 web tests plus typecheck, lint and builds); final
API typecheck/lint and Worker checks also passed (384 passed / six Node-only
tests skipped). The final focused Express Mongo suite passed all 14 tests. Updated 2026-11-04. This module does not migrate existing
SQL data or deploy the application.

## Runtime

Node uses `loadNodeConfig` and `createMongoContainer`. `MONGO_URI` is mandatory;
SQL credentials are not required. The shared service composition receives
Mongo repositories and enables planning approval, speech proposal reads and
budget workflows without a PostgreSQL provider gate. Worker composition and
SQL tooling are retained for M4–M6.

One owned Mongoose 9.11.4 connection supplies business models and the native
client/database to `better-auth/adapters/mongodb` from Better Auth 1.6.23.
Both dependencies are pinned. The real application TypeScript and replica-set
checks cover this shared-client integration. Auth uses generated string UUIDs,
so imported non-ObjectId user/account/session identifiers remain compatible.
The application retains OTP verification, bearer/cookie sessions, Google OAuth,
TOTP and mobile OAuth configuration. Actual provider/browser flows remain
separate acceptance work.

Startup rejects standalone MongoDB, creates collections/indexes before serving,
and records additive initialization in `mongo_migrations`. It does not call
`syncIndexes`, reset a database, or delete previously approved proposals. Pool
size is bounded at 10; server selection at 10 seconds and driver operations at
30 seconds. Shutdown closes the shared connection after deferred work drains.

## Data mapping

The committed Prisma snapshot and SQL migration constraints were inspected as
historical input; they are unchanged. Public DTOs use the existing string `id`
and field names. Business collections retain an indexed public `id` where the
source has one and an internal string `_id`; the internal field is never exposed.
Auth collections use the adapter's `_id` mapping rather than Mongoose auth models.

| Source | Mongo representation / guarantees |
| --- | --- |
| trips | `trips`, metadata, revision, intake, dates, cover and creation time |
| trip_members | `trip_members`, globally unique member ID, trip/order and user indexes, partial unique trip/user for real members |
| trip_days | `trip_days`, unique trip/number |
| stops | `stops`, unique public ID and trip/order index; retained stop IDs keep booking links |
| stop_votes | `stop_votes`, unique stop/member |
| stop_comments | `stop_comments`, separate ordered comments; public contract has no comment ID |
| expenses + participants | `expenses`, unique public retry-derived ID, participants and custom allocations per expense, trip/order index |
| reservations | `reservations`, trip/date and association indexes, unique trip/creator/idempotency key, reservation revision |
| invites + allowed emails | `trip_invites`, unique token hash, bounded service-validated allowlist |
| invite acceptances | `trip_invite_acceptances`, unique invite/user |
| planning proposals | `planning_proposals`, owner/date index, atomic result and approval timestamp, no TTL |
| agent messages | `agent_messages`, unique ID/global sequence, trip/sequence index; transactionally allocated `mongo_counters` sequence |
| suggestions + dismissals | Separate collections; conditional claim of pending/unexpired suggestions, unique suggestion/user dismissal |
| user preferences | `user_preferences`, unique user ID, field-scoped updates preserve simultaneous panel edits |
| user/account/session/verification/twoFactor | Better Auth collections with email/account/token uniqueness and reference lookup indexes |
| SQL migration history | Retained historical artifacts; separate `mongo_migrations` initialization journal |

Mongoose schemas reject unknown business fields, enforce enums/numeric bounds,
and validate adapter updates. Existing HTTP Zod validation and domain rules stay
in place. Repositories check association ownership before reservation writes;
stops removed from a trip clear reservation stop links and delete their votes
and comments in the same transaction. There is no trip/account-delete API in
this module; future deletion workflows must explicitly implement full cascades.
The M4 importer still needs lossless source metadata and reconciliation mapping,
including SQL-only comment IDs/timestamps not exposed in current DTOs.

### Money manifest

| Field | Source / public meaning | Mongo storage |
| --- | --- | --- |
| expense amount | Major units; SQL decimal(12,2) | Validated safe integer `amountMinor` plus explicit scale |
| expense custom allocations | Existing domain/API stores major-unit custom shares | Convert each custom share to minor units, validate sum/participants, convert back on reads |
| computed equal shares | Calculated by existing domain rules | Not a second ledger; derived from total/participants |
| reservation amountMinor | Already minor units | Preserve unchanged |
| budget forecast amounts | Already INR paise | Preserve unchanged |
| stop cost | Display estimate, not expense ledger | Preserve unchanged |

INR scale is 100. Existing non-INR expense rules use scale 1; this module does not
introduce a currency-precision policy change. The earlier migration plan's
assumption that custom allocation JSON was already minor units was corrected
against `Trip.addExpense`, `expenseAllocations` and the public DTO conversion.
M4 must parse SQL decimal strings exactly and reconcile custom allocation JSON
using this field-specific manifest, not multiply all monetary fields by 100.

## Transactions and tests

Compound reads use a snapshot. Writes pass the same session sequentially through
all affected collections. Trip snapshot saves compare the originally supplied
revision even if the driver retries; a stale user decision is never rebased.
Expense command retries reload the trip inside the transaction and run existing
service authorization/idempotency rules. Reservation retries serialize via the
trip revision and return the existing result without a second revision bump.
Proposal creation and approval results commit together; replay works after expiry.
Budget approvals check the expected revision and preserve the actual ledger.
Realtime notification happens after commit, outside retryable callbacks.

`test/mongo-persistence.test.ts` starts MongoDB 8.2.1 as a disposable loopback
replica set and never reads project credentials. It covers schema/index setup,
DTO round trips and visibility, rollback, competing snapshot writes, exact money,
expense and reservation retry IDs, preserved/removed booking links, proposal
approval/replay/owner isolation, budget permissions and stale/successful approval,
member projections, legacy money, message sequence, suggestion claiming,
preferences and invites. It also exercises actual Express + Better Auth imported
login, cookie/bearer requests, signup/OTP verification/sample provisioning and logout.

Logs and local working scripts are under `.workspace/m3/`. Initial sandbox port
errors required approved execution. The interrupted first binary download was
resumed. Test development caught custom-allocation unit conversion, and the
corrected adapter is verified against both stored and public values.

## Remaining boundaries

Root `.env` has no nonempty `MONGO_URI` (presence-only check). The user will
supply it; no hosted database has been used. Atlas/network acceptance,
existing SQL data migration (M4), Node platform/realtime parity (M5), deployment
and SQL dependency/tooling retirement (M6) remain separate tasks. Earlier I0
visual and M1 provider/browser acceptance gaps remain open. No PostgreSQL restart
is required to continue this migration.

Reference APIs: [Mongoose transactions](https://mongoosejs.com/docs/transactions.html)
and [Better Auth Mongo adapter](https://better-auth.com/docs/adapters/mongo).
Current Better Auth documentation describes a newer adapter package/retry loop;
this implementation uses the tested pinned 1.6.23 package. Its auth transaction
helper does not provide the newer documented retry behavior; see M0 evidence.
