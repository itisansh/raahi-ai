# Render staging (native Node, no Docker)

Run one Render Web Service serving both the Vite frontend and Express API.
This keeps cookies, HTTP streaming and WebSockets on one origin. MongoDB must
support replica-set transactions (Atlas does). The database starts fresh; no
SQL migration or PostgreSQL server is needed.

## Setup

1. Push the reviewed project to your GitHub repository. Check existing
   Cloudflare workflow triggers before pushing; retiring them is M6 work.
2. Create a Render Blueprint from `deploy/render/render.yaml` (select this
   Blueprint path). Review charges: the template selects a paid Starter service
   with a 1 GB persistent disk. Nothing is deployed by adding these files.
3. Supply `MONGO_URI` privately in Render, and allow the service's documented
   outbound IPs in Atlas Network Access. Local `.env` is not uploaded.
4. Set `BASE_URL` and `TRUSTED_ORIGINS` to the exact HTTPS service origin, without
   a trailing slash. Use that same value during the frontend build. If the final
   service URL changes, update both values and rebuild.
5. Configure `RESEND_API_KEY` and `EMAIL_FROM` using a verified sender for account
   verification/reset emails. Keep the generated `BETTER_AUTH_SECRET` stable.
6. Copy enabled AI/voice/provider settings from your private environment into
   Render. See `.env.example` and `docs/raahi/RAAHI_API_ACCOUNTS_AND_KEYS.md` for
   supported names. Do not commit credentials.
7. Deploy manually. Verify `/api/health`, registration/login, streaming chat,
   two-browser trip edits, reconnect/refetch, upload/read and upload persistence
   after a restart. Check database documents and service logs for errors.

Build: `bash deploy/render/build.sh`. Start:
`corepack pnpm --filter @opentrip/api start`. Repository root is the service root.
Node 24 is selected. `WEB_DIST_PATH=../web/dist` resolves from the API workspace.
Uploads use `/var/data/uploads` on the persistent disk; the temporary filesystem
is unsuitable for uploaded files. S3 is an alternative supported by existing
storage configuration.

## Limits and acceptance

Keep exactly one process/instance. Rate limits, presence and sequence counters
are in memory. Restart/reconnect requests authoritative refetch; event history
is not durable. Multiple instances require shared coordination first.

`TRUST_PROXY_CIDRS` accepts comma-separated trusted proxy IP ranges. Default is
empty: forwarded addresses are ignored, so users behind a proxy share its auth
rate-limit bucket. Verify the hosting proxy chain and ranges before setting
this; never trust arbitrary forwarded headers or use an unrestricted range.
Proxy identity remains a staging acceptance item.

The supplied CI workflow runs checks with disposable Mongo replica sets; it
does not access your Atlas database or deploy. Live staging acceptance is still
pending until a service exists. No Docker is required.
