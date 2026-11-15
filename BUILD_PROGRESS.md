# Raahi AI — Build Progress & Verification Log

> Evidence log for the inspected local checkout. Unchecked criteria remain unverified; passing mocked tests does not establish live provider behavior.

- **Updated:** 2026-11-15
- **Project:** Raahi AI (OpenTrip-based)
- **Current phase:** Phase 8 — medical facilities and resilience (PARTIAL)
- **Active task:** Live provider acceptance; see section 47. Browser voice/model checks pass; physical-device voice and successful live nearby/medical listings remain.
- **Implementation state:** Voice and proposal preview implemented; automated checks pass, live acceptance incomplete
- **Local git SHA:** `253ff744c3022d4deea1ce0de0aaab585c120512`
- **Branch:** `dev/raahi`
- **Deployment URL:** NOT CONFIGURED
- **Live ElevenLabs key present:** YES (live scoped-token browser transcription verified on 2026-11-15)
- **Voice pipeline tested:** YES — live browser STT → reviewed Send → model clarification → TTS playback; prerecorded input, physical microphone not verified
- **Live transport provider tested:** NO

### Future stack migration request — planning only (2026-11-02)

- User requested Express, MongoDB with Mongoose, and a familiar backend folder
  layout; explicitly requested no code changes now.
- Audited HTTP entry points/routes, SQL repositories and transactional stores,
  Better Auth integration/version, composition, realtime, clients, tests and
  deployment coupling. Created the
  [migration module](docs/raahi/EXPRESS_MONGODB_MIGRATION_PLAN.md), with source map,
  target folders, collection mapping, data preservation/rollback and M0–M6 gates.
- Updated roadmap and agent-rule precedence for the requested future stack.
- Migration implementation: NOT STARTED. No runtime, dependencies, database or
  deployment changed by this planning task. Existing phase statuses unchanged.
- Follow-up scope: added I0 for WeChat removal and India-specific trips, imagery,
  map/currency defaults and product content. Inspected seed/provisioning, auth,
  locales, map initialization and asset references. UI currently supports en/zh,
  not Japanese; asset contents still require visual inspection during I0.
- Validation: `node scripts/docs-check.mjs` PASS; scoped `git diff --check` PASS.
  Runtime tests not run for this documentation-only task. Existing live/browser
  gaps remain unverified.

## 1. Specification availability (verify locally)

| Required file | Status | Notes |
|---|---|---|
| `AGENTS.md` | READ | Existing user changes preserved |
| `RAAHI_PLAN.md` | READ / UPDATED | Phase roadmap and acceptance criteria |
| `BUILD_PROGRESS.md` | UPDATED | Replace states only with evidence |
| `docs/raahi/RAAHI_AI_BUILD_v1.2.md` | READ | Older architecture superseded |
| `docs/raahi/RAAHI_AI_REPOSITORY_AUDIT_AND_VOICE_PLAN.md` | READ | Compared against source |
| `docs/raahi/RAAHI_AI_INDIA_TRAVEL_APIS.md` | MISSING / OPTIONAL | Reverify official provider docs during implementation |

**Before implementing Raahi-specific features:** If either of the two required `docs/` files is absent, stop after baseline-only analysis and request the file. The earlier build spec's Next.js/Supabase Auth guidance is superseded by the OpenTrip-based plan.

## 2. Phase tracker

| Phase | Goal | State | Evidence/gate |
|---|---|---|---|
| 0 | Inspect and run OpenTrip baseline | PARTIAL | Source audit complete; configured typecheck/lint/tests/UI check pass; full build and live DB/browser checks pending |
| 0B | Raahi identity and honest demo data | PARTIAL | Product names, metadata, auth/email and public copy updated; icons, Indian fixtures and screenshot replacement remain |
| 1 | Microphone UI + live STT + text fallback | PARTIAL | Live token issuance, transcript lifecycle and mobile browser checks pass; physical microphone recognition pending |
| 2 | Voice/text → validated itinerary proposal | PARTIAL | Preview API/UI, paise costs and place/route evidence; live Gemini extraction and candidate generation pass after section 15 fix; browser/full geo acceptance pending |
| 3 | Approve proposal → persisted shared itinerary | PARTIAL | Mongo new-trip and additive existing-trip approval implemented; revision, permission, retry and second-member tests pass; live multi-user browser acceptance pending |
| 4 | ElevenLabs human-like spoken response | PARTIAL | Automatic reply speech, mute/cancel/replay implemented; live English/Hindi generation and mocked browser checks pass; device listening acceptance pending |
| 5 | Voice expenses + exact share allocation | PARTIAL | Paise/custom splits, repayment records and personal caps implemented; authenticated browser save/reload and Mongo checks pass; physical speech acceptance pending |
| 6 | Budget-aware replanning | PARTIAL | Forecasts, reviewed reductions and revision-safe rollback implemented; browser approve/reject/restore pass with deterministic model; live-model end-to-end acceptance pending |
| 7 | India transport and places provider adapters | PARTIAL | Road/forecast checks and official links implemented; live route/weather pass, nearby provider unavailable; browser acceptance pending |
| 8 | Nearby medical + resilience | PARTIAL | Stop/opt-in GPS medical lookup, public contacts, offline export/retry implemented; automated checks pass, browser/live listing acceptance pending |
| 9 | Deploy + E2E demo | NOT STARTED | Real deployed journey and regression tests |

Allowed states: `NOT STARTED`, `IN PROGRESS`, `PARTIAL`, `BLOCKED`, `DONE`.

`DONE` is allowed only after the phase's acceptance gate has passed. `PARTIAL` requires explicit remaining work. Do not mark a live integration verified if only a mock was tested.

## 3. Baseline capture — to fill during Phase 0

- Date: 2026-10-27; Linux WSL2, Bash; Node v24.21.0.
- Remote: `https://github.com/itisansh/raahi-ai.git`; branch/SHA recorded above.
- Initial changes: modified `AGENTS.md`; deleted root `BUILD_PROGRESS.md:Zone.Identifier` and `RAAHI_PLAN.md:Zone.Identifier`. Preserved.
- pnpm was missing; bootstrapped pinned 10.28.1 through Corepack in `/tmp/raahi-corepack`, with shims in `/tmp/raahi-bin`.
- No root `.env`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `AI_MODEL`, `AI_API_KEY`, or `ELEVENLABS_API_KEY` configured. Checked existence/names only.
- `make`, `docker`, and `psql` unavailable. No migrations, seed, resets or live database connections run.
- Root `LICENSE` is Apache-2.0; retained unchanged.
- Source map and architecture conflicts: [local gap register](docs/raahi/IMPLEMENTATION_GAPS.md).

Commands below use `PATH=/tmp/raahi-bin:$PATH COREPACK_HOME=/tmp/raahi-corepack` after bootstrap.

| Command | Actual result |
| --- | --- |
| `pnpm --version` | FAIL 127 initially: executable absent |
| `COREPACK_HOME=/tmp/raahi-corepack corepack pnpm --version` | Sandbox DNS failure; approved network retry PASS, 10.28.1 |
| `corepack pnpm install --frozen-lockfile --store-dir /tmp/raahi-pnpm-store` | Sandbox EAI_AGAIN; approved retry PASS (2,089 packages, lockfile unchanged). Existing policy skips some optional dependency scripts |
| `make check` | NOT RUN: `make` missing (exit 127); underlying `pnpm check` used |
| `pnpm check` | FAIL 2: missing generated `PrismaClient` export |
| `pnpm --filter @opentrip/web typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm --filter @opentrip/api test` | PASS: 44 files, 268 tests, mocked/in-memory dependencies |
| `pnpm --filter @opentrip/web test` | FAIL: 12 files/57 tests passed, 2 suites could not load without `BASE_URL` |
| `DATABASE_URL=postgresql://unused:unused@127.0.0.1:5430/unused pnpm --filter @opentrip/api db:generate` | PASS: generated Prisma 7.8.0 client from committed snapshot; placeholder satisfies config only, no DB connection |
| `BASE_URL=http://localhost:8780 pnpm --filter @opentrip/web test` | PASS: 14 files, 66 tests |
| `BASE_URL=http://localhost:8780 pnpm check` | Typecheck, lint, tests and ui:check PASS; build FAIL because Taro cannot create `/home/itisansh/.taro4.0` inside sandbox |
| `BASE_URL=http://localhost:8780 pnpm build` (approved outside sandbox) | IN PROGRESS |
| `node scripts/docs-check.mjs` | PASS before and after audit documents |
| `node scripts/ui-check.mjs` | Initially missing TypeScript; PASS after dependencies installed |

Manual sign-in, create trip, map/schedule, live AI, two-account sharing and
expense persistence: **NOT RUN** (no database/auth configuration or browser tool).
Local provider calls: **NOT RUN** (credentials absent).

Do not run DB reset/reseed/destructive schema commands against an existing user database. If environment or credentials are missing, mark the specific test `NOT RUN` with a reason.

## 4. MVP acceptance checklist

### Voice-first planning

- [ ] Push-to-talk visible in trip discovery or existing trip AI interface.
- [ ] Microphone permission, stop, cancel, error and offline/text fallback work.
- [ ] ElevenLabs Scribe **final** transcript shown and editable before submit.
- [ ] Hindi/Hinglish/English request maps to validated travel intent.
- [ ] Ambiguous/missing dates, traveler count or total budget handled explicitly.
- [ ] Candidate itinerary includes real mapped stops and evidence/unknown labels.
- [ ] Per-person and total budget computed in integer paise.
- [ ] No unapproved action writes to database.
- [ ] Accepted trip persists after refresh and is visible to authorized group member.
- [ ] ElevenLabs TTS reads a short summary without blocking the trip UI.

### Group expenses and replanning

- [ ] Exact payer and participating member subset confirmed.
- [ ] Equal split + rounding/remainder tests pass.
- [ ] Idempotency prevents duplicate expenses on retry.
- [ ] Nonmember cannot access/edit another group's ledger.
- [ ] Actual paid, committed, estimated costs and budget buffer separated.
- [ ] Budget breach triggers a versioned proposal, not silent edits.
- [ ] Approved replan changes only permitted future activities.

### India readiness and travel safety

- [ ] Route and place adapters return a source and evidence status.
- [ ] Train/bus inventory is never claimed without authorized live data.
- [ ] Synthetic demo prices/schedules explicitly labeled.
- [ ] Medical search uses permitted location and displays uncertainty/contacts.
- [ ] Secrets are server-side and private details are excluded from logs.

### Release

- [ ] Relevant unit/integration tests pass.
- [ ] Repository's typecheck, lint and build pass (record actual commands).
- [ ] At least one deployed E2E run performed with two test accounts.
- [ ] Hackathon demonstration rehearsed, including provider failure scenario.

## 5. Work session log

Add one entry **after every Codex session**. Never fabricate checks or counts.

### Session template — copy for the next session

```markdown
### YYYY-MM-DD HH:MM — Phase N — Short goal
- **State:** NOT STARTED / IN PROGRESS / PARTIAL / BLOCKED / DONE
- **Git:** branch / before SHA / after SHA
- **Files changed:**
  - `path`: reason
- **Existing OpenTrip modules reused:**
  - ...
- **Tests and evidence:**
  - `exact command` → PASS / FAIL / NOT RUN; relevant output or link
  - Manual UI scenario → PASS / FAIL / NOT RUN; screenshot/video optional
  - Live integration or mocked fixture? specify
- **Safety/authorization checks:**
  - ...
- **Issues or blockers:**
  - ...
- **Decisions and rationale:**
  - ...
- **Remaining work for phase:**
  - ...
- **Next smallest action:**
  - ...
```

### 2026-10-27 — Phase 0 — Source audit and baseline
- **State:** PARTIAL; runtime verification still requires a development database and browser.
- **Files changed:** `RAAHI_PLAN.md` (correct paths, identity milestone, conflicts), `docs/raahi/README.md` (document index), `docs/raahi/IMPLEMENTATION_GAPS.md` (source map and gaps), `docs/README.md` (link), this log.
- **Existing modules inspected:** trip wizard, assistant composer/SDK approvals, trip aggregate/ops, SQL repositories, Better Auth, invite and realtime services, Prisma schema, finance formatter/settlement engine.
- **Checks:** exact commands and failures recorded in section 3.
- **Next:** finish the full build, then the first safe product identity changes. No live functionality is claimed.

## 6. Decision register

| ID | Decision | Basis | Status |
|---|---|---|---|
| ADR-001 | Extend OpenTrip instead of rebuilding Next.js/Supabase Auth stack | Architectural compatibility, preserve features | CONFIRMED by source audit |
| ADR-002 | Voice-first via Scribe Realtime → existing AI tools → ElevenLabs TTS | Use one AI orchestrator, avoids redundant conversational agent | PROPOSED — SDK/auth smoke test needed |
| ADR-003 | Human approval before itinerary / expense writes | Accuracy, security, group trust | REQUIRED |
| ADR-004 | Budget engine uses deterministic paise arithmetic | Testability and rounding integrity | REQUIRED |
| ADR-005 | Indian transport sources return evidence labels, never fake live availability | Data gaps and provider terms | REQUIRED |
| ADR-006 | Wispr STT is optional behind verified documented adapter | API availability not confirmed | DEFERRED |

## 7. Blockers / risks

| Issue | Severity | Current mitigation | Owner / next action |
|---|---|---|---|
| No configured development database or browser | HIGH | Mock tests and static checks only; no destructive setup | Configure an isolated PostgreSQL instance and verify auth/shared persistence |
| Expense units/rounding and mixed currency | HIGH | Source findings documented, no premature paise claims | Phase 5 coordinated ledger migration |
| No live AI/voice credentials | HIGH | Typed path remains available; future provider tests use mocks | Set server-side keys locally for live verification |
| ElevenLabs quotas/auth/SDK versions may differ | MEDIUM | Check current docs and server-scoped tokens | Phase 1 |
| Indian rail/bus inventory has incomplete public API coverage | HIGH | Authorized adapters + official handoff + evidence labels | Phase 7 |
| Legacy demo access and Node realtime limitations | HIGH | Explicitly recorded in gap register | Test isolation and second-account behavior in phase 3 |

## 8. End-of-phase handoff (Codex must populate)

```text
Phase:
Gate passed? YES/NO
What works now (verified):
What remains:
Files changed:
Checks run, results and environment:
Known limitations:
Credential names needed (NEVER secret values):
UI demo steps:
Recommended next phase/task:
```

