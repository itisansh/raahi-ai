# Local implementation audit

Inspected 2026-10-27 at `253ff744c3022d4deea1ce0de0aaab585c120512`, branch
`dev/raahi`. This is a source audit, not evidence of a live end-to-end run.
See [BUILD_PROGRESS.md](../../BUILD_PROGRESS.md) for executed checks.

**Current review (2026-11-02):** See [the through-Phase-8 review](PHASE_0_8_REVIEW.md)
for the current acceptance matrix and newly confirmed correctness findings.
The original tables below are historical; they are not the current feature status.

Update, 2026-11-01: the table below preserves the original audit findings.
Phase 1 now has microphone/transcript integration and Phase 2 has a read-only
structured proposal API and wizard preview. Both remain partial pending live
acceptance. Gemini extraction and candidate generation now pass after the model
availability and structured-output fixes in progress log section 15. Proposal
persistence is still Phase 3 work. See section 14 for the implementation map.

## Reuse map

Paths below are relative to the repository root.

| Capability | Existing implementation | Extension boundary |
| --- | --- | --- |
| Web entry and routing | `apps/web/src/main.tsx`, `app/App.tsx`, `app/router.tsx` | Keep React/Vite, auth gate and FSD |
| Trip creation | `apps/web/src/pages/trips/ui/CreateTripWizardDialog.tsx` | Existing destination/duration/dates/budget/party review; add voice request without silently interpreting it as a destination |
| Assistant input | `apps/web/src/pages/travel-planner/ui/agent/AgentComposer.tsx`, `model/useAgentChat.ts` | Editable transcript feeds explicit submit; never submit partial recognition |
| Plan and map | `apps/web/src/pages/travel-planner/TravelPlannerPage.tsx`, `ui/BudgetBoard.tsx`, `shared/ui/map` | Reuse existing DTOs, rendered stops and React Query write echoes |
| API entries | `apps/api/src/node-server.ts`, `worker.ts`, `interfaces/http/app.ts` | Shared Hono app and session guard |
| Composition/config | `apps/api/src/infrastructure/composition/container.ts`, `infrastructure/config.ts` | Inject provider ports; private keys stay server-side |
| Auth | `apps/api/src/infrastructure/auth/auth.ts`, `apps/web/src/shared/auth/index.ts` | Better Auth sessions, OTP, roles; no new auth system |
| Trip commands | `apps/api/src/application/use-cases.ts`, `application/trip/ops/{catalog,schemas,apply}.ts` | Reuse `TripService`, `TRIP_OPS`, validated approved operations |
| AI orchestration | `apps/api/src/application/agent/agent-service.ts`, `infrastructure/ai/agent-model.ai-sdk.ts` | Existing AI SDK tool approvals and fresh trip context |
| Domain | `apps/api/src/domain/trip/{trip,types,settlement}.ts` | Trip aggregate owns membership and changes |
| Persistence | `apps/api/src/infrastructure/persistence/{trip,agent,invite}-repository.db.ts` | Existing SQL ports, PostgreSQL source of truth |
| Database tooling | `apps/api/prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations` | Generate migrations/snapshots by command; no hand edits |
| Travel data | `apps/api/src/application/{geo,weather,lodging}`, `infrastructure/{geo,weather,lodging}` | Reuse provider ports, add evidence validation |
| Collaboration | `application/invite-service.ts`, `domain/realtime`, `infrastructure/realtime` | Existing owner/editor/viewer, invites and Cloudflare fan-out |
| Product copy | `apps/web/src/shared/i18n/locales/{en,zh}`, `apps/web/index.html`, `vite.config.ts` | Centralized copy and PWA identity; preserve internal identifiers |

## Confirmed gaps and phase assignments

| Finding | Consequence / required work | Phase |
| --- | --- | --- |
| No ElevenLabs integration or microphone workflow | Add authenticated short-lived token issuance, official client SDK, recording lifecycle and editable final transcript | 1 |
| Wizard creates an empty trip before agent planning | Add validated one-shot preview and explicit approval before creating the itinerary | 2–3 |
| Intake stores budget and party size, but no complete structured voice intent/evidence | Persist origin, confirmed constraints, source observations and proposal versions in the existing architecture | 2–3 |
| Proactive suggestions check trip version; chat writes are approved per operation | Existing approval does not prove atomic whole-itinerary apply or idempotent initial creation | 3 |
| No TTS playback | Server synthesis, user-initiated play/stop, same grounded readable response | 4 |
| `computeBudget` divides in floating point then rounds each member independently | Equal allocations can fail conservation; introduce deterministic remainder allocation with tests | 5 |
| `addExpense`/`updateExpense` round inputs; `formatMoney` displays integers without minor-unit scaling | Audit persisted unit semantics before INR migration; do not simply switch JPY defaults and call existing amounts paise | 5 |
| Expense schema stores participants, not exact custom allocations or recorded settlements | Extend the existing ledger through generated migrations, transactional writes and idempotency | 5 |
| Aggregate budget sums mixed currencies | Define currency-safe accounting; never claim such totals prove affordability | 5–6 |
| Reservations already have `amount_minor`, revision and idempotency key | Reuse fixed/committed reservations when computing future costs | 6 |
| Stop costs are display-only, independent of paid expenses | Add explicit unknown estimates, commitments and buffer without double counting | 6 |
| No India transport evidence contract | Provider-owned labels, official link handoffs, no fabricated live inventory | 7 |
| Legacy trips with no user-backed members are editable by any signed-in user | Keep demos clearly isolated; verify real trips reject nonmembers before release | 0B, 3, 9 |
| Node does not implement Cloudflare Durable Object realtime | Verify second-user refresh/polling separately; do not advertise instant sync on Node without implementing it | 3, 9 |
| Existing Airbnb integration includes scraping and an ignore-robots option | Do not enable bypasses; review permitted provider use before including lodging results in Raahi proposals | 2, 7 |
| Product identity, fixtures, docs and defaults remain OpenTrip-oriented | Rebrand public surfaces and label Indian examples; preserve LICENSE and upstream attribution | 0B |

## Compatibility decisions

The master instructions and observed React/Vite/Hono architecture supersede
v1.2's replacement Next.js/Supabase app, alternative auth and numbered phases.
The existing Next.js documentation site remains valid. The API uses AI SDK 7,
with API Zod 3 and a separately isolated Zod 4 catalog package; do not merge
these validation boundaries indiscriminately.

The root license is Apache-2.0. No third-party reference implementation was
copied during this audit. Existing license and history must remain intact.

## Phase 5 follow-up status (2026-11-02)

The original rounding/unit gaps above are addressed for INR: Decimal(12,2)
major-unit persistence preserves existing amounts, with deterministic integer-paise
allocation, positive custom shares, computed shares in DTOs and fraction-aware
INR display. SQL expense commands use a locked read/mutate/write transaction.
Web add-expense requests carry a stable UUID for identical retry deduplication.
Live English/Hindi Gemini extraction and local PostgreSQL persistence/concurrency
checks pass. Browser speech/confirmation/reload acceptance remains pending.
Non-INR expense input keeps whole-unit behavior; mixed-currency rows are explicitly
excluded from the trip-currency balance and labeled. No paid-settlement recording
or cross-currency ledger consolidation is claimed.
