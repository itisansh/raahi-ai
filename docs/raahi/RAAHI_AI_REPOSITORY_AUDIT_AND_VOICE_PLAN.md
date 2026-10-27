# Raahi AI — Six-Repository Audit and Voice-First Integration Blueprint

Research snapshot: 27 October 2026. Intended for an AI coding agent (Astra GPT) and human review.

**Scope & evidence:** Based on public GitHub READMEs, selected package manifests, application entrypoints, and official ElevenLabs documentation. These projects were **not cloned, built or end-to-end tested** in the research environment. “Documented” means claimed/described in the source; code/runtime behavior requires local verification. An absent README feature is **not proof that no code exists**.

## Executive decision

**Use OpenTrip's React/Vite UI and Hono/Node/PostgreSQL application architecture as the potential base.** Do not rebuild it in Next.js merely because an earlier specification named Next.js. Build Raahi-specific voice, India transport and budget-aware planning as explicit modules. If a clean OpenTrip fork proves too complex after initial smoke tests, use it as an architectural/UI reference and build a smaller React + Hono prototype instead.

Most important deliverable: user presses a microphone button, says in Hindi/Hinglish/English that five friends want a budget trip from Lucknow, sees the transcript, gets an actual proposed day-by-day itinerary with geographically checked places and labeled transport uncertainty, approves it, sees the trip saved for group members, and hears a short spoken summary through ElevenLabs.

## 1. OpenTrip — recommended base

Repository: https://github.com/stvlynn/OpenTrip — Apache-2.0.

**Verified stack:** React 19, TypeScript, Vite, Tailwind, MapLibre GL, TanStack React Query, Vercel AI SDK, Hono REST API, Better Auth, Prisma, PostgreSQL, with existing `@hono/node-server` and a Node server entrypoint; also supports Cloudflare runtime.

**Documented features:** Trips/dashboard, group invitations/roles, voting, comments, interactive map with numbered stops/day routes/place search, day schedule cards and transit segments, weather hints, reservations, group expenses and minimal settlements, multi-currency display, PWA, shared per-trip AI chat with proposed edits requiring approval, English/Chinese locale support.

**Important observations:** AI does not start automatically without `AI_MODEL` and `AI_API_KEY`. `.env.example` supports `AI_PROVIDER`, `AI_BASE_URL`, OSM geo (Nominatim/Overpass/OSRM) or Google geo. The app already has `apps/api/src/node-server.ts`, which listens on `PORT` — useful for Render. Public OSM services are rate-limited and should not be treated as unlimited production APIs. Read and verify the exact agent tool surface before extending.

**Take:** Principal React UI, trip scoped chat and approval pattern, trip/member/expense/schedule persistence, map and PWA. **Build new:** voice UI/STT/TTS; one-prompt multi-day initial generation; Indian multimodal transport adapters; budget-aware replanning; nearby medical search; verified travel source metadata; Hindi/Hinglish responses.

Source: README https://github.com/stvlynn/OpenTrip ; app manifests https://raw.githubusercontent.com/stvlynn/OpenTrip/main/apps/api/package.json and https://raw.githubusercontent.com/stvlynn/OpenTrip/main/apps/web/package.json ; node server https://raw.githubusercontent.com/stvlynn/OpenTrip/main/apps/api/src/node-server.ts ; sample env https://raw.githubusercontent.com/stvlynn/OpenTrip/main/.env.example

## 2. Travex — simple AI planner and receipt ideas

Repository: https://github.com/mr-sanjai-offl/travex-ai-travel-planner — MIT.

**Verified stack:** React 19, TypeScript, Vite, Tailwind 4, `@google/genai`; browser `localStorage` for persistence. No multi-user server/database evident in manifest.

**Documented features:** Prompt-based itinerary using destination/date/group size/budget/interests; stay, food, transport, attraction and daily recommendations; rating/refinement of itinerary; export blueprint; add crew; paid-by expense entry; equal split and settlement; receipt photo OCR extracting amount/description; mobile responsive UI.

**Code observation:** `geminiService.ts` creates structured JSON for whole itinerary and supports feedback refinement. Output names/fees/review-like descriptions in AI output aren't independently verified just by using a schema; Raahi must geocode/check places and distinguish estimated prices. Client-side model key flow should be replaced with backend API calls.