**Rule:** Update the tracker at the end of each session and before context compaction. The next Codex session must be able to resume without relying on hidden chat history.


## 9. 2026-10-31 continuation — Phase 1 verification

State: **PARTIAL**. No phase is claimed complete from mock tests alone.

Implemented since the baseline:
- Server-only `ELEVENLABS_API_KEY` configuration and example placeholder.
- `application/voice/voice-token-service.ts` port/service; ElevenLabs token adapter
  with timeout, response validation and sanitized failures; bounded token limiter.
- Authenticated `POST /api/voice/token` with exact trusted-Origin enforcement,
  no-store responses and five attempts/user/minute. Workers reuse the existing
  atomic Durable Object limiter; Node uses process memory.
- Official `@elevenlabs/client` pinned dependency and reusable FSD `voice-input`
  feature: explicit start/stop/cancel, partial display, committed text review,
  timeout and cleanup, HTTPS/microphone capability checks, typed-input fallback.
- Wizard integration dictates destination only. Assistant integration appends
  reviewed text to its composer; it never automatically sends or saves a trip.
- API platform contract and README updated. Existing mobile OAuth test fixture
  now includes the new service. Original user edits remain untouched.

Verification commands used installed local binaries because the resumed shell
had neither Node nor pnpm on PATH. All commands below prepend
`PATH=/home/itisansh/.nvm/versions/node/v24.21.0/bin:$PATH`.

| Command / directory | Result |
| --- | --- |
| `../../node_modules/.bin/vitest run src/features/voice-input/model/recorder.test.ts` in `apps/web`, with `BASE_URL=http://localhost:8780` | PASS: 9 lifecycle tests |
| `../../node_modules/.bin/vitest run test/voice.test.ts` in `apps/api` | PASS: 14 token/provider/authorization/rate-limit tests |
| `node_modules/.bin/tsc --noEmit -p apps/web` and `-p apps/api` from root | Initial failures fixed (translation key narrowing and Container fixture); subsequent PASS |
| `../../node_modules/.bin/vitest run` in `apps/web`, with local BASE_URL | PASS: 15 files, 75 tests |
| `../../node_modules/.bin/vitest run` in `apps/api` | PASS: 45 files, 282 tests |
| `node_modules/.bin/eslint . --max-warnings 0` in each app | API PASS; web found two unused test parameters, fixed and targeted lint rerun |
| `node scripts/docs-check.mjs` / `node scripts/ui-check.mjs` | PASS / PASS |
| Root `node_modules/.bin/vitest run` | FAIL: inappropriate root invocation collected skill scripts and missed web aliases; app-scoped suites above passed |
| Web `node_modules/.bin/vite build` with local BASE_URL | See final result below |

Live provider, browser microphone permissions, mobile audio capture, Hindi/
Hinglish recognition, authentication against PostgreSQL, and two-account
persistence: **NOT VERIFIED**. No real credentials were read or printed.

Next: finish Phase 1 browser/live acceptance with an isolated development DB,
server auth configuration and `ELEVENLABS_API_KEY`; then implement Phase 2
validated trip intent and proposal preview. TTS, whole-trip voice generation,
paise ledger correctness, budget replanning and deployment remain unimplemented.
Branding also still needs the Indian demo and visual assets; legacy screenshots
are explicitly labeled rather than presented as Raahi India results.

Final verification: web Vite/PWA build **PASS** (exit 0); targeted voice-feature
ESLint **PASS** after fixing unused parameters; `git diff --check` **PASS**.
No commit or deployment was made; phase acceptance remains partial.

## 10. 2026-10-31 — Provider credential setup reference

- Updated `.env.example` with Gemini key mapping to `AI_API_KEY`, optional
  Resend and S3-compatible storage placeholders, and explicitly unimplemented
  Geoapify/openrouteservice placeholders.
- Documented pending vendor selection for transport/accommodation inventory;
  no unsupported provider integration or generic booking key is implied.
- Existing optional weather, Maps, OAuth, cover-photo, captcha and observability
  settings remain available. Real `.env` contents were not read or changed.
- Verification: checked existing variable names against backend configuration;
  `git diff --check` passed. Documentation/configuration-template changes only;
  no live provider calls or application tests were required for this change.
- Phase 1 remains partial; live microphone/auth verification is still pending.

## 11. 2026-10-31 — Phase 1 credential readiness recheck

- Checked credential presence without printing values. In this checkout the root
  `.env` still has empty/missing `ELEVENLABS_API_KEY`, `AI_API_KEY`, `AI_MODEL`
  and `AI_BASE_URL`; auth secrets still match development placeholders.
  No keys were found in `.env.example` or the alternate local env paths checked.
- Local TCP probes could not reach ports 5430, 5170 or 8780 from this session;
  this is not proof of database authentication or server health.
- Reran API `vitest run test/voice.test.ts`: PASS, 14 tests; web
  `vitest run src/features/voice-input/model/recorder.test.ts`: PASS, 9 tests.
  Used the installed Node v24.21.0 PATH and web BASE_URL=http://localhost:5170.
- Phase 1 remains PARTIAL: no live token issuance or actual Hindi/English
  microphone transcription was verified. Need the saved root `.env` credentials,
  running authenticated application, and real browser microphone acceptance.
- No real environment values were displayed or modified.

## 12. 2026-10-31 — Local PostgreSQL setup

- User authorized local database creation. Docker is unavailable; used installed
  PostgreSQL 18 to initialize an isolated cluster in ignored
  `.workspace/postgres/data`, with a local socket in `.workspace/postgres/socket`.
  The system PostgreSQL cluster was not changed.
- Server listens only on `127.0.0.1:5430`; created the development role/database
  matching the existing local `.env` URL. Applied all 8 existing Prisma migrations
  with `apps/api/node_modules/.bin/prisma migrate deploy`: PASS. No schema edits,
  new migrations, reset, or demo seed performed.
- Verified with the application's `pg` driver and configured URL: connection PASS,
  23 public tables, 8 completed migrations. Sandbox socket restrictions required
  approved escalated commands for startup and database connections.
- Replaced only placeholder auth/grant secrets in ignored `.env` with independent
  generated secrets and set file mode 0600. No secret values were displayed.
- Credential presence recheck: root `.env` still has empty/missing ElevenLabs
  and AI settings in this workspace; asked user for saved file path only.
- Start this cluster after a restart (from repository root):
  `/usr/lib/postgresql/18/bin/pg_ctl -D .workspace/postgres/data -l .workspace/postgres/server.log -o "-p 5430 -h 127.0.0.1 -k /home/itisansh/projects/raahi-ai/.workspace/postgres/socket" start`.
- Phase 1 remains PARTIAL: database connectivity verified, but browser auth and
  live Hindi/English microphone transcription still need verification.

## 13. 2026-10-31 — Gemini local configuration

- Both provider keys are now present in saved root `.env`; values were not printed.
- Set local AI_PROVIDER=openai, AI_MODEL=gemini-3.8-flash and Google's documented
  OpenAI-compatible base endpoint. Existing keys were preserved. No secrets or
  environment-specific configuration were added to tracked files.
- Authenticated Gemini model listing returned HTTP 200 and included the selected
  model. One minimal generation through the installed AI SDK compatible adapter
  returned HTTP 503; generation and tool calling remain unverified.
- Phase 1 live microphone verification remains pending. Configuration presence
  and successful model listing do not establish end-to-end planning functionality.

## 14. 2026-10-31 / 2026-11-01 — Phase 2 proposal preview

State: **PARTIAL**. User explicitly requested Phase 2 while Phase 1 live microphone
acceptance is still pending. No phase completion, commit or deployment claimed.

Implemented and reused:
- `apps/api/src/application/planning/contracts.ts`: Zod request, nullable intent
  and candidate schemas; exact decimal-rupee to integer-paise conversion; model port.
- `application/planning/planning-service.ts`: clarification before planning;
  validation of days/cost ranges; deterministic group budget comparison; unique
  India/city/name place matching and provider-only coordinates; road/time checks
  including overnight rest and return to origin. Unknown costs/places/routes and
  infeasible schedules remain explicitly flagged. No write tools/repository port.
- `infrastructure/ai/planning-model.ai-sdk.ts`: reuses the existing AI SDK model
  factory, validates structured output, caps generation and sanitizes errors.
  `agent-model.ai-sdk.ts` exports its existing factory instead of duplicating it.
- `application/use-cases.ts`: read-only, authorized persisted planning context
  without the normal GET trip's coordinate backfill. `composition/container.ts`
  wires it with the existing GeoService and a separate rate-limit namespace.
- `interfaces/http/app.ts`: authenticated/trusted-Origin POST
  `/api/planning/preview`, body/input limits, no-store, sanitized error responses.
- `apps/web/src/pages/trips/{model/proposal.ts,model/proposal-copy.ts,ui/TripProposalPanel.tsx}`
  and `ui/CreateTripWizardDialog.tsx`: complete voice/text request, explicit
  generate, missing-detail prompts, editable request, loading/cancel/error states,
  day-by-day preview, known estimate totals, evidence/map links and attribution.
  The existing manual wizard is still accessible. No proposal save button exists.
- Added `apps/api/test/planning.test.ts` (24 cases) and `planning-model.test.ts`
  (4 actual-SDK/mocked-HTTP cases); updated the mobile OAuth container fixture.
- Updated README and API platform/route documentation. No dependencies or database
  schema changes were needed; pre-existing user changes and credentials preserved.

Verification (installed Node v24.21.0 prepended to PATH):

| Command / directory | Result |
| --- | --- |
| `../../node_modules/.bin/vitest run test/planning.test.ts test/voice.test.ts` in API | Initial new oversized-body test failed (500 instead of 413); fixed Hono body-limit error handler, then 38 tests PASS |
| `../../node_modules/.bin/vitest run test/planning-model.test.ts` in API | PASS: 4 cases, including compatible SDK JSON validation and sanitized 503 |
| `../../node_modules/.bin/vitest run` in API | PASS before adapter tests: 46 files / 306 tests; final combined rerun recorded below |
| `BASE_URL=http://localhost:5170 ../../node_modules/.bin/vitest run` in web | PASS: 15 files / 75 tests |
| `node_modules/.bin/tsc --noEmit -p apps/api` and `-p apps/web` from root | Test fixture initially lacked ForbiddenError arguments; fixed, both PASS on final 2026-11-01 check |
| App-local `node_modules/.bin/eslint` over changed planning/wizard files and tests | PASS; initial attempt at root eslint path failed because only app-local binary exists |
| Web `BASE_URL=http://localhost:5170 node_modules/.bin/vite build` | PASS before final attribution/link adjustment; final rerun recorded below |
| `node scripts/docs-check.mjs` and `node scripts/ui-check.mjs` | PASS before final log update; final check recorded below |
| Live extractor via `tsx --env-file=../../.env` | Sandbox IPC denied; approved network retry failed. Direct diagnostic returned `AI_APICallError`, HTTP 503. No provider error body or credentials printed |

Limitations and next steps:
- Live Gemini structured extraction/candidate generation is not verified because
  the provider returned 503. Successful model listing alone is insufficient.
- No browser automation tool is available in this session. Actual dialog/mobile
  interaction, microphone permission denial, Hindi/Hinglish transcription and the
  full spoken request → preview workflow remain manual acceptance items.
- Phase 2 is a bounded initial preview (1–14 days, up to 3 stops/day, 20 unique
  place lookups). Estimates are AI-generated ranges, not quotes. Accommodation
  availability, opening hours, public transport schedules and seasonal suitability
  are not verified. A failed place match produces no coordinates.
- Proposal IDs are ephemeral. Persisted proposal versions, atomic approval/save,
  idempotency and map/itinerary persistence belong to Phase 3, not this endpoint.
- Next: retry live provider after availability recovers, run an authenticated
  browser preview and verify no trip writes, then close the phase acceptance gaps.

Final 2026-11-01 results: API full suite **PASS**, 47 files / 310 tests; latest
web Vite/PWA production build **PASS**, exit 0; both app TypeScript checks and
targeted API/web ESLint **PASS**, exit 0. Together with the web suite above,
**385 automated tests passed**. `git diff --check` **PASS**. No live-provider
success is inferred from these checks.
Final `docs:check` and `ui:check` also **PASS** after documentation updates.

## 15. 2026-11-01 — Gemini diagnosis and fix

- Diagnosed the configured model rather than assuming a key or API-format error.
  `gemini-3.8-flash` previously returned 503 and now timed out on both native and
  compatible endpoints. A diagnostic `gemini-2.5-flash` call returned 404, so it
  was not selected. Current model listing succeeded. `gemini-3.1-flash-lite`
  returned HTTP 200 and nonempty content on both native and compatible APIs.
- Changed only AI_MODEL in ignored root `.env` to the responding Flash-Lite model.
  Kept the Google endpoint and existing key. No model rotation or silent fallback
  was added; provider/model configuration remains explicit.
- The real extractor then exposed a separate integration bug: the generic AI SDK
  compatible adapter warned that it was omitting JSON Schema and returned invalid
  structured output. Enabled `supportsStructuredOutputs` in the shared model
  factory specifically for Google's official API hostname. Other compatible
  providers keep their existing behavior. Google documents this capability at
  https://ai.google.dev/gemini-api/docs/openai#structured-output.
- Added a regression case in `apps/api/test/planning-model.test.ts` asserting that
  Google receives `json_schema` with the required intent fields; the existing
  generic-provider test still asserts `json_object`.
- **Live application adapter verification PASS**: extracted five travellers,
  six days, Lucknow, INR 7000 per person and unknown dates; generated candidate
  passed the Zod schema, six-day sequential-order check and cost-range check.
  This verifies model generation, not live place/route accuracy, browser audio,
  trip persistence or the complete authenticated workflow.
- Tests: planning-model suite **PASS**, 5 cases; API TypeScript and targeted
  ESLint **PASS**. Final full API regression result recorded below.
- Diagnostic scripts are local/ignored in `.workspace/diagnostics`; secrets are
  loaded from `.env`, never embedded or printed. Sandbox DNS failed initially;
  network diagnostics were rerun with approved escalation. No schema/dependency
  changes, database writes, commit or deployment.

Final Gemini-fix regression: `../../node_modules/.bin/vitest run` in API
**PASS**, 47 files / 311 tests; `node scripts/docs-check.mjs` **PASS**;
`git diff --check` **PASS**. No frontend changes were made in this fix.

## 16. 2026-11-01 — Phase 3 new-trip approval

