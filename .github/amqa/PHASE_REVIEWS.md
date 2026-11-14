# AMQA Phase Reviews

## Phase 0 — Foundation ✅

**Shipped:** `qa-plan.v1.schema.json`, `cis_config.yml`, expanded `spec-map.yml`, full `qa-playbook.md`, `PILOT.md`, `BASELINE.md`, parser tests.

**Drift check:** CIS fallback when CodeRabbit absent; schemas in-repo (toolkit migration optional later).

## Phase 1 — PR QA Plan ✅

**Shipped:** `pr-manual-qa-plan.yml`, `QA/plan` status, `<!-- agentic-qa-plan -->` comment, CodeRabbit + TPA integration, webhook on CIS ≥ 70, dry-run var.

**Drift check:** Low + no manual QA → no plan comment (status only).

## Phase 2 — Targeted automation ✅

**Shipped:** Spec mapper with tags + smoke, spec file validation, optional Playwright run (`AMQA_RUN_SCOPED_PLAYWRIGHT`), `QA/automation` status, automation blocks execute on failure.

## Phase 3 — Agent execution ✅

**Shipped:** `pr-manual-qa-execute.yml`, `/qa-verify`, `QA/Run`/`QA/Skip` labels, CIS ≥ 70 auto-dispatch, Cloud Agent queue step (GHA orchestration only — `computerUse` runs outside CI), defect filing script, `QA/execution` status, playbook + cursor.md.

## Phase 4 — Release orchestrator ✅

**Shipped:** `release-manual-qa.yml`, parallel hook in `e2e-tests-on-release.yml`, merge artifacts, confidence score + go/no-go report, migration detection, Sev-1 specs.

## Phase 5 — Governance ✅

**Shipped:** `pr-manual-qa-override.yml`, `agentic-qa-verified-label.yml`, `GOVERNANCE.md`, `amqa_metrics.py`, advisory-only pilot policy.

**Follow-ups:** `AMQA_SOFT_GATE`, Zephyr cycle ID, full Playwright in CI when infra ready.
