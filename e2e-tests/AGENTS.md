# AGENTS.md

## Purpose

Use this directory for Mattermost webapp E2E validation. Prefer the agent-focused wrapper here over the raw local runner.

## Command selection

- Use `make run-agent` for AI-agent execution.
- Use `make run-local` for human debugging when verbose stdout is acceptable.
- Use the legacy `make` flow only when you specifically need the CI-style Docker image path.

## `make run-agent`

This is the default agent entrypoint.

Behavior:
- Defaults to `FRAMEWORK=playwright`.
- Defaults to `E2E_SCOPE=smoke`.
- Redirects the full bootstrap and test output to `logs/agent/*.log`.
- Prints only a compact summary to stdout so agents do not ingest full Cypress/Playwright logs.
- Leaves the local server and dependency containers running for follow-up debugging.

Examples:
- `make run-agent`
- `FRAMEWORK=cypress make run-agent`
- `SPEC_FILES=specs/functional/channels/search/find_channels.spec.ts make run-agent`
- `SPEC_FILES=tests/integration/channels/team_settings/create_a_team_spec.js make run-agent`
- `FRAMEWORK=cypress E2E_SCOPE=full SPEC_FILES=tests/integration/channels/enterprise/elasticsearch_autocomplete/channels_spec.ts make run-agent`

Notes:
- If `SPEC_FILES` starts with `specs/`, `run-agent` infers `FRAMEWORK=playwright`.
- If `SPEC_FILES` starts with `tests/integration/`, `run-agent` infers `FRAMEWORK=cypress`.
- Do not use `SPEC_FILES` with `FRAMEWORK=all`.
- Avoid `FRAMEWORK=all` unless explicitly asked; it is expensive and usually unnecessary for agents.

## Inputs

- `FRAMEWORK=playwright|cypress|all`
- `E2E_SCOPE=smoke|full`
- `SPEC_FILES=<comma-separated spec paths>`
- `PLAYWRIGHT_TEST_FILTER=<playwright args override>`
- `CYPRESS_TEST_FILTER=<run_tests.js filter override>`
- `ENABLED_DOCKER_SERVICES=<override dependency set>`
- `BROWSER=<cypress browser override>`

## Output locations

- Agent wrapper log: `logs/agent/*.log`
- Playwright summary: `playwright/results/summary.json`
- Cypress summary: `cypress/results/summary.json`
- Playwright framework log: `playwright/logs/`
- Cypress framework log: `cypress/logs/`

## Authoring guidance

- For Playwright test-writing conventions, page objects, accessibility-first locators, and test documentation format, consult `playwright/CLAUDE.OPTIONAL.md` and `playwright/README.md`.
- Keep new agent-facing orchestration guidance in this file short; keep framework-specific test authoring guidance in the Playwright docs.