State: **PARTIAL**. The user requested Phase 3 progression. New-trip approval is
implemented; applying proposals to existing trips is deliberately rejected until
revision-safe replacement is implemented. No earlier live/browser gaps are closed.

Changes:
- Prisma generated `20261101171519_planning_proposals` from a scratch desired schema
  in ignored `.workspace`, then applied it to the isolated local PostgreSQL DB.
  Regenerated committed `schema.prisma` with `prisma db pull` and generated client.
  No migration or committed snapshot was handwritten. Initial P3014 shadow DB
  permission failure was fixed with CREATEDB on the isolated development role.
- `application/planning/{proposal-store,approval-service}.ts` and
  `infrastructure/persistence/proposal-store.db.ts`: 30-minute server-side proposal
  retention, owner-scoped row locking, explicit approval, atomic trip creation and
  approval history. Repeated/concurrent approval returns the same trip ID.
- `planning-service.ts` persists validated previews and exposes `approvable`.
  Approval blocks all evidence, schedule and budget issues except unknown dates.
  All saved coordinates come from the preview's provider matches; unknown dates
  remain empty rather than adopting the manual wizard's default date.
- Reused Trip.create/updateDay/insertStop, TripOwner/member permissions and existing
  SqlTripRepository.create. That method accepts a caller-owned transaction and now
  persists any initial stops. Existing votes, expenses and invitations are untouched.
- TripIntake now includes structured origin, budget basis and exact paise amount.
  Full intent/estimates/evidence remain in the approval record.
- Authenticated `POST /api/planning/proposals/:id/approve` accepts exactly
  `{confirm:true}` and the server proposal ID, requires trusted Origin and owner,
  and returns tripId. Client itinerary/user payloads are rejected.
- Wizard preview adds Approve and save trip, pending/failure/blocked states and
  navigation to the existing planner/map. README and API docs updated.

Verification:
- API full Vitest suite **PASS**, 48 files / 317 tests (6 new HTTP boundary cases).
- Both app TypeScript checks **PASS**; targeted API/web ESLint **PASS**.
- `node --env-file=../../.env --import tsx scripts/verify-proposal-persistence.ts`
  in API, approved local DB access: **PASS**. Actual PostgreSQL test covered stored
  preview with no trip write, owner approval, two concurrent approvals producing
  one trip, reload of exact stop coordinates/city/unknown date/700001 paise,
  outsider denial, second member visibility after membership addition, expired
  proposal rejection and invalid-evidence rollback. Fixtures were explicitly test
  data and only their generated IDs were cleaned up. No live travel data claimed.
- Production web build and final docs/UI checks: results appended below.

Remaining:
- Existing-trip revision-safe application, stale-proposal rejection in that path,
  actual invitation UI/second browser account, authenticated approval UI/map
  rendering and microphone-to-approved-trip browser verification remain pending.
- Proposal approval is PostgreSQL-only. MySQL previews remain ephemeral and its
  approval endpoint returns 503 until matching schema support is implemented.
- No commit/deployment. Credentials were not printed. Original user edits preserved.

Final Phase 3 checks: web Vite/PWA production build **PASS** (exit 0),
`docs:check` **PASS**, `ui:check` **PASS**, `git diff --check` **PASS**.

## 17. 2026-11-01 — Browser verification setup

- Confirmed isolated PostgreSQL running; started API and Vite development servers.
- Network checks: frontend `http://localhost:5170` **200**, frontend proxy
  `/api/health` **200**, direct API `http://localhost:8780/api/health` **200**.
- Local server logs: ignored `.workspace/api-dev.log` and `.workspace/web-dev.log`.
  Console email verification codes can be read privately by the user in API logs.
- Provided user steps for approval, refresh, retry and a second browser account.
  These user-driven browser checks are still pending; server readiness is not
  evidence of successful signup, microphone access or browser approval.

## 18. 2026-11-01 — Missing pnpm in user's active shell

- User's `npm run dev` failed because pnpm was missing from the active Node
  v26.13.0 installation; the older Node v24 installation already had its own pnpm.
- Installed repository-pinned `pnpm@10.28.1` globally under the active NVM Node
  installation with approved filesystem/network escalation.
- `pnpm --version`: **PASS**, 10.28.1. Workspace selection for API/web:
  **PASS**. No dependency or source changes needed; npm config warnings came from
  invoking npm against this pnpm workspace. Use `pnpm dev` from repository root.

## 19. 2026-11-01 — Development port handoff

- User's `pnpm dev` failed because the verification servers started in section 17
  still occupied 5170 and 8780. Confirmed process commands and working directories,
  then gracefully stopped only those two agent-started servers with SIGTERM.
- `ss` verified both ports free. PostgreSQL was left running. User can now own
  startup and logs through `pnpm dev` in their terminal. No source changes needed.

## 20. 2026-11-01 — Signup diagnosis and error feedback

- User reported account creation failure without a specific browser error. Asked
  whether the form shows an error, remains disabled, or reaches verification.
- Confirmed both user-owned dev servers running. Local configuration uses console
  email and Cloudflare's official passing test keys. Against the running frontend
  proxy, an isolated signup request with the documented dummy captcha token
  returned HTTP 200 and a created user. Removed only that fixture's account/trips.
  This establishes backend signup success, not user-browser verification success.
- Found signup discarded server rejection codes and lacked password-length guidance.
  Added password minLength/guard, a whitelist of localized public rejection messages,
  and a captcha-waiting explanation. Unknown provider messages remain hidden.
- Changed `features/auth/{AuthForm.tsx,auth-error.ts,auth-error.test.ts}` and auth
  locale files. Credential messages explain password, email, existing-account,
  captcha, rate-limit and service errors. Console email still requires reading the
  code privately from the user's pnpm terminal; no email delivery bypass added.
- Focused tests **PASS**, 3 cases; web TypeScript **PASS**; targeted ESLint **PASS**;
  ui:check, docs:check and git diff --check **PASS**. No backend behavior changed.
- Exact cause of the user's browser failure remains unconfirmed pending their
  error/step description. No passwords, API keys or OTP values were displayed.

## 21. 2026-11-01 — Remaining generic authentication message

- User reported "could not authenticate". Found sign-in still used generic copy
  and the installed Better Auth captcha code `VERIFICATION_FAILED` was not mapped.
  Applied public-code mapping to both signup and sign-in; added origin, connection,
  credential and create-user failure guidance. Raw provider errors stay hidden.
- Focused auth error tests **PASS**, 4 cases; web TypeScript and targeted ESLint
  **PASS**; diff whitespace check **PASS**. Backend signup previously returned 200.
- Requested actual browser address and whether failure occurs on Create account
  or Sign in. Browser-specific root cause is still unconfirmed without that detail
  or a new specific rejection message. No auth protections were disabled.

## 22. Login provider failure correction (2026-11-01)

- Reproduced both visible social buttons failing on the running app: Google and WeChat returned HTTP 404 `PROVIDER_NOT_FOUND`. Neither provider is configured. This is a confirmed failure path; the user's precise browser action remains unknown.
- Added public `GET /api/auth/capabilities` in `apps/api/src/interfaces/http/app.ts`, returning only configured provider names and email delivery mode, with no-store caching and no session lookup.
- Updated `apps/web/src/features/auth/AuthForm.tsx` to render only configured social providers and show console OTP instructions for local verification/password reset. Added safe provider-unavailable copy to `auth-error.ts` and English/Chinese auth locales.
- Extended `apps/api/test/mobile-oauth.test.ts` to verify disabled/enabled provider visibility, no secret exposure, and no session dependency. Extended the frontend error-code test and added `apps/web/src/shared/auth/auth-client.test.ts` to exercise the installed client, signup JSON, captcha and language headers.
- Verification: live local email signup HTTP 200 with account creation, then fixture cleanup; live capabilities endpoint HTTP 200 with no social providers and console email. API targeted suite 4 tests PASS; web auth suites 5 tests PASS; API/web TypeScript PASS; targeted frontend ESLint PASS; git diff whitespace check PASS.
- The new client test initially failed because fetch was mocked after client initialization; corrected test setup to mock before importing the client and reran successfully. No production workaround added.
- Full browser signup/OTP/session workflow remains unverified. Phase completion status unchanged. Google login requires separate Google OAuth credentials; Gemini API credentials do not enable OAuth.

## 23. Browser signup connection investigation (2026-11-01)

- User screenshots establish that the remaining failure occurs during email signup, with the TypeError/connection toast. The previous social-provider correction did not resolve this reported failure.
- Windows curl reached the WSL frontend `/api/health` with HTTP 200. Created a separate headless Windows Chrome profile, without opening or accessing the user's browser profile.
- In that browser, the real auth SDK reached the server and correctly rejected dummy sign-in credentials with HTTP 401 `INVALID_EMAIL_OR_PASSWORD`.
- Navigated to `http://localhost:5170/signin`, switched to Create account, filled a temporary fixture, waited for the real Turnstile test widget, and clicked the enabled submit button. The actual UI advanced successfully to the OTP form with local-console instructions. No JavaScript exception was observed. Removed only the temporary diagnostic account and its generated trip, then closed the isolated browser.
- No application source changes made: the user's exact browser origin/network error is still needed to reproduce their failure. Requested the address-bar URL (cropped out of screenshot). Do not disable captcha, weaken trusted origins, or claim this user-specific failure is fixed.
- Browser signup-to-OTP is now verified in isolated Windows Chrome; OTP verification, session creation, and the user's existing browser remain unverified. Phase completion unchanged.

## 24. Phase 4 — ElevenLabs spoken proposal summaries (2026-11-01)

State: **PARTIAL**. User explicitly requested Phase 4 progression while prior
phase acceptance remains incomplete. No earlier phase marked complete.

Implemented:
- `application/voice/spoken-summary.ts`: summary use case and speech port; owner-only unexpired stored proposals, deterministic Hindi/English narration of saved constraints, group budget, destinations and all warnings. No free-form text endpoint or extra model call.
- `infrastructure/voice/elevenlabs-speech-provider.ts`: fixed ElevenLabs Create speech endpoint, server credential/configured voices, multilingual v2, bounded MP3 buffer (4 MB), timeout/cancellation and sanitized errors. No new dependency.
- `SqlProposalStore.read` uses an owner-filtered fresh DB query. Composition reuses PostgreSQL proposal storage and the existing shared/process limiter with a separate speech namespace.
- `/api/voice/summary/text` and `/audio`: authenticated, trusted-Origin POSTs with strict UUID/language input, 1 KB request cap, no-store responses, five billed generations/user/minute and sanitized 429/503 states. No trip mutation.
- `features/spoken-summary`: request-on-click audio, displayed identical narration, English/Hindi choice, loading/error, cancellation, native replay/volume/mute and Stop. Pending requests and blob URLs are cleaned up. Integrated into the existing proposal panel. Saved-trip playback and progressive streaming are not implemented; summaries play during proposal review.
- Config recognizes `ELEVENLABS_VOICE_ID_EN/HI`. Added placeholder keys to `.env.example`, updated README/account instructions/API contract. Local ignored `.env` uses the multilingual voice from the official ElevenLabs API example, tested below. No credential printed or committed.

Verification:
- API new targeted suite: **12 tests PASS**, covering narration/budget/warnings, Hindi, owner/expiry checks, unavailable config, rate limiting, adapter failure/size handling, auth/origin/input/body limits and binary response.
- Full API `vitest run`: **49 files / 330 tests PASS**.
- Web playback suite: **2 tests PASS**, cancellation ignores late audio and replay/unmount revoke URLs.
- API and web `tsc --noEmit`: **PASS** after correcting Hono binary body to an owned ArrayBuffer. Targeted API/web ESLint: **PASS**.
- `BASE_URL=http://localhost:5170 pnpm build` in web: **PASS**.
- Official API documentation verified: https://elevenlabs.io/docs/api-reference/text-to-speech/convert. Multilingual v2 does not support language_code; the Hindi/English narration text and configured voices control language.
- Live voice-list request returned **401**; did not print provider body or assume TTS unavailable. Two actual short TTS calls via the implemented adapter **PASS**: English 24,284 MP3 bytes, Hindi 29,300 bytes. This proves generation, not listening quality or full UI integration.
- First local live-check script had a CJS/top-level-await format error; renamed the ignored diagnostic to `.mts` and reran successfully. Sandbox DNS denied network initially; approved external call used normally.
- docs/UI/whitespace checks passed before final documentation edits; final repeat recorded below.

Remaining gate: restart local dev after environment changes, generate a real
proposal, play Hindi/English in the browser, listen for understandable
pronunciation, verify stop/mute/replay/cancel and that an audio outage leaves
editing/approval usable. Full microphone-to-persisted-trip acceptance and Phase 3
existing-trip revision checks remain incomplete. No deployment or phase commit.

Final Phase 4 documentation checks: `node scripts/ui-check.mjs`,
`node scripts/docs-check.mjs`, and `git diff --check` all **PASS** after final edits.

## 25. Phase 4 correctness review (2026-11-01)

Reviewed the implementation against the Phase 4 task and acceptance gate.
Status remains **PARTIAL**, not complete. Owner/session/Origin validation,
server-only credentials, strict request inputs, deterministic visible/spoken
summary, Hindi/English selection, warning narration, cancellation, object URL
cleanup and native volume/mute/replay controls are implemented.

Corrected two review findings:
- Added a 15-second timeout to the frontend summary-text request, which previously
  could leave Preparing audio active indefinitely until manually cancelled.
- Require audio/mpeg from ElevenLabs before returning an MP3 response. Previously
  the adapter accepted any audio type. Added a wrong-audio-format regression case.

Verification: speech API/service/adapter suite **13 tests PASS**; frontend playback
suite **2 tests PASS**; API/web TypeScript and targeted frontend ESLint **PASS**;
UI and whitespace checks **PASS**. Prior live English/Hindi generation and build
results are retained in section 24, not claimed as newly rerun here.

Remaining acceptance evidence: real proposal playback in the browser; audible
Hindi/English intelligibility; controls including mute/replay on supported
browsers; provider outage leaving proposal editing/approval usable. Unit tests
and successful MP3 generation do not establish these. Playback remains on the
proposal-review surface; saved-trip playback is outside the current implementation.

## 26. Phase 5 — voice expense draft and ledger conservation (2026-11-01)

State: **PARTIAL**. User requested Phase 5 and will verify Phases 4/5 together.
Phase 4 browser/listening acceptance remains pending.