**Take:** Prompt fields, structured initial-plan schema, receipt extraction workflow, user-feedback refinement. **Do not take:** localStorage as group source of truth; unverified AI-suggested costs as confirmed prices; raw UI if unwanted.

Source: https://raw.githubusercontent.com/mr-sanjai-offl/travex-ai-travel-planner/main/geminiService.ts and repository README.

## 3. AI Trip — strongest place-verification pattern

Repository: https://github.com/Ripwords/ai-trip — MIT.

**Verified stack:** Nuxt 4/Vue 3 + Nitro, TypeScript, Vercel AI SDK (DeepSeek/Gemini), Better Auth, Drizzle ORM, Neon PostgreSQL, Google Places/Distance Matrix/Geocoding, Redis, Resend, Zod, Tailwind, Bun, PWA; Vercel deployment.

**Documented features:** Intent-specific add/remove/edit/reschedule/optimize AI commands; candidate generation → Google Places validation/enrichment → travel-time-aware scheduling → structured itinerary; discuss-mode proposals/SSE; one-shot whole trip generation; drag/drop; route optimization; idea bucket; group roles/votes/comments/activity attendees/audit logs; public sharing; flights tracking; reservation organizer; packing; expense custom splits/receipt attachments/currency exchange/CSV export; travel history and interactive maps.

**Take:** The *pipeline*, not Vue UI components: natural-language intent parsing, verify named places, open hours and estimated transit time before saving, proposal review and structured mutations. Adapter interfaces permit Geoapify/OSM initially and Google Places if a funded key is available.

**Do not take directly:** Nuxt/Vue components or Drizzle migrations into React/Hono/Prisma. Port conceptual behavior to Raahi's own services/schemas, and test.

Source: https://github.com/Ripwords/ai-trip

## 4. NomadSync — agent context and versioning patterns

Repository: https://github.com/shankerram3/NomadSync — public code; inspect licensing before copying. Root license file was not obvious in the examined top-level listing (backend manifest says ISC, but that does not necessarily license all repository contents).

**Verified stack by manifests:** React 18 + Vite/Tailwind/shadcn-style components; Express/Node/TypeScript backend, MongoDB native driver, JWT, OpenAI SDK and Zod. README describes LangGraph architecture, but the inspected backend package manifest does **not** list `@langchain/langgraph`; verify actual implementation before relying on the claim.

**Documented implemented features:** Chat planner; trip memory/confidence; stored plan versions, diffs, rollback, votes/conflict resolution; multi-user collaboration; SSE updates; Google Places; Amadeus flight search cards; dynamic tool registry. **Marked in progress or planned:** memory auto updates, hotels/weather/attractions, some advanced conflict tooling and notification paths. Expense splitting is in the repo description but not clearly verified by its implemented-features section — confirm in the code.

**Take:** Structured trip context, confidence/source distinctions, version history, auditability, conflict management. **Do not take directly:** Express/Mongo data layer, JWT login, potentially incomplete integrations, unverified LangGraph dependency.

Source: https://github.com/shankerram3/NomadSync and https://raw.githubusercontent.com/shankerram3/NomadSync/main/backend/package.json

## 5. TREK — mature feature reference, not a transplant

Repository: https://github.com/liketrek/TREK — AGPL-3.0.

**Verified stack:** React 19 + Vite client; NestJS 11/Node server with MikroORM + SQLite, Zustand, WebSockets, Leaflet/MapLibre, PWA/IndexedDB offline support; large npm workspaces.

**Documented features:** Rich day schedule, multi-modal map routing, POIs, Open-Meteo, hiking and elevation support, train/flight/accommodation reservations, CSV/PDF exports, receipts, multi-payer splits as integer minor currency units, currency conversion, real-time group chat/polls/invites, collaboration, checklists, offline trip view and edit queue, AI assistant and MCP (some components are disabled by default), plugin ecosystem.

**Take as engineering lessons:** accurate integer-money arithmetic, per-member settlement ledger, offline-first travel access, saved bookings and checklists, WebSocket sync and idempotency on offline resubmission, routes/terrain and medical-nearby integration ideas.

**Do not copy directly:** AGPL-licensed implementation code into a differently licensed proprietary product without analyzing obligations. Major framework/database mismatch; build the minimum needed independently or choose to comply with AGPL if reusing.

Source: https://github.com/liketrek/TREK

## 6. Turistar — clean collaboration and real-time inspiration

