# Raahi AI

Raahi AI is a private travel-planning application for trips across India, built
with React, Vite, Express, TypeScript and MongoDB. It supports shared itineraries,
map/day views, invitations, reservations, group expenses, reviewed AI planning,
voice input and spoken replies. The mobile experience is a browser app/PWA.

[API reference](API.md) documents HTTP endpoints, streaming, authentication,
request bodies and response DTOs.

## Local setup

Use Node 24 and pnpm 10.28.1 (pinned in `package.json`). MongoDB must support
replica-set transactions; use an isolated development replica set or Atlas database.

```sh
corepack pnpm install --frozen-lockfile
# Only when .env does not already exist:
cp .env.example .env
corepack pnpm dev
```

Use `pnpm dev:client` or `pnpm dev:server` to run either workspace separately.

Before starting, configure the ignored `.env` using the table below. With the
example settings, the web app is at `http://localhost:5170` and the API listens on
port 8780. Vite proxies `/api`, including WebSocket upgrades, to the API. Restart
both dev servers after changing environment values.

The API initializes Mongo collections, indexes and versioned migrations before
listening. A standalone Mongo server is rejected. New accounts receive a personal
demonstration trip; no SQL seed is needed. Do not reset a supplied database.

## Configuration

Keep credentials, production URLs and bucket names in private environment
configuration. Never put private keys in `VITE_*` variables or commit `.env`.
The committed [.env.example](.env.example) contains placeholders only.