Implemented:
- `application/expenses/voice-expense.ts` and `infrastructure/ai/expense-model.ai-sdk.ts`: typed validated extraction port/adapter using the existing model factory. Hindi/Hinglish/English request extraction contains no arithmetic and never saves. Permission check precedes model access; provider failures are sanitized; limiter is separate from trip planning/voice tokens.
- Container and HTTP integration: authenticated trusted-Origin `POST /api/trips/:tripId/expenses/preview`, strict input/body cap, existing edit permission, per-user rate limit, no-store response and no client confirmation/save fields.
- `ExpenseVoiceDraft.tsx` + `model/expense-voice.ts` integrated into the existing BudgetBoard expense editor using existing VoiceInput. Reviewed transcript or typed input fills an editable draft. Payer uses explicit self or unique exact name only. Unspecified participants stay unselected. The requested participant count must match selection before explicit save. Unknown amount/currency/payer cannot be saved.
- `domain/trip/settlement.ts`: deterministic remainder distribution by sorted unique member IDs fixes independent-rounding conservation errors for the existing whole-unit ledger. Domain add/update and input schema reject fractional/unsafe amounts and duplicate participants instead of silently rounding. UI shows a share range for unequal whole-unit remainder allocation.
- Reused existing auth, model configuration, trip write service, expense entities, member selection/editor, SQL storage and settlement algorithm. No schema or amount-unit migration performed.

Verification:
- Full API suite after initial integration: **50 files / 336 tests PASS**.
- Expanded targeted voice-expense/domain suite: results below. Includes no inferred four-person subset, permission-before-model, invalid/rate/unavailable failures, five-member selected-four split, 100 conservation/settlement amounts, decimal/duplicate write rejection and HTTP auth/origin/input checks.
- Frontend member resolution: **2 tests PASS** (unnamed four of five stays empty; ambiguous/invented names rejected).
- API/web TypeScript **PASS**, targeted API/web ESLint **PASS**, docs/UI/whitespace checks **PASS**. Final build result below.

Remaining:
- Live Gemini expense extraction and browser microphone → draft → explicit save → reload acceptance are unverified.
- Decimal INR/paise persistence and display require coordinated schema/storage/API/UI work. The existing integer column stores whole currency units; this partial change does not claim paise precision.
- Custom split storage/UI, mixed-currency correctness, idempotent expense writes and safe retry after unknown save outcomes remain incomplete. Existing write flow is reused and is not claimed duplicate-safe.
- Phase 5 cannot be marked complete until the remaining financial and browser gates pass. No commit or deployment.

Final Phase 5 checks: expanded targeted suite **7 tests PASS**; web production
Vite/PWA build **PASS** (exit 0). Final docs/UI/whitespace checks **PASS**.

## 27. Phase 5 continuation — INR precision, custom shares and retries (2026-11-02)

State: **PARTIAL**, pending user browser acceptance. Section 26's precision,
custom-share and web-retry gaps are now implemented as described below; its
results remain a historical record.

- Generated and applied Prisma migration `20261101182311_expense_precision`
  from an ignored scratch schema. Existing amounts retain major-unit meaning;
  integer becomes Decimal(12,2), nullable custom allocations JSON added. Ran
  Prisma db pull and generate to produce committed schema snapshot/client.
  Updated MySQL fresh-install schema; existing MySQL upgrade/live verification
  remains unverified. No hand-written Prisma migration or snapshot.
- Added `domain/trip/expense-money.ts`: INR amount -> integer paise, deterministic
  equal remainders, exact participant/custom-share validation and total checking.
  Non-INR amounts preserve legacy whole-unit semantics. Aggregate add/update
  uses these rules; budget computes in minor integers and converts only at DTO
  boundaries. Different-currency expenses are explicitly excluded/labeled,
  never silently summed as equal units.
- Expense allocation storage/read mapping, DTO custom allocations and computed
  shares, INR formatting and same-currency conversion preserve fractions.
  Editor offers custom positive shares and validation; settlement explanations
  preserve fractions. Existing custom shares survive editing/reload.
- Web add form uses stable UUID request ID. Save awaits success, keeps the draft
  after failure and disables the form during persistence. SQL expense mutations
  lock the trip, read/check permission/mutate/persist inside one transaction.
  Same actor/trip/request with identical details returns existing expense; reuse
  with different details rejects with 409. Concurrent different request IDs
  retain both expenses. Request identity is optional for legacy clients.
- Fixed issues found by real DB verification: custom allocations were initially
  omitted from the SELECT; corrected read mapping. Serialized batched repository
  reads on the locked connection to avoid pg's concurrent-query deprecation.
  Earlier optimistic retry implementation was replaced by transaction-scoped
  locking/read to avoid inconsistent multi-query snapshots.

Verification:
- Full API Vitest after precision/custom changes: **50 files / 339 tests PASS**.
  One earlier run failed because a previous validation-message assertion still
  expected the old wording; updated that assertion and reran successfully.
- Full web Vitest: **19 files / 84 tests PASS**.
- API/web TypeScript and targeted API/web ESLint: **PASS**. Final check results
  after transaction read serialization/status mapping are appended below.
- `scripts/verify-expense-persistence.ts` against local PostgreSQL: **PASS**.
  Creates only generated fixture user/trip, tests 600.01 and custom shares after
  reload, concurrent/repeated same-key save creating one expense, changed-details
  reuse rejection, concurrent distinct saves retaining both, outsider rejection,
  and removes its fixtures. Final run passed with no concurrency deprecation.
- Live Gemini English and Hindi expense extraction: **PASS** for stated 600.50 INR,
  count four, self payer, and zero invented participant names. Credentials never
  printed. Initial sandbox network calls failed; approved calls succeeded.
- The local PostgreSQL process had stopped during continuation; restarted only
  the isolated project cluster on port 5430, then reran persistence verification.

Remaining: user browser microphone/transcript -> draft -> exact four of five ->
custom/equal confirmation -> reload, and Phase 4 listening/control acceptance.
Automated tests do not establish microphone quality or accessible browser flows.
Mixed-currency balances remain explicitly separate/excluded rather than converted
into one ledger; settled-payment recording is not introduced. Legacy clients
without request IDs do not receive duplicate-save protection. No deployment or
completed-phase commit claimed.

Final continuation checks: API `tsc --noEmit` and full Vitest **PASS**, 50 files /
339 tests, after final transaction implementation/cleanup. Web full suite **PASS**,
19 files / 84 tests; production Vite/PWA build **PASS**. Targeted API/web ESLint,
docs/UI checks and whitespace check **PASS**. Final real PostgreSQL fixture rerun
**PASS** after cleanup; no diagnostic accounts/trips retained. Phase 5 remains
PARTIAL pending browser acceptance; Phase 4 remains PARTIAL pending listening.

## 28. Phase 6 — budget intelligence and reviewed activity reductions (2026-11-02)

State: **PARTIAL**, implemented and backend-verified; browser acceptance pending.
Prior phases retain their outstanding manual checks.

Implementation:
- `application/budget/budget-service.ts`: validated explicit group forecast,
  deterministic integer-paise actual/committed/future/buffer calculation, remaining
  budget and per-planned-traveller average; complete-input gates and protected
  future activity candidates; AI proposal validation and revision-safe approval.
- `infrastructure/ai/budget-model.ai-sdk.ts`: existing AI SDK/model configuration
  chooses optional activity IDs only. The server computes savings and rejects
  invented IDs, insufficient savings and incomplete budgets. No invented prices,
  replacement places, schedule/booking claims or LLM arithmetic.
- `infrastructure/persistence/budget-store.db.ts`: explicit forecast persists in
  trip intake JSON; proposals reuse existing planning proposal storage. Approval
  locks proposal/trip, checks current actor permissions and revision, removes only
  eligible future optional stops, retains expenses/reservations/past activity,
  records old plan/estimates, actor/applied revision/timestamp and commits together.
  Concurrent approval retries are idempotent. Existing realtime publisher reused.
- Composition and HTTP: authenticated read endpoint; trusted-Origin, strict body,
  editor-only forecast/propose/explicit approval with request-size/AI rate limits.
  Approval is bound to session actor, stored ID and requested trip. Budget stale
  changes return 409; edit denial 403 and provider unavailable 503.
- `BudgetReplanPanel.tsx` + `model/budget-replan.ts`: integrated into BudgetBoard;
  current actual/commitment/forecast/remaining totals, explicit forecast entry,
  including other remaining meals/lodging/transport and buffer; missing data,
  error/loading/read-only states; model suggestion and before/after costs;
  separate Approve removals / Keep current itinerary actions. Trip revision changes
  refresh the budget after expense entry. Unknown legacy amount basis is not
  silently inferred.
- Required cross-feature correction in `SqlTripRepository`: expense mutations no
  longer delete/reinsert unrelated stops or delete existing expense rows. They
  upsert expense records and replace participant rows while preserving booking
  foreign-key links. Real paid-booking integration exercises this regression.
- No new schema or API credentials. PostgreSQL-only implementation; MySQL budget
  integration remains unavailable. INR only; mixed costs are explicitly incomplete.

Verification:
- Full API suite after final implementation: **52 files / 350 tests PASS**.
- Eight budget service/calculation tests cover shortfall, group/per-person values,
  booking deduplication, future eligibility, missing/foreign data, model rejection,
  proposal immutability and stale revision rejection. Three HTTP cases cover
  auth/Origin, tampered/unconfirmed approval and session/trip binding.
- Full web suite: **20 files / 85 tests PASS** (includes exact decimal input test).
- API/web TypeScript, targeted API/web ESLint, production Vite/PWA web build:
  **PASS**. Docs/UI/whitespace checks **PASS** before final documentation update.
- `node --env-file=../../.env --import tsx scripts/verify-budget-replan.ts` in API,
  approved local database access: **PASS**, including an expense-created shortfall,
  proposal discard leaving 3 stops unchanged, intervening-expense stale rejection,
  concurrent approval applying once, preserved paid reservation/linked expense and
  past activity, positive post-replan forecast, viewer denial and second-member
  reload of 2 stops, retained audit record. Fixtures cleaned up by generated IDs.
- The first unit test run failed because the new fixture omitted the existing
  required stop time; corrected the fixture and reran successfully. No test skipped.
- Live Gemini provider verification results appended below. Mock-based DB checks
  do not imply real travel data or browser success.

Remaining gate: user browser run confirming forecast -> new expense -> visible
shortfall -> AI proposal -> Keep versus Approve -> refreshed shared itinerary.
This release proposes removal of optional future activities only; alternative
verified routes/accommodation are outside this implementation. Savings remain
user-entered estimates; approval explicitly warns about resulting travel gaps.
No paid bookings or expenses are changed, and no payment/booking automation is
claimed. Earlier phase manual gates remain pending. No deployment or phase commit.

Live Phase 6 model check: the actual `AiSdkBudgetModel` **PASS** on a later
approved retry, selecting one supplied eligible activity. Earlier adapter attempts
returned sanitized `budget_unavailable`; their upstream cause was not established.
An independent structured-output probe also passed. No silent provider fallback
or fabricated model result was added. Final docs/UI/whitespace checks **PASS**.

## 29. Phase 7 — India travel evidence and fallbacks (2026-11-02)

State: **PARTIAL**. Implemented and provider-tested where available; browser
acceptance and successful live nearby-place response remain pending. No previous
phase is marked complete by this work.

Implemented:
- `application/travel/travel-data.ts` and `india-travel-service.ts`: reusable daily
  weather port and membership-authorized trip travel inspection. Reuses GeoService
  driving-only routing and nearby OSM/Google stay search; one to six ordered saved
  stops, no client coordinates. Includes source URLs, service date, request check
  time, explicitly unknown provider observation time and cache uncertainty.
- Official IRCTC/UTC/UPSRTC search handoffs, explicitly search links; local jeep
  schedules/fares/availability always need confirmation. No inventory scraping,
  invented schedules/prices/rooms or account-specific provider URLs.
- `infrastructure/travel/open-meteo-provider.ts`: fixed-endpoint daily min/max
  temperature and precipitation, valid India-calendar dates within today+15 days,
  nullable-data validation, 10-second timeout, bounded one-hour cache/single-flight,
  no serving expired forecasts as current. Preserves retrieval timestamp and
  displays CC BY 4.0 provider attribution. Separate narrow daily port avoids
  fabricating fields required by the legacy hourly OpenWeather DTO.
- `TRAVEL_WEATHER_PROVIDER=open-meteo` explicitly opts into free non-commercial
  daily forecasts; committed example defaults off. Local ignored env enabled for
  non-commercial verification. Commercial licensed adapter remains a deployment
  requirement; legacy OpenWeather UI/agent feature remains unchanged.
- Container/HTTP integration: authenticated trusted-Origin POST
  `/api/trips/:id/travel`, strict body/size/ID bounds, membership before provider
  access, separate 5/user/minute limiter, 429/Retry-After and sanitized failure.
- `IndiaTravelPanel.tsx` + `model/india-travel.ts` integrated into existing
  Reservations tab: ordered saved-stop selection, road estimate, nearby listings,
  daily forecasts, official transport links and accurate uncertainty copy;
  loading/cancel/empty/error/out-of-window/unknown-date/config states. Selection
  or trip revision changes clear obsolete displayed results. No new dependency,
  database schema or API credentials.

Verification:
- New travel/provider/HTTP suite **11 tests PASS**: fixed weather endpoint and
  timezone, single-flight/cache expiry, date limits/nulls/upstream failure, ordered
  driving route, unavailable transport inventory, provider fallback/search links,
  membership-before-call, unknown/repeated stops, coordinates, missing date,
  limiter, HTTP auth/Origin and rejection of client coordinates.
- Initial full API suite **53 files / 359 tests PASS**; two additional tests were
  then added and targeted suite passed. Final full-suite result appended below.
- API/web TypeScript and targeted API/web ESLint **PASS**; web production Vite/PWA
  build **PASS**. Docs/UI/whitespace checks **PASS**.
- Initial test code had a mock tuple typing error; corrected the test's call
  inspection and reran TypeScript. No application fallback bypass introduced.
- Live approved provider check used clearly labeled test coordinates, not claimed
  provider geocoding results. Lucknow -> Rishikesh -> Chopta -> Haridwar: road
  estimate **PASS**, 1,086 km, 3 route legs; Open-Meteo **PASS** for first stop's
  India-local date (2026-11-03). Separate Chopta forecast **PASS** for 2026-11-05.
  These are road/forecast estimates, not confirmed access, schedules or bookings.
