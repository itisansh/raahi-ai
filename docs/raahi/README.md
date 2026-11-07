# Raahi AI development reference

Raahi AI extends the OpenTrip application in this repository. These documents
are implementation references for contributors; planned features are not
claims about the current product.

- [Implementation roadmap](../../RAAHI_PLAN.md) — phase order and acceptance gates.
- [Express + MongoDB migration module](EXPRESS_MONGODB_MIGRATION_PLAN.md) — requested Express/Mongoose stack and ordered migration gates; M0 feasibility complete.
- [M0 baseline and compatibility](M0_BASELINE_AND_COMPATIBILITY.md) — recovery archive, route/data manifest, disposable MongoDB tests and limitations.
- [I0 India product progress](I0_INDIA_PRODUCT_PROGRESS.md) — WeChat removal, Indian onboarding defaults and remaining visual/live acceptance.
- [M1 Express transport](M1_EXPRESS_TRANSPORT.md) — Node port, shared HTTP handlers, test modes and remaining acceptance.
- [M2 backend layout](M2_BACKEND_LAYOUT.md) — current folder map, import migration and verification scope.
- [M3 Mongo persistence](M3_MONGODB_PERSISTENCE.md) — Node wiring, collection mapping, transactions and verification scope.
- [M4 migration and fresh start](M4_DATA_MIGRATION.md) — optional offline tooling and the user decision to start with an empty Mongo database.
- [M5 Node platform parity](M5_NODE_PLATFORM.md) — current implementation and remaining realtime/staging work.
- [Build progress](../../BUILD_PROGRESS.md) — actual checks, results and blockers.
- [Local implementation gaps](IMPLEMENTATION_GAPS.md) — inspected source map and remaining work.
- [Agent rules](RAAHI_AGENT_RULES.md) — architecture, privacy and verification constraints.
- [Repository audit and voice plan](RAAHI_AI_REPOSITORY_AUDIT_AND_VOICE_PLAN.md) — research reference; local source findings take precedence.
- [Build specification v1.2](RAAHI_AI_BUILD_v1.2.md) — product scenarios; its older Next.js/Supabase architecture and phase order are superseded by the roadmap.
- [API accounts and keys](RAAHI_API_ACCOUNTS_AND_KEYS.md) — configuration names and account setup; never put credentials in these documents.

The optional India travel API companion document was not supplied. Verify
official provider documentation and terms when implementing each adapter.
