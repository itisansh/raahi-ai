# M2 backend layout

Status: **DONE**, 2026-11-03. The full workspace check passed: 376 API tests,
88 web tests, typecheck, lint, UI checks and all builds. Documentation and
whitespace checks also passed after the documentation updates.

The backend folders now use the requested service/repository/integration naming.
This module moves code and updates paths; database and product behavior stay the
same. MongoDB/Mongoose connection and persistence implementation belong to M3.

## Folder map

| Previous location under `apps/api/src` | Current location | Responsibility |
| --- | --- | --- |
| `application/` | `services/` | Workflow orchestration, DTOs, application ports |
| `infrastructure/persistence/` | `repositories/` | Persistence adapters and seed fixtures; SQL retained for now |
| `infrastructure/composition/` | `config/` | Dependency assembly (`container.ts`) |
| `infrastructure/config.ts` | `config/env.ts` | Environment parsing and types |
| `infrastructure/realtime/` | `realtime/` | Collaboration transport and retained Worker objects |
| Other `infrastructure/` subdirectories | `integrations/` | Auth, AI, speech, geo, weather, storage, email, telemetry and platform adapters |
| `domain/` | `domain/` | Pure business rules and domain ports |
| `interfaces/http/` | `interfaces/http/` | Shared HTTP handlers, Express and retained Worker transport |

The dependency rule is unchanged: HTTP handlers call services; services depend
on domain rules and ports. Repositories/integrations implement inward-facing
ports. Config assembles them. The folder name `services` describes the former
application layer; it does not move business rules into Express controllers.
No empty future Mongo `models` or `db` directory is added before M3 needs it.

## Verification scope

- 149 files moved, with 114 files requiring module/source-inspection path edits.
  Node/Worker entries, tests, Prisma tools and verification scripts use the new
  paths. No compatibility re-export files preserve obsolete source paths.
- The local syntax comparison verifies rewritten files retain all non-path
  tokens and string literals. It caught two period delimiters in the initial
  rewrite, which were restored before final checks.
- All 721 relative imports in source, tests, Prisma and verification scripts
  resolve. Source scans find no imports of the retired application/infrastructure
  paths. Domain files and `schema.prisma` match the pre-M2 archive byte-for-byte.
- The Worker suite passes 370 tests; the six Node bridge tests are intentionally
  skipped in that mode. Express and full workspace results are recorded in
  BUILD_PROGRESS section 36.
- No database connection, seed, reset, migration, provider request or deployment
  was run. Existing I0/M1 and product live/browser acceptance gaps remain open.

Local recovery archive and verification logs: `.workspace/m2/`. The initial
rewrite command hit a sandbox subprocess EPERM before any move; the approved
retry performed the move. Existing user changes were captured in the archive.

Active backend/API/setup documentation now uses these paths. Historical audit
reports, decision records, prior build-log entries and the M0 manifest retain
their inspected paths as evidence; use this map when following them today.

The user requested M2 while earlier live acceptance remained partial. This
module's completion does not change the status of those earlier gates.
