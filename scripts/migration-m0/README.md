# M0 compatibility spike

This isolated development package does not change the application dependencies,
runtime, database configuration, or Prisma schema. Run commands from the repository
root. It uses npm with its own lockfile because it is deliberately outside the
pnpm application workspace; do not add it to application runtime dependencies.

```bash
MONGOMS_DISABLE_POSTINSTALL=1 npm ci --prefix scripts/migration-m0 --ignore-scripts
MONGOMS_DOWNLOAD_DIR=/tmp/raahi-m0-mongodb node scripts/migration-m0/compatibility.mjs
node scripts/migration-m0/manifest.mjs
```

The first compatibility run downloads MongoDB 8.2.1. It launches a temporary,
loopback-only replica set, creates synthetic fixtures, and stops the server in
`finally`. It does not load `.env`, accept an external Mongo URI, send emails,
or read/migrate existing user data. Its binary cache lives under `/tmp` in the
command above. The test requires network access for installation/download and
permission to bind local ports.

The compatibility probe pins Better Auth 1.6.23 to match the application, Mongoose
9.11.4 and mongodb-memory-server 11.3.0. It checks string IDs, imported synthetic
password hashes/session tokens, OTP, cookies, bearer authentication, revocation,
auth and business transaction rollback, revision conflicts, uniqueness and minor
unit money. This is a feasibility test, not a replacement for M3 repository tests
or M4 migration rehearsal with a consistent copy of real SQL data. Google OAuth,
TOTP enrollment/recovery, application provisioning/profile hooks, every plugin
flow and deployed cookie continuity still need their later migration gates.

`manifest.mjs` uses the repository TypeScript parser to inventory route registrations
and records the committed Prisma snapshot plus migration statements. Run it from
the root after installing the normal workspace dependencies. Generated output is
`docs/raahi/M0_ROUTE_DATA_MANIFEST.json`. It records auth as a delegated wildcard;
it does not pretend to enumerate every plugin endpoint or inspect a live catalog.
