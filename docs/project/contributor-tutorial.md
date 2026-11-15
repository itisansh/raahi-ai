---
title: "Developer tutorial"
description: Set up Raahi AI, run it locally, and land a small documentation-safe change.
---

# Developer tutorial

This lesson gets an authorized developer from an empty machine to a running local
stack and a first change that respects Raahi AI’s documentation rules.

## Outcome

By the end you will:

1. run web + API against a development MongoDB replica set;
2. know where user vs developer docs live;
3. update docs in the same change set when behavior changes.

## 1. Prerequisites

- Node.js and `pnpm` as required by the repo
- A development MongoDB replica set or Atlas database
- Git

## 2. Set up the monorepo

Obtain access to the private repository, then clone its URL into `raahi-ai`.
From that directory:

```bash
pnpm install --frozen-lockfile
```

If `.env` does not exist, copy `.env.example` to `.env`. Configure `MONGO_URI`,
auth secrets and `BASE_URL` privately; see [the project README](../../README.md).
No SQL reset or migration is required for the Node application.

## 3. Run the product locally

```bash
make dev
```

- Web: http://localhost:5170
- API: http://localhost:8780

Sign in with a seeded or newly registered account and open a trip.

## 4. Preview documentation

```bash
make dev-docs
```

Open http://localhost:5171 — choose **User guide** or **Developer docs**.

## 5. Make a small change safely

1. Prefer the layer that owns the behavior (`apps/web` FSD slice or
   `apps/api` use case + port).
2. If you change product behavior, architecture, configuration, or HTTP
   contracts, update the matching page under `docs/` in the **same** change
   set.
3. Keep user workflows in `docs/user/`; keep implementation detail in developer
   sections.
4. Never commit secrets or environment-specific production endpoints.

## 6. Verify before you open a PR

```bash
pnpm docs:check
pnpm --filter @raahi/docs typecheck
make check
```

## Next reading

- [../CONTRIBUTING.md](../CONTRIBUTING.md) — documentation audience rules
- [../operations/README.md](../operations/README.md) — day-to-day commands
- [../backend/trip-ops.md](../backend/trip-ops.md) — add a trip mutation once
- [architecture.md](architecture.md) — system topology
