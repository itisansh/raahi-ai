# Raahi AI — Accounts, API Keys & Environment Setup

**For:** OpenTrip-based Raahi AI (React + Vite, Hono, PostgreSQL/Prisma, Better Auth)

**Security first:** Do not share API keys, database passwords, tokens or `.env` contents in ChatGPT, public Codex prompts, screenshots, issues or GitHub commits. Add secrets locally in the repository's ignored `.env` file; on deployment, use the provider's secret/environment variable dashboard. Codex should inspect variable **names**, never print their values. If a key leaks, revoke/rotate it.

## 1. Create accounts in this order

| Priority | Service/account | Purpose | What you need | Notes |
|---|---|---|---|---|
| NOW | **GitHub** — https://github.com | Fork/host Raahi code, pull requests | Sign in / git authentication | No third-party API key required for normal git cloning |
| NOW | **ElevenLabs** — https://elevenlabs.io | Voice-to-text (Scribe Realtime) + humanlike voice replies (TTS) | `ELEVENLABS_API_KEY` | One provider for both STT and TTS; protect key server-side, mint short-lived client tokens for realtime STT |
| NOW | **One AI inference provider**: e.g., **Google AI Studio** — https://aistudio.google.com or **OpenRouter** — https://openrouter.ai | Raahi's actual trip-planning LLM and tool calling | Key stored in OpenTrip's `AI_API_KEY` | ChatGPT Plus / Codex login does not pay for your deployed application's AI calls. Choose only **one** initially and check model/tool compatibility |
| SOON | **Geoapify** — https://myprojects.geoapify.com/ | Geocoding, places, pharmacies/hospitals | `GEOAPIFY_API_KEY` (new Raahi adapter) | Optional for first baseline; verify quota, attribution, and terms. OpenTrip already has OSM-based geolocation |
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

- **OpenTrip's local PostgreSQL** runs with Docker; no online database account is necessary initially.
- **Better Auth** works with OpenTrip's account flow; generate strong local secrets. Google OAuth is optional.
- **OpenTrip default OSM geolocation** (`GEO_PROVIDER=osm`) works without a Google Maps key, but respect Nominatim/Overpass/OSRM public usage policies and rate limits.
- **Open-Meteo noncommercial weather** requires neither an account nor API key (an adapter is needed because OpenTrip currently references OpenWeatherMap).
- **Render and GitHub** need accounts for hosted deployment/repository access, but manual setup does not require developer API tokens.

## 3. Configure your cloned OpenTrip repository

Use `make setup` to generate its project `.env`, then edit the existing `.env` rather than replacing it wholesale. Some keys below are **new Raahi-specific variable names**; they do nothing until Codex implements their adapters.

```dotenv
# EXISTING OpenTrip keys — keep existing BASE_URL, DATABASE_URL, etc.
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
