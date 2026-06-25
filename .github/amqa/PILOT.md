# AMQA Pilot Scope

## Duration

4 weeks or one full RC cycle (whichever completes first).

## Scope

- Repository: `mattermost/mattermost`
- Branches: `master`, `release-*`
- Squads: start with teams owning high-traffic webapp + admin console paths

## Exit criteria

- ≥ 50 PRs processed by `agentic-qa-pr` workflow
- < 15% override rate due to agent error (policy waivers excluded)
- ≥ 1 release RC with published Release Confidence Report
- Playbook Sev-1 paths with < 5% agent inconclusive rate
- ≥ 50% reduction in human QA hours on pilot RC vs baseline (see [BASELINE.md](BASELINE.md))

## Advisory-only gates

Pilot runs with informational statuses only. No merge blocks until exit criteria met and EM + Release Manager approve soft gates.