- Live nearby-stay checks **UNAVAILABLE**: public Overpass capacity/502 timeout.
  Service retained road/weather/official links and reported listing failure;
  no fake listings or endpoint rotation. Mock listing/empty/failure behavior is
  verified; successful live nearby data is not claimed. Local jeep status remained
  needs_confirmation in both live runs. Sandbox-blocked calls were rerun using
  approved network access.
- Reviewed official provider docs/terms and booking-link sources (links in API
  docs). Free Open-Meteo non-commercial/CC BY terms are explicit. Optional
  Geoapify/openrouteservice/authorized inventory/GTFS adapters remain unimplemented;
  they were not needed to duplicate the existing geo stack.

Remaining: browser/mobile acceptance of the Reservations travel panel, successful
live nearby-place provider response, and geographically appropriate stored stops
in a real approved trip (test coordinates do not establish itinerary geocoding).
Live source availability cannot be guaranteed. Phase 8 medical search not started.
No deployment or completed-phase commit. README/API/account instructions updated.

Final Phase 7 full API suite: **53 files / 361 tests PASS**. Final API/web type,
targeted lint, production web build, docs/UI and whitespace checks **PASS**.
Phase remains PARTIAL pending browser acceptance and live nearby listing success.

## 30. Phase 8 — medical listings and offline resilience (2026-11-02)

State: **PARTIAL**, implemented and automatically verified; browser/mobile
acceptance and successful live medical-listing response remain pending.

Implemented:
- `application/medical/medical-service.ts`: validated stop or opt-in current-location
  search; membership before provider access, five searches/user/minute, strict
  radius/category/coordinate bounds, minimized GPS precision, no trip/location
  persistence. Reuses configured GeoService OSM/Google adapters, filters unrelated
  or distant results, deduplicates, sorts straight-line distance, caps ten listings,
  sanitizes phone formats and exposes published hours as unverified. Source/check
  metadata explicitly distinguishes cached/unknown observation time. No medical
  advice, emergency-capacity or current-open assertions.
- Container/HTTP `/api/trips/:id/medical`: session, trusted Origin, 1.5 KB cap,
  strict consent/location schema, membership, controlled unavailable/empty states
  and 429/503 handling. No API credentials or schema change needed.
- `features/medical-help`: dialog from map/planner, selected-stop default and
  correction, separate hospital/clinic/pharmacy filters, 5/10 km radius, explicit
  browser permission button, permission-denied/timeout fallback, loading/cancel/
  failure/empty states, category/address/listed phone/published hours/directions,
  source/check time and uncertainty. No automatic geolocation or emergency call.
  Closing unmounts search state and cancels pending requests.
- Public Emergency contacts in app shell outside auth gate/error boundary; India
  112 and separately labeled Uttarakhand 108 with official sources/review date.
  Contacts remain available without waiting for AI/Places/auth. They do not promise
  coverage or dispatch. Reviewed official 112.gov.in, health.uk.gov.in and current
  Google medical place types; no copied implementation or changed licenses.
- `features/offline-itinerary`: explicit local HTML download from Reservations
  tab, standalone escaped itinerary snapshot with CSP and contacts; excludes member
  details, expenses and notes. User opens the file to read offline. This is not
  a new authenticated offline app or an automatic private-data cache.
- Shared online/offline status; opened trip memory preserved during network errors
  with retry notice, while fresh 401/403/404 deny access. Offline edit controls
  disabled and expense mutations fail immediately instead of waiting silently
  for reconnection. Existing voice failure leaves typed input untouched.
- Corrected service-worker comment claiming IndexedDB owned trip data: no such
  persistence existed in this checkout. Auth/API/medical traffic remains uncached;
  full fresh-load offline authentication and IndexedDB trip storage remain absent.

Verification:
- API full Vitest **54 files / 370 tests PASS**, including **9 medical tests** for
  listing metadata/phone, membership-before-provider, missing vs unavailable,
  explicit consent/radius bounds, GPS precision/no trip mutation, category/distance
  filtering, limiting/location failure and HTTP session/Origin checks.
- Web full Vitest **22 files / 88 tests PASS**: explicit invocation/denied location
  tests, escaping/CSP/private-data exclusion in offline export, and existing nine
  recorder tests including timeout/permission/unavailable -> typed-input fallback.
- API/web TypeScript **PASS**, targeted API/web ESLint **PASS**, production web
  Vite/PWA build **PASS**. Docs/UI/whitespace checks passed before final docs update.
- Fixed checks introduced during implementation: duplicate ApiError import in the
  planner and unnecessary regex escape rejected by lint. Corrected both and reran
  successfully; no checks skipped.
- Approved live test used a clearly labeled Chopta test coordinate (not a real GPS
  trace, trip or medical listing). Hospital, clinic and pharmacy requests all
  returned **unavailable**, zero fabricated places, unknown emergency capacity and
  unknown opening status. Provider success/empty/listing behavior is verified with
  labeled mocks only; successful live coverage is not claimed. Initial sandbox
  network failures were rerun with approved network access.

Remaining acceptance:
- Browser/mobile Medical help discovery, keyboard/dialog behavior, explicit GPS
  permission allowed/denied paths and saved-stop correction.
- Open the downloaded snapshot with network disconnected; reconnect/retry an
  opened trip; verify no queued financial write or loss of typed request.
- Successful live Places listing response remains dependent on provider access.
  A clear no-data/provider-unavailable state is intentionally supported for Chopta.
- Earlier phase manual gates remain pending. No deployment or phase-complete commit.

Final Phase 8 docs/UI/whitespace checks **PASS** after documentation edits.
Phase remains PARTIAL pending browser/location/offline acceptance; no live medical
facility availability or capacity was established by these checks.

## 31. Through-Phase-8 requirements and correctness review (2026-11-02)

User requested comparison against the attached module/specification documents.
Reviewed the current working tree, including uncommitted implementation, against
RAAHI_PLAN and the older module requirements with architecture precedence intact.
Full findings: [PHASE_0_8_REVIEW.md](docs/raahi/PHASE_0_8_REVIEW.md).

- Verdict: implemented in substantial part, **not fully complete or accepted**.
- Confirmed source defect: ordinary stop saves delete/reinsert stops while
  reservation stop foreign keys use ON DELETE SET NULL; expense/replan-specific
  protections do not fix ordinary edits, votes or comments.
- Reproduced forecast defect without database/provider calls: a ₹200 unpaid
  activity today with a ₹100 cap reports ₹0 future costs, ₹100 remaining and
  no issues. Strictly-future eligibility currently also controls accounting.
- Ordinary stop mutations lack the expected-revision protection required for
  simultaneous edits. Source inspection only; no new concurrent DB run.
- Missing module requirements include recorded repayments, individual allocated
  budget caps, general existing-trip proposal application/rollback, and complete
  Indian demo replacement. Browser gates remain pending for every voice phase.
- Fresh checks: API 370/370 and web 88/88 tests passed, no pending tests;
  API/web type checks and web production build passed. Full web lint passed.
  Full API lint FAILED on one consistent-type-imports warning in
  `apps/api/test/voice-expense.test.ts:55`; not waived or hidden.
- Documentation/UI checks and diff whitespace checks passed. Local logs and JSON
  test reports: `.workspace/audit-through-8/`.
- Changed documentation only: this log, IMPLEMENTATION_GAPS.md and the new review.
  No application fixes, credentials, provider calls, database changes or browser
  acceptance were included in this audit. No completed-phase commit created.
- Next: fix data integrity and budget findings, implement remaining required
  modules, and verify the real two-account/mobile workflow before release.

## 32. Correctness fixes following the Phase 8 review (2026-11-02)

Implemented the confirmed persistence and forecast defects before adding modules.

- Retained stops now use dialect-aware upserts, preserving reservation stop
  foreign keys across ordinary edits, comments, votes and day reordering.
  Removed stops are still deleted when the approved operation removes them.
- Repository snapshot saves and day reorder/delete require the version captured
  before domain mutation. A transaction row lock checks it before any writes;
  stale snapshots fail with `trip_write_conflict` / HTTP 409. Updated manual
  use cases, AI operation registry, ambient comments and expense transaction
  callers. No schema migration or new dependency.
- Budget accounting includes remaining unbooked costs today and later, while
  automatic removals remain limited to strictly future dates. Missing costs
  today are reported. Updated forecast UI wording to explain this distinction.
- Fixed the API test type-import lint warning.
- New local database regression: `apps/api/scripts/verify-trip-integrity.ts`.
  Passed booking-link retention after edit/vote/comment/reorder, preservation
  of votes/comments, one winning concurrent save, and stale-save rejection
  after a newer expense. Initial sandbox connection failed EPERM; approved
  rerun passed. Fixtures are generated and cleaned up; no existing trips edited.
- Existing PostgreSQL proposal, expense and budget acceptance scripts all passed
  again after the changes, including approval idempotency and second-member reload.
- API typecheck, full lint and 372 tests passed. Web validation recorded below.
- API key presence checked without values: AI/ElevenLabs and both voice IDs are
  configured; Google Maps, OpenWeatherMap, Resend, Geoapify and ORS keys absent.
  No additional key is required for these fixes. Updated `.env.example` and the
  account guide with optional Google Places New/Routes setup and future needs.
- The broader missing modules (repayment recording, member-specific caps,
  general proposal revisions) and manual acceptance are NOT marked complete.
  This closes the confirmed defects; it is not Phase 0–8 completion.

Final verification for section 32: web typecheck, all 88 tests and production
build passed. Documentation/UI checks and `git diff --check` passed after edits.
All four local PostgreSQL acceptance scripts passed. No browser or live-provider
success is newly claimed; no secrets were displayed or changed.

## 33. Migration M0 — baseline and MongoDB compatibility (2026-11-03)

- **State:** DONE for M0 feasibility only. No runtime migration, I0 work,
  deployment or product phase completion claimed.
- **Authorization:** user requested the first migration task, then explicitly
  directed MongoDB/Mongoose only and will provide `MONGO_URI`. Do not ask them
  to restart PostgreSQL as a prerequisite for continuing the migration.
- **Baseline:** branch `dev/raahi`, HEAD
  `253ff744c3022d4deea1ce0de0aaab585c120512`; Node 26.13.0, pnpm 10.28.1.
  Archived 1,090 tracked/nonignored files, including earlier uncommitted work,
  under `.workspace/m0/source-baseline.tar.gz`; verified every archived file
  against SHA-256. Saved status and tracked binary patch. Excluded ignored
  credentials, uploads and dependencies. This is source recovery, not DB backup.
- **Files:** isolated `scripts/migration-m0/` package with pinned npm lockfile,
  compatibility script and manifest generator; generated route/data JSON;
  `docs/raahi/M0_BASELINE_AND_COMPATIBILITY.md`; updated migration/roadmap/agent
  instructions, docs index and connection-key guidance. Application source,
  application dependencies and Prisma schema unchanged by M0.
- **Reused contracts:** existing auth version/plugins, string IDs, source HTTP
  registrations, Prisma models/migrations and trip revision/finance invariants.
- **Inventory:** 62 route entries, 23 models, Prisma migration statements;
  auth internals remain delegated and realtime remains Worker-specific.
- **Compatibility:** Better Auth 1.6.23, Mongoose 9.11.4,
  mongodb-memory-server 11.3.0, disposable MongoDB 8.2.1 replica set.
  All nine checks passed: imported synthetic IDs/hash/cookie login/session,
  wrong-password denial, OTP/unverified-login rules, revocation, auth rollback,
  business rollback, concurrent revision rejection, uniqueness and minor units.
  Custom auth ID generation is required to preserve arbitrary string IDs.
  Pinned auth adapter has transactions but lacks the retries in current docs.
- **Validation:** `BASE_URL=http://localhost:8780 pnpm check` PASS (workspace
  typecheck, lint, tests, UI and all builds); manifest generation PASS;
  `MONGOMS_DOWNLOAD_DIR=/tmp/raahi-m0-mongodb node scripts/migration-m0/compatibility.mjs`
  PASS after approved dependency download/local port access. Syntax checks PASS.
  Initial package-version lookup failed because package.json is not exported;
  corrected to read metadata directly. No app fix was needed.
- **Known baseline limitation:** existing SQL integrity script first hit sandbox
  EPERM, then approved retry hit ECONNREFUSED because the local database was down.
  User declined SQL startup; no further SQL attempts. Historical SQL evidence
  remains historical, not freshly verified. No existing user data was modified.
- **Scope limits:** synthetic import only, not real SQL migration rehearsal;
  complete auth plugin flows, actual browser-cookie continuity, provisioning,
  application TypeScript integration and production repositories remain later
  gates. Browser/voice/provider acceptance still pending.
- **Next:** I0 India product cleanup. `MONGO_URI` belongs in ignored `.env` and
  must target a transaction-capable development replica set. Runtime connection
  wiring is M3; the disposable spike intentionally does not read this key.
- **Final documentation verification:** `node scripts/docs-check.mjs`,
  `node scripts/ui-check.mjs` and `git diff --check` all PASS after M0 edits.

## 34. Migration I0 — India source cleanup (2026-11-03)

- **State:** PARTIAL. User authorized continuation after M0. No M1 work started.
- **Recovery:** `.workspace/i0/source-before.tar.gz` captures tracked/nonignored
  source before edits; M0's verified baseline remains available.
- **Changes:** removed `apps/miniapp`, WeChat auth provider/plugin/config/button,
  deployment keys and Makefile targets; refreshed pnpm lockfile. Retained native
  OAuth/bearer mechanisms and Google/email/OTP/2FA. Updated active docs.
- **Indian demo:** versioned `india-north-v1`, six dates, Indian stops/coordinates,
  Indian display names, clearly labelled simulated estimates and empty ledger.
  Updated provisioning/template loader together. Existing persisted data untouched.
- **Defaults:** INR for new auth preferences/trips, India empty-map center/zoom,
  stored location data instead of Japan coordinate guessing, Indian placeholders.
  Image cache versioned with old image-cache deletion on activation.
- **Reused:** existing trip aggregate, provisioning clone, auth assembly,
  FSD auth surface, map and schedule components; no parallel implementation.
- **Tests:** API 370/370 and web 88/88 PASS after adapting old fixture assumptions.
  Two new India demo tests cover coordinates, evidence labels, no fake payments,
  cloned identity/ownership and template preservation. Four WeChat tests removed;
  JPY-specific conservation tests explicitly retain JPY and exact assertions.
