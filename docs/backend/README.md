---
title: "Backend (DDD + Hexagonal)"
---

# Backend (DDD + Hexagonal)

The backend (`apps/api`) uses Express 5 on Node and a retained Hono transport on Workers, following Domain-Driven
Design and Hexagonal architecture. Reference:
[../reference/backend-sources.md](../reference/backend-sources.md).

## Layers and dependency direction

```text
interfaces -> services -> domain
                 ^          ^
repositories / integrations / realtime
                 ^
               config
```

- **domain** (`src/domain`) owns aggregates, values, business rules and ports.
- **services** (`src/services`) orchestrates application workflows through ports.
- **repositories** (`src/repositories`) contains persistence adapters and fixtures;
  Mongo adapters serve Node; SQL adapters remain for the Worker and migration rehearsal.
- **integrations** (`src/integrations`) contains auth, AI, voice, geo, email,
  storage, telemetry and other external/platform adapters.
- **realtime** (`src/realtime`) contains the retained collaboration transport.
- **interfaces** (`src/interfaces/http`) parses HTTP input, calls services and
  formats output through shared Express/Worker route handlers.
- **config** (`src/config`) parses environment values (`env.ts`) and assembles
  dependencies (`container.ts`). Domain/services do not acquire HTTP or database
  implementation dependencies because their folders were renamed.

## Composition

- `src/config/container.ts` assembles shared services and legacy SQL adapters.
- `src/config/mongo-container.ts` selects Mongo adapters and initializes Node persistence.
- `src/models/mongo.ts` defines business schemas and indexes; Better Auth owns auth collections.
- `src/config/env.ts` validates environment configuration.
- `src/node-server.ts` runs the Express Node server for local/Docker.
- `src/worker.ts` retains the Hono Worker entry during the migration.

## Client developers (mobile and other apps)

Use **[api/README.md](api/README.md)** as the client-facing HTTP contract
(split into focused files under `api/`):

- [conventions](api/conventions.md) — envelopes, status codes, access rules
- [auth-session](api/auth-session.md) — cookies / session for non-browser clients
- [routes](api/routes.md) — full method/path/auth table
- Resource endpoints — [platform](api/platform.md), [trips](api/trips.md),
  [itinerary](api/itinerary.md), [expenses](api/expenses.md),
  [invites](api/invites.md), [user](api/user.md), [agent](api/agent-endpoints.md)
- [dtos](api/dtos.md) — response DTO field catalog
- [errors](api/errors.md) · [multi-client](api/multi-client.md)

Auth deep-dive: [auth.md](auth.md). Do not treat
`apps/web/src/shared/api/` as the contract source — it is a web convenience
wrapper only.

## Related

- [api/README.md](api/README.md) — **client HTTP contract and DTOs** (start here for apps).
- [domain.md](domain.md) — the model and business rules.
- [trip-ops.md](trip-ops.md) — trip-scoped mutation registry (shared HTTP + agent tools).
- [agent.md](agent.md) — trip agent session, tools, and approval.
- [weather.md](weather.md) — internal weather service, cache, and agent tool boundary.
- [cover.md](cover.md) — Unsplash trip cover search on create.
- [fx.md](fx.md) — internal FX rates service for settle-up display conversion.
- [geo.md](geo.md) — internal geo service (OSM/Google), cache, and agent read tools.
- [lodging.md](lodging.md) — Airbnb lodging search (openbnb-style), agent read tools.
- [street-view.md](street-view.md) — provider-neutral imagery search, previews, viewer, and agent tools.
- [realtime.md](realtime.md) — trip change fan-out, presence, and WebSocket protocol.
- [database.md](database.md) — schema, migrations, seed.
- [auth.md](auth.md) — Better Auth integration.
