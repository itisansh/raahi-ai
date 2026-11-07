---
title: "Platform endpoints"
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

- **Response:** [`WeatherData`](./dtos.md#weatherdata) or `null`  
- **Errors:** `400` `invalid_coordinates`; `503` `weather_not_configured`;
  `502` provider failures. Details: [weather.md](../weather.md).

### `GET /api/fx/rates`

- **Auth:** session  
- **Query:**

| Param | Required | Meaning |
| --- | --- | --- |
| `base` | yes | ISO 4217 (3 letters) |
| `quotes` | no | Comma-separated quote currencies |
| `date` | no | `YYYY-MM-DD` historical; omit for latest |

- **Response:** [`FxRatesData`](./dtos.md#fxratesdata)  
- **Errors:** `400` `invalid_currency` / `invalid_date`; `502` provider.
  Details: [fx.md](../fx.md).

### `GET /api/agent/status`

- **Auth:** session  
- **Response:** `{ enabled: boolean }` — `true` when AI env is configured.

---

Related: [weather.md](../weather.md) · [fx.md](../fx.md)

---

[← API index](./README.md) · [Route index](./routes.md) · [DTOs](./dtos.md)

## Voice transcription token

`POST /api/voice/token` requires an authenticated session and an `Origin`
exactly matching `TRUSTED_ORIGINS`. It accepts no audio or trip changes and
returns `{ "data": { "token": "<single-use-token>" } }` with `private, no-store`.
The server uses `ELEVENLABS_API_KEY`; never expose that key in browser config.
Issuance is limited to five attempts per user per minute. Workers reuse the
atomic auth Durable Object limiter; a single Node process uses memory.

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
It requires a session and an exact trusted Origin. Prompts must be 10–4000
characters; bodies are limited to 20 KB. Attempts are limited to five per user
per minute (shared atomic storage on Workers, process memory on Node).

With `tripId`, membership is checked before provider calls and the current trip
revision, intake and days are supplied as context. This read does not backfill
coordinates or mutate the existing trip. Without `tripId`, no trip is loaded.

Responses use the normal `{ data }` envelope:

- `status: clarification`: extracted `intent` and `missing` field identifiers.
  Origin, group size, duration (1–14 days), positive INR budget and its per-person
  or group basis are essential. Dates may remain unknown. No itinerary provider
  call occurs until these constraints are present.
- `status: preview`: unsaved proposal ID, context revision, intent, ordered days,
  per-stop place evidence, road estimates including return travel, cost ranges
  and issue identifiers. PostgreSQL retains the proposal for explicit approval;
  other backends currently return an ephemeral preview.

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
form remains available. On PostgreSQL, previews are retained for 30 minutes in
`planning_proposals`; `approvable` indicates eligibility for explicit approval.

### New-trip approval

`POST /api/planning/proposals/:id/approve` requires the proposal owner session,
trusted Origin and exactly `{ "confirm": true }`. Client itinerary data is never
accepted. A row lock makes concurrent retries return the same `tripId`; trip,
members, days, stops and approval timestamp commit together. Failed approval
rolls back. The stored proposal retains intent, cost/source evidence and approval
history. Unknown dates remain unknown and no guessed coordinates are persisted.

Only new-trip proposals with no issues other than unknown dates can be approved.
Expired proposals and proposals with existing-trip context are rejected. Existing
trip replacement/revision checks remain pending; no existing itinerary is changed.
MySQL approval is unavailable (503) pending a corresponding storage migration;
its previews remain ephemeral. PostgreSQL deployments must apply Prisma migrations.
The response is `{ "data": { "tripId": "..." } }`; the UI navigates to the existing
map/itinerary planner and uses existing trip membership/invitation permissions.

### Spoken proposal summaries

`POST /api/voice/summary/text` and `POST /api/voice/summary/audio` require a
session, trusted Origin and exactly `{ "proposalId": "<uuid>", "language": "en" | "hi" }`.
Requests are bounded to 1,000 bytes. Only the owner of an unexpired stored
PostgreSQL proposal can request its summary; arbitrary text and client owner IDs
are rejected. Text returns `{ "data": { "text": "...", "language": "en" } }`.
Audio returns MP3 bytes with no-store and nosniff headers. Missing configuration
or provider failure returns sanitized `503 speech_unavailable`; exceeding five
audio generations per user per minute returns `429 speech_rate_limited`.

Narration is built deterministically from stored trip constraints, destination
cities, group budget and every warning. It explicitly calls costs estimates and
bookings/timetables unconfirmed. The visible summary is the text sent to TTS.
No second LLM call performs arithmetic or invents a spoken itinerary.

Configure server-only `ELEVENLABS_API_KEY` with Text to Speech access and
`ELEVENLABS_VOICE_ID_EN` / `ELEVENLABS_VOICE_ID_HI`. Both IDs are required; the same
multilingual voice may serve both. The adapter uses ElevenLabs
`eleven_multilingual_v2` and MP3 at 44.1 kHz/128 kbps, a 30-second timeout and a
4 MB response bound. Short audio is buffered before playback; it is not a live
voice conversation or progressive audio stream. API reference:
https://elevenlabs.io/docs/api-reference/text-to-speech/convert

The proposal panel starts audio only after Play summary is clicked. Native audio
controls provide replay, volume and mute. Stop/cancel, language changes and
unmount abort pending requests and revoke temporary audio URLs. Speech failures
leave the readable summary and itinerary intact. Local replay through native
controls does not generate another billed request; Play summary regenerates it.
Playback is currently available during proposal review, not in saved-trip pages.

### Voice expense drafts (Phase 5 partial)

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

Current storage remains legacy integer whole currency units. Fractional amounts
are rejected by API and aggregate validation instead of silently rounded.
Equal shares allocate integer remainders by sorted member ID; total allocated
shares equal the expense amount and net balances sum to zero for valid inputs.
This is not yet paise accounting. Decimal expense persistence, custom shares,
mixed-currency settlement and idempotent writes remain Phase 5 work. No existing
amounts were reinterpreted or migrated.

#### Phase 5 precision and retry update (supersedes whole-unit-only status)

PostgreSQL migration `20261101182311_expense_precision` changes expense `amount`
from integer to Decimal(12,2) in major currency units and adds nullable JSON
`allocations`. Existing values retain their meaning (600 remains 600 rupees,
not 6 rupees). Apply Prisma migrations before running this source. The MySQL
schema snapshot is updated for fresh installs; existing MySQL deployments need a
matching schema upgrade and have not been verified here.

INR expense amounts may have two decimals. Backend calculations convert to
integer paise and distribute equal remainders by sorted member ID. Custom
`allocations: { "memberId": 400, "otherId": 200.01 }` use major currency units;
they must name exactly the participants, each have a positive valid amount and
sum exactly to the expense. Other currencies retain whole-unit behavior.
The DTO includes custom `allocations` and computed `shares` for display.

Add-expense input optionally accepts UUID `requestId`. The web editor assigns
one per mounted form and retains it across a failed-save retry. On SQL storage,
expense writes lock the trip before reading, checking permissions and changing
the ledger, then persist in the same transaction. Same actor/trip/request ID and
same details return the existing expense; changed details return 409. Independent
requests remain separate expenses. Legacy clients omitting requestId have no
retry identity. Editors wait for successful persistence before closing and keep
the draft on failure. After an ambiguous failed save, retry the same details;
close/reopen the form before starting a different expense.

Balances use only expenses in the trip currency. `budget.excludedCurrencies`
labels other-currency expenses excluded from that balance; the UI displays a
warning. No cross-currency amounts are added together. Settlement transfers are
computed suggestions, not bank transfers or payment confirmations.

### Budget intelligence and reviewed replanning (Phase 6)

PostgreSQL endpoints (all authenticated, private/no-store):

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

Future means a dated itinerary day strictly after today in Asia/Kolkata.
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
Unapproved proposals expire after 30 minutes. Approval locks proposal and trip,
rechecks current edit permission/date/protected stops/revision, deletes only the
approved optional stops, updates the forecast and revision, and records approval
actor, applied revision and timestamp atomically. Repeated approval returns the
same trip. Stale proposals return 409. Discard in the UI leaves the trip intact;
the unapplied proposal expires normally. Existing realtime invalidation notifies
members after commit; Node users can also reload to see the updated shared trip.

A live budget panel appears in the existing Budget board. Confirm the group
forecast, add spending, review projected shortfall, compare the proposal and
explicitly approve or keep the itinerary. Expenses refresh the panel through trip
revision changes. MySQL budget intelligence is unavailable (503); no additional
schema migration was required beyond the Phase 5 expense migration.

### India travel checks (Phase 7)

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

### Medical listings and offline resilience (Phase 8)

`POST /api/trips/:id/medical` requires session, trip membership, trusted Origin,
and a body under 1,500 bytes. Input is exactly `{ category, radiusMeters, location }`:
category is hospital/clinic/pharmacy; radius is 5,000 or 10,000 metres. Location
is either `{ kind: "stop", stopId }` or `{ kind: "gps", lat, lng, consent: true }`.
GPS coordinates are finite, India-area bounded and rounded to four decimals;
consent is the caller's explicit assertion. Browser permission is separately
requested only by the frontend button action, never on mount. No live location
is written to trip/member records or broadcast. Underlying Places requests/cache
use coordinates to answer that lookup; this is not continuous location tracking.

The service reuses the configured OSM/Google GeoService and its cache. Fixed
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
login/session loading and inside Medical help: 112 (India ERSS) and 108 explicitly
labeled Uttarakhand ambulance. No call is automated. Sources reviewed 2026-11-02:
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