- **Dependency check:** offline lock refresh failed on missing semver metadata;
  approved `pnpm install --lockfile-only --ignore-scripts` passed. Existing
  Better Call/Zod peer warning recorded. No miniapp importer/Taro entries remain.
- **Checks:** `node scripts/docs-check.mjs`, `node scripts/ui-check.mjs` PASS;
  initial whitespace warning corrected. Full workspace check result recorded below.
- **Remaining:** inherited screenshots/photography/icons and public asset audit;
  browser/mobile/cache acceptance; existing WeChat account recovery inventory;
  provenance-aware persisted demo replacement review. No DB reset, seed, account
  deletion, deployment or new live-provider request. Current application still
  needs M3 MongoDB wiring; user will provide `MONGO_URI`, no PostgreSQL restart.
- **Details:** `docs/raahi/I0_INDIA_PRODUCT_PROGRESS.md`. I0 stays partial and
  blocks proceeding to M1 until its acceptance gaps are resolved.
- **Final verification:** `BASE_URL=http://localhost:8780 pnpm check` PASS:
  all workspace typecheck/lint/tests/UI checks and docs/API/web builds.
  Additional India demo test run PASS (370 API tests total). Documentation/UI
  checks and `git diff --check` PASS after final documentation edits.

## 35. Migration M1 — Express Node transport (2026-11-03)

- **State:** PARTIAL acceptance; source implementation and automated transport
  verification complete, live/browser acceptance remains open. User explicitly
  requested the next module despite I0's outstanding visual/account gates.
- **Runtime:** Node entry now listens with Express 5.3.0 and request-scoped Sentry.
  SIGINT/SIGTERM stop admissions, drain active connections/deferred tasks and
  dispose pools; a 30-second HTTP deadline bounds active connections.
- **Source:** shared route registration/context in `interfaces/http/transport.ts`,
  Express routing/Web-to-Node streaming in `express-app.ts`, shared handler
  registration in `app.ts`. Error/response helpers no longer require Hono types.
  Retained Worker wrapper uses Hono and the same handlers. No duplicated business
  implementations, domain/service changes or database schema changes.
- **Contracts:** retained request IDs/cache/error envelopes, cookies, CORS,
  origin/session/role checks, raw auth payloads, multipart, route body limits,
  incremental responses/backpressure and disconnect abort/cancellation. Strict
  paths/case sensitivity and first-value query parsing match retained semantics.
- **Tests:** identical HTTP suites select Express by default through
  `test/http-app.ts`; explicit `test:worker` keeps legacy transport coverage.
  Express initially passed 370 existing API tests; full workspace run passed
  375 API tests including five bridge regressions. Final focused bridge suite
  passed 6/6 after strict-path regression was added. Worker suite passed 370,
  skipping Node-only bridge tests. The remaining test is additive, not a failure.
- **Commands:** approved `BASE_URL=http://localhost:8780 pnpm check` PASS across
  workspace typecheck/lint/tests/UI/builds; final API typecheck/lint PASS;
  approved focused `pnpm --filter @opentrip/api exec vitest run test/express-bridge.test.ts`
  PASS 6/6. Docs/UI checks and `git diff --check` PASS after documentation edits.
- **Environment issues:** initial package downloads failed with sandbox DNS;
  approved installation passed. Loopback tests failed EPERM in sandbox; approved
  executions passed. Initial type/lint issues were fixed. Logs under `.workspace/m1/`.
- **Dependencies:** added Express and its types through pnpm. Removed unused CORS
  packages after shared CORS middleware was extracted. No auth upgrade or Prisma
  edits. Node still uses existing composition until MongoDB/Mongoose M3; user
  will supply `MONGO_URI`. No SQL server startup/reset/seed or deployment.
- **Limits:** mocked services establish transport contracts, not live OTP/OAuth/
  TOTP/provider/browser acceptance or exhaustive route-fixture coverage. Shutdown
  has compile/static verification; process-level draining/restart still needs
  release testing. M5 supplies Node realtime/platform parity, M6 retires legacy
  runtime/dependencies. I0 image/account/demo-preservation gates remain open.
- **Docs:** `docs/raahi/M1_EXPRESS_TRANSPORT.md`, backend/API/architecture docs,
  roadmap, agent rules, README and migration index updated. Next module is M2
  familiar-folder organization when requested; Mongo repositories belong to M3.

## 36. Migration M2 — familiar backend folders (2026-11-03)

- **State:** DONE for M2. User requested continuation to the next module;
  earlier I0/M1/product acceptance gaps remain open and unchanged.
- **Recovery:** `.workspace/m2/source-before.tar.gz` captures the prior tracked
  and nonignored source, including existing uncommitted work. Move/rewrite maps
  and verification logs are local under `.workspace/m2/`.
- **Changes:** moved 149 files: application → services, persistence → repositories,
  provider/platform adapters → integrations, realtime adapters → realtime,
  composition → config/container.ts, environment config → config/env.ts.
  Domain and HTTP interface locations retained. Updated Node/Worker entries,
  tests, Prisma tools, verification scripts, active docs and generated-type ignore.
- **Reused:** all existing workflows, domain rules, providers, repositories,
  composition and HTTP transports; no compatibility wrappers or new behavior.
  No dependencies, schema, database configuration values or credentials changed.
- **Integrity:** 114 rewritten files differ only in module/source-inspection
  paths, verified by syntax/token comparison. Two period delimiter literals
  mistaken for paths in the initial rewrite were restored before final checks.
  All 721 relative imports across src/test/scripts/prisma resolve. Domain files
  and Prisma snapshot are byte-identical to the archive. No stale old-folder
  imports in active source/scripts/deploy/CI.
- **Checks:** approved `BASE_URL=http://localhost:8780 pnpm check` PASS with
  376 API tests, 88 web tests, workspace typecheck/lint/UI and all builds.
  `HTTP_TEST_TRANSPORT=worker BASE_URL=http://localhost:8780 pnpm --filter @opentrip/api test`
  PASS 370 tests, with six Node-only bridge tests intentionally skipped.
  `node scripts/docs-check.mjs`, `node scripts/ui-check.mjs` and
  `git diff --check` PASS after documentation changes.
- **Environment:** initial Node Git-inventory subprocess was denied EPERM before
  moves; approved retry performed the move. Full checks ran outside the sandbox
  because Express tests bind loopback ports. Existing build size warnings remain.
- **Docs:** current map in `docs/raahi/M2_BACKEND_LAYOUT.md`; backend/API/architecture
  and setup paths updated. Historical audits, prior logs and M0's baseline manifest
  retain historical paths. Use the M2 map when following them.
- **Limits:** no live database/provider/browser/deployment verification was run.
  No SQL startup, reset, seed or migration. Current repositories remain SQL until
  M3; user will supply `MONGO_URI`. Next task is M3 MongoDB/Mongoose persistence,
  models, transaction guarantees and Better Auth Mongo wiring.


## 37. Migration M3 — MongoDB/Mongoose persistence (2026-11-04)

- **State:** DONE for source implementation and isolated acceptance. The user
  requested the next migration module. Node now requires `MONGO_URI`; retained
  Worker SQL is unchanged as a deployment option until M5/M6. No real database
  migration, seed/reset, provider operation or deployment was performed.
- **Implementation:** one owned Mongoose connection, replica-set capability
  check, explicit business schemas/indexes, repeatable additive initialization
  journal, and Mongo trip/invite/preference/reservation/agent/proposal/budget
  adapters. Shared composition takes persistence ports; Node selects Mongo,
  retains Better Auth's supported adapter and enables formerly PostgreSQL-only
  planning/budget features. SQL tooling remains for M4–M6.
- **Auth:** pinned Better Auth 1.6.23 and Mongoose 9.11.4 share the native client
  successfully in application TypeScript and real tests. UUID strings preserve
  legacy non-ObjectId identities. Real Express tests cover synthetic imported
  password login, cookies/bearer, wrong password, signup, OTP verification,
  personal Indian sample trip creation, protected routes and logout/revocation.
- **Integrity:** snapshot reads, revision predicates on writes, transaction
  rollback, one winning stale-snapshot competitor, concurrent expense/reservation
  replay, booking link preservation/removal, proposal owner isolation and replay
  after expiry, budget permission/stale checks and successful atomic reduction,
  exact expense conversions, member projections, agent ordering/claiming,
  preference field isolation and concurrent invite acceptance are exercised.
- **Money correction:** inspection/test development established custom expense
  allocations use major units in the existing domain/API. Mongo stores validated
  minor-unit custom shares and maps them back, while preserving missing/equal
  allocation semantics. INR uses scale 100; legacy non-INR expense rules use 1.
  Reservation minor units and budget paise are unchanged. Migration plan wording
  and the field-level manifest were corrected accordingly.
- **Verification:** full `BASE_URL=http://localhost:8780 pnpm check` exited 0:
  389 API tests (including the then-13 Mongo tests), 88 web tests, package tests,
  typecheck, lint, UI checks and builds. After final reference/config/idempotency
  review, API typecheck/lint pass, and retained Worker suite passes 384 tests
  with six Node-only bridge tests intentionally skipped (390 total). Final
  Express Mongo suite passed all 14 tests; see `.workspace/m3/mongo-test.log`.
  Documentation and whitespace checks pass. Prisma snapshot remains unchanged.
- **Execution:** package downloads and loopback test ports required approved
  execution after sandbox network/EPERM errors. The first Mongo binary download
  was interrupted between turns; resumed download and isolated runs completed.
  Tests never read `.env`/`MONGO_URI`; every database was temporary and stopped
  during cleanup. Logs and local working scripts: `.workspace/m3/`.
- **Configuration:** checked only whether root `.env` has a nonempty `MONGO_URI`:
  NO. No secret values displayed. The user will provide it; do not request a
  PostgreSQL restart. Hosted URI/network acceptance remains unverified.
- **Docs:** `docs/raahi/M3_MONGODB_PERSISTENCE.md`, database/backend guides,
  README, `.env.example`, AGENTS, roadmap, account guide and migration rules
  updated together. SQL data export/import/reconciliation (M4), Node realtime/
  platform parity (M5), deployment/cutover/tooling retirement (M6), and previous
  visual/provider/browser acceptance gaps remain open.


## 38. Migration M4 — offline tooling and fresh-start decision (2026-11-04)

- **User decision:** explicitly selected “Start fresh; no existing data to
  migrate.” A real SQL-to-Mongo transfer/rehearsal is unnecessary for this
  project. M4 is complete for that scope; do not ask to start PostgreSQL.
- **Optional tooling:** `apps/api/scripts/migrate-mongo.ts` exports a read-only
  PostgreSQL snapshot, imports into a new offline Mongo database, reconciles
  every transformed field/count, and restores the archived source export.
  Explicit migration-only connection variables prevent implicit use of app DBs.
- **Coverage:** versioned committed-schema column manifest covers all 23 tables;
  live exporter rejects unknown/missing public tables/columns. Decimals and
  bigints export as strings. Exact decimal arithmetic maps INR expense totals
  and custom shares to paise; reservations retain their existing minor units.
  Auth IDs/hashes and timestamps are preserved, and imported login works.
- **Safety/limits:** fresh target only, ownership fence before initialization,
  one transaction for imported rows/counter/archive; late index failures roll
  back application data and leave an incomplete target fenced for inspection.
  Replay reconciles instead of overwriting. Full source archive retains metadata
  and source-only history. Offline tool is explicitly limited to 8 MiB; large
  batching/checkpoints, MySQL export, external upload copying/verification and
  post-cutover reverse migration are not implemented.
- **Verification:** full workspace check passed its then-395 API tests, 88 web
  tests and shared-package tests, typecheck, lint, UI checks and all builds
  (exit 0).
  The final focused migration suite passes six tests, including all-table import,
  trip/money assertions, imported Better Auth login, repeat/restore, next agent
  sequence, invalid/orphan/occupied-target rejection, late failure rollback,
  tamper detection and read-only SQL query orchestration. SQL query orchestration
  uses a fake source; Mongo import/auth/restore uses real disposable replica sets.
  Final API typecheck/lint and standalone CLI typecheck passed (exit 0);
  logs are in `.workspace/m4/`.
- **Privacy:** tests use synthetic fixtures and do not load application `.env`.
  No supplied database, legacy dataset, export, reset, provider or deployment was
  used. Export output is exclusive-create with mode 0600; source/auth archives
  must remain private. Existing `BETTER_AUTH_SECRET` must be preserved for any
  future encrypted-auth migration.
- **Docs:** `docs/raahi/M4_DATA_MIGRATION.md`, database guide, roadmap and index
  document the fresh start, command examples, limits and evidence. No Prisma
  schema change. Next requested module is M5 Node platform/realtime parity;
  Mongo URI setup and earlier browser/provider/visual gaps remain separate.


### M4 follow-up review — 2026-11-04

- User requested the M4 migration/reconciliation/rollback review. Preserved the
  explicit fresh-start decision; no live migration or M5 work performed.
- Fixed missing proposal owner/context/result reference validation before
  import. Fixed reconciliation to verify the archived source/digest, including
  source-only metadata; repeated import now refuses a corrupt rollback archive.
- Eight migration tests passed on a disposable replica set. Added regression
  cases for missing proposal references and archive corruption with otherwise
  matching application records. Verification logs: `.workspace/m4/review-*`
  and `.workspace/m4/migration-test.log`.
- Final API typecheck, lint, documentation and whitespace checks passed.


## 39. M5 Node platform parity — started 2026-11-07

- Inspected Node/Worker composition, realtime protocol/grants, Durable Object
  limiter and provider-limit wiring against the M5 plan.
- Node now supplies atomic bounded single-process rate-limit storage to auth and
  provider services. Express overwrites the private client-IP header from the
  socket; Node auth uses that header exclusively. Proxy topology remains an
  explicit staging task; process restart resets limits and scaling needs shared
  state. See `docs/raahi/M5_NODE_PLATFORM.md`.
- Regression coverage: simultaneous limit consumption, expiry/retry timing,
  capacity refusal, provider namespace isolation and spoofed header replacement.
  Logs: `.workspace/m5/`. WebSocket implementation, two-client/restart/revocation
  tests, proxy/deployment/CI and staging acceptance remain outstanding.
- No supplied database, real provider, deployment or data migration used.
- Verification passed: three Node limiter tests, six Express bridge regressions,
  API typecheck/lint, docs check and whitespace check. M5 remains IN PROGRESS.

### M5 follow-up — native Render preparation and realtime, 2026-11-07

