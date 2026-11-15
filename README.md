# Raahi AI

Raahi AI is a private, proprietary travel-planning application for friends
exploring India. It uses React/Vite, an Express Node API, Better Auth and
MongoDB/Mongoose persistence. SQL code is retained for legacy tooling.

**Development status:** the local source audit and automated baseline are
recorded in [BUILD_PROGRESS.md](BUILD_PROGRESS.md). Product branding is in
progress. Microphone transcription and a read-only AI trip preview are implemented
with live end-to-end verification pending. The preview asks for missing constraints,
checks place coordinates and road estimates, and labels estimated costs. It does
not automatically save a trip. Eligible new-trip proposals can be explicitly
approved and saved; applying proposals to existing trips remains planned.
Proposal review includes English/Hindi spoken summaries through ElevenLabs,
with visible narration, stop/cancel and native replay/mute controls. Short live
TTS samples pass; browser audio and pronunciation acceptance remain pending.
Expense entry includes reviewed voice/text drafts with explicit payer and participant selection. INR expenses support paise precision, equal/custom shares and retry protection in the expense form. Database and live parser checks pass; browser acceptance remains incomplete. The Budget board also supports explicit group forecasts and reviewed AI reductions of optional future activities; database approval/revision checks pass, with browser acceptance pending.

## What exists today

The inherited application includes shared trips, invitations and roles, map and
day views, reservations, expense entry and a trip-scoped AI assistant with
approved write tools. AI requires a separately configured provider. Node provides single-process realtime collaboration; hosted acceptance is still pending.

Raahi supports planning across India. Rajasthan, Kerala, Goa, the Northeast
and the Himalayas are examples, not a destination whitelist. The personal
onboarding trip is one regional example. Landing previews are illustrative
plans, not live prices or bookings. INR expenses use deterministic paise splits.

## Roadmap

The defining workflow is:

Speak in Hindi, Hinglish or English → edit the transcript → review a sourced
itinerary proposal → approve → save a shared trip and map → hear a concise
ElevenLabs response.

See [RAAHI_PLAN.md](RAAHI_PLAN.md) for phase gates and
[the local gap register](docs/raahi/IMPLEMENTATION_GAPS.md) for verified reuse
points and remaining work. [API setup](docs/raahi/RAAHI_API_ACCOUNTS_AND_KEYS.md)
lists server-side credential names. Do not put private keys in `VITE_*` values.

## Migration status

The application runs on Node/Express and MongoDB. Cloudflare Worker and Docker
deployment/runtime files have been removed. Geoapify supplies places, medical
search and road routing. See [Render setup](deploy/render/README.md) for the free
single-service demo with external upload storage.
The final controllers/routes/db folder reorganization remains a later step.

## Quick start

Requirements: Node.js compatible with the pinned tooling (Node 24 is recommended),
pnpm 10.28.1, and an isolated MongoDB replica set or Atlas database.

```sh
corepack pnpm install --frozen-lockfile
cp .env.example .env
```

Copy the example only when `.env` does not already exist. Edit the ignored
`.env` locally: set `MONGO_URI` to your development database, generate strong
`BETTER_AUTH_SECRET` value, and check `BASE_URL`
and `TRUSTED_ORIGINS`. Keep credentials out of Git and screenshots.

```sh
corepack pnpm dev
```

The API creates required Mongo collections and indexes before listening. A
standalone MongoDB server is rejected because approvals and financial writes
require transactions. New accounts receive a personal Indian demonstration
trip through the existing signup hook; a SQL seed is not needed.

The web app runs at `http://localhost:5170`, and the API at
`http://localhost:8780` with the example settings. The retained `db:*` Prisma
commands operate on legacy SQL only; they do not initialize MongoDB. See
[database setup](docs/backend/database.md) and the
[M3 report](docs/raahi/M3_MONGODB_PERSISTENCE.md).

Email uses the existing local console provider by default. The AI assistant is
disabled until `AI_MODEL` and `AI_API_KEY` are configured. Set server-side `ELEVENLABS_API_KEY` to enable transcription token issuance.
Set `ELEVENLABS_VOICE_ID_EN` and `ELEVENLABS_VOICE_ID_HI` from your ElevenLabs
voice library to enable spoken proposal summaries (the same multilingual voice
can serve both). The key needs Text to Speech access. Restart `pnpm dev` after
changing environment values. Review an AI proposal and choose Play summary;
audio failure preserves the readable itinerary. Full voice workflow acceptance
remains pending.

## Verification

After installing dependencies and configuring `BASE_URL` (generate the retained
Prisma client with `pnpm db:generate` if it is absent):

```sh
corepack pnpm check
corepack pnpm docs:check
```

Mongo integration tests start their own disposable replica set, never read your
`MONGO_URI`, and download a pinned test binary on first use.

`make check` runs the same quality pipeline if Make is installed. A successful
build or mock test does not prove live authentication, provider access, or
multi-user persistence. The progress log records those checks separately.

## Repository

| Path | Purpose |
| --- | --- |
| `apps/web` | React/Vite SPA and PWA, Feature-Sliced Design |
| `apps/api` | Express Node, MongoDB/Mongoose, domain/services/adapter boundaries |
| `apps/docs` | Existing Next.js/Fumadocs documentation site |
| `packages` | Shared agent UI catalog and observability contracts |
| `deploy` | Native Node preparation and archived deployment configurations |
| `docs/raahi` | Raahi specifications and local audit |

Read [AGENTS.md](AGENTS.md) and the [documentation index](docs/README.md)
before working on the project. Use English identifiers/comments and Conventional Commits.
Keep each phase reviewable with tests and an updated progress log. Workspace
packages use the `@raahi/*` namespace.

## Private project and third-party notices

This project is not offered as open source. All workspace packages are private;
original Raahi AI additions are not licensed for public reuse. See
[project licensing](PROJECT_LICENSE.md) and [third-party notices](THIRD_PARTY_NOTICES.md).
Upstream and dependency licenses continue to apply to their respective code.

## Development files

- `pnpm-lock.yaml` pins dependency versions for reproducible installs. Keep it.
- `pnpm-workspace.yaml` defines the monorepo packages. Keep it.
- `AGENTS.md` and `.agents/skills/` guide coding assistants; they are development
  resources and are not bundled into the application.
- `skills-lock.json` records the sources and hashes of those installed skills.
- `.mcp.json` contains optional coding-assistant service configuration (Sentry).
- `.github/` runs automated checks. `node_modules/`, build output and `.workspace/`
  contain dependencies, generated files and local test artifacts; they are ignored.
- The duplicate Claude instruction links and retired WeChat MCP entry were removed.

India travel checks are available in a trip’s **Reservations** tab. Select saved
stops in travel order for road estimates, nearby stay listings and official
transport search links. Optional `TRAVEL_WEATHER_PROVIDER=open-meteo` enables
16-day daily forecasts for local/non-commercial use; it defaults disabled in the
example and requires attribution. See provider terms before deployment. Rooms,
fares, schedules, local jeeps and road access are never represented as confirmed.

**Medical help** is available from the trip planner. Choose a saved stop or opt
into browser location to search sourced hospital, clinic and pharmacy listings.
Opening status and emergency capacity remain unknown. India emergency contacts
are accessible before login. The Reservations tab also offers an offline HTML
itinerary download; it is a dated snapshot, without group finances or member
information. Live searches and maps need connectivity.
