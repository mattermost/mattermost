# Pilot v2 MCP server (optional, thin)

`server.mjs` exposes the orchestrator to any tool that speaks MCP over stdio, so an agent can fetch a pending task and submit a result without a command template. It adds no capability: every tool is read-only or bounded to one run directory.

**This is a hand-rolled subset of MCP.** `@modelcontextprotocol/sdk` is not installed in this repository (`e2e-tests/playwright/node_modules` has no `@modelcontextprotocol`), and nothing may be installed or downloaded, so the server implements newline-delimited JSON-RPC 2.0 by hand: `initialize` (echoes a supported protocol version: 2025-06-18, 2025-03-26, 2024-11-05), `notifications/initialized`, `ping`, `tools/list`, `tools/call`. Nothing else: no resources, prompts, sampling, progress, cancellation or list pagination. It was driven only by its own selftest client; no third-party MCP client has been tried.

## Run it

```bash
node explorer-proto/v2/agents/mcp/server.mjs [--runs-root <dir>]
```

The default runs root is `explorer-proto/v2/orchestrator/.runs` (git-ignored), the orchestrator's own default; `PILOT_MCP_RUNS_ROOT` also sets it. Most MCP clients take a command and its arguments for a stdio server; check your client's documentation for where to put them: command `node`, argument `explorer-proto/v2/agents/mcp/server.mjs`, working directory the repository root.

## Tools

| Tool | Does | Writes |
| --- | --- | --- |
| `pilot_status` | Lists the runs; for one run, its configuration, stage records and pending agent tasks. | nothing |
| `pilot_plan` | Runs `pilot.mjs run --dry-run --agents=manual` for `{run, target, feature, mode?}`. Call it again after a result was submitted to advance the run. | the run directory, by the orchestrator |
| `pilot_next_task` | Returns the first pending `agent-task.json` with the guidance of its role file and any earlier errors. Refuses a stale task or one with inputs the role must not see. The inputs are listed by path; the client reads them with its own file tools. | nothing |
| `pilot_submit_result` | Validates `{run, result}` against the pending task (schema, `task_id`, forbidden fields, unsafe and licence-like text) and, only if valid, writes that task's `agent-result` file. | one file inside the run directory |
| `pilot_gate_report` | Summarises the stage 7 gate results and verdicts per charter. | nothing |

## What it cannot do

- Start Docker, a stack, a live run or any shell command. The source holds one `spawn`, for the orchestrator in dry-run mode with a fixed argument list built from checked values (no `--live`, no shell).
- Write anywhere except the run directory. A run name is a plain name below the runs root; a run directory that is a link, or whose task names a result outside the run, is refused. `pilot_submit_result` writes only the sibling `agent-result` file of the task it matched.
- Read the licence: `MM_LICENSE` is removed from the environment of the orchestrator child.
- Override a gate. `pilot_submit_result` refuses approval and override fields, and the orchestrator checks the verdict again.

## Test

`node explorer-proto/v2/agents/selftest.mjs --only d` drives the server over pipes: protocol basics, exactly five tools, bad arguments, a whole dry run through the tools, refused results, and no write outside the run directory.
