# AMQA Governance (Phase 5)

## Pilot phase (advisory)

- All `QA/*` statuses are informational during pilot ([PILOT.md](PILOT.md))
- Overrides: `/qa-override` or `QA/Verified` label (write access required)
- No merge blocks until pilot exit criteria met

## Soft gates (post-pilot, opt-in)

| Status | When required | Override |
|--------|---------------|----------|
| `QA/plan` | Always generated | N/A |
| `QA/automation` | CIS ≥ 50 | `/qa-override` |
| `QA/execution` | CIS ≥ 80 + UI paths | `QA/Verified` label |

Enable via repo variable `AMQA_SOFT_GATE=true` (future).

## Security

- **GHA orchestrates only** — `pr-manual-qa-execute.yml` sets `QA/execution` pending and uploads artifacts. No LLM runs in CI.
- **Manual verification** — Cursor Cloud Agent `computerUse` reads the structured `qa-plan.json` and playbook; it does not ingest raw PR body text as an LLM prompt inside GitHub Actions.
- **User-controlled input** — CodeRabbit blocks are parsed by deterministic Python (`parse_coderabbit.py`), not passed to an in-CI agent.

## RACI

| Activity | Dev | Agent | QA/SDET | Release Mgr |
|----------|-----|-------|---------|-------------|
| PR QA steps in Summary | R | C | I | I |
| QA plan generation | I | R | A | I |
| Scoped automation | I | R | A | I |
| Manual execution | I | R | A | C |
| Release sign-off | I | C | R | A |

## KPIs

Tracked in workflow job summary via `amqa_metrics.py`. Monthly review:

- Time to QA plan (p95 < 3 min)
- Override rate (< 20% pilot)
- Human QA hours / release (−50% pilot target)
- Escaped defects in agent-covered areas

## Zephyr linkage (optional)

Set `AMQA_ZEPHYR_CYCLE_ID` repo variable to attach release report to a Zephyr cycle (future integration).
