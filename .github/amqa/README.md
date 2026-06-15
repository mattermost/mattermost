# Agentic QA (AMQA)

Burden-reduction QA layer: parse CodeRabbit → scoped automation → agent execution → release confidence rollup.

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `agentic-qa-pr.yml` | PR open/sync, CodeRabbit comment, `/qa-verify` | Parse, skip Low, queue automation/execution |
| `agentic-qa-execute.yml` | Called from PR workflow | Agent verification (Claude + Cloud Agent steps) |
| `agentic-qa-merge.yml` | PR merged | Store `qa-result` for release rollup |
| `agentic-qa-release.yml` | Manual / workflow_call | Release Confidence Report |
| `agentic-qa-override.yml` | `/qa-override` comment | Maintainer waiver |

## Repo variables

| Variable | Default | Effect |
|----------|---------|--------|
| `AMQA_DRY_RUN` | `false` | Status only, no comments |
| `AMQA_RUN_SCOPED_PLAYWRIGHT` | `false` | When `true`, list specs for future full Playwright job |

## Scripts

`.github/scripts/amqa/` — `parse_coderabbit.py`, `amqa_pr.py`, `amqa_release.py`

Run tests: `cd .github/scripts/amqa && python3 test_parse_coderabbit.py`

## Baseline

See [BASELINE.md](BASELINE.md) for pilot metrics.
