# Raahi AI — Accounts, API Keys & Environment Setup

**For:** OpenTrip-based Raahi AI (React + Vite, Hono, PostgreSQL/Prisma, Better Auth)

**Security first:** Do not share API keys, database passwords, tokens or `.env` contents in ChatGPT, public Codex prompts, screenshots, issues or GitHub commits. Add secrets locally in the repository's ignored `.env` file; on deployment, use the provider's secret/environment variable dashboard. Codex should inspect variable **names**, never print their values. If a key leaks, revoke/rotate it.

## 1. Create accounts in this order

| Priority | Service/account | Purpose | What you need | Notes |
|---|---|---|---|---|
| NOW | **GitHub** — https://github.com | Fork/host Raahi code, pull requests | Sign in / git authentication | No third-party API key required for normal git cloning |
| NOW | **ElevenLabs** — https://elevenlabs.io | Voice-to-text (Scribe Realtime) + humanlike voice replies (TTS) | `ELEVENLABS_API_KEY` | One provider for both STT and TTS; protect key server-side, mint short-lived client tokens for realtime STT |
| NOW | **One AI inference provider**: e.g., **Google AI Studio** — https://aistudio.google.com or **OpenRouter** — https://openrouter.ai | Raahi's actual trip-planning LLM and tool calling | Key stored in OpenTrip's `AI_API_KEY` | ChatGPT Plus / Codex login does not pay for your deployed application's AI calls. Choose only **one** initially and check model/tool compatibility |
| SOON | **Geoapify** — https://myprojects.geoapify.com/ | Geocoding, places, pharmacies/hospitals | `GEOAPIFY_API_KEY` with `GEO_PROVIDER=geoapify` | Optional for first baseline; verify quota, attribution, and terms. OpenTrip already has OSM-based geolocation |
| DEPLOY | **Render** — https://dashboard.render.com | Public web/API deployment, optional hosted PostgreSQL | Render login and dashboard config; no Render API token required for manual deploy | Use Render secret environment variables; free instances have limitations |
| OPTIONAL | **openrouteservice** — https://openrouteservice.org | Road/walking distance and route estimates | `OPENROUTESERVICE_API_KEY` (new adapter) | Existing OpenTrip OSM/OSRM backend can be used for first demo |
| OPTIONAL | **OpenWeatherMap** — https://openweathermap.org/api | Existing OpenTrip weather adapter | `OPENWEATHERMAP_API_KEY` | Alternatively write an Open-Meteo adapter; Open-Meteo's noncommercial endpoint needs no account/key |
| OPTIONAL | **Unsplash** — https://unsplash.com/developers | Trip cover photos | `UNSPLASH_ACCESS_KEY` | OpenTrip functions without it, using default art |
| OPTIONAL | **Google Cloud** — https://console.cloud.google.com | Sign in with Google, Google Maps/Places as alternative | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and/or `GOOGLE_MAPS_API_KEY` | Google OAuth is optional; Maps Places requests require billing setup |
| OPTIONAL | **Resend** — https://resend.com | Deliver real signup OTP / account emails in production | `RESEND_API_KEY` | For local testing OpenTrip uses `EMAIL_PROVIDER=console` |
| OPTIONAL | **Cloudflare Turnstile** — https://dash.cloudflare.com | Production anti-bot challenge | Production site/secret keys | OpenTrip includes local test keys; production keys should be site-specific |
| LATER | Approved train/bus/flight data vendors | Live schedules, fares, seats when permitted | Provider-specific | Do **not** promise live Indian Railways seats/bus inventory unless integration is authorized; public/booking-link fallback |
| LATER | **Wispr Flow** — https://platform.wisprflow.ai | Alternative speech-to-text | To be confirmed | API access/endpoint availability must be verified before creating dependency; ElevenLabs Scribe works as default |

## 2. What requires no account or API key for the initial local demo?

