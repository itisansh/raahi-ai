# I0 India product cleanup

Status: **PARTIAL**, 2026-11-03. Source cleanup is implemented; visual assets and
live account/onboarding acceptance remain open. Do not start M1 until I0's gate
is resolved unless the user explicitly advances the migration. The user subsequently
requested M1; I0 gates remain open. M0's route/data manifest is the historical baseline.

## Implemented

- Removed the WeChat miniapp workspace, Taro build approval, Makefile targets,
  auth plugin/provider, web button/icon/copy, config fields and environment parsing.
  Removed its deployment secret plumbing. Refreshed the pnpm lockfile with pnpm;
  it no longer contains the miniapp importer or Taro dependencies.
- Retained Google/email authentication, OTP, 2FA, bearer sessions and the unrelated
  native OAuth exchange. Existing accounts and trip records were not modified.
- Added versioned `india-north-v1` onboarding data: six fixed illustrative dates,
  Lucknow → Rishikesh → Chopta → Haridwar → Lucknow, Indian coordinates and demo
  member names. Every stop explicitly labels estimates and local confirmation.
  The ledger starts empty; estimated costs are stops, not fictional payments.
  Internal fixture IDs stay stable to preserve domain regression coverage.
- New trips and auth preferences default to INR. Explicit historical currency
  values and currency support remain available. No Prisma schema was edited.
- Empty map opens over India; existing trips still fit their own stops. Removed
  Japan-specific coordinate-to-city guessing from schedule controls; they use
  stored day cities and stop areas instead. Updated destination placeholders.
- Versioned the public-image cache and scheduled deletion of the prior image
  cache during service-worker activation. Precache cleanup already removes old
  hashed assets. Updated active mobile, auth, operations and project docs.

## Evidence

Local source backup before I0: `.workspace/i0/source-before.tar.gz`, excluding
ignored files. M0's separately verified source baseline is also retained.

`pnpm install --lockfile-only --offline` failed because cached semver metadata
was missing. Approved online `pnpm install --lockfile-only --ignore-scripts`
passed. It reported a Better Call/Zod peer warning; the application typechecks
and test suites pass. No database credentials were read or changed.

API tests: 370 passed, including two new demo regression checks; four obsolete
WeChat tests were removed. Web tests: 88 passed. Tests tied to the old fixture
now expect the new names/currency and empty ledger. Whole-yen rounding tests
explicitly select JPY, retaining their exact conservation assertions.

Run logs are local under `.workspace/i0/`. No new browser, live account,
database, provider or deployment verification is claimed.

## Remaining acceptance work

- Replace and visually inspect inherited desktop/mobile landing captures and
  public documentation screenshots, photography, promotional assets and icons.
  Current landing captures still truthfully identify the legacy OpenTrip demo;
  they are not accepted as final India product imagery. Update the landing facts
  and captions together with the replacement captures, not ahead of the images.
- Inventory legacy WeChat-linked accounts using the later data migration input.
  Establish alternate verified sign-in/recovery before deploying retirement to
  any real accounts that depend solely on WeChat. No users are deleted by I0.
- Inventory persisted old demos before offering replacement/archive. Only
  proven untouched generated copies may be automatically replaced. Edited trips
  and historical ledgers must remain intact. The changed versioned template only
  affects future onboarding; no replacement/reset/seed command was run.
- Verify fresh signup, Indian schedule/map/budget, mobile layout, retained auth,
  cache upgrades and offline behavior in a browser after MongoDB wiring. The
  user will supply `MONGO_URI`; current app composition is still SQL until M3.
- Complete public asset/copy scans and classify remaining historical decision
  records, generic browser compatibility comments and required attribution.

I0 is not complete merely because compilation and automated tests pass.
