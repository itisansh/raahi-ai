# Raahi AI — Implementation Plan for Codex CLI

**Status:** Proposed roadmap; **not yet executed or verified against the user's local clone**.  
**Updated:** 2026-10-27  
**Base:** [OpenTrip](https://github.com/stvlynn/OpenTrip) — extend in place, preserve its working behavior and license.  
**Priority:** Voice-first itinerary generation, followed by expense voice commands and budget-aware replanning.

## 1. Product objective

Raahi AI is an India-first, collaborative travel planner for small groups and students on strict budgets. A traveler can speak a full planning request in Hindi, Hinglish or English. Raahi transcribes the utterance, extracts constraints, checks destinations and travel feasibility, drafts an itinerary with cost/evidence labels, presents a preview, saves the approved proposal into a shared trip, and speaks a concise answer via ElevenLabs.

**Hero test case (illustrative, not a verified live price):**

> "Hum paanch dost Lucknow se six days mountains trip plan kar rahe hain, ₹7,000 per person. Rishikesh aur Chopta dekhna hai. Trains, buses, stays, food aur trekking consider karke plan banao."

Expected: five travelers, ₹35,000 combined budget, origin Lucknow, 6 days, candidate Rishikesh/Chopta itinerary, map stops, explicit unknown dates, budget breakdown and uncertainty/source labels, approval before write, persisted group trip, short spoken Hindi/Hinglish summary. Do **not** fabricate train seats, bus departures, confirmed hotel prices or trekking conditions.

## 2. Reference document precedence and compatibility

**Required under `docs/`:**

- `docs/RAAHI_AI_REPOSITORY_AUDIT_AND_VOICE_PLAN.md` — primary feature-reuse and voice-architecture reference.
- `docs/RAAHI_AI_BUILD_v1.2.md` — detailed PRD, use cases, contracts, long-term features and India scenarios.

**Optional:** `docs/RAAHI_AI_INDIA_TRAVEL_APIS.md` — source selection and licensing.

This plan supersedes earlier architecture choices in v1.2 if they would replace OpenTrip's working React/Vite/Hono/Better Auth stack with unrelated Next.js/Supabase Auth patterns. The live checkout remains the definitive source for file paths, scripts, migrations and APIs. Codex must verify, not assume, specific implementation details.

### Preserve/adapt matrix

| Existing reference | Borrow/adapt | Compatibility strategy |
|---|---|---|
| **OpenTrip (base)** | Trip UI, trip AI, maps, invites, votes, schedules, expenses, settlements, auth | Preserve existing code; extend current domain/services/UI patterns |
| **Travex** | One-shot itinerary input/output; optional receipt review | Port ideas/schema to Hono tools; do not use its localStorage as shared storage |
| **AI Trip** | Verify places before saving; natural-language itinerary edits | Port algorithms/contracts, not Vue/Nuxt UI |
| **NomadSync** | Stable trip context, proposed version changes, rollback | Implement in existing Postgres and API; do not introduce MongoDB |
| **TREK** | Robust expense logic, offline design | Reference patterns only; respect AGPL license |
| **Turistar** | Real-time collaborative UX | Keep existing auth/database and add version-safe sync as needed |
| **Raahi-specific** | Hindi/Hinglish voice, budget-aware replan from actual ledger, Indian transport/provider evidence, nearby medical search | New features behind typed interfaces and tests |

### Primary technical stack

| Layer | Decision |
|---|---|
| Web | Existing React + Vite + TypeScript + Tailwind/FSD components |
| API | Existing Hono server / Node-compatible host |
| Database | Existing PostgreSQL + Prisma conventions |
| Authentication | Existing Better Auth and trip role checks |
| Maps | Existing MapLibre stack and geo provider |
| AI | Existing Vercel AI SDK agent/tools plus structured Zod schemas; choose/test a provider separately |
| Speech in | **ElevenLabs Scribe Realtime** using official SDK and server-issued scoped token where supported |
| Speech out | **ElevenLabs TTS** (short summary, user-initiated playback) |
| Alternative STT | Wispr only after real docs, legal API access and integration smoke tests |
| Weather | Existing provider or Open-Meteo where permitted |
| India geo | Existing geo provider; optional Geoapify / openrouteservice |
| Transport | Authorized provider adapters + booking link-outs + explicit unknown/simulated states |
| Deployment | Keep existing options; Render Node service + hosted Postgres is a possible target after baseline proof |

## 3. Architecture boundaries

```text
Trip discovery page / existing AI trip pane
  → push-to-talk microphone and editable transcript
  → backend authenticated intent endpoint
  → trip-scoped context and AI tool orchestration
  → sourced place/route suggestions + deterministic feasibility checks
  → versioned proposal (NO automatic write)
  → review and approve
  → existing OpenTrip trip-write operations + persistent DB
  → visible shared schedule/map/budget
  → concise grounded speech via ElevenLabs TTS (optional, non-blocking)
```

**Avoid new parallel architecture:** reuse OpenTrip's trip mutation pipeline, permission checks, API and UI patterns; do not implement a second trip table, second authentication provider or second expense ledger.

### Suggested internal contracts (adapt names to actual code)

```ts
type VoiceIntent =
  | { type: 'trip.create'; origin: string | null; days: number | null; travelers: number | null; budgetPerPersonPaise: number | null; destinationHints: string[]; startDate: string | null; language: string }
  | { type: 'trip.modify'; tripId: string; instruction: string }
  | { type: 'expense.add'; tripId: string; totalPaise: number | null; payerId: string | null; participantIds: string[] | null; description: string }
  | { type: 'trip.replan'; tripId: string; constraintChange: string }
  | { type: 'facilities.search'; tripId?: string; location: { lat: number; lng: number } | null; query: string };

type EvidenceStatus =
  | 'VERIFIED_PROVIDER_RESULT'
  | 'PUBLISHED_TIMETABLE'
  | 'ROAD_ESTIMATE'
  | 'UNVERIFIED_THIRD_PARTY'
  | 'LOCAL_CONFIRMATION_REQUIRED'
  | 'SIMULATED_DEMO'
  | 'UNAVAILABLE';

type RaahiProposal = {
  id: string;
  baseTripRevision: number | null;
  parsedIntent: VoiceIntent;
  preview: unknown; // replace after inspecting OpenTrip itinerary contracts
  sources: Array<{ provider: string; url?: string; checkedAt?: string; status: EvidenceStatus }>;
  estimatedCosts: { minPaise: number | null; maxPaise: number | null; bufferPaise: number };
  warnings: string[];
  approvedAt?: string;
};
```

Source labels are assigned by adapter validation, not chosen by the model. Reuse existing schemas wherever possible; the above is **an illustrative interface**, not an instruction to duplicate types.

## 4. Phase roadmap — only one active phase at a time

### Phase 0 — Check out and baseline OpenTrip (P0, mandatory)

**Tasks**

1. Verify repository remote, commit hash, branch, operating system, package versions, `.env.example`, README, upstream `AGENTS.md`, repo decision docs and scripts.
2. Confirm required two Raahi docs exist in `docs/`. If absent: inspect-only, then stop until provided.
3. Follow checkout-specific local setup using safe development database; no reset of unknown DB.
4. Run existing tests/build/checks (`make check` if supported), and manually inspect sign-in, create trip, schedule/map, AI suggestions, shared expense screen.
5. Write a code map: exact frontend AI pane/wizard, backend agent entry point, trip write tool, DB schema and expense services.
6. Record baseline command results, gaps, environment variable names, license, exact git SHA in `BUILD_PROGRESS.md`.

**Gate:** Existing OpenTrip functionality is demonstrated or failures are documented and understood. **Do not build Raahi features on an unexamined broken baseline.**

### Phase 1 — Voice UX and reliable transcription (P0)

**Tasks:** Reuse design system to add microphone to trip-creation/discovery and existing trip assistant; recording indicator, explicit start/stop, permissions, final transcript, edit-and-submit, keyboard fallback, errors/timeouts and mobile permission handling. Integrate official ElevenLabs Scribe Realtime with server-issued scoped access. Protect permanent keys. Add mock provider for automated tests and deliberate error simulation.

**Gate:** Mic press → spoken Hindi/English text → editable finalized transcript. Denied mic permission and STT provider outage still permit typed input. No itinerary is yet written merely from transcription.

### Phase 2 — Voice request → constrained trip proposal (P0)

**Tasks:** Define trip-intent schemas, extract origin/group size/total days/per-person budget/destination hints/dates/preferred language; normalize ₹7,000 to 700000 paise; ask for missing mandatory details; fetch existing trip context; use OpenTrip's AI SDK / trip tools to generate candidate itineraries. Validate stop coordinates using an existing or compatible places adapter. Calculate day/leg feasibility and estimated ranges using deterministic code, display labels for unverified travel information.

**Gate:** One spoken or typed prompt creates a complete **preview**, not automatically saved. It contains five travelers, six days, declared budget, suggested verified place coordinates, source labels and any unknown dates. Bad JSON, unavailable providers and implausible connections do not become accepted trip facts.

### Phase 3 — Approve, persist and collaborate (P0)

**Tasks:** Connect proposal preview to existing OpenTrip approved trip mutations, membership checks, map stops and day schedule. Use proposal ID, `tripRevision` and idempotency to prevent retries duplicating the trip. Keep approval history and reject stale changes. Confirm refresh and second-account trip visibility. Preserve existing votes/invites.

**Gate:** Human approves once → exact itinerary persists after reload and is accessible only to authorized members. Repeated approval doesn't duplicate records. Nonmembers receive authorization failures.

### Phase 4 — ElevenLabs spoken reply (P0; sponsor-critical)

**Tasks:** Integrate short summary playback via ElevenLabs TTS in backend; stream/play safely, cancel/mute/replay controls, relevant Hindi/English voice choice, no autoplay absent interaction. The spoken text must describe the same approved/proposed itinerary and express important uncertainties. Graceful failure leaves readable text.

**Gate:** A traveler can hear a concise, understandable response to the generated trip. TTS failure does not lose plan or impede editing.

### Phase 5 — Voice expenses + deterministic splits (P0)

**Tasks:** Reuse OpenTrip expense entities and settlement code; parse voice expense request, confirm payer, currency, amount and **exact** participant subset, compute integer paise allocations, save through authorized service, show balances, avoid duplicate writes. Optional receipt scanning after core passes.

**Gate:** In a five-member group, “I paid ₹600 for four people” triggers a follow-up to identify which four before writing. Shares sum to ₹600 and the group balances sum to zero. Refresh displays correct ledger.

### Phase 6 — Budget-aware itinerary replanning (P0 flagship)

**Tasks:** Compute actual group spending + committed bookings + future estimates + buffer against both per-person and group budget. Detect overruns, propose affordable changes to *future editable* stops, compare old/new itineraries and costs, require group/user approval as appropriate, persist version and audit trail. Never adjust historical expenses or paid bookings invisibly.

**Gate:** Entering a new expense creates a reproducible shortfall and a visible replan proposal; accepted proposal changes future itinerary and all members see it; rejected proposal leaves itinerary unchanged.

### Phase 7 — India travel evidence adapters (P1)

**Tasks:** Existing map/geo provider first; Geoapify places/medical location when terms permit; Open-Meteo when forecastable; optional openrouteservice; railway and bus links to official/authorized services; optional permitted published timetables and regional GTFS. Return provider URL, observation time, service date and evidence status. Distinguish road travel estimate from scheduled transport. Implement caching, provider errors and demo fixtures clearly labeled.

**Gate:** Lucknow → Rishikesh → Chopta → Haridwar route displays geographically sensible stops, with unknown local jeeps shown as needing confirmation. No fabricated trains, prices or available hotel rooms.

### Phase 8 — Nearby medical facilities and resilience (P1)

**Tasks:** Ask location permission or use selected itinerary stop; find nearby hospitals, clinics, pharmacies from permitted Places provider; show category, phone/address if available, directions, checked timestamp and uncertainty. Make emergency contact information easily accessible; do not claim a listing has emergency capacity or is open without evidence. Also test offline/retry behavior for saved plans and voice-text fallback.

**Gate:** Search based on selected Chopta location returns sourced, labeled results or a clear no-data state. No geolocation without permission.

### Phase 9 — Deployment, tests and judge demo (P0 release gate)

**Tasks:** Choose one target (Render Node + hosted Postgres if suitable, or existing Cloudflare/Docker) and deploy after local success; configure CORS, Better Auth origin/cookies/HTTPS, rate limits, server-side secrets. Run E2E in deployed environment. Test two accounts, mobile viewport, voice input/output, expenses and replan. Keep a labeled demo fixture fallback that never pretends to be live travel availability. Prepare a 2–3 minute narrative and a rollback path.

**Gate:** One deployed, authenticated end-to-end run proves real persisted state, valid group access, deterministic finance, and voice functionality. API outage states are honest and usable.

## 5. Must-have vs cut-first

**Must-have demo:** baseline OpenTrip, microphone and STT, one-shot structured trip proposal, approval/persistence, ElevenLabs TTS, collaborative groups and reliable expense splits. **Flagship target:** budget-aware replanning from actual spending.

**Cut first if time-limited:** fancy 3D UI, multi-agent orchestration, flight ticket checkout, unofficial live train inventory, auto-booking, receipt OCR, weather embellishments, multi-currency expansion, continuous interruption-capable voice conversation, offline writes. Medical-facility lookup can remain a post-demo bonus.

## 6. Critical validation scenarios

| Scenario | Expected result |
|---|---|
| Group of five, ₹7,000/person, six days | Budget cap ₹35,000; unverified estimates plainly labeled |
| User does not specify dates | Ask for dates or mark undecided; never invent exact trains |
| Voice partial recognition contains wrong amount | Only finalized/edit-confirmed amount is used |
| Five members; expense shared by four | Request exact four member identities |
| ₹100 split between three | Split 3334, 3333, 3333 paise deterministically |
| Duplicate POST due to retry | One trip/expense created (idempotency) |
| Two members edit simultaneously | Stale `tripRevision` rejected or merged explicitly |
| User without trip membership requests edits | Forbidden (403 or equivalent) |
| Provider returns no transport data | Clear UNAVAILABLE / booking link-out; no invented availability |
| Weather requested outside horizon | No fictional day-specific forecast |
| TTS offline | Text remains visible; trip/ledger not rolled back |
| Budget replan after paid booking | Preserve booked/paid expense and suggest only editable alternatives |
| Medical search without consent | Use selected place or request permission; no silent tracking |

## 7. Workflow for every Codex session

1. Read `AGENTS.md`, `RAAHI_PLAN.md` and `BUILD_PROGRESS.md`.
2. Confirm the current phase, user-approved scope and required docs are present.
3. Inspect touched modules and existing tests first. Present a short change plan.
4. Implement the smallest working slice. Add tests for failures and edge cases.
5. Run focused tests then global checks, record exact outputs/status.
6. Update `BUILD_PROGRESS.md`, checked scope and blockers; state next phase only if current gate passes.
7. Ask before making destructive DB changes, deleting data, major architecture rewrites or external real-world actions.

### Starting prompt to paste into Codex

```text
We are extending the checked-out OpenTrip codebase into Raahi AI.
Read AGENTS.md, RAAHI_PLAN.md, BUILD_PROGRESS.md, and the two Raahi specification files in docs/.
Do not modify code yet. First audit the local repository and compare it with the documents.
Identify existing AI tools, trip mutation flow, frontend planning interfaces, map and budget features, auth and migrations.
Run safe baseline checks and write the exact results (including blockers) in BUILD_PROGRESS.md.
Report the first implementable small task from the current phase, but do not start the next phase without passing its gate.
Voice-first trip creation is our primary feature; preserve all existing OpenTrip functionality and conventions.
```

## 8. External references (confirm current terms when implementing)

- OpenTrip source: https://github.com/stvlynn/OpenTrip
- ElevenLabs STT: https://elevenlabs.io/docs/overview/capabilities/speech-to-text
- ElevenLabs TTS: https://elevenlabs.io/docs/overview/capabilities/text-to-speech
- Codex `AGENTS.md`: https://developers.openai.com/codex/guides/agents-md
- Product and provider research: the `docs/` files listed above.

**This is a target implementation architecture, not a claim that any new Raahi feature has been built or tested.**