- Added Node WebSocket rooms with authenticated membership/origin checks,
  ordered change fan-out, deduplication, multi-tab presence, access revocation,
  bounded client input/buffering and shutdown. Wired into Mongo composition's
  existing post-persistence publisher port. Reconnect always requests refetch:
  sequence-only cursors cannot safely identify an earlier server incarnation.
- Added optional same-origin frontend serving and explicit proxy CIDR trust.
  Added native Node Render blueprint/build instructions and Node/Mongo CI.
  User selected no Docker; Render is the recommended single-instance target.
  No deployment or hosting charges initiated. Template uses a paid service/disk.
- Full workspace check passed: 406 API, 88 web and 15 shared-package tests,
  typecheck, lint, UI checks and production builds. Three additional HTTP
  hosting/proxy tests passed after the full run; final API typecheck/lint and
  docs checks passed. Runtime-only Node TypeScript entry also compiles.
  Logs are under `.workspace/m5/`.
- User saved `MONGO_URI`; read-only connection/ping verified replica-set support.
  No supplied database data was written/reset and no migration was performed.
- M5 remains IN PROGRESS pending hosted acceptance: actual proxy identity,
  two authenticated browser edits backed by Mongo, streaming/cancellation,
  persistent uploads across restart and telemetry. Local WebSocket tests use
  injected authorization; separate Mongo integration tests use real disposable
  replica sets. Render secrets/provider email and hosting creation are user steps
  documented in `deploy/render/README.md`. Multi-instance coordination remains
  unsupported; run one process. Cloudflare retirement remains M6.

## 40. M6 local cleanup — 2026-11-07

- User explicitly deferred Render deployment and requested M6 cleanup now,
  with a Git commit before changes. Created local checkpoint `9ab6726`; ignored
  `.env` and `.workspace` files were not committed. Nothing was pushed.
- This overrides the original hosted M5-before-M6 ordering for local cleanup
  only. Hosted acceptance and production cutover remain pending.
- Isolated SQL composition and Hono/Worker entry under `src/legacy/`, removing
  their runtime imports from Node service composition and the HTTP route table.
  SQL/Worker packages remain development-only for historical tools/tests; unused
  Hono adapters were removed. Added a runtime import-graph regression gate.
- Archived the old Cloudflare workflow outside GitHub's active workflow folder;
  marked root Cloudflare commands `legacy:*`. Normal Make setup/dev/API commands
  now use MongoDB without PostgreSQL startup, migrations or Docker.
- Updated current operations/architecture docs and marked old deployment guides
  as historical. Preserved SQL snapshots/migrations and optional migration tools.
  Final controllers/routes/db reorganization remains deferred per user request.
- No real database writes, resets, provider calls or deployment occurred.
  Verification results are recorded below after completion; logs: `.workspace/m6/`.
- Final verification: full `pnpm check` passed (exit 0): 410 API tests, 88 web
  tests, 15 shared-package tests, workspace typecheck/lint, UI checks and all
  production builds. Documentation and whitespace checks passed. Frozen/offline
  lockfile validation and Make setup/API dry runs passed. Initial moved-file
  test import failures were corrected before this final run.
- Local M6 cleanup is complete; M5 staging acceptance and M6 hosted cutover/
  backup-restore rehearsal remain deferred. Cleanup changes are uncommitted for
  review; `9ab6726` is the requested pre-cleanup recovery checkpoint.

## 41. India-wide product cleanup — 2026-11-07

- User requested removal of inherited destination content and clarified Raahi
  serves all India, not only Uttarakhand. Kept the existing regional onboarding
  trip as a labeled example; did not change supplied database records.
- Replaced inherited landing captures with labeled React trip previews spanning
  Rajasthan, Kerala, Goa, Meghalaya and the Himalayas. Updated both landing
  locales, destination placeholders, user guide and Chinese README.
- Retired inherited documentation screenshots, videos and promotional clips;
  historical originals remain in Git. Source audit finds no old destination
  mentions in active authored product copy. Accurate currency support remains.
- INR is now the settings picker default. Medical/offline contacts now use the
  verified nationwide 112 contact; removed unconditional regional ambulance
  guidance. Travel shortcuts now cover IRCTC trains/buses and BusIndia providers.
- Added medical routing regressions across five regions, including Port Blair,
  and an offline-export check preventing unconditional regional contacts.
  See `docs/raahi/INDIA_WIDE_PRODUCT_CLEANUP.md` for scope/sources and limits.
- Deployment remains deferred. No real database writes or provider searches
  performed; browser visual acceptance and fresh demo recordings remain pending.
- Final verification: full `pnpm check` passed (exit 0): 415 API tests, 88 web
  tests, 15 shared-package tests, workspace typecheck/lint, UI checks and all
  production builds. Docs and whitespace checks passed. Initial preview i18n
  array-key type errors were fixed before the final run. Logs are under
  `.workspace/india-product/`. Existing M6 changes were preserved.

## 42. Voice-first guided planning and seasonal prompt — 2026-11-07

- User described microphone → animated listening → reviewed text → Gemini
  response + ElevenLabs speech, with constraint questions and mobile layout.
- Centralized model policy covers all India, missing constraints, strict budget,
  destination discovery, dates/month, timing/pace/accessibility and region-specific
  seasonal considerations. Unknown dates/years are never assumed; current
  closures, permits and safe access are explicitly unverified.
- Added optional intent preferences and preview response/timing/questions while
  preserving existing payload compatibility. Client retains initial request
  across typed/voice follow-ups and offers an explicit dates-undecided checkbox.
- Made microphone prominent in planning and landing CTA. Added reduced-motion
  aware listening feedback, stacked narrow-screen details, wrapping costs and
  full-width audio controls. Existing dialog visual-viewport behavior retained.
- Kept explicit transcript/send/save and playback controls. This is turn-based;
  continuous hands-free talk, spoken clarifications and automatic playback remain
  unimplemented. Live microphone/audio and browser viewport acceptance pending.
- Added preference/guidance propagation regression and transport-level prompt
  checks. No deployment, real database mutation or live provider calls performed.
  See `docs/raahi/VOICE_FIRST_PLANNING_FLOW.md`; logs: `.workspace/voice-flow/`.
- Final full workspace check passed (exit 0): 416 API, 88 frontend and 15
  shared-package tests, typecheck/lint, UI checks and production builds. Final
  frontend typecheck/lint also passed after the refinement-input polish. Docs
  and whitespace checks passed. No browser viewport or live speech/model run
  is claimed by these checks.

## 43. Conversational new-trip voice interface — 2026-11-10

- **Scope:** user requested implementation of the animated microphone → reviewed
  transcript → explicit Send → model reply → automatic ElevenLabs playback flow,
  with speech opt-out and removal of unnecessary existing controls.
- **Implemented:** single conversational composer with previous messages, floating
  microphone with listening/speaking states, finalized text inserted for editing,
  voice preference retained in browser storage, automatic replies, stop/replay,
  cancellation on recording/send/hide/unmount, and browser autoplay-block handling.
  Complete itinerary/evidence/costs live in an expandable section; saving remains
  explicit and disabled while an unsent change/recording/request is present.
- **Simplified:** removed separate planning follow-up/transcript forms and old
  manual spoken-summary UI/language switches. Disabled Markdown fixed formatting
  toolbar in notes/journal; existing content/editor support retained. Retired
  speech component copies (including prior local edits) preserved locally under
  `.workspace/voice-agent/retired/`. Manual trip creation remains a secondary option.
- **Backend:** 1–4,000 character prompts; owner-scoped expiring clarification and
  preview replies stored in existing mixed proposal payloads. Speech reads the
  same visible reply in its original language. Clarification IDs explicitly
  reject approval. Existing origin/session/rate/expiry checks remain. No database
  schema/index migration, real database mutation, deployment or provider call.
- **Verification:** frontend suite PASS 94 tests (including rendered React
  conversation and audio lifecycle tests); focused planning/speech/approval plus
  disposable Mongo suite PASS 56 tests. Frontend lint and changed API-file lint
  PASS; UI/docs/whitespace checks PASS. Frontend production build/typecheck PASS
  before the final retired-component cleanup; final build result recorded below.
- **Full workspace gate:** `BASE_URL=http://localhost:8780 pnpm check` FAIL at
  existing API typecheck errors from English-only locale work: remaining `zh`
  entries in `integrations/email/email-copy.ts`, street-view locale branches and
  `test/street-view-grounding.test.ts`. A separate final API typecheck confirms
  those same errors; no new voice-file type errors reported. This task does not
  mark the overall project green.
- **Test corrections:** Express HTTP tests initially hit sandbox loopback EPERM;
  approved execution passed. Updated the old minimum-length test for conversational
  short input. DOM harness supplies missing jsdom AbortSignal.any/localStorage;
  audio rejection handling now recognizes DOMException by name across realms.
- **Limits:** no real-browser viewport inspection, live microphone transcription,
  audible ElevenLabs response or live model run claimed. This is tap-to-record and
  send, not continuous hands-free/barge-in conversation. Phase acceptance remains
  PARTIAL until live browser/device verification. Logs: `.workspace/voice-agent/`.
- **Docs:** `VOICE_FIRST_PLANNING_FLOW.md`, API platform contract, frontend UI
  system and roadmap updated for the new interaction and speech contract.
- **Final frontend gate:** `BASE_URL=http://localhost:8780 pnpm --filter
  @opentrip/web build` PASS after the retired-component cleanup, including
  TypeScript and PWA production output. Existing bundle-size warnings remain.
  Final docs and whitespace checks PASS.

## 44. 2026-11-11 — Phases 1–4 audit and mobile planning

- **Phase 1:** improved live committed/partial transcript visibility and compact
  microphone state. Explicit Send remains required. Scoped live STT token issuance
  passed; real microphone recognition in English/Hindi/Hinglish remains unverified.
- **Phase 2:** existing-trip prompts include retained plans, preserve dates/day
  count and allow days without additions. Combined schedules validate travel,
  overlaps, rest and return travel. Unknown existing timing blocks approval.
  Live English/Hinglish model extraction passed; full live geo itinerary acceptance
  remains separate from deterministic service tests.
- **Phase 3:** implemented the user's selected additive behavior on Mongo.
  Approval preserves existing plans, expenses and bookings, checks current edit
  permission and revision transactionally, applies retries once and publishes
  realtime changes once. Disposable Mongo tests cover concurrent approval,
  second-member reads, stale previews and revoked editing permissions. Retained
  SQL approval remains new-trip-only. No supplied database was reset or modified.
- **Phase 4:** automatic speech ignores replies arriving in hidden tabs; mute,
  stop, replay and autoplay recovery remain. Live English/Hindi TTS returned audio.
  Audible pronunciation and physical-device playback still require acceptance.
- **Mobile:** full-height planning dialog, independently scrolling conversation,
  stable composer, editable starter prompts and larger controls. Browser checks
  passed at five viewport sizes including reduced height, explicit send,
  clarification, voice opt-out, reduced motion and no horizontal overflow.
  APIs were mocked in this browser run; screenshots were visually inspected.
- **Structure:** shared planning composition moved to `widgets/trip-planning`
  (both new and existing trip entry points); voice/audio remain reusable features.
  Temporary browser harness moved out of app source to `.workspace/phases-1-4`.
- **Cleanup:** resolved stale English-only locale type errors in email and street
  view copy/tests. Existing notes/journal formatting-toolbar cleanup is retained.
- **Verification:** frontend 97 tests PASS; focused API 89 tests PASS, including
  16 disposable Mongo tests. Final workspace result recorded below. Logs, browser
  screenshots and provider status evidence: `.workspace/phases-1-4/`.
- **Status:** phases remain PARTIAL for the explicitly listed live/device gates;
  automated success is not claimed as end-to-end microphone acceptance.

- **Final gate:** `BASE_URL=http://localhost:8780 pnpm check` PASS: workspace
  typechecks, lint, 535 tests (423 API, 97 web, 15 shared packages), UI checks and
  production builds. `pnpm docs:check` and `git diff --check` PASS. Existing bundle
  size warnings remain. The first final run caught a missing frontend cost-scope
  type; fixed before the passing run. Sandbox loopback failures were rerun with
  approved permissions. Nothing was deployed or committed.

## 45. 2026-11-11 — Phase 5 audit and expense review corrections

- **Audit:** voice extraction, exact INR shares, custom allocations, permission
  checks and idempotent persistence already exist. No duplicate expense engine
  or schema migration was added.
- **Corrected:** settle-up explanations previously divided custom expenses
  equally and included other currencies. They now use saved shares, deterministic
  paise remainders and same-currency filtering. Transfer traces previously divided
  major-unit values by 100 again and skipped sub-unit transfers; they now compute
  in minor integers and convert once. Regression tests cover custom shares,
  four-of-five exclusion, fractional sums, paise transfers and whole-unit currency.
- **Voice/mobile:** compact animated microphone, reviewed text and explicit draft
  extraction; cancellation retains text and ignores late replies. Saving is
  blocked while recording/interpreting. Exact-member selected/requested counts
  and 44-pixel participant targets improve the review step. Duplicate spoken names
  resolve to one participant ID.
- **Mongo acceptance:** disposable five-member trip, selected four, 600.01 INR,
  concurrent same-key retries, exact zero-sum balances, excluded fifth member,
  changed-payload rejection, outsider rejection, custom-share reload and second
  member read all PASS. No supplied database touched.
- **Tests:** full web suite PASS (104 tests); focused voice-expense and Mongo
  suite PASS (25 tests). Build/typecheck/lint final results recorded below.
- **Remaining:** real microphone → draft → exact member confirmation → Save →
  browser reload acceptance, including device permission and audio behavior.
  Live extraction evidence from section 27 is retained, not claimed rerun.
  Phase 5 remains PARTIAL until that device/browser gate is exercised.
- **Evidence:** `.workspace/phase5-review/`. No deployment or commit.
- **Final checks:** frontend production build/typecheck and lint PASS; API
  typecheck and changed-test lint PASS; docs/UI/whitespace checks PASS. Removed
  an unused type import caught by lint after extracting settlement calculations.
  Existing build-size warnings remain. Browser/device acceptance was not rerun
  in this phase; React interaction tests are not claimed as a browser run.

## 46. 2026-11-12 — Finance, rollback and phases 5–8 acceptance

- **Authorized scope:** user selected implementation of repayments, individual
  caps and proposal rollback alongside browser and live-provider verification.
