# AMQA phase reviews

## Phase 0 — Foundation ✅

**Shipped:** CodeRabbit parser + tests, JSON schemas, spec-map, qa-playbook, BASELINE.md, README.

**Drift check:** Parser only; no duplicate LLM risk scoring. Tests cover High/Medium/Low fixtures from real PRs.

**Bloat removed:** No extra markdown plans on PR; schemas minimal.

**Misses fixed:** Comma-split for QA Recommendation scenarios.

---

## Phase 1 — Shift-left at PR ✅

**Shipped:** `agentic-qa-pr.yml` — skip path (`QA/skipped`), automation job, artifact upload.

**Drift check:** Aligns with noise budget — Low + no manual QA → skip all three statuses success, no comment.

**Bloat removed:** Playwright full run gated behind `AMQA_RUN_SCOPED_PLAYWRIGHT` (default off).

**Misses:** Full Playwright in CI deferred (var opt-in) — spec list still recorded in qa-result.

---

## Phase 2 — Agent execution ✅

**Shipped:** `agentic-qa-execute.yml`, `/qa-verify` trigger, cursor.md AMQA section, Claude advisory step.

**Drift check:** 🔴 High auto-queues execute; Cloud Agent steps documented in playbook.

**Bloat removed:** Claude step produces verification doc only — no code changes.

**Misses:** Full `computerUse` browser run requires Cloud Agent on PR branch (documented, not GHA).

---

## Phase 3 — Release confidence ✅

**Shipped:** `agentic-qa-merge.yml`, `agentic-qa-release.yml`, `amqa_release.py`, confidence score.

**Drift check:** Rollup from merge artifacts; parallel to E2E (no wait).

**Bloat removed:** Report only lists gap-fill for unverified 🔴.

---

## Phase 4 — Optimize ✅

**Shipped:** `agentic-qa-override.yml`, AGENTS.md rules, repo vars docs, phase reviews.

**Drift check:** Advisory-only gates; override mirrors test-analysis pattern.

**Follow-ups (out of scope):** Enable `AMQA_RUN_SCOPED_PLAYWRIGHT`, wire release workflow to platform delivery, KPI dashboard.
