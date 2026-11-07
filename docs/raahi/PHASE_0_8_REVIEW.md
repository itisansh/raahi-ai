# Implementation review through Phase 8

Reviewed 2026-11-02 against the working tree, not only committed files.
References: `AGENTS.md`, `RAAHI_PLAN.md`, `BUILD_PROGRESS.md`, the repository
audit/voice plan, agent rules, account/key guide and BUILD v1.2 module table.

**Verdict: substantial implementation exists, but Phases 0–8 are not fully
accepted.** Passing unit tests does not prove the full spoken, shared-trip
workflow. The findings below distinguish missing functionality from verification
gaps. No application code or user data was changed in this review.

**Fix follow-up (2026-11-02):** Findings 1 and 2 below are repaired and verified.
Snapshot saves and day reorder/delete now require an expected revision under a
transaction lock, addressing finding 3 for those paths. Retained stops are
upserted without deleting their rows; only removed stops are deleted. The local
PostgreSQL regression script verifies booking links across edits/votes/comments/
reordering, one winning concurrent save and rejection after a newer expense.
Today's remaining costs are included, while today's stops remain ineligible for
automatic budget removals. API lint now passes. The findings below preserve the
original audit evidence; missing modules and browser gates remain open. This is
not a claim of client-supplied revision checks on every API command.

## Correctness findings, in priority order

1. **High: ordinary itinerary writes can unlink reservations.**
   `SqlTripRepository.save` deletes every trip stop before reinserting them
   (`apps/api/src/infrastructure/persistence/trip-repository.db.ts:599`).
   `TripService.updateStop`, insert, move, vote and comment call this path.
   The reservations migration defines `reservations.stop_id` with
   `ON DELETE SET NULL`. Reusing the stop ID on insertion does not restore the
   reservation link. This undermines later budget protection of booked stops.
   Expense writes and budget approval have dedicated paths that avoid this,
   but those protections do not cover ordinary itinerary writes. Verified by
   source and FK inspection; a new database reproduction was not run here.

2. **High: unpaid activities today disappear from the forecast.**
   `budgetSnapshot` includes only days whose date is strictly greater than
   today's India date. A remaining activity today is neither forecast nor
   reported as an unknown. A direct in-memory execution with a ₹100 cap,
   no expenses, and a ₹200 activity today returned estimated cost ₹0,
   remaining budget ₹100, and no issues. Protecting today's activities from
   automatic removal must not remove their unpaid costs from accounting.
   Source: `apps/api/src/application/budget/budget-service.ts`.

3. **High: revision safety is not universal.**
   New-trip approvals and budget approvals have specific idempotency/locking
   protection, and expense mutations have a transaction lock. Ordinary
   `TripService` stop mutations still load an aggregate and call `save` without
   an expected-revision check. The broad “two members edit simultaneously”
   acceptance requirement is therefore not established for all edit paths.
   Source inspection finding; concurrent ordinary edits were not rerun here.

## Roadmap acceptance matrix

| Phase | Implemented evidence | Missing or unverified |
| --- | --- | --- |
| 0 / 0B | Existing architecture preserved; auth works per earlier user confirmation; Raahi copy and attribution present | Full browser baseline and cohesive Indian demo replacement incomplete. English landing still shows Tokyo → Kyoto → Osaka as a labeled legacy preview; trip placeholders still name overseas cities. |
| 1 | Scoped Scribe token, microphone lifecycle, editable transcript, typed fallback, mock tests | Actual Hindi/Hinglish/English microphone run and mobile allow/deny acceptance pending. |
| 2 | Validated intent/candidates, deterministic budget totals, place matching, road feasibility and warnings | Full live hero request with all required geo evidence and an approvable preview not established. Preview structure is activity stops plus aggregate cost ranges, not structured lodging and multimodal legs. |
| 3 | Atomic new-trip approval, stored proposal/history, retry protection; earlier PostgreSQL second-member reload evidence | Existing-trip whole-proposal approval explicitly rejects `contextTripId`; ordinary mutation safety findings above; two-account browser invite/map/schedule run pending. Node does not supply the Cloudflare realtime publisher. |
| 4 | Grounded English/Hindi summary, server TTS, explicit playback and text fallback; earlier live audio responses | Human listening, pronunciation and browser playback pending. Summary requires an unexpired proposal; saved-trip/replan narration and progressive streaming are absent. |
| 5 | Deterministic INR shares, custom splits, exact participants, voice draft confirmation, retry deduplication | External repayment recording and resulting balance adjustment absent; full expense deletion/audit requirements absent. Browser speech → confirmation → reload pending. |
| 6 | Group forecast, commitments/expense deduplication, approved future optional-stop removal, revision/audit history | Today's-cost defect; no individual caps and allocated-consumption budget checks. `remainingPerPersonPaise` is a group average. No general substitution/reordering or rollback workflow. Browser approval/rejection pending. |
| 7 | Road estimates, daily forecast, official rail/bus search links, source/unknown states | Previous live nearby stay lookup failed at provider. Browser route review pending. No live inventory is implemented or claimed; Geoapify/ORS/GTFS are optional, not mandatory omissions. |
| 8 | Stop/GPS medical lookup, explicit location action, sourced contacts, directions links, no-data handling, offline HTML export | Browser GPS allow/deny, mobile usability and offline/reconnect tests pending. Previous live medical provider returned unavailable. No medical markers on the in-app map; results link to external directions. Offline support is an explicit downloaded snapshot plus already-open memory, not persistent authenticated offline app data. |

