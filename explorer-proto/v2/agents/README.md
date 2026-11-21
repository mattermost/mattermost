# Pilot v2 agents: the portability layer

The v2 pipeline is a program, `explorer-proto/v2/orchestrator/pilot.mjs`. It acts, measures and gates. Agents only perform the judgement tasks it hands out: classify findings, propose charters, review duplicates, review verification, propose lessons. This directory lets Claude Code, Codex, Cursor, a person, or any chat tool do those tasks under one contract, with nothing vendor-specific in the code.

| Path | What it is |
| --- | --- |
| `CONTRACT.md` | The one-page agent contract. A human pastes it into an `AGENTS.md` or `CLAUDE.md`; this directory does not create or edit either. |
| `roles/` | One file per role (8) and `index.json`, the machine-readable side (task role names, input deny-lists). |
| `lessons/` | `lessons.json` (13 proposals) and `LESSONS.md`. |
| `providers/` | Command templates for `--agents=cmd:`, `run-manual.md`, `cmd-wrapper.mjs`, and `fake-agent.mjs` for tests. |
| `mcp/` | An optional, thin MCP server over stdio (hand-rolled subset; see `mcp/README.md`). |
| `lib/` | Shared code of the wrapper and the server: task loading, result checks, prompt building. |
| `selftest.mjs` | Everything above, offline. |

## The roles

| Role file | Orchestrator task role | Where it acts |
| --- | --- | --- |
| `coverage-reviewer.md` | `duplicate-reviewer` | stage 4, `review` task |
| `journey-selector.md` | `charter-proposer` | stage 4, `select` task |
| `triage.md` | `finding-triager` | stage 3 |
| `independent-verifier.md` | `verifier` | stage 7, and pilot verification by a person |
| `lessons-proposer.md` | `lesson-proposer` | stage 9 |
| `qa-lead.md` | none | before a pilot: charter and QA notes |
| `engine-owner.md` | none | work package on `explorer-proto/src/` |
| `infra-owner.md` | none | work package on `explorer-proto/infra/` |

Each file has the same sections: purpose, inputs, outputs, allowed tools, forbidden actions, checklist, failure modes seen in earlier pilots (each with a repository path), and what the role must not see. `cmd-wrapper.mjs` and the MCP server refuse a task whose inputs match a role's deny-list.

## Order of work

1. **Check the layer offline.** `node explorer-proto/v2/agents/selftest.mjs` (about 1 minute, no Docker, no network). `node explorer-proto/v2/orchestrator/selftest.mjs` checks the orchestrator.
2. **Dry run, agent tasks.** `pilot.mjs run --target main --feature channels.favorites --dry-run --agents=manual --out <dir>` plans everything that needs no stack and stops with exit 20 at the first agent task. Do the task (below), run again with `--resume --out <dir>`, and repeat for each task (`select`, `review`, `verify`, `lessons`). A dry run cannot reach a passing verdict: the gates that need a stack or an emitted spec stay `blocked`.
3. **Live run.** Only a person starts it, and only when all of this holds (from the orchestrator README and `explorer-proto/README.md`):
    - `--live` with a real agent provider (the stub is refused), and `MM_LICENSE` exported by the person (presence is checked, the value is never read or printed);
    - Docker (linux/amd64, Compose v2) and both images already pulled by digest (nothing pulls);
    - the Playwright workspace (1.62.1) with its two browser builds installed, Node 24;
    - for discovery, `--engine-charter session:<name>` or `journey:<name>`, because the engine reads no `explorer-charter/v2` yet, and `--explore-cmd` or `--oracle-results` for bug oracles, because no feature-bounded oracle runner exists.

## How to do an agent task, per tool

All four routes end the same way: one result file that the orchestrator validates. A tool cannot approve, soften or override anything.

- **A person, or any chat tool.** Follow `providers/run-manual.md`. No template, no CLI.
- **Claude Code, Codex, Cursor.** Fill the two placeholders of the template in `providers/claude-code.md`, `providers/codex.md` or `providers/cursor.md` from the tool's current documentation, then pass it as `--agents='cmd:...'`. Start with a manual task and a dry run before you trust a template. The templates use `cmd-wrapper.mjs`, which builds the prompt, runs your tool with the prompt on stdin, validates the answer, and writes the result.
- **Any tool with MCP support.** Register `mcp/server.mjs` as a stdio server (see `mcp/README.md`). The agent calls `pilot_next_task`, does the task, and calls `pilot_submit_result`.
- **A script.** `--agents='cmd:node my_agent.mjs {task} {result}'`.

Paste `CONTRACT.md` into the instruction file your tool reads (`AGENTS.md`, `CLAUDE.md` or its equivalent), and point the tool at its role file.

## What is real, and what is not verified

Verified by `selftest.mjs`, offline:

- every role file has the required sections, at least 8 checklist items, at least 4 failure modes that cite repository paths that exist, and the input deny-lists exist; every orchestrator role has a role file;
- `lessons.json` validates against the lesson schema; `lessons_guard.mjs` passes every lesson (and refuses a protected or approved-by-an-agent copy); all evidence paths exist;
- `cmd-wrapper.mjs`: a real pending task from the orchestrator dry run round-trips in stub mode; a plain and a fenced answer are written; a result with a forbidden field, an origin, licence-like text, an approval field or a wrong `task_id` is refused and nothing is written; a failing command or no JSON exits 3; a stale task, a foreign result path and a denied input are refused; the whole dry pipeline runs through the `cmd:` provider with the wrapper in the documented template shape, and a tool that only produces refused results ends the run with exit 22;
- the MCP server over pipes: the protocol subset, exactly five tools, a whole dry run driven by the tools, refusal of invalid, stale and forbidden results, and no write outside the run directory (task path, linked run directory, run names);
- no file here holds licence-like text or session material, no vendor-specific flag, and no bare vendor invocation. The patterns are built in `selftest.mjs` (`VENDOR_FLAG_PARTS`, `VENDOR_BINARIES`, `licenceLikeRules` in `lib/result_check.mjs`). The categories are permission modes, tool allow-lists, input and output formats, sandbox and approval modes, model selection, auto-approval, and print or exec style invocations. The flags in `providers/*.md` must also be in a short allow-list of this directory's and the orchestrator's own flags.

Not verified:

- **No real vendor CLI was run.** Whether a given tool reads the prompt from stdin, prints only JSON, honours read-only options and exits 0 on success is unknown. The templates are shapes with placeholders, and the provider pages say so.
- No MCP client was used. The server was driven only by the selftest's own client, and it is a hand-rolled subset (`initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`; no resources, prompts, progress, cancellation or pagination). A client that needs another method will fail.
- Every live path (Docker, the stack, the engine, replay gates). Nothing here starts one.
- Lessons L08 and L13 rest on the work-package brief; no committed log records those incidents (`lessons/LESSONS.md`, Provenance).
- The role checklists encode what happened in two pilots and the v2 build. They have not been tried by a real agent.

## Lint

Prettier uses `e2e-tests/playwright/.prettierrc.json`. ESLint's `import/order` needs a `package.json`, so the files were linted through a `/tmp` mirror inside a copy of the Playwright workspace config, as the orchestrator README describes. The `no-process-env` comments in the files that read the environment are there because the repository relaxes that rule for `.ts` and `.js` only.