- **MongoDB** can run as a local replica set without an online account; Atlas is an optional hosted provider. Node requires `MONGO_URI`.
- **Better Auth** works with OpenTrip's account flow; generate strong local secrets. Google OAuth is optional.
- **OpenTrip default OSM geolocation** (`GEO_PROVIDER=osm`) works without a Google Maps key, but respect Nominatim/Overpass/OSRM public usage policies and rate limits.
- **Open-Meteo noncommercial weather** requires neither an account nor API key (an adapter is needed because OpenTrip currently references OpenWeatherMap).
- **Render and GitHub** need accounts for hosted deployment/repository access, but manual setup does not require developer API tokens.

## 3. Configure your cloned OpenTrip repository

Copy `.env.example` only if `.env` does not exist; otherwise edit the existing ignored `.env`. The Node API uses MongoDB. Legacy setup/reset commands target SQL. Some keys below are **new Raahi-specific variable names**; they do nothing until Codex implements their adapters.

```dotenv
# Node database: private replica-set/Atlas URI, only in ignored .env.
MONGO_URI=<your-development-mongodb-uri>
# Keep existing BASE_URL and storage/provider settings.
BETTER_AUTH_SECRET=<generated-local-secret-at-least-32-characters>
REALTIME_GRANT_SECRET=<different-generated-local-secret>

# Existing OpenTrip trip agent: required for AI to be enabled
AI_PROVIDER=openai
AI_MODEL=<supported-model-id-from-your-provider>
AI_BASE_URL=<your-openai-compatible-provider-base-url-or-empty-for-openai>
AI_API_KEY=<your-private-application-AI-provider-key>

# NEW Raahi voice modules — Codex adds config and API routes
ELEVENLABS_API_KEY=<private-key-entered-only-into-env>

# Optional new Raahi location and routing modules
GEOAPIFY_API_KEY=
OPENROUTESERVICE_API_KEY=

# Already recognized in the original OpenTrip env.example
GEO_PROVIDER=osm
OPENWEATHERMAP_API_KEY=
UNSPLASH_ACCESS_KEY=
GOOGLE_MAPS_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
```

**One possible Google AI Studio / Gemini configuration:** Google documents an OpenAI-compatible base endpoint `https://generativelanguage.googleapis.com/v1beta/openai/`. An integration test must confirm OpenTrip's Vercel AI SDK tool-calling and structured responses work with the chosen Gemini model. Don't assume every Gemini model or every OpenAI-compatible API feature works unchanged. A different approach is for Codex to add the provider's native Vercel AI SDK adapter.

**Important:** Placeholder values shown above are not usable credentials. Avoid committing `.env`; verify OpenTrip `.gitignore` before entering secrets.

## 4. Safely let Codex work with integrations

Tell Codex:

> Inspect the existing `.env.example` and references to process.env. Create an additional `.env.raahi.example` containing only variable names and obvious non-secret examples. Do not display, read back, log, copy, or commit real `.env` values. Implement provider adapters that validate missing credentials with friendly feature-specific errors. Continue to work without optional providers. For ElevenLabs, create a protected server endpoint that issues short-lived STT tokens for the browser; TTS uses server-side key only. Add automated tests using mocks. Request that I enter real secrets locally when a manual step is required.

Keep backend-side secrets out of `VITE_*` variables: Vite bundles those values into frontend code. For a public map key that *must* run in the browser, use documented referrer restrictions and the provider's client-key approach.

## 5. First milestone — minimum accounts

To get a **voice-first local demo** running, you need only:

1. GitHub (source control)
2. ElevenLabs (STT + TTS)
3. **One** AI inference provider (AI Studio or OpenRouter or separately billed OpenAI API)

No Render or Geoapify registration is needed until the baseline and initial voice/AI paths are tested. For deployment, add Render and production configuration afterward.

## 6. Important provider documentation

