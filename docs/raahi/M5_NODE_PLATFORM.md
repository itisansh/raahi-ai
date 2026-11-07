# M5 Node platform parity

Status: **IN PROGRESS — local implementation verified; staging pending**, 2026-11-07.

Node supplies a bounded atomic single-process fixed-window limiter to auth and
provider services. Concurrent consumption cannot exceed the limit within one
event loop. Expired counters are removed; capacity exhaustion refuses new keys.
Express overwrites the private client-IP header. Optional `TRUST_PROXY_CIDRS`
uses Express's explicit proxy allowlist; default ignores forwarded IPs. The
actual hosting proxy chain still needs verification. Limits reset on restart;
multiple API instances are not supported yet.

`realtime/node-realtime.ts` implements authenticated WebSocket upgrades on the
existing trip realtime route, trusted-origin checks, membership checks, ordered
change publication, event-ID deduplication and multi-tab presence. Node
composition supplies the publisher to existing services, which publish after
persistence. Session and membership access is rechecked on join, publication,
client messages and periodically. Revoked access closes the socket. Payload,
connection, pending-message and outgoing-buffer limits bound client usage.
Shutdown closes sockets before draining deferred database work.

Reconnect always returns `resync_required`, causing authoritative refetch.
This deliberately replaces planned bounded replay: sequence numbers alone have
no server incarnation identifier and can match stale cursors after a restart.
No durable event history or multi-process coordination is claimed.

The native Render deployment serves the built frontend and API on one origin,
uses a persistent upload disk and requires no Docker. See
[setup and acceptance steps](../../deploy/render/README.md). The optional template
selects a paid service/disk; no service has been created. A Node/Mongo GitHub
Actions workflow runs checks using disposable databases. Existing Cloudflare
workflow retirement remains M6 scope.

Local coverage includes real WebSocket clients for ordered fan-out, presence,
deduplication, revocation, rejected upgrades, restart resync and shutdown;
HTTP streaming/cancellation and multipart regression tests; proxy allowlist and
SPA hosting tests. Realtime tests inject authorization; they do not constitute
an end-to-end hosted Mongo/auth/browser acceptance run. Existing Mongo tests
exercise real disposable replica sets and auth/persistence separately.

The supplied `.env` MongoDB URI passed a read-only connectivity and replica-set
capability check. No application data was written or migrated.

Remaining acceptance: create staging service, configure private provider/email
settings and verified proxy ranges, exercise two authenticated browsers editing
persisted trips, streaming and cancellation through the hosting proxy, upload
persistence across restart, and inspect telemetry/errors. M5 remains open until
these live checks pass.
