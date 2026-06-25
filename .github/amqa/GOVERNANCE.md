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