Repository: https://github.com/andre-lmarinho/turistar — AGPL-3.0.

**Verified stack:** Next.js App Router + React/TypeScript, Tailwind, tRPC/TanStack Query, Supabase Auth/PostgreSQL/Realtime, Leaflet, drag-and-drop via dnd-kit, Vitest/Playwright.

**Documented features:** Trip boards, day activities with live collaborative sync, place search and interactive map, activity/additional category costs, invited registered users with admin/member permissions, demo trips, English/Portuguese.

**Take:** Responsive drag/drop day planner concepts, real-time co-editing permissions, optimistic updates. **Do not copy directly:** Next.js routing, Supabase Auth into Better Auth, or AGPL code without corresponding license compliance.

Source: https://github.com/andre-lmarinho/turistar

## Cross-repository comparison

Legend: D = explicitly documented; P = partial/planned; — = not confirmed in examined sources. These are source claims, not runtime verification.

| Capability | OpenTrip | Travex | AI Trip | NomadSync | TREK | Turistar |
|---|---|---|---|---|---|---|
| AI text itinerary generation | D (trip AI advice; verify one-shot generation) | D | D | D | D (optional) | — |
| Trip-scoped conversational agent | D | — | D | D | D (optional) | — |
| AI trip edit with approval | D | Feedback regenerate | D | Version/rollback | D (optional) | — |
| Verified place resolution | OSM/Google provider | — | D (Google) | D (Google place search) | D (multiple providers) | Place search |
| Group membership / collaboration | D | Local crew only | D | D | D | D |
| Map & day schedule | D | Day text | D | D | D | D |
| Group expenses & settlements | D | D | D | Unclear in implemented list | D | Costs (not full settlement confirmed) |
| Receipt OCR | — | D | Receipt attachment | D? not established | D | — |
| Plan revisions / rollback | Proposal review | Feedback regenerate | Audit trail | D | Undo | Live edits |
| Realtime collaboration | D (validate deployment) | — | D (group features) | SSE | WebSockets | Supabase Realtime |
| Offline PWA | D | — | D | — | D | — |
| In-app push-to-talk → AI → ElevenLabs voice | **not documented** | **not documented** | **not documented** | **not documented** | **not documented** | **not documented** |
| India rail/bus/live last-mile inventory | not established | not established | not established | not established | global/public routing varies | not established |
| Budget-aware replanning from posted real expense ledger | **new Raahi module** | not established | not established | not established | not established | not established |

## Final compatible stack (OpenTrip fork path)

- **Web**: React 19, Vite, TypeScript, Tailwind, MapLibre; keep OpenTrip's UI and React Query; add microphone and spoken-answer controls.
- **API**: Hono on Node using existing `@hono/node-server`; deploy as Render web service or compatible container.
- **DB**: PostgreSQL + Prisma (Render Postgres or Supabase **database only**). Keep OpenTrip's Better Auth; **do not introduce Supabase Auth** unless replacing Better Auth deliberately throughout.
- **AI orchestration**: OpenTrip's Vercel AI SDK tool infrastructure plus new Zod schemas and route modules. Hosted AI provider via compatible SDK adapter; smoke-test chosen model's tool-calling and structured outputs.
- **STT**: ElevenLabs Scribe v2 Realtime via `@elevenlabs/react` or `@elevenlabs/client`. Browser connects with a server-generated one-time token; never expose long-lived API key. Wispr Flow only if your developer credentials grant a supported, documented endpoint. Otherwise make it an optional adapter, not a hard dependency.
- **TTS**: ElevenLabs text-to-speech streaming or byte streaming via `@elevenlabs/elevenlabs-js` on the API, delivered to an HTMLAudioElement on the web. Speak a brief verified summary, not an entire day schedule.
- **Places**: retain OpenTrip's OSM geo provider initially; add Geoapify service adapter for production-style limits and hospitals; optional Google Places for confidence-enhanced validation. Cache appropriately and honor OSM/third-party terms.
- **Routing/weather**: OpenTrip OSM/OSRM infrastructure, optionally openrouteservice; Open-Meteo or original OpenWeatherMap.
- **Indian trains/buses/flights**: provider interfaces returning provider/source, date checked, timetable-vs-live status, price type and booking URL. Mock data for demos is visibly labeled; no invented seats/times. Use authorized sources only.
- **Money**: integer paise ledger, payer/member share records, reimbursement transfers, budget cap, committed booking expenses, estimated future costs, trip version number and idempotency keys.
- **Availability/medical**: geolocation consent, mapped nearby hospitals/clinics, directions/phone, source timestamp, not a promise of care availability.

