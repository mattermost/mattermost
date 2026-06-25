# Agentic QA (AMQA)

Burden-reduction QA program: CodeRabbit signals → structured QA plan → scoped automation → agent execution → release confidence rollup.

## Workflows (plan names)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| [pr-manual-qa-plan.yml](../workflows/pr-manual-qa-plan.yml) | PR, CodeRabbit comment, `/qa-verify`, `QA/Run`/`QA/Skip` labels | Plan + automation + dispatch |
| [pr-manual-qa-execute.yml](../workflows/pr-manual-qa-execute.yml) | Called from plan workflow | Agent verification |
| [pr-manual-qa-override.yml](../workflows/pr-manual-qa-override.yml) | `/qa-override` | Maintainer waiver |
| [release-manual-qa.yml](../workflows/release-manual-qa.yml) | Release cut / manual | Release Confidence Report |
| [agentic-qa-merge.yml](../workflows/agentic-qa-merge.yml) | PR merged | Store qa-result for rollup |
| [agentic-qa-verified-label.yml](../workflows/agentic-qa-verified-label.yml) | `QA/Verified` label | Human attestation |

Release orchestration is also triggered from [e2e-tests-on-release.yml](../workflows/e2e-tests-on-release.yml) in parallel with E2E.

## Status contexts

| Context | Meaning |
|---------|---------|
| `QA/plan` | Structured plan generated |
| `QA/skipped` | Low risk — no manual QA |
| `QA/automation` | Scoped spec validation/run |
| `QA/execution` | Agent manual verification |
| `QA/Queued` | Budget cap (future) |

## Repo variables

| Variable | Default | Effect |
|----------|---------|--------|
| `AMQA_DRY_RUN` | `false` | Status only, no comments |
| `AMQA_RUN_SCOPED_PLAYWRIGHT` | `false` | Run mapped Playwright specs in CI |

## Schemas & config

- [schemas/qa-plan.v1.schema.json](schemas/qa-plan.v1.schema.json)
- [schemas/qa-result.v1.schema.json](schemas/qa-result.v1.schema.json)
- [schemas/coderabbit-signals.v1.schema.json](schemas/coderabbit-signals.v1.schema.json)
- [cis_config.yml](cis_config.yml)

## Scripts

`.github/scripts/amqa/`

```bash
cd .github/scripts/amqa && python3 test_parse_coderabbit.py && python3 test_qa_plan.py
```

## Docs

- [PILOT.md](PILOT.md) — pilot scope and exit criteria
- [BASELINE.md](BASELINE.md) — metrics baseline
- [GOVERNANCE.md](GOVERNANCE.md) — gates and RACI
- [PHASE_REVIEWS.md](PHASE_REVIEWS.md) — implementation reviews
- [.cursor/qa-playbook.md](../../.cursor/qa-playbook.md) — agent execution bible
