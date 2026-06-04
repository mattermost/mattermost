# Incident Command Center (YVETTE-2) - SDK Orchestrator

A 5-agent Cursor SDK pipeline that ships the **Incident Command Center** feature for the Mattermost webapp by chaining cloud agents on a single shared branch.

## Pipeline

| # | Agent | Deliverable | Notes |
|---|-------|------------|-------|
| 1 | Planner | `docs/incident-command-center/implementation_plan.md` | Read-only repo exploration + plan. No code. |
| 2 | Product Designer | `docs/incident-command-center/design_spec.md` | Textual high-fidelity spec (Figma MCP is not wired into the cloud agent). No code. |
| 3 | Implementation Engineer | Production code under `webapp/` + `implementation_report.md` | Adds tests; runs lint/typecheck where possible. |
| 4 | Reviewer | `docs/incident-command-center/review_report.md` with `REVIEWER_VERDICT: APPROVED | REJECTED` | Quality gate. Orchestrator stops if not APPROVED. |
| 5 | Release Engineer | `docs/incident-command-center/release_report.md`; PR opened via `autoCreatePR: true` | Only runs if Reviewer approves. |

## How chaining works

- Agent 1 (Planner) is created from `master` with `workOnCurrentBranch: false`. The SDK creates a fresh cloud branch and the Planner commits its plan into it. The branch name is captured from `result.git.branches[0].branch`.
- Agents 2-5 are created with `startingRef: <that branch>` and `workOnCurrentBranch: true`, so they all commit onto the same branch.
- Agent 5 is the only one with `autoCreatePR: true`. The PR is opened when its run finishes.

## Requirements

- Node 20+ (the repo uses Node 26 locally).
- A valid `CURSOR_API_KEY` exported in the environment (user API key or team service-account key).
- The repo at `cloud.repos[0].url` must be connected to your Cursor team (visible via `Cursor.repositories.list()`).

## Run it

```bash
cd .agents/incident-cc
npm install
export CURSOR_API_KEY="cursor_..."
# Optional overrides:
# export REPO_URL="https://github.com/<owner>/<repo>"
# export STARTING_REF="master"
# export MODEL_ID="auto"
npm start
```

## Outputs

- `runs/session-<timestamp>.json` - structured timeline of every agent (agentId, runId, branch, status, durationMs, verdict, prUrl).
- `runs/session-<timestamp>.log` - human-readable trace with truncated assistant output and tool-use markers.
- The shared branch on GitHub carries all artifacts (`docs/incident-command-center/*.md`) and the implementation code.
- A PR to the repo's default branch when Agent 5 completes.

## Exit codes

- `0` - all five agents completed and Reviewer approved.
- `1` - startup failure (`CursorAgentError`) or run-level failure (`result.status === "error"`).
- `2` - Reviewer rejected; Release Engineer was not run.

## What this orchestrator does NOT do

- It does not interact with the Figma MCP. Agent 2 produces a textual design spec only. A future iteration could pass an `mcpServers: { figma: { url, headers } }` block on Agent 2's `Agent.create`.
- It does not retry on flaky failures. If `result.status === "error"`, the script aborts with exit code 1.
- It does not poll review iterations. If the Reviewer rejects, the script stops; re-running Agent 3 + Agent 4 is a manual follow-up.