| Variables | Purpose |
| --- | --- |
| `MONGO_URI` | Required Mongo replica-set connection |
| `BETTER_AUTH_SECRET` | Required stable random authentication secret, at least 32 characters |
| `BASE_URL`, `TRUSTED_ORIGINS` | Public browser origin and exact allowed origins; the former is embedded at build time |
| `PORT`, `WEB_PORT` | Local API and Vite ports |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` | Console verification codes locally; verified Resend sender for hosted email |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google OAuth |
| `AI_PROVIDER`, `AI_MODEL`, `AI_BASE_URL`, `AI_API_KEY` | Server-side model configuration; Gemini uses the OpenAI-compatible provider |
| `AI_PROACTIVE_THRESHOLD`, `AI_MAX_TOOL_STEPS` | Trip-assistant intervention and tool limits |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_EN`, `ELEVENLABS_VOICE_ID_HI` | Realtime transcription tokens and spoken replies; both voice IDs required for speech |
| `GEO_PROVIDER`, `GEOAPIFY_API_KEY` | Geoapify place, medical and road lookups; OSM/Google adapters also exist |
| `GEO_OSM_USER_AGENT`, `GOOGLE_MAPS_API_KEY` | Identifying contact for OSM or credentials for the Google alternative |
| `TRAVEL_WEATHER_PROVIDER` | Empty disables daily travel forecasts; `open-meteo` selects the noncommercial adapter |
| `OPENWEATHERMAP_API_KEY` | Separate weather widget and assistant weather integration |
| `UNSPLASH_ACCESS_KEY` | Optional trip cover images |
| `STREET_VIEW_PROVIDER`, `MAPILLARY_ACCESS_TOKEN` | Optional street-view imagery |
| `STORAGE_BACKEND`, `STORAGE_ROOT` | Local filesystem upload storage |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | External private upload storage when `STORAGE_BACKEND=s3` |
| `WEB_DIST_PATH` | Built web app directory, relative to the API workspace |
| `TRUST_PROXY_CIDRS` | Explicit verified proxy ranges; empty ignores forwarded IP headers |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` | Optional server observability |
| `AI_TELEMETRY_RECORD_CONTENT` | Keep false unless intentionally enabling model-content telemetry |

A model-list response does not establish generation access. Voice requires browser
microphone permission and appropriate provider access. Audio failures leave the
readable reply available. Daily travel forecasts and the weather widget use
separate providers; a health check does not verify either provider or email.

## Architecture and conventions

Source layout:

| Path | Responsibility |
| --- | --- |
| `client/src/App.tsx`, `main.tsx` | Application composition and browser entry |
| `client/src/pages` | Route-specific screens and their local logic |
| `client/src/features` | Reusable workflows, including voice and trip planning |
| `client/src/components` | UI primitives, layout, providers and reusable surfaces |
| `client/src/lib` | API/auth clients, configuration, routing, shared models and utilities |
| `client/src/styles` | Global styling and design tokens |
| `client/public` | Fonts, icons and static assets; `src/sw.ts` owns the PWA worker |
| `server/src/server.ts` | Node startup, shutdown, web serving and realtime attachment |
| `server/src/app.ts`, `routes` | Native Express app, routing and per-endpoint access guards |
| `server/src/controllers` | Request validation, service calls and response formatting |
| `server/src/middleware` | Session/CORS/error handling, body limits and Web SDK stream adapter |
| `server/src/services` | Application use cases and provider orchestration |
| `server/src/services/rules` | Pure business rules and repository/provider contracts |
| `server/src/db/repositories` | Mongo persistence and transactional writes |
| `server/src/db/models.ts` | Business schemas and indexes |
| `server/src/db/migrations` | Versioned Mongo migrations; preserve these |
| `server/src/integrations` | Auth, storage, AI, email, geo and other providers |
| `server/src/realtime` | Single-process WebSocket collaboration |
| `server/tests` | HTTP, service, persistence and realtime regression tests |
| `shared/agent-ui`, `shared/observability` | Shared UI catalog and telemetry contracts |

Express handles route matching and middleware directly. Controllers retain Web
request/response primitives for Better Auth, multipart uploads and AI SDK streams.
The adapter preserves multiple cookies, backpressure and request cancellation.

Keep HTTP handlers thin. Business rules must remain independent of Express and
provider SDKs. Preserve public IDs, revision checks, idempotency, permission checks
and exact monetary conversions. Better Auth owns its auth collections through its
pinned Mongo adapter. Do not reinterpret existing amounts: expense inputs use INR
rupees with two decimals, while fields named `*Paise` or `amountMinor` use minor
units; other expense currencies retain their existing whole-unit semantics.

Keep page-specific UI logic with its page; extract reusable components and
features when needed. Use the existing coss/Base UI primitives and design tokens.
Centralize copy per surface, avoid duplicate implementations, use English code and
comments, and use Conventional Commits. Apply mutation responses to query caches;
refetch authoritative state after realtime reconnects. Diagnose failures before
adding fallback behavior.

Legacy browser-storage keys, email-language headers and native OAuth callback
identifiers are compatibility contracts. Their migration/support must survive
renaming. Root package and workspace packages are private; package identifiers
use `@raahi/*`.

## Verification

```sh
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm ui:check
corepack pnpm build
corepack pnpm docs:check
# All checks are also available as:
corepack pnpm check
```

Mongo collections, indexes and migrations initialize during API startup. No SQL
server, Prisma generation or `db:*` command is required.

Mongo integration tests start a disposable replica set, never use your supplied
`MONGO_URI`, and may download their pinned binary on first use. HTTP/Mongo tests
need permission to listen on local ports. Keep route and DTO documentation
coverage when moving code. Validate streaming/cancellation, cookies, uploads,
realtime reconnects and transaction behavior after transport changes.

Latest local verification (2026-11-16): a separate checkout with no existing
`node_modules` or private `.env` installed successfully from the frozen lockfile.
All 537 tests (401 server, 121 client, 15 shared), typechecking, lint, UI/doc checks
and builds passed. Built-app browser checks covered 320/390/768/1440-pixel layouts,
signup/session, day-five markers, medical/planning dialogs, native WebSocket
updates/resync, and uploaded-file persistence across a server restart. These
checks used disposable MongoDB and synthetic accounts. Live model/audio-provider
acceptance and hosted deployment verification remain separate.

## Deployment

The native Node blueprint is [render.yaml](render.yaml).
It serves the web app and API from one HTTPS origin. Build with
`bash scripts/build-render.sh`; start with `corepack pnpm --filter @raahi/api start`.
Use the repository root as service root and Node 24. Existing hosted services
must point their blueprint/build command at these new paths before redeploying.
`WEB_DIST_PATH=../client/dist` currently resolves from `server`.

Set `BASE_URL` to the exact assigned HTTPS origin without a trailing slash and
include it in `TRUSTED_ORIGINS`. A changed origin requires a frontend rebuild.
Keep `BETTER_AUTH_SECRET` stable. Configure Mongo network access and external S3
storage with `STORAGE_BACKEND=s3`; local uploads do not survive an ephemeral host.
Use Resend with a verified sender for actual account emails.

Rate limits, presence and realtime sequence counters are process-local: run one
instance. Reconnects refetch trip state. Free hosting can sleep; this configuration
does not establish production availability. Set trusted proxy ranges only after
verifying them, otherwise proxy clients can share one auth rate-limit bucket.

Before a release, check registration/OTP/login/reset, microphone and speaker
behavior, streamed replies, medical/travel lookups, two-browser collaboration,
and an uploaded file surviving restart. Use a separate staging database. No
restructure step should deploy or migrate an existing user database implicitly.

## Product boundaries and outstanding acceptance

AI previews stream draft reply text, then return a validated persisted result.
Only explicit approval writes a plan. Existing-trip approvals append reviewed
stops with revision checks; they preserve existing bookings and expenses.
Estimates and place/road evidence do not confirm prices, bookings, opening hours,
road access or train/bus schedules. Medical listings do not establish emergency
capacity or current opening status. The product supports India-wide planning;
the North India demo is an example, not a destination restriction.

The offline itinerary download is a dated HTML snapshot. It excludes finances,
member details and free notes. Authenticated API responses and GPS/medical results
are not cached by the service worker. Full offline authentication, persistent trip
sync and distributed realtime are not implemented.

Automated tests and prior browser checks cover local behavior. Live acceptance
of the latest Gemini reply streaming and microphone/speaker flow remains pending.
Hosted production readiness is not established by a passing build. The draggable,
minimizable desktop planning panel is a separate pending UI change.

## Private project and third-party notices

Raahi AI is a private, proprietary project. No public license is granted for
original Raahi AI additions, and repository access does not grant permission to
publish or redistribute them. This does not replace or restrict licenses already
granted for third-party code. The root [LICENSE](LICENSE) preserves the upstream
license; [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) records provenance and
scope. Dependencies retain their own licenses. Required notices remain even when
product branding and folder names change.


## Repository maintenance

`pnpm-lock.yaml` pins dependencies and `pnpm-workspace.yaml` defines the five
private workspaces. Keep both files. Use pnpm commands from this guide; there is
no separate docs site, SQL runtime or Makefile. Mongo startup migrations belong
in `server/src/db/migrations`; never delete or rewrite applied migrations.
The authentication dependency may retain optional SQL-related packages in the
lockfile; the application does not import them or run Prisma generation.

Keep README and API.md updated when behavior, configuration or contracts change.
Dependency licenses and THIRD_PARTY_NOTICES.md remain applicable. Local secrets,
uploads, assistant configuration, test artifacts and generated output stay ignored.
