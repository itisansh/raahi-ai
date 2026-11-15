# Render free demo — native Node

One free Render Web Service serves the Vite frontend and Express API on the
same HTTPS origin, including session cookies, streaming and WebSockets. MongoDB
must support replica-set transactions (for example, Atlas). No SQL server,
Docker, Worker or Cloudflare account is required.

## Required accounts and secrets

- Render connected to the GitHub repository containing this checkout.
- MongoDB replica-set URI (`MONGO_URI`); allow Render's documented outbound IPs
  in the database network rules.
- Geoapify (`GEOAPIFY_API_KEY`), the configured AI provider (`AI_MODEL`,
  `AI_BASE_URL`, `AI_API_KEY`), and ElevenLabs (API key and both voice IDs).
- S3-compatible external storage: bucket, region, endpoint, access key and secret.
  Use a private bucket with object read/write/delete permissions. The API proxies
  file reads; public bucket access and browser credentials are unnecessary.
- Resend API key and verified sender (`EMAIL_FROM`) for account verification and
  password reset. Console email is for local development, not a public demo.

These provider accounts have their own quotas and pricing; the free Render plan
only covers Render compute within its limits. Do not commit keys or upload the
local `.env`. The Blueprint prompts for private values in Render.

## Deploy

1. Push the reviewed changes to your GitHub repository.
2. In Render choose **New → Blueprint**, connect the repository, and select
   `deploy/render/render.yaml` as the Blueprint path. It selects `plan: free`,
   with no paid disk and automatic deployment turned off.
3. Supply the required variables. Set `BASE_URL` and `TRUSTED_ORIGINS` to the
   exact HTTPS service origin, with no trailing slash. `BASE_URL` is embedded
   during the frontend build, so changing the service URL requires a rebuild.
   The Blueprint generates a stable `BETTER_AUTH_SECRET`; do not rotate it on
   every deployment. `GEO_PROVIDER=geoapify` is already selected.
   Set `GEO_OSM_USER_AGENT` privately to `RaahiAI/0.1 (<service-origin>; geo-agent)`.
   The service name does not guarantee the hostname; copy the assigned URL from
   Render. The build rejects missing/non-HTTPS origins, localhost, paths and
   trailing slashes, and requires `TRUSTED_ORIGINS` to include `BASE_URL`.
4. Configure the external S3 bucket. Do not change storage to `fs`: uploaded
   files on a free service disappear on restart, redeploy or idle shutdown.
   `S3_FORCE_PATH_STYLE=true` is included; adjust only if your provider needs
   virtual-host addressing. Keep the API/storage credentials server-side.
5. Deploy manually and complete the checks below.

Build: `bash deploy/render/build.sh`.
Start: `corepack pnpm --filter @raahi/api start`.
Service root: repository root. Node: 24.
`WEB_DIST_PATH=../web/dist` resolves from the API workspace.

## Updating an existing service

Keep service-specific URLs and credentials in Render, not Git. For an existing
Blueprint service, set newly added `sync: false` variables in its Environment
page; Blueprint sync does not prompt for them again. Remove manually copied
local `PORT` and `WEB_PORT` entries and let Render supply its port. Confirm
`STORAGE_BACKEND=s3`, all five S3 connection values, and `EMAIL_PROVIDER=resend`
with `EMAIL_FROM` and `RESEND_API_KEY`. Console email can allow boot but does not
deliver account verification emails.

After changing `BASE_URL`, choose **Save, rebuild, and deploy**, or save and use
**Manual Deploy → Deploy latest commit** after pushing the repository changes.
**Save and deploy** reuses the existing frontend build; **Save only** does not
deploy. See [Render environment settings](https://render.com/docs/configure-environment-variables).

Weather has two separate integrations: `TRAVEL_WEATHER_PROVIDER=open-meteo`
enables travel evidence, while `/api/weather` and the trip assistant's
`checkWeather` use `OPENWEATHERMAP_API_KEY`. The latter return
`weather_not_configured` without that key; a successful health check does not
verify weather or email delivery. See [weather configuration](../../docs/backend/weather.md).

## Acceptance

Verify `/api/health`, registration/OTP/login/reset, browser voice permissions,
transcript → Send → model → spoken reply, medical listings and directions,
streaming chat, two-browser trip updates and reconnect/refetch. Upload a file,
restart the service, and confirm it remains readable. Inspect logs for errors.
Use a separate staging database; do not reset an existing user database.

Free services sleep after inactivity and may take about a minute to wake up.
There is no persistent disk or dashboard shell. Rate limits, presence and live
sequence counters are process-local; retain one instance. Reconnect refetches
current trip state. This is a demo, not a production availability guarantee.

`TRUST_PROXY_CIDRS` is optional and defaults to ignoring forwarded IP headers.
Only set verified proxy ranges; never trust arbitrary headers. Until verified,
clients behind the hosting proxy share an auth rate-limit bucket.

References: [Render free service limits](https://render.com/docs/free),
[Blueprint specification](https://render.com/docs/blueprint-spec).
