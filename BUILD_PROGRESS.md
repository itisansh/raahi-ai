# Raahi AI — Build Progress & Verification Log

> Living status document for Codex CLI. **Do not treat the unchecked boxes below as completed.** The planning files have been prepared, but the user's local OpenTrip checkout has **not** been inspected or built through this document-creation task.

- **Updated:** 2026-10-27
- **Project:** Raahi AI (OpenTrip-based)
- **Current phase:** Phase 0 — baseline and repository inspection
- **Active task:** Confirm both required `docs/` files exist, inspect actual OpenTrip code and `AGENTS.md`, run safe baseline checks, record results.
- **Implementation state:** NOT STARTED / UNVERIFIED
- **Local git SHA:** NOT RECORDED
- **Branch:** NOT RECORDED
- **Deployment URL:** NOT CONFIGURED
- **Live ElevenLabs key present:** UNKNOWN (do not record secret values)
- **Voice pipeline tested:** NO
- **Live transport provider tested:** NO

## 1. Specification availability (verify locally)

| Required file | Status | Notes |
|---|---|---|
| `AGENTS.md` | Draft prepared | Merge with live upstream OpenTrip `AGENTS.md` — do not blindly overwrite |
| `RAAHI_PLAN.md` | Draft prepared | Phase roadmap and acceptance criteria |
| `BUILD_PROGRESS.md` | Draft prepared | Replace states only with evidence |
| `docs/RAAHI_AI_BUILD_v1.2.md` | NOT VERIFIED | User will place it in `docs/` |
| `docs/RAAHI_AI_REPOSITORY_AUDIT_AND_VOICE_PLAN.md` | NOT VERIFIED | User will place it in `docs/` |
| `docs/RAAHI_AI_INDIA_TRAVEL_APIS.md` | OPTIONAL | Provider research; add if available |

**Before implementing Raahi-specific features:** If either of the two required `docs/` files is absent, stop after baseline-only analysis and request the file. The earlier build spec's Next.js/Supabase Auth guidance is superseded by the OpenTrip-based plan.

## 2. Phase tracker

| Phase | Goal | State | Evidence/gate |
|---|---|---|---|
| 0 | Inspect and run OpenTrip baseline | NOT STARTED | SHA, setup, tests, base features checked |
| 1 | Microphone UI + live STT + text fallback | NOT STARTED | Working final/editable transcript; negative tests |
| 2 | Voice/text → validated itinerary proposal | NOT STARTED | Budget, group constraints, sources and warnings displayed |
| 3 | Approve proposal → persisted shared itinerary | NOT STARTED | Refresh + second user + permissions + idempotency |
| 4 | ElevenLabs human-like spoken response | NOT STARTED | Audio playback, mute/stop, failure fallback |
| 5 | Voice expenses + exact share allocation | NOT STARTED | Five members / selected four, money unit tests |
| 6 | Budget-aware replanning | NOT STARTED | Actual vs committed vs forecast, approved revision |
| 7 | India transport and places provider adapters | NOT STARTED | Sourced status labels and verified fallback |
| 8 | Nearby medical + resilience | NOT STARTED | Consented search, real data labeling |
| 9 | Deploy + E2E demo | NOT STARTED | Real deployed journey and regression tests |

Allowed states: `NOT STARTED`, `IN PROGRESS`, `PARTIAL`, `BLOCKED`, `DONE`.

`DONE` is allowed only after the phase's acceptance gate has passed. `PARTIAL` requires explicit remaining work. Do not mark a live integration verified if only a mock was tested.

## 3. Baseline capture — to fill during Phase 0

```text
Date/time:
OS / shell:
Node version:
pnpm version:
Git remote:
Branch and git SHA:
Working tree state:
Original OpenTrip AGENTS.md present (yes/no):
Raahi docs both present (yes/no):
Configured development DB (type; no credentials):
Setup command(s) and exit status:
Focused test command(s) and exit status:
Global quality check (e.g. make check) and exit status:
Manual baseline checks:
  - authentication:
  - create/open trip:
  - schedule / map:
  - AI chat / suggestions:
  - expenses / balances:
Known baseline failures:

```

Do not run DB reset/reseed/destructive schema commands against an existing user database. If environment or credentials are missing, mark the specific test `NOT RUN` with a reason.

## 4. MVP acceptance checklist

### Voice-first planning