- OpenTrip `.env.example`: https://github.com/stvlynn/OpenTrip/blob/main/.env.example
- ElevenLabs developer quickstart: https://elevenlabs.io/docs/eleven-api/quickstart
- ElevenLabs client-side realtime STT: https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/client-side-streaming
- Gemini API keys: https://ai.google.dev/gemini-api/docs/api-key
- Gemini OpenAI compatibility: https://ai.google.dev/gemini-api/docs/openai/
- Geoapify pricing: https://www.geoapify.com/pricing/
- Render environment secrets: https://render.com/docs/configure-environment-variables
- Open-Meteo free data API: https://open-meteo.com/

## Implemented spoken proposal summaries (Phase 4)

Set `ELEVENLABS_VOICE_ID_EN` and `ELEVENLABS_VOICE_ID_HI` in the ignored root
`.env`; both are voice-library IDs, not API keys. A multilingual voice may be
used for both. Keep `ELEVENLABS_API_KEY` server-side and grant Text to Speech
access. Voices Read is useful to list available voices; it is not needed when
you already know a valid voice ID. Restart development processes after env edits.
The HTTP adapter requires no additional server SDK. See the summary endpoints
in `docs/backend/api/platform.md`. Browser listening/pronunciation verification
is separate from a successful provider response.

## Phase 7 daily travel forecast configuration

`TRAVEL_WEATHER_PROVIDER=open-meteo` enables the daily forecast shown in India
travel checks, for non-commercial use of its free API with CC BY 4.0 attribution.
No API key is required. Empty disables it. The committed example defaults off;
local testing may opt in through ignored `.env`. Restart dev after env edits.
Commercial deployment needs a licensed provider/account adapter, not the free
endpoint: https://open-meteo.com/en/terms.

This daily adapter does not replace the existing `OPENWEATHERMAP_API_KEY` hourly
weather feature. Existing OSM/Google geo configuration supplies road estimates and
nearby stay listings. Geoapify is implemented for places and road routing; openrouteservice remains
unimplemented. Select Geoapify with its API key or use the existing OSM/Google adapters.
Rail/bus entries are official search links, not authorized inventory integrations.

## Through-Phase-8 key requirements

- Required for voice planning: `AI_API_KEY`, `ELEVENLABS_API_KEY`, and configured
  English/Hindi voice IDs. Voice IDs are configuration, not additional API keys.
- No extra API key is needed for the database, deterministic expense/budget
  calculations, offline export, or emergency contact references.
- Optional existing alternative for nearby places and routing:
  `GOOGLE_MAPS_API_KEY` with `GEO_PROVIDER=google`. Enable **Places API (New)**
  and **Routes API** in the same billing-enabled Google Cloud project. Restrict
  the key to these APIs and use server-compatible application restrictions;
  browser-referrer restrictions do not suit this backend adapter. Keep it in
  ignored server environment configuration. Setup references:
  [Places](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
  and [Routes](https://developers.google.com/maps/documentation/routes/get-api-key).
  Public OSM needs no key but can return unavailable; a key does not guarantee
  medical coverage or operational facilities.
- `RESEND_API_KEY` and production CAPTCHA credentials are deployment setup,
  not prerequisites for local console-email authentication.
- `OPENWEATHERMAP_API_KEY` is optional for the existing hourly weather feature;
  the opted-in noncommercial Open-Meteo daily adapter needs no key.
- Geoapify now supports places, medical search and road routing. Openrouteservice
  and live rail/bus inventory still need separately selected integrations.


## Current Geoapify and Render setup (2026-11-15)

This section supersedes earlier placeholder and deployment notes. Geoapify is
implemented: set `GEO_PROVIDER=geoapify` and `GEOAPIFY_API_KEY` privately. Live
places, hospital listings, geocoding, detail, road routing and matrices passed.
No Google Maps or openrouteservice key is needed for this configuration.
Cloudflare/Turnstile and Docker integrations have been removed. Render's free
demo uses external S3-compatible storage plus MongoDB, Resend and the existing
AI/ElevenLabs keys; see [Render setup](../../deploy/render/README.md).