## Voice first architecture

```text
[React microphone button / voice panel]
  ↓ microphone permission; recording indicator; stop/cancel control
[ElevenLabs Scribe real-time] --committed transcript--> [Editable transcript]
  ↓ user submits or voice confirmation (don't act on unstable partial words)
[Hono POST /api/raahi/voice/interpret]
  ↓ auth + trip membership + Zod input validation
[Intent parser → trip.create | trip.update | expense.add | trip.replan | facilities.search | Q&A]
  ↓ load structured trip memory and latest revision
[OpenTrip trip-aware AI + adapter tools]
  ↘ Geo verified places, routing, weather, Indian transport adapter, budget engine
[Validated TripChangeProposal JSON and evidence source labels]
  ↓ show preview (map, days, costs, unknowns); require acceptance
[Atomic Prisma DB mutation + audit log + group update]
  ↓
[Short grounded spoken summary → ElevenLabs TTS → browser audio]
```

**Crucial:** ElevenLabs *Agents/Conversational AI* and ElevenLabs *text-to-speech* are different integration modes. For Raahi's existing OpenTrip AI logic, **STT → your AI agent → ElevenLabs TTS** is the simplest, most controllable architecture. Add continuous turn-taking or interruptions only after the push-to-talk workflow is stable.

Official integration references:
- Realtime client speech to text: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming
- ElevenLabs JavaScript SDK: https://github.com/elevenlabs/elevenlabs-js
- Streaming TTS: https://elevenlabs.io/docs/eleven-api/quickstart

## Data/contract requirements

### Travel intent contract

```ts
const travelIntent = {
  type: 'trip.create',
  fromCity: 'Lucknow',
  destinationHint: 'mountains in North India',
  travelers: 5,
  budgetPerPersonPaise: 700000,
  numberOfDays: 6,
  startDate: null, // ask/mark unconfirmed rather than fabricate
  language: 'hi-en'
};
```

### Proposal record (suggested fields)

```ts
type TravelProposal = {
  tripId?: string;
  baseRevision: number | null;
  intent: 'create_trip' | 'modify_trip' | 'record_expense' | 'replan' | 'find_medical';
  candidateDays: Array<{ day: number; stops: Array<{ name: string; lat?: number; lng?: number; sourceUrl?: string; verification: 'verified' | 'unverified' }> }>;
  cost: { estimatedMinPaise: number; estimatedMaxPaise: number; actualPaidPaise: number; pendingBookingsPaise: number; bufferPaise: number };
  sourceFreshness: Array<{ provider: string; checkedAt: string; live: boolean }>;
  warnings: string[];
  summaryForSpeech: string;
  requiresApproval: true;
};
```

### Expense invariant

- Every expense must have immutable ledger identifier, payer, currency, total (integer minor units), participants and exact allocated shares.
- Sum of shares == total; group sum of net balances == 0; no floating point allocation loss. For 100 rupees among 3, allocate remaining paise deterministically.
- Never treat the AI's suggested arithmetic as the ledger result.
- Never auto-post an expense based only on speech with ambiguous participants. If group has five people and user says 'split among four', ask who the four are.
- Distinguish available cash and what a person owes others from trip's actual total spending.
- Replanning must account for already paid, committed but unpaid, estimated costs and a buffer; must not rewrite past expenses.

## Implementation phases for Astra GPT

