# AMQA baseline metrics (Phase 0)

Measure before pilot to prove burden reduction. Update after each release cycle.

| Metric | Baseline (fill in) | Pilot target | Notes |
|--------|-------------------|--------------|-------|
| Human QA hours / RC | TBD | −50% | Track in release retro |
| RC-to-sign-off wall time | TBD | −40% | Hours from RC image to go/no-go |
| PRs with zero human QA touch | ~0% | ≥ 60% | 🟢 Low + AMQA skip |
| Sev-1 escaped post-release | TBD | No increase | Jira Sev-1 in pilot window |

## How to measure

- **Human QA hours:** QA team self-report per RC (spreadsheet or Jira tempo)
- **RC-to-sign-off:** Timestamp RC workflow start → Release Confidence Report approval
- **Zero touch:** Count PRs with only `QA/skipped` or automation pass, no human comment

## Pilot scope

- Repository: `mattermost/mattermost`
- Branches: `master`, `release-*`
- Duration: 4 weeks or 1 RC cycle minimum