- **Repayments:** separate records of money already transferred, explicit
  confirmation, exact minor units, debtor/creditor bounds, current edit permission,
  revision checks and same-request replay. Voiding preserves actor/time audit.
  Neither recording nor voiding changes travel expenses or allocated spending.
  Settle-up balances and explanations account for net repayments.
- **Personal caps:** optional member limits in trip currency with allocated actual
  spending and remaining allowance. Editable by trip editors; clearing is explicit.
  Caps do not invent allocations for future group estimates or prohibit recording
  real spending. Existing non-INR whole-unit semantics remain.
- **Persistence:** optional strict embedded `finance` schema; additive migration
  002 records rollout without backfilling or rewriting old money. Mongo writes
  serialize on the trip revision and publish realtime invalidation. SQL legacy
  storage has no new finance/history write implementation.
- **Existing-trip proposals:** reviewed additive stop application is retained.
  New planning/budget approvals keep before/after stop snapshots; budget approvals
  also keep the prior forecast. History provides a review then explicit rollback.
  Rollback is atomic, idempotent and only available at the applied revision;
  later edits/bookings block it. Expenses, finance, membership and bookings stay
  intact. Reverted proposals cannot be reapplied. Older approvals without
  snapshots cannot be retroactively rolled back.
- **Mobile and medical fixes:** collapsible finance/history sections, accessible
  full participant names and explicit selector labels. Browser testing exposed
  a missing Base UI portal in MedicalHelp; replaced with the existing responsive
  dialog sheet. A failed GPS request now clears previously selected coordinates.
- **Backend tests:** focused expense/budget/medical/Mongo suite PASS 52 tests;
  Mongo persistence/migration suite PASS 28 tests, including repayment retry,
  cap overspend, voiding, rollback preservation and stale rollback rejection.
  Frontend suite PASS 106 tests before final dialog/label fixes; final checks below.
- **Live providers:** configured Overpass endpoint failed with a connection
  timeout (also reproduced with direct curl). Documented alternative
  `overpass.private.coffee` failed to connect; `maps.mail.ru` returned HTTP 504.
  No successful nearby/medical result is claimed. Alternatives were process-local
  diagnostic overrides; app configuration and production credentials were not
  changed. Public instance reference: https://wiki.openstreetmap.org/wiki/Overpass_API
- **Evidence:** `.workspace/phases-5-8/`. Browser API uses a disposable replica set
  and synthetic Better Auth accounts. No supplied database was reset or used.

- **Combined browser acceptance PASS:** actual React components, real Better Auth,
  HTTP services and disposable Mongo. Verified reviewed transcript → explicit
  extraction → exactly four of five → save → reload; second authenticated member
  reads the same expense; balances conserve paise. Rejected replan preserves stops;
  approved replan removes them; reviewed rollback restores them. Repayment/void
  and personal-cap changes persist. GPS is opt-in, permission denial clears prior
  coordinates, saved-stop selection remains available, directions encode location,
  provider errors can retry, offline search is disabled and contacts remain visible.
  Downloaded HTML contains itinerary but no member/expense details; mobile has no
  horizontal overflow. Screenshots inspected. Speech events, model outputs and
  medical listings were synthetic fixtures, not live provider acceptance.
- **Browser corrections:** fixed the missing medical portal and stale GPS state;
  added explicit accessible names for member and finance/location controls. Test
  selectors were corrected to distinguish payer from participant groups and not
  depend on a particular currency-minus glyph. Permission denial is exercised in
  the correct isolated browser context.
- **Automated gate:** 548 workspace tests PASS (427 API, 106 web, 15 shared),
  typechecks/lint/UI checks PASS. Final build result below. Temporary app harness
  moved back under `.workspace/phases-5-8`; no test route or account in production.
- **Final gate:** `BASE_URL=http://localhost:8780 pnpm check` PASS through all
  production builds. Docs and whitespace checks PASS. Existing bundle-size
  warnings remain. Disposable browser API/Mongo stopped after verification.
  No deployment, commit or production configuration change.
- **Remaining acceptance:** successful live nearby/medical results (three tested
  public endpoints timed out or returned 504), physical microphone/audio quality,
  and a live-model end-to-end replan. Browser fixtures do not establish those gates.


## 47. Live browser provider acceptance (2026-11-15)

- **Isolation:** disposable Mongo replica set and synthetic authenticated users;
  actual configured model and ElevenLabs adapters, without response fixtures.
  The local browser harness forwards API calls with authentication and Origin;
  it does not replace provider responses or the Scribe SDK. Production database
  and configuration were not modified. Local harness CAPTCHA disabled only for
  synthetic sign-in. Browser viewport 390 × 844, reduced motion enabled.
- **Voice PASS:** existing ElevenLabs-generated English audio was decoded to WAV
  and supplied through Chromium's fake microphone device. The real SDK opened
  the live Scribe WebSocket, received partial transcripts, and committed
  “Where would you like to travel?”. The editable draft did not submit until
  Send. The live planning endpoint returned a clarification; the real summary
  endpoint returned MPEG audio and the browser emitted `playing`. Voice-off
  control switched off successfully. No page errors or horizontal overflow.
  This verifies recorded-audio browser integration, not human microphone quality,
  pronunciation, audible speaker quality, or mobile-device autoplay policies.
- **Model PASS:** live English and Hinglish extraction plus English/Hindi speech
  generation passed direct adapter checks. Browser expense interpretation used
  the real model with typed text (not a fabricated transcription): ₹600.01 lunch
  for four people. Exactly four of five members were required; save/reload and
  second-member reads passed; balances conserved paise. Live-model budget replan
  rejection preserved stops; approval removed the optional stop and reviewed
  rollback restored it. Repayment/void and individual cap persistence passed.
- **Medical still BLOCKED:** actual browser GPS consent and search reached the
  live backend. OSM returned `status: unavailable`, not listings. The configured
  Overpass endpoint timed out, a direct diagnostic also timed out, Private.coffee
  timed out, and VK Maps returned HTTP 504. No sample facilities substituted.
  Existing Google alternative needs a locally configured Google Maps key with
  Places API (New); Routes API is needed by the shared travel adapter. Geoapify
  remains unimplemented. All three alternatives were process-local diagnostics,
  not production endpoint changes.
- **Evidence:** ignored `.workspace/live-acceptance/providers.log`,
  `browser-final.log`, `browser-evidence.json`, `finance.log`, `places.log`,
  `places-alternative.log`, `places-coffee.log`, `medical-diagnostic.log`,
  `voice.png`, and `medical.png`. Harness scripts are retained in that directory.
  Corrected harness-only routing, Origin forwarding and detached Audio event
  observation during verification; no application behavior change was necessary.
- **Gate boundary:** successful live medical listings and directions to returned
  facilities, physical-device microphone/audio quality, and complete live-model
  itinerary generation are still unverified. Prior automated fixtures remain
  useful regression tests but are not evidence of those gates.
- **Closeout:** documentation and whitespace checks PASS. Temporary browser entry
  files archived outside the app; disposable API/Mongo and Vite stopped.


## 48. Local environment cleanup (2026-11-15)

- Grouped private `.env` by current Node/Mongo app, authentication, storage, model,
  ElevenLabs, geo providers and weather. Removed duplicate assignments, retired
  SQL/Worker/WeChat entries, the unused `BTTER_AUTH_SECRET` typo and empty unused
  provider/observability slots. Preserved all effective retained values exactly,
  including the newly supplied Geoapify key. No credentials displayed or committed.
- Reworked `.env.example` for current Node/Mongo development. Optional supported
  features and deployment settings are commented; legacy SQL and speculative
  inventory/routing variables are no longer part of the default template.
- Geoapify remains pending implementation; its key is clearly marked as inactive
  until the adapter is added. The active provider was not silently changed.
- Validation PASS: retained values unchanged, no duplicate keys, `loadNodeConfig`
  parses the cleaned file, required Mongo/model/speech settings and Geoapify key
  are present. Validation did not connect to the database or any paid provider.


## 49. Geoapify adapter verification and test coverage (2026-11-15)

- **Audit finding:** The `GeoapifyGeoProvider` adapter, `GeoService`, `MedicalService`
  wiring, `createGeoProvider` factory, and `loadNodeConfig` env parsing for
  `GEO_PROVIDER=geoapify` / `GEOAPIFY_API_KEY` were already fully implemented.
  Section 47 noted "Geoapify remains unimplemented" because the live OSM/Overpass
  endpoints timed out during the browser acceptance run — not because the Geoapify
  code was absent. The adapter was already present and correct.
- **Category mapping verified:** `hospital` → `healthcare.hospital`,
  `medical_clinic` → `healthcare.clinic_or_praxis`, `pharmacy` → `healthcare.pharmacy`
  passed upstream; response normalization adds human aliases (`hospital`, `clinic`,
  `pharmacy`) alongside the raw Geoapify category strings so `MedicalService`
  filtering matches correctly for all three healthcare categories.
- **New test coverage added** (`test/geoapify.test.ts`): 11 net new tests (17 total,
  up from 6). Added:
  - `clinic` and `pharmacy` category mapping for `placeNearby`
  - `placeSearch` (text, bias, limit params)
  - `placeDetail` (Place Details v2, null on empty collection)
  - `reviewLookup` unsupported without network call
  - Transit unsupported for `routeMatrix`
  - `createGeoProvider` selects `GeoapifyGeoProvider` from config
  - `MedicalService` × Geoapify integration: hospital, clinic, pharmacy listing
    and empty-result paths, verifying sourceUrl, category pass-through, and
    distance filtering end-to-end.
- **Full suite:** 419/419 tests pass (`pnpm --filter @opentrip/api test`).
  No application code changed; only tests were added.
- **Remaining gate:** live browser acceptance with the configured `GEOAPIFY_API_KEY`
  (place search returning real Indian hospital/clinic/pharmacy listings and
  directions to returned facilities). The adapter is ready; the gate is a live
  network test, not a code gap.

## 50. Render deployment configuration follow-up (2026-11-15)

- User reports Blueprint deployment now boots and `/api/health` returns 200 after
  configuring S3 and resolving email configuration. Private Render values and
  live user journeys have not been independently verified.
- Confirmed unsupported shutdown override is already absent. Changed
  `GEO_OSM_USER_AGENT` to `sync: false` so the Blueprint does not impose an
  incorrect service hostname; configure the existing service in its dashboard.
- Hardened `deploy/render/build.sh`: require a public HTTPS origin without path,
  credentials or trailing slash, reject loopback, and require `TRUSTED_ORIGINS`
  to include the origin. Actual assigned hostname still needs operator checking.
- Diagnosed weather: `TRAVEL_WEATHER_PROVIDER` only selects travel evidence;
  `/api/weather` and `checkWeather` still require `OPENWEATHERMAP_API_KEY`.
  Documented this separation without changing provider contracts.
- Updated Render guide with existing-service environment repair and rebuild
  steps. No deployed hostname, credentials or private environment values added.
- Validation PASS: `bash -n deploy/render/build.sh`, 10 isolated Node origin
  validation cases (via Python harness), `pnpm docs:check`, `git diff --check`.
  Full application build/tests not run: changes are deployment validation and
  documentation only. No push, deploy, remote environment mutation or live
  weather/email verification performed.

## 2026-11-15 — Mobile map and streaming voice UI polish

Status: **DONE** for implementation and local verification. Live Gemini and
ElevenLabs calls were not made during this pass.

- Restored mobile medical help at the top left; compacted the member/invite row,
  enlarged the title header, and moved Plan more stops below map search.
- Removed map connection layers. Yellow rounded pins show `day·stop`, preserving
  itinerary order and including day/place in accessible labels. Place-name labels
  appear only for selected/focused pins. Bounds refresh when visible coordinates
  change, even when the stop count stays the same.
- Reserved bottom space between map controls and the assistant launcher. Shared
  blue orb styling replaces the robot/avatar; planning/chat composers and voice
  activity use blue/violet/pink light. Recording and speech show animated waves;
  reduced motion disables activity animation.
- Added incremental planning guidance through the existing preview endpoint,
  service and model port. AI SDK structured-output chunks reach the browser as
  NDJSON snapshots, then the validated/persisted result replaces the draft.
  Approval and speech use the final result only. Cancellation aborts model work,
  clears provisional text and preserves typed or spoken input.
- Reused MedicalHelp, ExistingTripPlanning, coss dialogs/buttons, VoiceInput,
  TripMap, planning validation and the existing proposal approval flow.
- Updated `docs/frontend/map.md`, `docs/frontend/ui-system.md`, and the incremental
  planning preview contract in `docs/backend/api/platform.md`.

Verification (actual results):

- `pnpm typecheck` — PASS.
- `pnpm lint` — PASS.
- `pnpm --filter @opentrip/web test` — PASS (initial 111 tests); the subsequent
  `BASE_URL=http://localhost:8780 pnpm check` also passed the expanded web suite.
- `pnpm --filter @opentrip/web exec vitest run src/shared/api/client.test.ts src/widgets/trip-planning/ui/TripProposalPanel.test.tsx`
  — PASS, 9 tests including incremental UTF-8 chunks, incomplete streams and cancel.
- `pnpm --filter @opentrip/api exec vitest run test/planning.test.ts test/planning-model.test.ts test/planning-reply.test.ts`
  — initial sandbox HTTP bind failure; PASS outside sandbox, 34 tests. The added
  real-SDK/mocked-SSE adapter test subsequently passed (6 adapter tests).
- `BASE_URL=http://localhost:8780 pnpm check` — typecheck, lint and web tests passed;
  API tests failed under sandbox restrictions. Ran the API suite separately with
  local-server permission: `BASE_URL=http://localhost:8780 pnpm --filter @opentrip/api test`
  — PASS, 55 files / 421 tests, including disposable MongoDB integration tests.
- `pnpm ui:check`, `pnpm docs:check`, `git diff --check` — PASS.
- `BASE_URL=http://localhost:8780 pnpm build` — PASS across the workspace.
- Browser: disposable Mongo fixture at 320, 390, 768 and 1440px; no horizontal
  overflow or page errors; Plan more stops below search on mobile; map controls
  do not intersect the assistant; day filtering preserves day/stop identity;
  medical and planning dialogs open. Dark theme
  screenshots visually inspected. Artifacts and browser script are under
  `.workspace/mobile-polish/` (ignored). First-run location and assistant sheets
  were dismissed as part of test setup.

Remaining verification: optional live Gemini streaming and microphone/speaker
listening check with the user's configured providers. No new credentials or
configuration variables are required. No deployment or commit performed.
