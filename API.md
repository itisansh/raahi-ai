# Raahi AI API reference

Current Node/Express and MongoDB client contract. See [README](README.md) for setup.

HTTP registrations: `server/src/routes/index.ts`. WebSocket upgrades:
`server/src/realtime/node-realtime.ts`. Schemas and serializers remain the
source of truth for validation. Request schemas live in `server/src/controllers/schemas.ts`
and domain mutation schemas in `server/src/services/trip/ops/schemas.ts`.

## Contents

- [Conventions](#conventions)
- [Authentication and session](#authentication-and-session)
- [Route index](#route-index)
- [Platform endpoints](#platform-endpoints)
- [Trip endpoints](#trip-endpoints)
- [Itinerary endpoints (days, stops, media)](#itinerary-endpoints-days-stops-media)
- [Expense endpoints](#expense-endpoints)
- [Reservations](#reservations)
- [Invite endpoints](#invite-endpoints)
- [User profile, preferences, and avatar](#user-profile-preferences-and-avatar)
- [Agent HTTP endpoints](#agent-http-endpoints)
- [DTO catalog](#dto-catalog)
- [Error envelope](#error-envelope)
- [Multi-client implementation notes](#multi-client-implementation-notes)


# Conventions


| Item | Rule |
| --- | --- |
| Base path | `/api` |
| Auth mount | `/api/auth/*` (Better Auth handler; `GET` and `POST`) |
| Content type | JSON (`Content-Type: application/json`) unless noted (multipart, streams, file bytes) |
| Success envelope | `{ "data": <payload> }` |
| Error envelope | `{ "error": { "code": string, "message": string } }` |
| Validation | Zod at the HTTP edge before use cases; first issue message becomes `error.message` with code `validation_error` |

### Status codes

| Code | When |
| --- | --- |
| `200` | OK |
| `201` | Created (trip create, media/avatar upload, day append, invite create) |
| `400` | Validation / domain input errors |
| `401` | No session on a guarded route |
| `403` | Member lacks permission (e.g. viewer mutating) |
| `404` | Not found — **or** non-member on a trip route (existence not leaked); agent disabled |
| `409` | Conflict (e.g. agent suggestion already resolved / stale / expired) |
| `413` | Upload too large |
| `500` | Unexpected |
| `502` / `503` / `504` | Upstream weather/FX/geo failures (see specialized docs) |

### Trip access rules

- Business routes under the session guard require an authenticated session →
  otherwise `401` with `unauthenticated`.
- Trip routes require membership: **non-members get `404`** (`trip_not_found`),
  not `403`, so trip existence is not leaked.
- Read-only **viewers** attempting an edit get **`403`**
  (`insufficient_permissions`).
- Permissions on a full trip: `{ isMember, canEdit, canInvite }` (see
  [TripDto](#tripdto-full-trip)).
- **Public** business route: `GET /api/trip-invites/:token` (invite preview).
- **Public** file delivery: `GET /api/uploads/*`.
- **Public** health: `GET /api/health`.

### Non-JSON responses

| Path | Response |
| --- | --- |
| `POST /api/trips/:tripId/agent/chat` | AI SDK UI message **stream** (not `{ data }`) |
| `GET /api/uploads/*` | Raw file bytes with `Content-Type`, long-lived `Cache-Control` |
| Multipart upload errors still use the JSON error envelope |

### Amounts, dates, ids

- **Expense amounts** use major units: INR supports two decimal rupee places;
  other supported currencies retain whole-unit semantics. Backend arithmetic uses
  integer minor units. Fields explicitly named `amountMinor` or `*Paise` use
  minor units. Display server-computed balances; do not reinterpret historical data.
- **Trip / day dates**: ISO `YYYY-MM-DD`, or `""` when unknown.
- **Timestamps**: ISO 8601 strings where documented (`createdAt`, `expiresAt`,
  preferences `updatedAt`, agent message times).
- **Trip-local member ids** (`members[].id`) are used for votes, expense
  `payer` / `participants`, balances, and settlements — not Better Auth user
  ids (those are `members[].userId`).

### Mutation responses and client caches

Create/update handlers return the written DTO. Apply that response to local
query caches; realtime invalidations and reconnects refetch authoritative state.
Examples: `POST /api/trips`, agent `POST …/messages`, preference PATCH.

---




# Authentication and session


Auth is **Better Auth** mounted at `/api/auth/*`. See [setup and architecture](README.md) for
server configuration and Google OAuth.

### Session model for non-browser clients

1. Session middleware runs on every request:
   `auth.api.getSession({ headers })`.
2. Business routes under `/api` (except health, invite preview, uploads) require
   a session; otherwise `401`.
3. The web app sends **cookies** with `credentials: "include"`
   (`client/src/lib/api/client.ts`).
4. **Mobile / native apps** should:
   - Point the Better Auth client (or equivalent HTTP) at the same API origin
     and base path `/api/auth`.
   - Persist and re-send the session **cookie** (cookie jar / `Cookie` header)
     on every API call after sign-in. CORS `credentials: true` and
     `TRUSTED_ORIGINS` apply to browser clients; native apps talking to the API
     origin directly rely on cookie storage, not browser CORS.
   - Prefer the official Better Auth client for the platform when available so
     sign-in, sign-up, session refresh, and sign-out stay compatible.

### Client-relevant Better Auth surfaces

Not every Better Auth plugin path is listed here. Clients need at least:

| Action | Typical path (under `/api/auth`) | Notes |
| --- | --- | --- |
| Email sign-up | `POST …/sign-up/email` | Creates user and sends a six-digit email code; no session until verified |
| Verify email OTP | `POST …/email-otp/verify-email` | Marks verified + auto sign-in |
| Resend email OTP | `POST …/email-otp/send-verification-otp` | Explicit verification request |
| Email sign-in | `POST …/sign-in/email` | Verified email/password sign-in; unverified users receive a code and `EMAIL_NOT_VERIFIED` |
| Social sign-in | `POST …/sign-in/social` | Google when configured |
| Session | `GET …/get-session` | Current user + session |
| Sign-out | `POST …/sign-out` | Clears session |
| Update user | Better Auth `updateUser` | e.g. `name`, `defaultCurrency` |

### Native OAuth bridge

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/mobile-auth/oauth/start?provider=google` | 302 to Google with Better Auth OAuth state cookies (open inside ASWebAuth) |
| GET | `/api/mobile-auth/oauth/complete` | Convert the browser cookie session to a one-time app callback code |
| POST | `/api/mobile-auth/oauth/exchange` | Consume `{ code }` and return `{ token, session }` |

The callback code is hashed at rest, valid for three minutes, and consumed on
first use. Native business requests send the returned session token as a Bearer
credential.

Email/password signup requires a six-digit email verification code (valid for five
minutes). Unverified users receive a new code when signing in; verification creates
the session automatically. Verified users sign in with their password normally.
With `EMAIL_PROVIDER=console`, codes appear in the server terminal; Resend delivers
them by email when configured. Password recovery also uses an email code. No CAPTCHA
provider is configured by the Node auth implementation.

Avatar image for the signed-in user is **not** only Better Auth: use
`POST/DELETE /api/users/avatar` so storage and profile stay consistent.

---




# Route index


Route inventory from native Express registrations in `server/src/routes/index.ts`. Paths are absolute from the
API origin. **Auth**: `public` | `session` | `session + member` | `session + edit` | `session + canInvite`.

### Platform

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET, POST | `/api/auth/*` | Better Auth | Sign-in, sign-up, session, OAuth, etc. |
| GET | `/api/mobile-auth/oauth/start` | public | 302 to Google with OAuth state cookies |
| GET | `/api/mobile-auth/oauth/complete` | OAuth cookie | Redirect to the app with a one-time code |
| POST | `/api/mobile-auth/oauth/exchange` | one-time code | Exchange code for a native Bearer session |
| GET | `/api/health` | public | Liveness `{ status: "ok" }` |
| GET | `/api/uploads/*` | public | Immutable managed file bytes |
| GET | `/api/weather` | session | Forecast/observed weather |
| GET | `/api/fx/rates` | session | FX rate table for settle-up display |
| GET | `/api/agent/status` | session | Whether trip agent is enabled |
| POST | `/api/voice/token` | session + trusted Origin | Scoped Scribe transcription token |
| POST | `/api/planning/preview` | session + trusted Origin (+ member when tripId supplied) | Read-only structured trip proposal |
| POST | `/api/planning/proposals/:id/approve` | session + trusted Origin + proposal owner | Atomically create an approved new itinerary |

### Node WebSocket upgrade

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/trips/:tripId/realtime` | session + member | WebSocket upgrade for trip changes + presence; handled by `NodeRealtime` attached to the Node HTTP server. Browsers always send `Origin` (checked against trusted origins); Origin-less native clients authenticate via Bearer token. |

WebSocket server messages are `hello` (connection ID, sequence, presence),
`change` (sequence and change payload), `presence` (members), and
`resync_required` (sequence). Clients may send `{ "type": "resume",
"afterSequence": 0 }`; Node always requests an authoritative refetch on resume.
Sequence counters are process-local and cannot identify a server restart.
Membership is rechecked during the connection; this is not a persistent replay log.

### Additional Node endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/` | public | API identity when not serving the web app |
| GET | `/api/auth/capabilities` | public | Enabled authentication capabilities |
| POST | `/api/voice/summary/:action` | session + trusted Origin + proposal owner | `text` or `audio` from retained proposal |
| POST | `/api/trips/:id/medical` | session + member + trusted Origin | Nearby medical listings |
| POST | `/api/trips/:id/travel` | session + member + trusted Origin | Read-only travel evidence |
| GET | `/api/trips/:id/history` | session + member | Approved proposal history |
| POST | `/api/trips/:id/history/rollback` | session + edit + trusted Origin | Revision-checked rollback |
| GET | `/api/trips/:id/finance` | session + member | Balances and repayment audit |
| POST | `/api/trips/:id/finance/:action` | session + edit + trusted Origin | `repay`, `void`, or `cap` |
| GET | `/api/trips/:id/budget` | session + member | Budget forecast and actual spending |
| POST | `/api/trips/:id/budget/:action` | session + edit + trusted Origin | `forecast`, `propose`, or `approve` |
| POST | `/api/trips/:tripId/expenses/preview` | session + edit + trusted Origin | Unsaved interpreted expense draft |

### Trips

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/trips` | session | List trip summaries for the current user |
| POST | `/api/trips` | session | Create trip (caller becomes owner) |
| GET | `/api/trips/:id` | session + member | Full trip DTO |
| PATCH | `/api/trips/:id` | session + edit | Rename trip, or `{ clearAgentSeedPending: true }` |

### Street view

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/trips/:tripId/street-view/images` | session + member | Search nearby normalized imagery |
| GET | `/api/trips/:tripId/street-view/images/:imageId` | session + member | Trusted image metadata |
| GET | `/api/trips/:tripId/street-view/images/:imageId/preview` | session + member | Proxied static preview bytes |
| GET | `/api/trips/:tripId/street-view/viewer-config` | session + member | Minimum interactive viewer configuration |

### Itinerary days

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/trips/:id/days` | session + edit | Append empty day |
| PATCH | `/api/trips/:id/days/:day` | session + edit | Update day metadata (`:day` = day number) |
| PUT | `/api/trips/:id/days/order` | session + edit | Reorder days |
| DELETE | `/api/trips/:id/days/:day` | session + edit | Delete a day (renumbers remaining) |

### Stops

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/trips/:id/stops` | session + edit | Insert stop |
| PATCH | `/api/trips/:id/stops/:stopId` | session + edit | Update stop display metadata |
| PUT | `/api/trips/:id/stops/:stopId/position` | session + edit | Move stop to day/index |
| POST | `/api/trips/:id/stops/:stopId/vote` | session + edit | Toggle current-user vote (viewers `403`) |
| POST | `/api/trips/:id/stops/:stopId/comments` | session + edit | Add comment (viewers `403`) |
| POST | `/api/trips/:id/media` | session + edit | Upload stop-note image (multipart) |

### Expenses

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/trips/:id/expenses` | session + edit | Add expense |
| PATCH | `/api/trips/:id/expenses/:expenseId` | session + edit | Replace expense fields |

### Reservations

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/trips/:id/reservations` | session + member | List reservations |
| POST | `/api/trips/:id/reservations` | session + edit | Create idempotently |
| PATCH | `/api/trips/:id/reservations/:reservationId` | session + edit | Update by revision |
| POST | `/api/trips/:id/reservations/:reservationId/cancel` | session + edit | Cancel by revision |
| DELETE | `/api/trips/:id/reservations/:reservationId` | session + edit | Delete by revision |

### Invites

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/trips/:id/invites` | session + canInvite | Create or regenerate invite link |
| GET | `/api/trip-invites/:token` | public | Invite preview |
| POST | `/api/trip-invites/:token/accept` | session | Accept invite (join trip) |

### User

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/users/preferences` | session | UI preferences |
| PUT | `/api/users/preferences` | session | Planner sidebar prefs |
| PUT | `/api/users/preferences/agent-panel` | session | Agent panel collapsed |
| POST | `/api/users/avatar` | session | Upload avatar (multipart) |
| DELETE | `/api/users/avatar` | session | Remove managed avatar |

### Agent (per trip)

All agent trip routes return **`404` `agent_disabled`** when AI is not
configured. Membership rules still apply when the agent is enabled.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/trips/:tripId/agent/messages` | session + member | Shared history |
| POST | `/api/trips/:tripId/agent/messages` | session + member | Post plain message |
| POST | `/api/trips/:tripId/agent/chat` | session + member | Stream agent reply |
| GET | `/api/trips/:tripId/agent/events` | session + member | Poll after cursor |
| POST | `/api/trips/:tripId/agent/suggestions/:suggestionId/approve` | session + member | Approve/deny suggestion |
| POST | `/api/trips/:tripId/agent/suggestions/:suggestionId/apply` | session + edit | Alias approve `true` |
| POST | `/api/trips/:tripId/agent/suggestions/:suggestionId/dismiss` | session + member | Alias approve `false` |

---




# Platform endpoints

Unless noted, success body is `{ "data": … }` and the tables describe the **payload inside `data`**.

### `GET /api/health`

- **Auth:** public  
- **Response:** `{ status: "ok" }`

### `GET /api/uploads/*`

- **Auth:** public  
- **Path:** managed storage key after `/api/uploads/` (e.g. `avatars/…`,
  `trips/…`). Invalid / non-managed path → `400` `invalid_path`.  
- **Response:** raw bytes (not JSON). Headers include `Content-Type`,
  `Cache-Control: public, max-age=31536000, immutable`,
  `X-Content-Type-Options: nosniff`. Missing file → `404`.

### `GET /api/weather`

- **Auth:** session  
- **Query:**

| Param | Required | Meaning |
| --- | --- | --- |
| `lat` | yes | Latitude number |
| `lon` | yes | Longitude number |
| `date` | for useful data | `YYYY-MM-DD`; invalid/missing date yields `null` payload |
| `time` | no | `HH:MM` for hourly preference within horizon |
| `lang` | no | Default `en` |

- **Response:** [`WeatherData`](#weatherdata) or `null`  
- **Errors:** `400` `invalid_coordinates`; `503` `weather_not_configured`;
  `502` provider failures. Details: [setup and architecture](README.md).

### `GET /api/fx/rates`

- **Auth:** session  
- **Query:**

| Param | Required | Meaning |
| --- | --- | --- |
| `base` | yes | ISO 4217 (3 letters) |
| `quotes` | no | Comma-separated quote currencies |
| `date` | no | `YYYY-MM-DD` historical; omit for latest |

- **Response:** [`FxRatesData`](#fxratesdata)  
- **Errors:** `400` `invalid_currency` / `invalid_date`; `502` provider.
  Details: [setup and architecture](README.md).

### `GET /api/agent/status`

- **Auth:** session  
- **Response:** `{ enabled: boolean }` — `true` when AI env is configured.

---

Related: [setup and architecture](README.md) · [setup and architecture](README.md)

---



## Voice transcription token

`POST /api/voice/token` requires an authenticated session and an `Origin`
exactly matching `TRUSTED_ORIGINS`. It accepts no audio or trip changes and
returns `{ "data": { "token": "<single-use-token>" } }` with `private, no-store`.
The server uses `ELEVENLABS_API_KEY`; never expose that key in browser config.
Issuance is limited to five attempts per user per minute using process-local storage.

Errors: `401` unauthenticated, `403` forbidden origin, `429`
`voice_rate_limited` (with `Retry-After: 60`), or `503` `voice_unavailable`.
Provider failures are sanitized. A token is for Scribe transcription only;
it does not authorize itinerary or expense writes.

The browser uses the official ElevenLabs client, explicit microphone access,
90-second recording limit, cancellation, and editable committed text. Partial
recognition is never submitted. The trip wizard supports a full-request preview
and a separate step-by-step form with destination dictation. The
assistant receives reviewed text only after an explicit user action.

Raahi does not store audio recordings. Audio goes directly to ElevenLabs;
provider retention follows the account's settings and terms. Live Hindi,
Hinglish and English transcription and mobile permission behavior still need
manual verification. See the [official client streaming guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming).

## Read-only trip planning preview

`POST /api/planning/preview` accepts `{ "prompt": "...", "tripId": "optional" }`.
It requires a session and an exact trusted Origin. Prompts must be 1–4000
characters; bodies are limited to 20 KB. Attempts are limited to five per user
per minute using process-local storage.

With `tripId`, membership is checked before provider calls and the current trip
revision, intake and days are supplied as context. This read does not backfill
coordinates or mutate the existing trip. Saved dates, day count, party size and
budget fill missing extracted answers before clarification; explicit conversation
changes take precedence except that additions preserve the saved schedule. Legacy
budget amounts retain an unknown basis until clarified. Individual stop prices and
member count are not treated as total budget or party size. Without `tripId`, no trip is loaded.

Responses use the normal `{ data }` envelope:

- `status: clarification`: extracted `intent` and `missing` field identifiers.
  Origin, group size, duration (1–14 days), positive INR budget and its per-person
  or group basis are essential. Dates may remain unknown. No itinerary provider
  call occurs until these constraints are present.
- `status: preview`: unsaved proposal ID, context revision, intent, ordered days,
  per-stop place evidence, road estimates including return travel, cost ranges
  and issue identifiers. MongoDB retains owner-scoped proposals for explicit approval.

The AI SDK adapter uses the existing model factory with validated Zod output.
For Google's official compatible API hostname, the factory explicitly enables
JSON Schema structured outputs; generic compatible providers retain their
existing settings. Model availability must be verified with a generation request,
not just a successful model-list response.
It has no write tools. Invalid dates, malformed JSON, invalid day sequences and
reversed cost ranges are rejected. Monetary conversion and group multiplication
use deterministic integer paise, independently of model arithmetic. Estimates
are per-person whole-trip amounts; unknown cost categories remain null and
totals are explicitly partial. All costs are AI estimates, not provider quotes.

Coordinates come only from a unique exact-name, India/city-matched place lookup.
Unmatched, ambiguous or unavailable results have null coordinates. Existing geo
adapters supply data with their usual cache, timeout and rate-limit policies.
Evidence work is bounded to 20 unique lookups, 43 route requests and a 60-second
window (an in-flight provider request may run to its own timeout). Scheduling
checks sequential road estimates, activity durations, eight hours of overnight
rest and return travel within the final day. These checks do not establish
train/bus schedules, opening hours, room availability or seasonal suitability.
Unverified or infeasible sections remain flagged; nothing becomes persisted fact.

Errors: `400` invalid input, `401` unauthenticated, `403` forbidden origin,
`404` missing or inaccessible trip,
`413` oversized body, `429` planning rate limit, `502` invalid model output or
`503` provider unavailable. Failures are sanitized; responses are private/no-store.

In the trip wizard, users review speech in `VoiceInput`, transfer the final text
to the request field, and explicitly select Generate preview. Editing the request
clears stale results. Cancellation ignores late responses; the existing manual
form remains available. Previews are retained for 30 minutes in MongoDB; `approvable` indicates eligibility for explicit approval.

### New-trip approval

`POST /api/planning/proposals/:id/approve` requires the proposal owner session,
trusted Origin and exactly `{ "confirm": true }`. Client itinerary data is never
accepted. A Mongo transaction makes concurrent retries return the same `tripId`; trip,
members, days, stops and approval timestamp commit together. Failed approval
rolls back. The stored proposal retains intent, cost/source evidence and approval
history. Unknown dates remain unknown and no guessed coordinates are persisted.

Proposals with no issues other than unknown dates can be approved. On Mongo,
existing-trip proposals append stops to current days after checking current edit
permission and the preview revision. Existing stops, dates, expenses and bookings
are preserved. Duplicate approval applies once; stale revisions and expired
proposals are rejected.
Existing previews include `retainedStops`, `changeMode: "append_stops"` and
`costScope: "additions"`; cost estimates cover additions, not existing spending.
A reused saved total budget is only a ceiling. Such previews carry `costs_incomplete`
and cannot be approved until an additions allowance is supplied, because this
pipeline does not reconcile existing commitments against the saved total.
Combined retained/new schedules are checked for overlaps, travel and overnight
rest. Unknown saved times/durations block approval; unchanged days may be empty.
The response is `{ "data": { "tripId": "..." } }`; the UI navigates to the existing
map/itinerary planner and uses existing trip membership/invitation permissions.

### Spoken proposal summaries

`POST /api/voice/summary/text` and `POST /api/voice/summary/audio` require a
session, trusted Origin and exactly `{ "proposalId": "<uuid>", "language": "en" | "hi" }`.
Requests are bounded to 1,000 bytes. Only the owner of an unexpired stored
MongoDB proposal can request its summary; arbitrary text and client owner IDs
are rejected. Text returns `{ "data": { "text": "...", "language": "en" } }`.
Audio returns MP3 bytes with no-store and nosniff headers. Missing configuration
or provider failure returns sanitized `503 speech_unavailable`; exceeding five
audio generations per user per minute returns `429 speech_rate_limited`.

New proposals retain the model reply and synthesize that exact visible text. Older
snapshots without a reply use a deterministic summary of constraints and warnings.
No additional model call generates the spoken summary.

Configure server-only `ELEVENLABS_API_KEY` with Text to Speech access and
`ELEVENLABS_VOICE_ID_EN` / `ELEVENLABS_VOICE_ID_HI`. Both IDs are required; the same
multilingual voice may serve both. The adapter uses ElevenLabs
`eleven_multilingual_v2` and MP3 at 44.1 kHz/128 kbps, a 30-second timeout and a
4 MB response bound. Short audio is buffered before playback; it is not a live
voice conversation or progressive audio stream. API reference:
https://elevenlabs.io/docs/api-reference/text-to-speech/convert

The planning UI can speak a completed reply automatically after reviewed voice
input, or when the user chooses Read reply. It never speaks partial model text.
Autoplay restrictions expose a direct resume action that reuses downloaded audio.
Stop, new recording, hidden-page transitions and unmount cancel playback and
release audio resources. Provider or browser playback failure preserves the text.
A fresh Read reply request can generate new provider audio.

### Voice expense drafts

`POST /api/trips/:tripId/expenses/preview` accepts exactly
`{ "prompt": "I paid 600 rupees for lunch for four people" }` (3–2,000 chars,
8 KB body cap). Session, trusted Origin and trip edit permission are required
before model access. The existing AI configuration extracts a validated draft:
description, stated decimal rupee text, currency, payer name/self flag, explicit
beneficiary names and requested participant count, with `saved: false`.
The operation has no write port. Five interpretations/user/minute are allowed.
No member identity or allocation arithmetic is delegated to the model.

The existing expense editor accepts the reviewed speech/text, resolves only
unique exact member names, leaves unnamed beneficiaries unselected, and requires
the requested participant count before explicit Save. Unknown currency and payer
must be selected. The normal authorized expense endpoint performs the write.

INR expense amounts may have two decimals. Backend calculations convert to
integer paise and distribute equal remainders by sorted member ID. Custom
`allocations: { "memberId": 400, "otherId": 200.01 }` use major currency units;
they must name exactly the participants, each have a positive valid amount and
sum exactly to the expense. Other currencies retain whole-unit behavior.
The DTO includes custom `allocations` and computed `shares` for display.

Add-expense input optionally accepts UUID `requestId`. The web editor assigns
one per mounted form and retains it across a failed-save retry. On MongoDB,
expense writes check permissions and revision and persist atomically in a transaction. Same actor/trip/request ID and
same details return the existing expense; changed details return 409. Independent
requests remain separate expenses. Legacy clients omitting requestId have no
retry identity. Editors wait for successful persistence before closing and keep
the draft on failure. After an ambiguous failed save, retry the same details;
close/reopen the form before starting a different expense.

Balances use only expenses in the trip currency. `budget.excludedCurrencies`
labels other-currency expenses excluded from that balance; the UI displays a
warning. No cross-currency amounts are added together. Settlement transfers are
computed suggestions, not bank transfers or payment confirmations.

### Budget intelligence and reviewed replanning

MongoDB endpoints (all authenticated, private/no-store):

- `GET /api/trips/:id/budget`: current revision, recorded spending, unlinked
  confirmed/completed bookings, future estimates, buffer, projected cost,
  remaining budget, planned per-traveller average and completeness warnings.
- `POST /api/trips/:id/budget/forecast`: trusted-Origin/editor-only explicit
  confirmation of `{ groupBudgetPaise, otherFuturePaise, bufferPaise, costs }`.
  All amounts are integer group paise; `costs` maps stop IDs to remaining costs.
  Other-future costs cover meals, lodging and transport not already recorded or
  booked. This versioned forecast persists in trip intake JSON; legacy stop cost
  fields are never assumed to be group amounts or live quotes.
- `POST /api/trips/:id/budget/propose` with exactly `{}`: editor-only AI selection
  of optional future activities to remove. At most five requests/user/minute.
- `POST /api/trips/:id/budget/approve` with exactly
  `{ proposalId: "<uuid>", confirm: true }`: apply the stored proposal. Clients
  cannot supply removed stop IDs, financial totals or an actor identity.

Forecast costs include today and later. Removal candidates must be strictly
after today in Asia/Kolkata.
Unknown dates, missing cost estimates, unknown booking costs or foreign-currency
expenses block automatic replanning. Sight, shopping, activity and park stops may
be proposed; all reservation-linked stops, including tentative/cancelled entries,
are protected from removal. Confirmed/completed booking amounts are counted once;
bookings linked to an existing ledger expense are not counted again. Known
bookings also replace their corresponding future stop estimate.

The model selects only supplied activity IDs and supplies an explanation; the
backend calculates savings. A proposal must resolve the projected shortfall
using the user-confirmed estimates, without claiming live availability. It does
not introduce alternative destinations, change routes, reduce food/lodging
allowances or alter recorded expenses. Travel gaps still need user review.

Proposals use existing `planning_proposals` storage with `budget_replan` payload,
base trip revision, before forecast, removed-stop snapshots, reason and savings.
Unapproved proposals expire after 30 minutes. Approval transactionally checks proposal and trip,
rechecks current edit permission/date/protected stops/revision, deletes only the
approved optional stops, updates the forecast and revision, and records approval
actor, applied revision and timestamp atomically. Repeated approval returns the
same trip. Stale proposals return 409. Discard in the UI leaves the trip intact;
the unapplied proposal expires normally. Existing realtime invalidation notifies
members after commit; Node users can also reload to see the updated shared trip.

A live budget panel appears in the existing Budget board. Confirm the group
forecast, add spending, review projected shortfall, compare the proposal and
explicitly approve or keep the itinerary. Expenses refresh the panel through trip
revision changes. Mongo schema migrations run during startup.

### India travel checks

`POST /api/trips/:id/travel` takes exactly `{ "stopIds": ["saved-stop-id", "next-stop-id"] }`
(one to six distinct IDs, in travel order; 2 KB body cap). Requires session, trip
membership and trusted Origin. Client coordinates/provider URLs are rejected.
Five checks per user per minute; 429 includes Retry-After. The read-only operation
never changes an itinerary, expense or reservation.

The existing geo service supplies a driving-only route estimate across saved
coordinates and nearby stay listings at the first selected stop. Response fields
include provider/source URL, service date, checkedAt, observedAt:null and
cacheMayBeStale:true. checkedAt is when this application consulted the provider
interface, which can use cached data; it is not a provider observation timestamp.
Saved coordinates are not independently reverified by this endpoint. Coordinates
outside the broad India bounds produce a location-unavailable state, not a claim
about political borders or geocoding accuracy.

Road estimate status is road_estimate, choose_route or unavailable. It is never
presented as a train/bus/jeep departure or fare. Nearby stays are listings, empty
or unavailable; none indicates prices, room inventory, opening status or a
confirmed reservation. Official IRCTC, UTC and UPSRTC entries are search links
only. Local jeep/last-mile schedules, fares and availability remain unconfirmed.

Daily forecast is a narrow `TravelWeatherProvider` port, separate from the legacy
hourly/One Call `WeatherService`. The Open-Meteo adapter returns only supported
daily minimum/maximum Celsius temperatures and precipitation millimetres, with
source, serviceDate, original retrieval time and observedAt:null. It does not
invent humidity, pressure or observation time to fill the older weather DTO.
Dates use Asia/Kolkata and must fall between today and today+15 days. Missing dates,
missing rows, provider errors, outside-window dates and disabled configuration
have explicit statuses. Location requests are single-flight, cached for one hour,
bounded to 1,000 entries, and expired forecasts are not served as current data.
Timeout is ten seconds with a fixed HTTPS endpoint and no redirect following.

`TRAVEL_WEATHER_PROVIDER=` disables this daily adapter. `open-meteo` explicitly
opts into its free non-commercial endpoint with CC BY 4.0 attribution, displayed
in the UI. The example defaults disabled; local non-commercial verification opts
in via ignored `.env`. Commercial deployment requires an appropriately licensed
provider/account integration; the free adapter must not be enabled commercially.
Existing OpenWeather UI/agent weather remains unchanged and uses its own key.

The existing Reservations tab now includes India travel checks, with ordered stop
selection, loading/cancel/retry, provider/empty/failure states and attribution.
Weather and nearby stays use the first selected stop; selecting a different order
or changing the trip clears stale UI results. Official booking/search sites open
separately, with no scraped schedules or reservation claims.

References checked 2026-11-02: https://open-meteo.com/en/docs,
https://open-meteo.com/en/terms, https://contents.irctc.co.in/en/bookEticket.html,
https://www.utconline.uk.gov.in/home.aspx. Some booking sites reject automated
fetching; their links are not treated as a verified inventory API.

### Medical listings and offline resilience

`POST /api/trips/:id/medical` requires session, trip membership, trusted Origin,
and a body under 1,500 bytes. Input is exactly `{ category, radiusMeters, location }`:
category is hospital/clinic/pharmacy; radius is 5,000 or 10,000 metres. Location
is either `{ kind: "stop", stopId }` or `{ kind: "gps", lat, lng, consent: true }`.
GPS coordinates are finite, India-area bounded and rounded to four decimals;
consent is the caller's explicit assertion. Browser permission is separately
requested only by the frontend button action, never on mount. No live location
is written to trip/member records or broadcast. Underlying Places requests/cache
use coordinates to answer that lookup; this is not continuous location tracking.

The service reuses the configured Geoapify/OSM/Google GeoService and its cache. Fixed
medical category filters, coordinate/category/radius validation, deduplication,
straight-line distance sorting and ten-result cap keep listings bounded. Returned
name/category/address, normalized provider phone (when valid) and published hours
remain unverified. Emergency capacity, staffing and current opening status are
unknown. Distance is not road time. checkedAt means this application's lookup;
provider observedAt is null and cached data may be old. Empty, unavailable and
location-unavailable states do not mean no facilities exist. Provider failure does
not generate a substitute listing. Five searches/user/minute are allowed.

The map/planner Medical help action defaults to the selected saved stop. The user
can choose another stop, category/radius or explicitly request browser location.
Permission denial leaves stop lookup available. Closing the dialog aborts pending
fetch and releases its local location/result state. Directions and map search
open only on click; Call uses a sanitized, returned Indian phone number.

Official emergency contacts are independently available in the app shell before
login/session loading and inside Medical help: 112 (India ERSS). Regional contacts must remain explicitly labeled. No call is automated. Sources reviewed 2026-11-02:
https://112.gov.in/ and https://health.uk.gov.in/project/108-ambulances-project/.
They are reference contacts, not guarantees of signal, dispatch or medical capacity.

Offline behavior: an already opened trip stays readable from memory on network
failure, with a reconnect/retry notice. Fresh 401/403/404 responses still hide it.
Editing controls are disabled when the browser reports offline; expense add/edit
mutations run immediately/fail rather than silently waiting in an offline queue.
Typed request fields remain available independently of the recorder.

The Reservations tab offers an explicit downloaded HTML itinerary snapshot for
reading without the API/app shell. The export includes days, places, times,
coordinates and official contact links, without expenses, member details or free
notes. Text is escaped and CSP disables active/resource content. Maps/searches
still require connectivity. Downloaded files are snapshots and do not update with
shared changes. No authenticated API or medical/GPS response is cached by the
service worker. Offline fresh app authentication and a complete persistent
IndexedDB trip cache are not implemented or claimed.

### Voice-first planning follow-up

The client retains the original request and appends reviewed follow-up answers
in the same bounded `prompt` field. It never submits partial speech. The model
receives the same combined input for extraction; missing core constraints still
return `clarification` before itinerary generation.

Extracted intent may include optional `travelPreferences` for stated budget
flexibility, month/season, timing, pace and accessibility. Preview responses may
include nullable `guidance` with `response`, `timing` and `questions`. These are
model-generated general guidance, separate from independently matched places
and route estimates. Older stored proposals without guidance remain readable.
No schema/index migration is required for these optional proposal payload fields.
Current weather, closures, permits and opening status are not verified by this
planning model. Dates may remain undecided; no date or year is silently assumed.

### Conversational planning replies

`POST /api/planning/preview` accepts 1–4,000 trimmed prompt characters. Both
`clarification` and `preview` results now include `proposalId` and
`reply: { text: string, language: "en" | "hi" }`. These replies are retained for
30 minutes in owner-scoped proposal payloads. Clarification IDs cannot be approved.
`POST /api/voice/summary/text` returns the stored reply, and `/audio` synthesizes
that exact text in its stored language. The requested language remains supported
for older preview snapshots without `reply`; new replies use their original
language to keep visible and spoken content identical. Client-supplied narration
is still rejected. See [setup and architecture](README.md).

### Mongo finance and proposal history

`GET /api/trips/:id/finance` returns the current revision, trip currency,
repayment audit records, recomputed balances and optional member caps. Amounts
in these endpoints are integer minor units (INR paise; retained whole-unit
semantics for other currencies). Caps compare allocated actual expenses against
an individual limit; repayments never reduce trip spending or allocated cost.

Authenticated trip editors may POST to:

- `/finance/repay`: `{ requestId, from, to, amountMinor, currency, revision,
  confirm: true }`. Records an already-completed transfer between distinct trip
  members, bounded by current debtor/creditor balances. This does not send money.
  Same actor/request/details replay once; different details reject. A stale new
  request rejects. Permission is rechecked even for retries.
- `/finance/void`: `{ repaymentId, revision, confirm: true }`. Audits a mistaken
  record without deleting it. Repeated void is harmless. Balances are recomputed.
- `/finance/cap`: `{ memberId, capMinor, revision }`. Positive optional cap in the
  trip currency; `null` removes it. This is a displayed spending limit, not a
  payment restriction or an allocation of future group estimates.

All writes require trusted Origin and run in a Mongo transaction with the trip
revision. `finance` is an optional embedded trip field; migration
`002-trip-finance` records the additive schema version without backfilling or
reinterpreting existing money.

`GET /api/trips/:id/history` lists up to 50 approved existing-trip planning or
budget proposals for authorized members. New approvals retain before/after stop
snapshots; budget reductions also retain the prior forecast. Existing-trip
planning continues to **append** reviewed stops, as requested by the user.

`POST /api/trips/:id/history/rollback` accepts
`{ proposalId, revision, confirm: true }`. An editor can restore the immediate
pre-approval itinerary only if no later trip mutation has occurred. Linked added
stops are also protected explicitly. Expenses, finance records, membership and
bookings are preserved. Rollback and its actor/timestamp are atomic and retryable;
the reverted proposal cannot be applied again. Older approvals without snapshots
are visible but cannot be rolled back. After intervening edits, generate a new
proposal rather than overwriting newer work.


### Incremental planning preview responses

`POST /api/planning/preview` accepts `Accept: application/x-ndjson` to stream:

- `{"type":"status","stage":"planning"}` when processing starts.
- `{"type":"reply","text":"..."}` containing the current draft reply snapshot.
- `{"type":"result","data":{...}}` containing the ordinary validated preview or
  clarification response, after proposal persistence.
- `{"type":"error","code":"planning_unavailable"}` (or another planning error)
  terminates an unsuccessful stream; the client must not accept a partial plan.

Each event ends with a newline. Draft text comes from the model's partial
structured output and is not yet checked or approvable. Model calls receive the
request cancellation signal. Validation, membership, origin, limits and explicit
approval remain in place. Clients without this Accept header retain the JSON
response contract. Streaming failures after headers use an error event, while
pre-stream authentication, origin and input failures retain their HTTP status.
The adapter uses AI SDK `streamText` with `Output.object` and
`partialOutputStream` ([SDK reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)).


# Trip endpoints

Unless noted, success body is `{ "data": … }` and the tables describe the **payload inside `data`**.

## Trips

### `GET /api/trips`

- **Auth:** session  
- **Response:** `TripSummary[]` — trips the user may see (member of, plus
  legacy/demo). See [TripSummary](#tripsummary).

### `POST /api/trips`

- **Auth:** session  
- **Status:** `201`  
- **Body:**

| Field | Type | Rules |
| --- | --- | --- |
| `title` | string | trim, 1–120 |
| `currency` | string? | optional ISO-ish code, 1–8 chars |
| `startDate` | string? | optional ISO `YYYY-MM-DD` |
| `endDate` | string? | optional ISO `YYYY-MM-DD` (inclusive) |
| `dayCount` | number? | optional integer 1–60 |
| `destination` | string? | optional city/region label, 1–120 |
| `budgetAmount` | number? | optional planned budget (positive) |
| `partySize` | number? | optional planned party size 1–100 |

Omitted optional fields mean “TBD” in the create wizard. When any intake field
is present, the trip is created with `agentSeedPending: true` and an `intake`
object. The planner opens the agent and pre-fills a suggested `@agent` prompt;
the member can edit it and must explicitly send it. If `destination` is set and
`UNSPLASH_ACCESS_KEY` is configured, the
server searches Unsplash for a landscape cover and stores `coverUrl`. When
`destination` is set, the server also geocodes it via `GeoService` and stores
`intake.destinationLat` / `destinationLng` so the planner map can open near
that place before any stops exist.

Day rows are derived from dates / day count (defaults to one day starting
today). Day 1’s `city` is set from `destination` when provided.

- **Response:** full [`TripDto`](#tripdto-full-trip) (owner is first member).

Clients should apply the returned `TripDto` to the React Query cache
(`setQueryData` for both the trip detail and a prepended `TripSummary` on the
list via `toTripSummary`) and navigate to the planner. Realtime reconnects
refetch authoritative state.

### `GET /api/trips/:id`

- **Auth:** session + member (`404` if not)  
- **Response:** [`TripDto`](#tripdto-full-trip)

### `PATCH /api/trips/:id`

- **Auth:** session + edit  
- **Body:** one of:
  - `{ title: string }` (trim, 1–120) — rename
  - `{ clearAgentSeedPending: true }` — clear the one-shot agent seed flag after
    the member sends the suggested prompt
- **Response:** [`TripDto`](#tripdto-full-trip)

---




# Itinerary endpoints (days, stops, media)

Unless noted, success body is `{ "data": … }` and the tables describe the **payload inside `data`**.

## Days

### `POST /api/trips/:id/days`

- **Auth:** session + edit  
- **Status:** `201`  
- **Body:** none  
- **Response:** [`TripDto`](#tripdto-full-trip) with new empty day appended.

### `PATCH /api/trips/:id/days/:day`

- **Auth:** session + edit  
- **Path:** `:day` — positive integer day number (coerced from string)  
- **Body:** at least one of:

| Field | Type | Rules |
| --- | --- | --- |
| `date` | string? | `YYYY-MM-DD` or `""` |
| `dateLabel` | string? | max 40 (legacy) |
| `city` | string? | max 80 |
| `color` | string? | `#` + 6 hex digits |

- **Response:** [`TripDto`](#tripdto-full-trip)

### `PUT /api/trips/:id/days/order`

- **Auth:** session + edit  
- **Body:** `{ order: number[] }` — permutation of current day numbers
  (positive ints, min length 1). Days renumber to `1..N` by new position;
  city/label/stops travel with the day; date and color recompute from position.  
- **Response:** [`TripDto`](#tripdto-full-trip)

### `DELETE /api/trips/:id/days/:day`

- **Auth:** session + edit  
- **Path:** `:day` — positive integer day number  
- **Response:** [`TripDto`](#tripdto-full-trip) after deletion and renumbering.

**Date convention:** trip `startDate` and each day `date` are ISO
`YYYY-MM-DD` or `""`. New trips set day 1 from today; appended days use
`startDate + (day.number - 1)`. Because dates are positional, reordering
resequences dates. Clients localize ISO values for display. `dateLabel` is
legacy fallback only.

---

## Stops

### `POST /api/trips/:id/stops`

- **Auth:** session + edit  
- **Body:**

| Field | Type | Rules / default |
| --- | --- | --- |
| `day` | number | positive int |
| `index` | number | ≥ 0 within day |
| `name` | string | min 1 |
| `time` | string | display time |
| `duration` | string? | max 20; default `1h` |
| `lat` / `lng` | number? | if both provided, used verbatim; else interpolated |
| `area` | string? | max 120 |
| `category` | `StopCategory`? | default `Plan` |
| `cost` | number? | 0…1e8; per-person estimate |
| `costCurrency` | string? | 1–8; default trip currency when cost set |
| `note` | string? | max 20_000 Markdown; may embed hosted image URLs |

- **Response:** [`TripDto`](#tripdto-full-trip)

### `PATCH /api/trips/:id/stops/:stopId`

- **Auth:** session + edit  
- **Body:** partial of `name`, `time`, `duration`, `area`, `category`, `cost`,
  `costCurrency`, `note` — **at least one** field. Same limits as insert.
  `cost` of `0` clears cost currency. **Position** changes use the position
  endpoint, not this one.  
- **Response:** [`TripDto`](#tripdto-full-trip)

### `PUT /api/trips/:id/stops/:stopId/position`

- **Auth:** session + edit  
- **Body:** `{ day: number, index: number }` — target day and zero-based index
  within that day’s stops after removal.  
- **Response:** [`TripDto`](#tripdto-full-trip)

### `POST /api/trips/:id/stops/:stopId/vote`

- **Auth:** session + **edit** (`TripService` uses `loadEditable`; viewers get
  `403` `insufficient_permissions`)  
- **Body:** none  
- **Response:** [`TripDto`](#tripdto-full-trip) (votes toggled for acting member)

### `POST /api/trips/:id/stops/:stopId/comments`

- **Auth:** session + **edit** (`loadEditable`; viewers `403`)  
- **Body:** `{ text: string }` (min 1)  
- **Response:** [`TripDto`](#tripdto-full-trip)  
- **Side effect:** when the agent is enabled, comments that `@mention` trip
  members and/or `@agent` are mirrored into the shared agent session (with the
  stop as context). Member mentions use the same toast path as agent chat;
  ambient agent reply runs only when `@agent` is present and is prepended into
  the same stop comment thread via `addComment` (see [setup and architecture](README.md)).

### `POST /api/trips/:id/media`

- **Auth:** session + edit  
- **Status:** `201`  
- **Body:** `multipart/form-data`, field name **`file`**  
- **Constraints:** PNG / JPEG / WebP / PDF / plain text (markdown, csv); max **2 MiB** decoded payload  
  (agent chat attachments use the same endpoint) 
- **Response:** `{ url: string }` — absolute or path URL under `/api/uploads/trips/…`  
- **Errors:** `400` `media_missing` / `media_unsupported_mime`; `413`
  `media_too_large`

---

Related: [setup and architecture](README.md) · [setup and architecture](README.md) (comment @mentions)

---




# Expense endpoints

Unless noted, success body is `{ "data": … }` and the tables describe the **payload inside `data`**.

## Expenses

### `POST /api/trips/:id/expenses` / `PATCH /api/trips/:id/expenses/:expenseId`

- **Auth:** session + edit  
- **Body (both):**

| Field | Type | Rules / default |
| --- | --- | --- |
| `description` | string | min 1 |
| `amount` | number | positive major units; INR permits two decimals |
| `currency` | string? | 1–8; default trip currency |
| `category` | `StopCategory`? | default `Plan` |
| `payer` | string | trip-local **member id** |
| `participants` | string[] | min 1 trip-local member ids |
| `allocations` | record? | Custom positive major-unit shares, exactly matching participants and total |
| `requestId` | UUID? | Add-expense retry identity; retain across retries |

- **Response:** [`TripDto`](#tripdto-full-trip) including recomputed `budget`

Settlement is computed server-side on the full trip; clients should display
`budget.settlements` rather than re-deriving.

---

Budget shape: [Budget DTO](#budget). Display FX: [setup and architecture](README.md).

---




# Reservations

Reservations are trip-owned records for flights, accommodation, restaurants,
rail, ground transport, activities, and other bookings. All routes require a
trip member; commands additionally require edit permission.

## List

`GET /api/trips/:id/reservations` returns `ReservationDto[]`, ordered by start
time.

## Create

`POST /api/trips/:id/reservations` requires an `Idempotency-Key` header. Reusing
the same key for the same trip and creator returns the original reservation
without creating a duplicate.

Required body fields are `type`, `title`, `startAt`, and `timezone`. Date-times
must include `Z` or an explicit UTC offset. Optional `amountMinor` is an integer
in minor units and requires a three-letter `currency`.

## Update

`PATCH /api/trips/:id/reservations/:reservationId` requires `If-Match` with the
current numeric revision, for example `If-Match: "3"`. The body is a non-empty
partial create body.

## Cancel

`POST /api/trips/:id/reservations/:reservationId/cancel` requires `If-Match`.
Cancellation retains the record and is terminal.

## Delete

`DELETE /api/trips/:id/reservations/:reservationId` requires `If-Match` and
permanently removes the reservation.

Stale commands return `409 reservation_conflict` with the current server
reservation as `error.current` whenever the record still exists (stale
`If-Match` and compare-and-swap failures). Clients must refresh from
`error.current` before retrying and must not silently overwrite it.

---




# Invite endpoints

Unless noted, success body is `{ "data": … }` and the tables describe the **payload inside `data`**.

## Invites

### `POST /api/trips/:id/invites`

- **Auth:** session + `canInvite`  
- **Status:** `201`  
- **Body:**

| Field | Type | Rules |
| --- | --- | --- |
| `accessScope` | `"anyone" \| "restricted_emails"` | |
| `allowedEmails` | string[]? | emails; required non-empty when restricted; max 50 |
| `role` | `"editor" \| "viewer"` | role granted on accept |
| `canInvite` | boolean? | default `false` — whether invitee may invite others |
| `expiresAt` | string \| null? | ISO datetime or null (no expiry); default null |
| `previousToken` | string? | if set, create then revoke that prior link (regenerate) |

- **Response:**

```ts
{ url: string; token: string; expiresAt: string | null }
```

`url` is `{Origin}/invite/{token}` (request `Origin` or first trusted origin).
**Token is returned once**; only a hash is stored.

### `GET /api/trip-invites/:token`

- **Auth:** public (optional session improves `alreadyMember` / email checks)  
- **Response:** [`InvitePreview`](#invitepreview)

### `POST /api/trip-invites/:token/accept`

- **Auth:** session  
- **Response:** `{ trip: TripDto; joined: boolean }` — the fresh Trip mutation
  echo lets the client populate detail/list caches before navigation;
  `joined: false` if already a member (idempotent).
- **Errors:** domain `invite_*` codes when expired/revoked/email restricted.

---




# User profile, preferences, and avatar

Unless noted, success body is `{ "data": … }` and the tables describe the **payload inside `data`**.

## Account profile

Profile reads and display-name updates use Better Auth directly rather than
duplicate Raahi AI routes:

- `GET /api/auth/get-session` returns the current user profile.
- `POST /api/auth/update-user` with `{ "name": "…" }` trims the name and
  accepts 1–64 characters.

Name and image changes made through Better Auth are synchronized to every
`trip_members` row backed by that user and emit a `members` realtime
invalidation for each affected trip.

## User preferences and avatar

### `GET /api/users/preferences`

- **Auth:** session  
- **Response:** [`UserPreferenceDto`](#userpreferencedto)

### `PUT /api/users/preferences`

- **Auth:** session  
- **Body:**

| Field | Type | Rules |
| --- | --- | --- |
| `plannerSidebarWidth` | number | 0…100 |
| `plannerSidebarCollapsed` | boolean | |

- **Response:** [`UserPreferenceDto`](#userpreferencedto)

### `PUT /api/users/preferences/agent-panel`

- **Auth:** session  
- **Body:** `{ collapsed: boolean }`  
- **Response:** [`UserPreferenceDto`](#userpreferencedto)

### `POST /api/users/avatar`

- **Auth:** session  
- **Status:** `201`  
- **Body:** `multipart/form-data`, field name **`avatar`**  
- **Constraints:** PNG / JPEG / WebP; max **2 MiB**  
- **Response:** `{ url: string }`  
- **Errors:** `400` `avatar_missing` / `avatar_unsupported_mime`; `413`
  `avatar_too_large`

The object is stored first, then the Better Auth user image is updated. The
same user-update hook synchronizes trip member avatars. If account/profile
projection update fails, the previous image is restored and the new object is
removed.

### `DELETE /api/users/avatar`

- **Auth:** session  
- **Response:** `{ image: null }`

---




# Agent HTTP endpoints

Unless noted, success body is `{ "data": … }` and the tables describe the **payload inside `data`**.

Shared session model, tools, and intervention policy: [setup and architecture](README.md).

### `GET /api/trips/:tripId/agent/messages`

- **Auth:** session + member; agent enabled  
- **Response:** [`AgentHistoryDto`](#agenthistorydto) — up to ~200 messages plus
  active suggestions (dismissed-for-this-user hidden).

### `POST /api/trips/:tripId/agent/messages`

- **Auth:** session + member; agent enabled  
- **Body:**

```ts
{
  text?: string; // trim, max 4000; optional when files are present
  files?: Array<{
    type: "file";
    mediaType: string;
    url: string; // trip-owned /api/uploads/trips/… URL (not data:)
    filename?: string;
  }>; // max 8
}
```

At least one of `text` (non-empty) or `files` is required. File URLs must belong
to this trip’s managed upload namespace; unsupported MIME types are dropped.

- **Response:** `{ addressed: boolean; message: AgentMessageDto }`
  - `message` — the inserted row (echo the write so clients can `setQueryData`
    without an immediate list GET).
  - `addressed` — **immediate** flag only:
    - `true` when the text contains an explicit `@agent` mention (ambient reply
      is deferred and will arrive via polling).
    - `false` for every non-mention message, **even when** the server still
      schedules `maybeReplyIfAddressed` in the background. A later model
      judgment may still produce an ambient reply; that outcome is **not**
      reflected in this response. Clients should poll
      `GET …/agent/events` for any reply rather than treating `addressed: false`
      as “no reply will ever come.”

### `POST /api/trips/:tripId/agent/chat`

- **Auth:** session + member; agent enabled  
- **Response:** **streaming** AI SDK UI message stream — **not** the `{ data }`
  envelope. Clients (e.g. Vercel AI SDK `useChat` / `DefaultChatTransport`)
  should consume the stream protocol, not `apiFetch` JSON helpers.  
- **Body:**

```ts
{
  messages?: Array<{
    id?: string;
    role: string;
    parts: Array<
      | { type: "text"; text: string }
      | { type: "file"; mediaType: string; url: string; filename?: string }
      | { type: string; /* AI SDK tool/reasoning passthrough */ }
    >;
  }>;
  message?: { id?: string; role: string; parts: … } | null; // legacy single turn
}
```

Server persists new user text **and file parts** (and finished assistant
messages) using client UIMessage ids for live/history dedupe. Attachment-only
turns are allowed. Tool-approval continuation uses the full `messages` list
with approval parts.

### `GET /api/trips/:tripId/agent/events`

- **Auth:** session + member; agent enabled  
- **Query:** `after` — integer ≥ 0 (default `0`); return messages with
  `seq > after`  
- **Response:** [`AgentEventsDto`](#agenteventsdto)

### `POST …/suggestions/:suggestionId/approve`

- **Auth:** session + member; **apply** requires edit permission  
- **Body** (AI SDK approval shape):

```ts
{ id?: string; approved: boolean; reason?: string } // reason max 500
```

`id` defaults to path `suggestionId`.

- **Response when `approved: true`:** full [`TripDto`](#tripdto-full-trip)
  after patch apply  
- **Response when `approved: false`:** `{ dismissed: true }` (toast hidden for
  this user only)  
- **Errors:** `409` when suggestion not pending / stale / expired; `403` if
  viewer tries to apply

### `POST …/suggestions/:suggestionId/apply`

- Alias: `approved` defaults to `true` if omitted.  
- **Response:** same as approve with `approved: true`.

### `POST …/suggestions/:suggestionId/dismiss`

- Forces `approved: false`.  
- **Response:** `{ dismissed: true }`.

---

Behavior, tools, intervention: [setup and architecture](README.md).

---




# DTO catalog

## `StopCategory`

```ts
"Sight" | "Food" | "Stay" | "Shopping" | "Activity" |
"Walk" | "Park" | "Transit" | "Plan"
```

## `TripStatus`

```ts
"active" | "planning" | "settled"
```

## `MemberRole`

```ts
"owner" | "editor" | "viewer"
```

## `TripSummary`

Returned by `GET /api/trips`.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Trip id |
| `title` | string | Title |
| `startLabel` | string | Display start label |
| `endLabel` | string | Display end label |
| `status` | `TripStatus` | Status |
| `currency` | string | Trip currency code |
| `coverColor` | string | Card color |
| `coverUrl` | string \| null | Optional Unsplash (or other) cover image URL |
| `memberCount` | number | Members |
| `stopCount` | number | Stops |
| `createdAt` | string | ISO 8601 creation time |
| `creatorName` | string | Owner / first member display name |
| `members` | `TripSummaryMember[]` | Creator-first; for avatar stack |
| `location` | `{ lat, lng } \| null` | First located stop, or null |

**`TripSummaryMember`:** `id`, `name`, `initials`, `avatarBg`, `avatarFg`,
optional `image`, `isCurrentUser`.

## `TripDto` (full trip)

Returned by most trip mutations and `GET /api/trips/:id`.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Trip id |
| `title` | string | Title |
| `status` | string (`TripStatus`) | Status |
| `currency` | string | Default trip currency |
| `startDate` | string | ISO `YYYY-MM-DD` or `""` |
| `coverUrl` | string \| null | Optional cover image URL |
| `intake` | `TripIntake` \| null | Create-wizard answers (TBD fields omitted) |
| `agentSeedPending` | boolean | Planner should offer a one-shot suggested `@agent` draft |
| `members` | `MemberDto[]` | Membership |
| `permissions` | `TripPermissions` | **Caller’s** effective rights |
| `days` | `DayDto[]` | Itinerary days |
| `stops` | `StopDto[]` | Flat list (use `day` + order) |
| `expenses` | `ExpenseDto[]` | Expenses |
| `budget` | `Budget` | Server-computed settlement |

**`TripIntake`** (create wizard; omitted keys mean TBD):

| Field | Type | Meaning |
| --- | --- | --- |
| `destination` | string? | City / region label |
| `destinationLat` | number? | Geocoded destination latitude (create / backfill) |
| `destinationLng` | number? | Geocoded destination longitude |
| `dayCount` | number? | Planned day count |
| `startDate` | string? | ISO start |
| `endDate` | string? | ISO inclusive end |
| `budgetAmount` | number? | Planned budget amount |
| `budgetCurrency` | string? | Currency for `budgetAmount` |
| `partySize` | number? | Planned party size (does not create members) |

**`TripPermissions`:**

| Field | Type | Meaning |
| --- | --- | --- |
| `isMember` | boolean | May read |
| `canEdit` | boolean | Owner/editor (not viewer) |
| `canInvite` | boolean | May create invites |

**`MemberDto`:**

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Trip-local member id |
| `name` | string | Display name |
| `shortName` | string | Short label |
| `initials` | string | Avatar initials |
| `avatarBg` / `avatarFg` | string | Fallback colors |
| `image` | string \| null? | Avatar URL |
| `userId` | string \| null? | Better Auth user id; null for demo |
| `role` | `MemberRole` | Collaboration role |
| `canInvite` | boolean | Invite permission |
| `isCurrentUser` | boolean | True for the requesting user |

**`DayDto`:**

| Field | Type | Meaning |
| --- | --- | --- |
| `number` | number | 1-based day number |
| `date` | string | ISO `YYYY-MM-DD` or `""` |
| `dateLabel` | string | Legacy display label |
| `city` | string | City / region label |
| `color` | string | Hex color |

**`StopDto`** (persistence-only `order` is **not** exposed):

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stop id |
| `day` | number | Day number |
| `time` | string | Time label |
| `duration` | string | e.g. `1h` |
| `name` | string | Title |
| `area` | string | Area / neighborhood |
| `category` | string (`StopCategory`) | Category |
| `lat` / `lng` | number | Coordinates |
| `cost` | number | Per-person estimate (minor units) |
| `costCurrency` | string | ISO code; empty → trip currency |
| `createdBy` | string | Trip-local member id |
| `transit` | boolean | Transit segment flag |
| `note` | string | Markdown note |
| `votes` | string[] | Member ids who voted |
| `comments` | `{ author, timeLabel, text }[]` | Comments |

**`ExpenseDto`** (`createdOrder` not exposed):

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Expense id |
| `description` | string | Label |
| `payer` | string | Trip-local member id |
| `amount` | number | Major units; INR rupees support two decimals |
| `currency` | string | ISO code for amount |
| `category` | string (`StopCategory`) | Type |
| `participants` | string[] | Split among these member ids |
| `allocations` | record? | Custom shares in major units |
| `shares` | record | Computed participant shares in major units |
| `whenLabel` | string | Display time label |

## `Budget`

| Field | Type | Meaning |
| --- | --- | --- |
| `total` | number | Sum of expense amounts |
| `perPerson` | number | `total / memberCount` (rounded) |
| `balances` | `Balance[]` | Per-member paid / share / net |
| `settlements` | `Settlement[]` | Minimal transfer plan |

**`Balance`:** `{ memberId, paid, share, net }` — `net = paid − share`
(positive ⇒ others owe them).  
**`Settlement`:** `{ from, to, amount }` — transfer from debtor member id to
creditor.  
**Note:** Budget totals, balances and settlements use trip-currency major units.
Only expenses in that currency enter the calculation; `excludedCurrencies`
identifies excluded currencies. Use `GET /api/fx/rates` only for display conversion.

Example:

```json
{
  "total": 470200,
  "perPerson": 117550,
  "balances": [
    { "memberId": "lynn", "paid": 91200, "share": 117550, "net": -26350 }
  ],
  "settlements": [
    { "from": "lynn", "to": "sam", "amount": 26350 }
  ]
}
```

## `InvitePreview`

| Field | Type | Meaning |
| --- | --- | --- |
| `tripId` | string | Trip to join |
| `tripTitle` | string | Title |
| `inviterName` | string | Who invited |
| `memberCount` | number | Current members |
| `role` | `"editor" \| "viewer"` | Role on accept |
| `accessScope` | `"anyone" \| "restricted_emails"` | Link policy |
| `status` | `"usable" \| "expired" \| "revoked" \| "email_restricted"` | Usability |
| `alreadyMember` | boolean | Viewer already on trip |
| `expiresAt` | string \| null | Expiry |

## `UserPreferenceDto`

| Field | Type | Meaning |
| --- | --- | --- |
| `userId` | string | User id |
| `plannerSidebar` | `{ width: number; collapsed: boolean }` | Planner chrome |
| `agentPanelCollapsed` | boolean | Agent panel UI |
| `updatedAt` | string | ISO timestamp |

## `WeatherData`

| Field | Type | Meaning |
| --- | --- | --- |
| `icon` | string | Icon code |
| `main` | string | Short condition |
| `description` | string | Longer description |
| `temp` | number | Temperature |
| `feelsLike` | number | Feels-like |
| `humidity` | number | Humidity |
| `pressure` | number | Pressure |
| `visibility` | number | Visibility |
| `windSpeed` | number | Wind speed |
| `windDeg` | number | Wind direction deg |
| `clouds` | number | Cloud cover |

## `FxRatesData`

| Field | Type | Meaning |
| --- | --- | --- |
| `date` | string | Rate table date |
| `base` | string | Base currency |
| `provider` | string | Provider id |
| `rates` | `Record<string, number>` | Quote → units of quote per 1 base (includes `base: 1`) |
| `fetchedAt` | string | Fetch timestamp |

## Agent DTOs

### `AgentHistoryDto`

```ts
{ messages: AgentMessageDto[]; suggestions: AgentSuggestionDto[] }
```

### `AgentPostMessageResultDto`

Returned by `POST …/agent/messages` (inside `{ data }`):

```ts
{ addressed: boolean; message: AgentMessageDto }
```

`message` is the inserted row so clients can update the history cache without
an immediate list GET.

### `AgentEventsDto`

```ts
{
  latestSeq: number;
  messages: AgentMessageDto[];
  suggestions: AgentSuggestionDto[];
}
```

### `AgentMessageDto`

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Message id (may match client UIMessage id) |
| `seq` | number | Monotonic poll cursor |
| `role` | `"user" \| "assistant" \| "system"` | Role |
| `parts` | `AgentMessagePart[]` | Text and/or richer AI SDK parts |
| `actorUserId` | string \| null | Human author; null for agent |
| `actorName` | string \| null | Resolved from trip membership |
| `source` | `"chat" \| "mention" \| "operation" \| "threshold" \| "stop_comment"` | Origin |
| `mentionedUserIds` | string[] | @mentioned Better Auth user ids |
| `createdAt` | string | ISO time |

Text part: `{ type: "text"; text: string }`. Assistant messages may include
tool / approval parts with additional fields. Agent UI uses these typed,
persistent data parts (neither is transient):

```ts
type AgentGroundingPart = {
  type: "data-agent-grounding";
  id: string;
  data: {
    kind: "street-view";
    outcome:
      | "found"
      | "empty"
      | "place_not_found"
      | "invalid_request"
      | "service_unavailable";
    request?:
      | { kind: "place"; query: string; language: "en" | "zh"; selectionIndex: number }
      | { kind: "coordinate"; lat: number; lng: number; language: "en" | "zh"; selectionIndex: number };
    placeLabel?: string;
    imageIds: string[];
    selectedImageId?: string;
  };
};

type AgentStatusPart = {
  type: "data-agent-status";
  id: string;
  data: {
    kind: "generated-ui-fallback";
    reason: "place_not_found" | "invalid_request" | "service_unavailable";
    retryable: boolean;
    retryRequest?: { request: AgentGroundingPart["data"]["request"] };
  };
};
```

Only `outcome="found"` grounding image ids authorize a street-view card.

### `AgentSuggestionDto`

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Suggestion id |
| `messageId` | string \| null | Related session message |
| `status` | `"pending" \| "applied" \| "stale" \| "expired"` | Lifecycle |
| `severity` | `"info" \| "warning" \| "critical"` | Urgency |
| `reason` | string | Model reason |
| `suggestionText` | string | Human-readable suggestion |
| `patch` | `PendingPatch` | Discriminated patch (see below) |
| `expiresAt` | string \| null | Expiry |
| `appliedBy` | string \| null | Who applied |
| `createdAt` / `updatedAt` | string | ISO times |

### `PendingPatch`

Discriminated by `kind` (must match trip ops the aggregate supports):

| `kind` | Payload |
| --- | --- |
| `rename_trip` | `title` |
| `add_day` | (none) |
| `delete_day` | `dayNumber` |
| `update_day` | `dayNumber`, `changes` (same as day PATCH body) |
| `reorder_days` | `order: number[]` |
| `insert_stop` | `draft` (same as insert stop body) |
| `update_stop` | `stopId`, `changes` |
| `append_stop_note` | `stopId`, `markdown` |
| `move_stop` | `move: { stopId, day, index }` |
| `add_expense` | `draft` (expense body) |
| `update_expense` | `expenseId`, `changes` |

Applying a patch always goes through domain trip methods after human approval.

### `StreetViewImageDto`

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Opaque image id |
| `coordinate` | `{ lat, lng }` | Capture coordinate |
| `distanceMeters` | number, optional | Rounded distance from search origin |
| `capturedAt` | ISO string, optional | Capture time |
| `headingDegrees` | number, optional | Camera heading |
| `supports360` | boolean | Interactive panorama availability |
| `previewUrl` | string | Same-origin, trip-scoped preview route |
| `attribution` | `{ label, url? }` | Trusted provider attribution |

Provider thumbnail URLs and access tokens are never part of this DTO.

### `ReservationDto`

| Field | Type | Meaning |
| --- | --- | --- |
| `id`, `tripId` | string | Reservation and owning trip ids |
| `type` | `flight \| accommodation \| restaurant \| rail \| ground_transport \| activity \| other` | Booking kind |
| `status` | `tentative \| confirmed \| cancelled \| completed` | Lifecycle |
| `title`, `provider`, `confirmationNumber` | string | Booking identity |
| `startAt`, `endAt` | ISO string / null | UTC instants |
| `timezone` | string | Display IANA timezone |
| `locationName`, `address` | string | Display location |
| `latitude`, `longitude` | number / null | Optional coordinate pair |
| `dayNumber`, `stopId`, `expenseId` | number/string / null | Optional trip links |
| `amountMinor`, `currency` | number/string / null | Optional booking amount |
| `notes` | string | Member notes |
| `createdBy`, `createdAt`, `updatedAt` | string | Audit fields |
| `revision` | number | `If-Match` concurrency token |

---




# Error envelope


`server/src/middleware/errors.ts` maps thrown errors:

| Source | Typical status | `error.code` examples |
| --- | --- | --- |
| Zod | 400 | `validation_error` |
| Domain / input | 400 | domain codes (`empty_message`, `invalid_currency`, …) |
| Unauthenticated guard | 401 | `unauthenticated` |
| Forbidden | 403 | `insufficient_permissions` |
| Not found | 404 | `trip_not_found`, `suggestion_not_found`, `agent_disabled` |
| Conflict | 409 | `suggestion_not_pending`, `reservation_conflict` |
| Precondition required | 428 | `revision_required` |
| Avatar / media size | 413 | `avatar_too_large`, `media_too_large` |
| Weather/FX/geo | 502–504 / 503 | see weather/fx/geo docs |
| Street view | 400 / 404 / 413 / 502–504 | invalid image/query, missing image, bounded preview, or upstream failure |
| Unhandled | 500 | `internal_error` |

Example:

```json
{ "error": { "code": "unauthenticated", "message": "Sign in required" } }
```

Reservation compare-and-swap conflicts additionally return
`error.current` with the current `ReservationDto` or `null` when it was deleted.

---

Status code summary: [conventions.md](#conventions).

---




# Multi-client implementation notes


1. **Base URL** — API origin where `/api` is mounted (hosted Node or local `:8780`). Web uses Vite proxy in dev; mobile should call the API host
   directly.
2. **JSON helpers** — unwrap `data` on success; throw on `error` (see web
   `client/src/lib/api/client.ts` as a reference, not the contract).
3. **Do not use JSON unwrap for** agent chat stream or upload file GET.
4. **Multipart field names** — trip media: `file`; avatar: `avatar`.
5. **Optimistic / write-echo UI** — many mutations return the full trip (or the
   inserted row). Replace local state / query cache with the response rather
   than patching fields ad hoc or immediately refetching a list. Refetch authoritative state on realtime reconnect.
6. **Polling agent** — web polls `GET …/agent/events?after=<seq>` ~12s; mobile
   can use the same cursor protocol.
7. **Geo tools** are **agent-only** (no public HTTP geo routes). Clients do not
   call place search via REST; they use stops/map UX or the agent. See
   [setup and architecture](README.md).
8. **No product API** yet for deleting a stop or expense (human or agent).

---