1. **Bootstrap & verify OpenTrip unmodified.** `pnpm install`, local Postgres, seed demo, auth, existing agent tools, map and expenses. Make a green baseline with `pnpm check`. Record exact commit hash and license notice. STOP if baseline does not run; do not layer changes on broken dependencies.
2. **Voice UI only.** Microphone button in trip discovery wizard and trip agent pane, permissions, recording state, cancellation, transcript correction, mobile testing.
3. **STT real provider.** Server token endpoint, ElevenLabs Scribe, streaming transcript, timeout/error path and text-input fallback. Wispr adapter only if official docs/credentials verified.
4. **One-shot Create Trip from voice.** Zod intent extraction, prompt slots, geographic candidate retrieval, validation, budget and travel source uncertainty; proposal preview and user approval → saved multi-day trip with map stops.
5. **TTS.** API streams ElevenLabs voice for concise summary with language handling, playback controls, no autoplay before interaction; fallback readable text.
6. **Group collaboration and expense voice commands.** Keep OpenTrip auth/roles; deterministic expense ledger; voice confirmations and test 5-member split subset.
7. **India adapters.** Geo/routing/weather live where permitted. Train/bus/flight provider interfaces and links with confidence/freshness; mocked datasets visibly marked as demonstrations.
8. **Budget-aware replanning.** Actual spent + commitments + forecasts -> budget warning -> changes to future itinerary only; approval/revision and audit trail.
9. **Nearby medical and resilience.** Search nearby hospitals with permission, directions and source labels; offline access to saved itinerary, typed fallback, error/retry handling.
10. **Deployment & live integration tests.** Render Node API and Vite web, hosted Postgres, proper CORS/cookies/HTTPS/API secrets; create from Hindi voice, ask follow-up, approve proposal, add expense, replan, speak update. Test refresh and another signed-in member sees it.

## Compatibility decision table

| Desired reuse | Compatibility with OpenTrip base | Required method |
|---|---|---|
| Travex JSON itinerary prompts | High (concept) | Port schema+prompts behind Hono API, add verification |
| Travex receipt OCR | High (workflow) | Add secure upload/extract/review; do not expose Gemini key |
| AI Trip place validation | High (logic), low (direct UI/code) | Port provider validation patterns via OSM/Geoapify/Google adapters; not Nuxt components |
| NomadSync context and versions | Medium (concept), low (direct DB) | Add Prisma tables/revision/audit/rollback; no Mongo schema copying |
| TREK settlement/offline approaches | High (algorithmic concepts), low (direct code) | Independent integer-money + IndexedDB/idempotency work; AGPL review if copying |
| Turistar real-time UI patterns | Medium (concept), low (framework/auth transplant) | Reuse designs only; don't mix Supabase Auth with Better Auth or tRPC with Hono |
| ElevenLabs real-time STT & TTS | High | Add React client + Hono server SDK/token endpoints |
| Wispr Flow speech API | Conditional | Adapter disabled until official developer endpoint and permissions verified |
| Render hosting | High for Node Hono | Use existing Node server, review DB/provider migration/security before release |

## Minimum acceptance demo

A: A traveler presses Mic and says “Hum paanch dost Lucknow se Uttarakhand jaana chahte hain, six days, seven thousand per person.”
B: Raahi renders an editable transcript; asks for missing dates/season constraints if needed.
C: AI uses real place search to propose a 6-day route, source-labeled travel legs, max budget and caveats.
D: Traveler taps Approve; five-member shared trip, map and daily timeline persist.
E: Raahi speaks a short Hindi/Hinglish summary in ElevenLabs voice; text remains visible.
F: Traveler says “Maine chaar logon ka khana ₹600 diya.” Agent asks which four (five people in group) and shows review card.
G: The ledger is updated correctly after confirmation, then an extra expense triggers future-only budget-aware replanning.
H: A second account views the saved changes. Failed external API calls show honest fallback labels.

## Build notes / license checklist

- OpenTrip source is Apache-2.0; keep its license/attribution/any applicable NOTICE when making a fork and check third-party dependencies.
- Travex and AI Trip advertise MIT licenses; attribution obligations still apply to code copied.
- TREK and Turistar are AGPL-3.0; treat them as *behavior and design references* unless complying with the license obligations for actual reuse.
- NomadSync source can be read publicly; verify the applicable license before copying any implementation.
- Access to real travel data and booking platforms is independent from repository code licenses; honor official API and scraping terms.
- Changes must be tested locally: research can establish technical compatibility plausibility but cannot prove integration passes before tests.

## Astra GPT starting instruction

> Read this file and the existing Raahi AI specification. Treat OpenTrip as the proposed starting point, but FIRST audit the live checkout, scripts, license, existing AI/expense interfaces, and deployment environment. Identify any differences from this research snapshot. Do not mix frameworks or auth systems. Create `IMPLEMENTATION_GAPS.md`, then implement one numbered phase at a time with tests and a completed-work log. The must-have is real, push-to-talk voice → structured Indian student-budget trip proposal → approval/save/map/group sharing → ElevenLabs spoken summary. Never fabricate live train seats, bus departure times, route availability or prices.