Phase numbering follows `RAAHI_PLAN.md`, not the older v1.2 phase sequence.
Supabase, a replacement Next.js product, Wispr and ElevenAgents are not required
replacements for the existing stack or chosen Scribe → AI → TTS pipeline.
An honest provider-unavailable result is valid failure handling; it does not
prove successful live listing retrieval.

## Cross-module requirements from BUILD v1.2

- **Auth / trip-core / group / polls:** existing implementation reused. Member
  preferences, group approval policy and complete snapshot/rollback history
  are not established by the current proposal audit records. A declared party
  size is not equivalent to that many authenticated members joining the trip.
- **Itinerary / agent context:** persisted intake and proposal evidence exist;
  the planning context contract carries trip/revision/title/intake/days, not
  the complete specified per-member budgets, commitments and unresolved
  decisions packet. Separate services do not yet provide every requested
  voice action through one assistant workflow.
- **Expenses / settlements:** INR arithmetic uses integer paise internally;
  persistence deliberately retains exact `Decimal(12,2)` rupee amounts and
  JSON custom allocations for compatibility. This is a documented adaptation,
  not the literal integer-paise storage schema in v1.2. Suggested transfers
  exist; recording an external payment does not.
- **Budget / replanner:** group-level reductions are narrower than per-member
  affordability, alternative activity proposals and itinerary rollback.
- **Places / transport / medical:** adapters expose uncertainty and use existing
  providers. Official booking links are not timetable, seat or fare APIs.
  Airport/flight discovery is not covered by the new India travel panel.
- **Trip export:** offline itinerary exists; the new export deliberately omits
  expenses and members, so it does not satisfy an expense-summary export.

## Checks rerun in this review

| Check | Result |
| --- | --- |
| API Vitest | PASS: 370 tests, zero failed or pending |
| Web Vitest | PASS: 88 tests, zero failed or pending |
| API and web TypeScript | PASS |
| Web production build | PASS |
| Full API lint | FAIL: one `consistent-type-imports` warning at `apps/api/test/voice-expense.test.ts:55`; zero warnings allowed |
| Full web lint | PASS |
| Documentation and UI checks | PASS |
| `git diff --check` | PASS before review documents added; rerun after edits |
| Today's unpaid-cost diagnostic | Reproduced the incorrect result described above |

Logs and JSON reports are local under `.workspace/audit-through-8/`.
Commands: filtered pnpm test/typecheck/lint/build; app-local eslint; root Vitest
binary from each app with JSON reporter; `node scripts/docs-check.mjs`,
`node scripts/ui-check.mjs`, and `git diff --check`.
No new live-provider requests, database acceptance runs, browser recording or
deployment occurred in this review. Earlier live results remain historical
evidence in `BUILD_PROGRESS.md`, not fresh verification.

## Recommended completion order

1. Repair reservation-link preservation and ordinary mutation concurrency;
   add database regressions covering a booked stop and simultaneous edits.
2. Include today's remaining costs in accounting; add per-member budgets and
   allocation-based headroom, with tests for unequal participants/caps.
3. Complete repayment records and the required financial edit/audit lifecycle.
4. Complete existing-trip proposal application and clarify the remaining
   revision/rollback, lodging/transport and assistant-action scope.
5. Finish Indian demo branding; run two-account and mobile browser acceptance
   for voice, approval, playback, expenses, replanning, medical and offline.
6. Mark each gate complete only after recording its evidence; then proceed
   with the deployment/release phase.