- [ ] Push-to-talk visible in trip discovery or existing trip AI interface.
- [ ] Microphone permission, stop, cancel, error and offline/text fallback work.
- [ ] ElevenLabs Scribe **final** transcript shown and editable before submit.
- [ ] Hindi/Hinglish/English request maps to validated travel intent.
- [ ] Ambiguous/missing dates, traveler count or total budget handled explicitly.
- [ ] Candidate itinerary includes real mapped stops and evidence/unknown labels.
- [ ] Per-person and total budget computed in integer paise.
- [ ] No unapproved action writes to database.
- [ ] Accepted trip persists after refresh and is visible to authorized group member.
- [ ] ElevenLabs TTS reads a short summary without blocking the trip UI.

### Group expenses and replanning

- [ ] Exact payer and participating member subset confirmed.
- [ ] Equal split + rounding/remainder tests pass.
- [ ] Idempotency prevents duplicate expenses on retry.
- [ ] Nonmember cannot access/edit another group's ledger.
- [ ] Actual paid, committed, estimated costs and budget buffer separated.
- [ ] Budget breach triggers a versioned proposal, not silent edits.
- [ ] Approved replan changes only permitted future activities.

### India readiness and travel safety

- [ ] Route and place adapters return a source and evidence status.
- [ ] Train/bus inventory is never claimed without authorized live data.
- [ ] Synthetic demo prices/schedules explicitly labeled.
- [ ] Medical search uses permitted location and displays uncertainty/contacts.
- [ ] Secrets are server-side and private details are excluded from logs.

### Release

- [ ] Relevant unit/integration tests pass.
- [ ] Repository's typecheck, lint and build pass (record actual commands).
- [ ] At least one deployed E2E run performed with two test accounts.
- [ ] Hackathon demonstration rehearsed, including provider failure scenario.

## 5. Work session log

Add one entry **after every Codex session**. Never fabricate checks or counts.

### Session template — copy for the next session

```markdown
### YYYY-MM-DD HH:MM — Phase N — Short goal
- **State:** NOT STARTED / IN PROGRESS / PARTIAL / BLOCKED / DONE
- **Git:** branch / before SHA / after SHA
- **Files changed:**
  - `path`: reason
- **Existing OpenTrip modules reused:**
  - ...
- **Tests and evidence:**
  - `exact command` → PASS / FAIL / NOT RUN; relevant output or link
  - Manual UI scenario → PASS / FAIL / NOT RUN; screenshot/video optional
  - Live integration or mocked fixture? specify
- **Safety/authorization checks:**
  - ...
- **Issues or blockers:**
  - ...
- **Decisions and rationale:**
  - ...
- **Remaining work for phase:**
  - ...
- **Next smallest action:**
  - ...
```

No implementation sessions are recorded yet.

## 6. Decision register

| ID | Decision | Basis | Status |
|---|---|---|---|
| ADR-001 | Extend OpenTrip instead of rebuilding Next.js/Supabase Auth stack | Architectural compatibility, preserve features | PROPOSED — validate local checkout |
| ADR-002 | Voice-first via Scribe Realtime → existing AI tools → ElevenLabs TTS | Use one AI orchestrator, avoids redundant conversational agent | PROPOSED — SDK/auth smoke test needed |
| ADR-003 | Human approval before itinerary / expense writes | Accuracy, security, group trust | REQUIRED |
| ADR-004 | Budget engine uses deterministic paise arithmetic | Testability and rounding integrity | REQUIRED |
| ADR-005 | Indian transport sources return evidence labels, never fake live availability | Data gaps and provider terms | REQUIRED |
| ADR-006 | Wispr STT is optional behind verified documented adapter | API availability not confirmed | DEFERRED |

## 7. Blockers / risks

| Issue | Severity | Current mitigation | Owner / next action |
|---|---|---|---|
| Local OpenTrip version not yet inspected | HIGH | Phase 0 inspection before code | Codex: capture SHA and run baseline |
| New Raahi `AGENTS.md` might overwrite upstream rules | HIGH | Merge carefully with existing `AGENTS.md` | Developer review |
| Required docs may be missing from local `docs/` | HIGH | Verify before implementing features | User places two files |
| ElevenLabs quotas/auth/SDK versions may differ | MEDIUM | Check current docs and server-scoped tokens | Phase 1 |
| Indian rail/bus inventory has incomplete public API coverage | HIGH | Authorized adapters + official handoff + evidence labels | Phase 7 |
| OpenTrip base and cloned code may diverge | MEDIUM | Read actual docs and tests rather than assumptions | Phase 0 |

## 8. End-of-phase handoff (Codex must populate)

```text
Phase:
Gate passed? YES/NO
What works now (verified):
What remains:
Files changed:
Checks run, results and environment:
Known limitations:
Credential names needed (NEVER secret values):
UI demo steps:
Recommended next phase/task:
```

**Rule:** Update the tracker at the end of each session and before context compaction. The next Codex session must be able to resume without relying on hidden chat history.
