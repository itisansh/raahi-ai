# M1 Express transport

Implemented 2026-11-03. **PARTIAL acceptance:** Node now uses Express 5; automated
HTTP contracts and bridge tests pass. Live browser/auth/provider acceptance and
full endpoint fixture coverage remain open. No deployment or database cutover.

The user explicitly requested the next module while I0 visual/account gates
remain partial. This authorizes M1 without implying those I0 gates passed.

## Implementation

- `apps/api/src/node-server.ts` listens with Express, isolates Sentry request
  scope, stops admissions on SIGINT/SIGTERM, waits for active HTTP work, drains
  tracked deferred writes and disposes database pools. After 30 seconds active
  connections are closed; telemetry is drained before shutdown completes.
- `interfaces/http/app.ts` registers shared handlers, validation and permissions
  in a route table. `transport.ts` defines the HTTP context, middleware and
  registration contracts. Domain/application services remain unchanged.
- `express-app.ts` uses actual Express routing, with case-sensitive and strict
  paths and Express 5 named wildcards. It converts raw incoming requests to Web
  requests; no JSON/body parser consumes auth requests first. Existing Better
  Auth `auth.handler(Request)` runs through the same bridge as other handlers.
  This deliberately uses the existing Web handler rather than `toNodeHandler`;
  raw payload, cookie and response behavior is tested at the Node boundary.
- Web responses flow through Node's pipeline with backpressure and separate
  Set-Cookie headers. Disconnects abort the request signal and cancel upstream
  streams. Multipart bytes and route-specific limits are preserved. CORS,
  request IDs, private cache defaults, error envelopes and permission guards
  remain shared across transports.
- The Worker wrapper still uses Hono routing/instrumentation and the same
  handlers. This is temporary transport coexistence for migration, not duplicate
  business implementations. Worker realtime/cache/rate-limit replacement remains
  M5; Hono/runtime dependency retirement remains M6.
- Express is the default HTTP test transport. `test:worker` explicitly tests
  the retained Worker handler; `test:express` explicitly selects Express. The
  harness runs identical HTTP assertions over real ephemeral loopback listeners
  with mocked application dependencies and cleans up connections after each test.

## Verification

- Express passed the 370 existing API tests. Five additional bridge regressions
  passed in the full workspace run (375 tests); a final focused six-test run
  also covers strict paths/case sensitivity.
- Worker mode passed 370 API tests; Node-only bridge tests are intentionally
  skipped in Worker mode. No HTTP assertion was weakened to force parity.
- Bridge regressions exercise raw auth requests, multiple cookies, request
  metadata/private caching, preflight before auth, incremental streaming,
  disconnect cancellation, oversized chunked bodies and multipart file bytes.
- Typecheck and full API lint passed. Full workspace check results are recorded
  in BUILD_PROGRESS section 35. Logs live under `.workspace/m1/`.
- Initial install failed on sandbox DNS; approved installation succeeded.
  Loopback test execution initially failed with EPERM; approved runs passed.
  Initial TypeScript/lint adapter issues were corrected and checks rerun.

## Remaining gates and limits

Tests use mocked application services. They do not establish live OTP delivery,
OAuth/2FA, production cookies, browser upload behavior, AI/audio-provider behavior,
or the full two-account browser journey. Shared handler registration prevents
route-list drift but is not proof of fixture parity for every route and failure.
The shutdown code has static/compile verification; a process-level drain test
and deployment restart exercise remain required before release.

The application composition is still SQL until M3. The user will provide
`MONGO_URI`; no PostgreSQL startup, migration, reset or seed was requested/run.
No public API DTO, database schema or finance rule changed in M1. Familiar-folder
moves belong to M2; Mongo repositories/auth wiring to M3. Retain all earlier
phase/I0 live acceptance gaps alongside the migration work.

## References checked

- [Express 5 migration](https://expressjs.com/en/guide/migrating-5/), including named wildcards.
- [Better Auth Express integration](https://better-auth.com/docs/integrations/express),
  including mounting auth before body parsing; compared with the pinned local Node helper.
