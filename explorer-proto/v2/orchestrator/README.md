# Pilot v2 orchestrator

The v2 pipeline as a program, not a conversation. **Agents plan and judge; deterministic code acts, measures and gates.**
`pilot.mjs` runs ten stages. Each stage is a function that reads schema-validated JSON artifacts and writes
schema-validated JSON artifacts into `<out>/<n>-<stage>/`. A stage that needs judgement writes an **agent task** and
waits for a **result file**; the tool that produces the file is not the orchestrator's business (a person, Claude Code,
Codex, Cursor, a script). An agent result is advisory and can never override a deterministic gate.

Plain Node 24 (`.mjs`), built-ins only. Ajv and the TypeScript compiler API come from `e2e-tests/playwright/node_modules`
through `../schemas/validator.mjs`; nothing is installed or downloaded. No timestamps appear in compared artifacts.

```bash
node explorer-proto/v2/orchestrator/selftest.mjs     # no Docker, no network, stub agents; exit 0 only if every check passes
node explorer-proto/v2/orchestrator/pilot.mjs features
```

## Usage

```bash
pilot.mjs run --target <release|main> --feature <id> [--mode explore|author|both] [--out <dir>]
              [--from <stage>] [--to <stage>] [--dry-run | --live]
              [--agents manual|stub[:scenario]|cmd:<template>] [--resume] [--force] [--keep-stack]
              [--budget <stage>.<time|agent_calls|retries>=<n>]... [--result <bakeoff result file>]
              [--oracle-results <dir>] [--explore-cmd <command>] [--explore-repeat <n>]
              [--repeat <n>] [--engine-charter <session|journey>:<name>]
pilot.mjs lesson apply <lesson.json>      # gatekeeper only, see "Lessons"
pilot.mjs features | stages
```

| Flag                                | Meaning                                                                                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--target`                          | `release` (the pinned 12.1.0 build, `targets/release.json`) or `main` (`../targets/main.json`).                                                                                           |
| `--feature`                         | A file in `features/` (`channels.favorites`, `channels.create-and-modals`).                                                                                                               |
| `--mode`                            | `explore` runs stages 0, 2, 3, 9 (bug oracles). `author` runs 0, 1, 4 to 9 (new specs). `both` (default) runs all. A stage outside the mode records `skipped`.                            |
| `--from`, `--to`                    | Stage number or name. Stages outside the range are not touched.                                                                                                                           |
| `--dry-run` (default)               | Plans and records, starts nothing: no Docker, no stack, no engine, no oracle run. Stages that only read files (target pins, index, select, leakage, coverage, gates on files) are real.   |
| `--live`                            | Also runs what needs a stack: `up.sh`, the oracle runner, the engine, replay gates. Needs `MM_LICENSE` exported (presence checked, value never read or printed). Refuses `--agents=stub`. |
| `--agents`                          | `manual` (default), `stub[:scenario]` (tests only) or `cmd:<template>`. Not part of the stage input hash: switching provider does not invalidate finished stages.                         |
| `--resume`                          | Reload target, feature, mode and agents from `<out>/run.json`; needs `--out`. Resuming is the same as re-running: stages that are up to date are skipped.                                 |
| `--force`                           | Rerun every stage in the range.                                                                                                                                                           |
| `--keep-stack`                      | Do not run `down.sh` at the end of a live run.                                                                                                                                            |
| `--budget`                          | Override one budget for this invocation, for example `select.time=1`.                                                                                                                     |
| `--result`                          | Append each finished stage's record (the `metrics.mjs` shape) to a bakeoff result set's `cost.stages`.                                                                                    |
| `--oracle-results <dir>`            | Adopt existing `<traversal>.run<N>.jsonl` oracle finding files at stage 2 (nothing is run). Fault-injection and flag-variant directories are never adopted.                               |
| `--explore-cmd`, `--explore-repeat` | Replace the oracle runner command (placeholders `{work}` and `{plan}`), and the repeat count of the default runner (default 3).                                                           |
| `--repeat`                          | Replays for the stability gate (default 20, the pre-registered number).                                                                                                                   |
| `--engine-charter`                  | Run an existing engine charter (`session:bookmarks`, `journey:auto-follow`) at stages 5 and 6 instead of the selected charter.                                                            |

The default `--out` is `explorer-proto/v2/orchestrator/.runs/<target>-<feature>` (git-ignored).

## Stages

"Real" means it runs in dry mode too. "Live" means it needs the stack and is recorded as skipped (with the exact
commands) in dry mode.

| #   | Stage      | Modes         | What it does                                                                                                                                                                                                                                                                                                                                        | Dry                                                      | Live                                                                                                                                                                                                                                                             |
| --- | ---------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | `target`   | all           | Loads and validates the target file (`explorer-target/v2`); checks the image reference against the digest pins in `infra/scripts/lib.sh` (`MM_IMAGE_DEFAULT`, `MM_IMAGE_MAIN`, `PG_IMAGE`) without Docker; for a release also resolves the tag to the pinned sha.                                                                                   | real                                                     | Runs `infra/scripts/gate.sh --keep --target=<default\|main>` then `up.sh --target=...`; records the licence result as `PASS` or `FAIL` only (a `FAIL` is a setup failure). Always runs again in a live invocation, because a skipped stage would leave no stack. |
| 1   | `index`    | author, both  | Runs `../index/extract.mjs` for the current checkout into `1-index/data` (about 4 s).                                                                                                                                                                                                                                                               | real                                                     | same                                                                                                                                                                                                                                                             |
| 2   | `explore`  | explore, both | Validates the feature file, writes `feature-plan.json` (leakage report, budget, oracle list, runner command). Runs the oracle runner (default `../oracles/measure.mjs`), or adopts `--oracle-results`.                                                                                                                                              | records `skipped: not live`                              | runner runs; its findings are copied to `2-explore/runs/`                                                                                                                                                                                                        |
| 3   | `triage`   | explore, both | Counts reproduction deterministically across the repeated runs (`attempts`, `reproduced`); an **agent task** classifies.                                                                                                                                                                                                                            | real when findings exist (adopted); otherwise `skipped`  | same                                                                                                                                                                                                                                                             |
| 4   | `select`   | author, both  | An **agent task** proposes charters plus a coverage candidate each. Code then validates the charter schema, runs the leakage checker and the coverage duplicate gate. `likely_duplicate` and leakage failures are rejected with evidence. `needs_review` goes to a reviewer **agent task** that must cite `file:line` on the three comparison axes. | real                                                     | same                                                                                                                                                                                                                                                             |
| 5   | `discover` | author, both  | Engine `explore` for each accepted charter (`--session` or `--journey` by charter schema).                                                                                                                                                                                                                                                          | commands recorded                                        | runs the engine; blocked when the engine cannot read the charter                                                                                                                                                                                                 |
| 6   | `emit`     | author, both  | Engine `emit`; the emitted spec is copied to `6-emit/specs/`.                                                                                                                                                                                                                                                                                       | commands recorded                                        | runs the engine                                                                                                                                                                                                                                                  |
| 7   | `verify`   | author, both  | Runs every registered gate per accepted charter, then a verifier **agent task**. Writes a verdict per charter.                                                                                                                                                                                                                                      | gates on files run; the rest are `blocked` (environment) | all gates                                                                                                                                                                                                                                                        |
| 8   | `promote`  | author, both  | Writes the proposed branch name, commit message and PR body. A dry run only: no git command, no push, no PR. There is no `--open-pr`.                                                                                                                                                                                                               | real                                                     | same (still a dry run)                                                                                                                                                                                                                                           |
| 9   | `lessons`  | all           | A lesson-proposer **agent task**; lessons are stored as proposals; the application plan marks the ones that need a human approval.                                                                                                                                                                                                                  | real                                                     | same                                                                                                                                                                                                                                                             |

A stage that finishes with a result of `pass` or `skipped` lets the pipeline continue. Anything else stops it with the
exit code below. Run `--from lessons` after a failed run to still collect lessons.

## Artifacts

All paths are relative to `<out>`. Everything is canonical JSON (sorted keys, trailing newline) except where noted.

| Path                                                                                      | Schema                                                                                                    | Written by     |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------- |
| `run.json`                                                                                | `orch#run-config`                                                                                         | `pilot run`    |
| `<n>-<stage>/stage-record.json`                                                           | `orch#stage-record` (its `metrics` object is exactly what `bakeoff/metrics.mjs` appends to `cost.stages`) | every stage    |
| `agent-calls.jsonl`                                                                       | `orch#agent-call`, one line per agent call                                                                | agent boundary |
| `0-target/target.json`, `target-check.json`                                               | `target`, `orch#target-check`                                                                             | 0              |
| `1-index/data/{tests.jsonl,meta.json}`, `index-summary.json`                              | extractor output, `orch#index-summary`                                                                    | 1              |
| `2-explore/feature-plan.json`, `runs/*.jsonl`                                             | `orch#feature-plan`, oracle finding lines                                                                 | 2              |
| `3-triage/repro.json`, `findings/<id>.json`, `triage-summary.json`                        | `orch#repro`, `finding`, `orch#triage-summary`                                                            | 3              |
| `4-select/proposed/`, `leakage/`, `coverage/`, `charters/`, `verdicts/`, `selection.json` | `charter`, leakage report, `orch#coverage-report`, `charter`, `verdict`, `orch#selection`                 | 4              |
| `5-discover/commands.json`, `6-emit/commands.json`, `6-emit/specs/*.spec.ts`              | `orch#commands`, spec                                                                                     | 5, 6           |
| `7-verify/gates/<charter>.json`, `verdicts/*.verdict.json`, `verify-summary.json`         | `orch#gate-results`, `verdict`, `orch#verify-summary`                                                     | 7              |
| `8-promote/{branch-name.txt,commit-message.txt,pr-body.md,promote.json}`                  | text, `orch#promote`                                                                                      | 8              |
| `9-lessons/lessons/*.json`, `application-plan.json`                                       | `lesson`, `orch#lesson-plan`                                                                              | 9              |
| `<n>-<stage>/agent-task[.name].json`, `agent-result[.name].json`                          | `orch#agent-task`, the task's output schema                                                               | agent boundary |
| `.state/`, `.work/`                                                                       | scratch: active seconds and retry counts, raw runner output                                               | not compared   |

`orch#...` and `agent#...` are definitions in `schemas/orchestrator.schema.json` and `schemas/agent-results.schema.json`.
The contract schemas (`target`, `charter`, `finding`, `verdict`, `lesson`) are the shared ones in `../schemas`.

**Determinism.** Two independent dry runs differ only in `stage-record.json` timing fields and `.state/` (the selftest
checks it). A second run in the same directory is a no-op and byte-identical.

## Agent boundary

A stage that needs judgement (`triage`, `select` twice, `verify`, `lessons`) calls `ctx.agent(...)`. It writes
`<stage>/agent-task.json` (a second task in the same stage uses `agent-task.<name>.json`) and then asks the provider.

`agent-task.json` (`explorer-agent-task/v1`):

| Field            | Content                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `task_id`        | `<stage>-<role>-<hash>`; a result must echo it, so a stale or foreign result is rejected                      |
| `role`, `prompt` | role name and the prompt file (`prompts/<stage>.md`, with its sha256)                                         |
| `inputs`         | `[{path, base: out\|repo, sha256, purpose}]` the artifacts to read, with hashes                               |
| `output`         | `result_file` (relative to `<out>`) and `result_schema` (`id`, `file`, `base`, `sha256`, `definition`)        |
| `allowed_tools`  | read-only tools plus `write_file:<result_file>`; nothing else                                                 |
| `forbidden`      | field-name words (`step`, `route`, `sequence`, ...) and content classes (origins, tokens, ids, ordered steps) |
| `caps`           | the stage's agent-call and retry caps                                                                         |

Providers (`--agents`):

| Provider          | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manual`          | Stop with **exit 20** and print the task path and the result path. Anything may produce the result. Run `pilot.mjs run --resume --out <out>`: the orchestrator validates the result against the task's schema and continues.                                                                                                                                                                                                                                                                                                                         |
| `cmd:<template>`  | Run the command with `{task}` and `{result}` replaced by absolute paths. The template is split into arguments without a shell (quotes and backslashes only), so paths with spaces are safe. The child also gets `PILOT_AGENT_TASK` and `PILOT_AGENT_RESULT`. `MM_LICENSE` is removed from its environment. stdout and stderr go to the orchestrator's stderr. A non-zero exit, a timeout (the stage's remaining time) or an invalid result counts as an attempt; after the retry cap the stage fails (**exit 22** if the command never ran cleanly). |
| `stub[:scenario]` | Canned schema-valid results for tests (`leaky`, `duplicate-bookmark`, `duplicate-likely`, `invalid`, `sleep`, `verdict-pass-with-failing-gate`, `lesson-touches-gate`, `triage-overconfirm`). Refused with `--live`.                                                                                                                                                                                                                                                                                                                                 |

**Rules that make an agent result advisory** (all checked by code, none by trust):

- Every result is validated against the task's schema; an invalid result is set aside as `agent-result.rejected.json`
  with `agent-result.errors.json` (JSON path and rule only), and the stage stays open (exit 21).
- `triage`: `confirmed` needs two reproductions; `not_reproduced` is refused for a finding that reproduced every time.
- `select`: a proposal's charter must pass the schema, the leakage checker (free-text exemptions are dropped) and the
  coverage gate regardless of what the agent says. A reviewer that calls a proposal `non_equivalent` accepts it; one that
  calls it `equivalent` rejects it. Each of the three axes needs at least one `file:line` citation, and every cited file
  must appear in the coverage report; the compared test must be one of the ranked tests.
- `verify`: the result schema is generated per task. `proposed_overall` is limited by the deterministic gates: with a
  `fail` gate only `fail`, with a `blocked` gate only `blocked` or `fail`, never `pass`. The agent can add a failing gate
  (an `equivalent` spec, a leak) and can never remove or soften one. The final verdict is also validated against
  `verdict.schema.json`, which rejects `overall: pass` over any `fail` or `blocked` gate.
- `lessons`: only `status: proposed`; an agent cannot approve its own lesson.

`agent-calls.jsonl` has one line per call (`stage`, `role`, `provider`, `task_id`, `attempt`, `outcome`), no timestamps.
A result already counted for the same `task_id` is not counted again when a stage reruns.

### Worked example, manual mode

```bash
$ node explorer-proto/v2/orchestrator/pilot.mjs run --target main --feature channels.favorites --agents=manual --out /tmp/pilot-out
pilot run: target=main feature=channels.favorites mode=both dry agents=manual
0-target     pass               0.0s  agent calls 0  budget within  target verified statically; licence and stack are live-only
1-index      pass               3.9s  agent calls 0  budget within
2-explore    skipped            0.0s  agent calls 0  budget within  skipped: not live
3-triage     skipped            0.0s  agent calls 0  budget within  skipped: not live (no oracle runs to triage)
4-select     awaiting_agent     0.0s  agent calls 0  budget within  awaiting agent result (charter-proposer)
agent task:   /tmp/pilot-out/4-select/agent-task.json
result file:  /tmp/pilot-out/4-select/agent-result.json
resume:       node explorer-proto/v2/orchestrator/pilot.mjs run --resume --out /tmp/pilot-out
$ echo $?
20
```

1. Open `4-select/agent-task.json`. Read the prompt file it names and the inputs it lists (the feature definition, the
   index summary, `1-index/data/tests.jsonl`).
2. Write `4-select/agent-result.json` matching `agent#select` (`explorer-select-result/v1`): `task_id` copied from the
   task, and `proposals`, each `{charter: <explorer-charter/v2>, candidate: <coverage candidate>}`.
3. `pilot.mjs run --resume --out /tmp/pilot-out`. The result is validated. If it is invalid the command exits 21 and
   `4-select/agent-result.errors.json` says where. If a proposal needs review, the next stop is exit 20 again, with
   `4-select/agent-task.review.json`; answer it the same way (`agent-result.review.json`).
4. The run continues to the next stage that needs an agent (`7-verify`), then `9-lessons`.

### Plugging in an agent tool with `cmd:`

The orchestrator only runs a command line with two placeholders. The command must read the task file, do the work with
whatever tools it has, and write the result file; it should exit 0 only after writing it. The pattern is the same for
every tool:

```bash
--agents='cmd:<agent CLI> <check your CLI'"'"'s non-interactive flag> "Perform the agent task described in {task}. Write the JSON result to {result}."'
```

- **Claude Code**: put the Claude Code CLI in `<agent CLI>` and its non-interactive (print) flag where the slot is. Check
  your installed CLI's help for the exact flag and for how to allow file reads and the one result write.
- **Codex**: the same, with the Codex CLI and its non-interactive subcommand or flag.
- **Cursor**: the same, with the Cursor agent CLI and its non-interactive flag.
- **A script**: `--agents='cmd:node my_agent.mjs {task} {result}'`.

Restrict the tool to the task's `allowed_tools` if it can be configured that way. Do not give it the licence, a running
stack or network access it does not need. The orchestrator never hardcodes a vendor or a flag.

## Resumability and idempotence

- A stage is **skipped** when its record exists with the same `inputs_hash`, a `pass` or `skipped` result, a `within`
  budget and outputs whose hashes still match. The input hash covers the stage name, mode, live flag, target, feature,
  the orchestrator's own source, schemas, prompts and budgets, and the digest of every upstream stage that it reads.
  Changing an upstream artifact therefore reruns everything downstream, and nothing else.
- A failed, blocked, awaiting or budget-exceeded stage always reruns. Manually dropped `agent-result*.json` files survive
  the rerun; a result for a changed task is rejected as stale.
- `--force` reruns every stage in the range.
- Stage 0 is the one exception in a live invocation: it always runs, because the stack it started is torn down at the
  end of every invocation (including when the run stops to wait for an agent) unless `--keep-stack` is given.

## Exit codes

| Code | Meaning                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------ |
| 0    | Every stage in the range is `pass` or `skipped` (dry-run skips and per-charter rejections are normal). |
| 1    | A stage failed: a deterministic failure, a failed verdict, an invalid artifact, or a budget exceeded.  |
| 2    | Usage error: bad flags, unknown feature, invalid configuration, `--live` with the stub agent.          |
| 3    | Blocked: a precondition is missing (for example `MM_LICENSE`, or the engine cannot read the charter).  |
| 20   | Awaiting an agent result (`--agents=manual`). The task and result paths are printed.                   |
| 21   | An agent result was invalid or stale and was set aside; the task stays open.                           |
| 22   | The agent command failed to run cleanly on every attempt.                                              |

## Budgets

`config/budgets.json` holds, per stage, `time_seconds`, `agent_calls` and `retries`. Time is the orchestrator's active
time in the stage, summed over invocations (time spent waiting for a manual agent is not counted); a child process is
killed when the remaining time runs out. Agent calls and retries are totals per stage across invocations. Exceeding any
of them stops the stage with result `fail` and `budget_outcome` `time_exceeded`, `agent_calls_exceeded` or
`retries_exceeded`: a budget overrun is never a pass, even if the stage produced output (the output is kept for
inspection and the stage reruns next time). Every stage record carries `elapsed_seconds`, `exit_code`, `agent_calls`
and the budget outcome. `--budget select.time=1` overrides one value for one invocation.

## Gates (stage 7)

`gates/index.mjs` is the registry: an ordered list of modules with a common interface (`id`, `gate`, `description`,
`liveOnly`, `run(ctx)`), documented in the file header. To add a gate: write the module, import it in the registry, add a
check to `selftest.mjs`. A gate returns `pass`, `fail` or `blocked` with evidence references and a `blocked_reason`; it
never returns `pass` when it could not run.

| Gate id                  | Verdict gate name     | Checks                                                                                                                                                                                                                                                                                                                                                                                             | Dry                                   |
| ------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `schema-valid-artifacts` | `schema`              | Every JSON artifact of stages 0 to 6 validates against its schema.                                                                                                                                                                                                                                                                                                                                 | real                                  |
| `leakage`                | `leakage`             | Charter passes `../bakeoff/leakage_check.mjs` (five rules, free-text exemptions dropped).                                                                                                                                                                                                                                                                                                          | real                                  |
| `duplicate-gate-ran`     | `duplicate`           | The coverage report exists and agrees with the recorded verdict; `needs_review` was reviewed; no `likely_duplicate`.                                                                                                                                                                                                                                                                               | real                                  |
| `licence`                | `licence`             | The live licence result is `PASS`.                                                                                                                                                                                                                                                                                                                                                                 | blocked                               |
| `discovery`              | `discovery`           | The engine explore command exited 0.                                                                                                                                                                                                                                                                                                                                                               | blocked                               |
| `spec-emitted`           | `emit`                | A spec exists for the charter.                                                                                                                                                                                                                                                                                                                                                                     | blocked                               |
| `spec-static`            | `lint`                | No `waitForTimeout`, `setTimeout`, `pause`; no `expect.soft` (or `expect.configure({soft})`); no CSS or XPath locator. Walks the TypeScript syntax tree, so comments and string contents never trigger it.                                                                                                                                                                                         | blocked (no spec)                     |
| `strict-spec-rules`      | `lint`                | The frozen WP-E rules in `../gates/static_spec_check.mjs` accept the spec.                                                                                                                                                                                                                                                                                                                         | blocked (no spec)                     |
| `no-secret-no-origin`    | `secret_scan`         | The origin and unsafe-text patterns find nothing in the artifacts (index data, coverage reports and generated schemas are skipped), and `infra/scripts/leak_scan.mjs` finds no licence material (needs `MM_LICENSE`; blocked without).                                                                                                                                                             | real, or blocked without `MM_LICENSE` |
| `repeat-replay`          | `stability`           | N replays (default 20), each from a freshly started and seeded stack: `up.sh`, engine replay, `down.sh`.                                                                                                                                                                                                                                                                                           | blocked                               |
| `mutation-control`       | `control_sensitivity` | Each `negative_controls` entry of the charter is applied by replay only; it must fail at the named assertion and nowhere else (`lib/controls.mjs`, judge tested offline). Controls of an unknown `kind`, a charter without controls, or a control that cannot be applied are `blocked` and stay in the denominator. Only `kind: seed_variant` (`up.sh --variant`) is applied by this orchestrator. | blocked                               |

The frozen WP-E gates in `../gates/` (replay judge, stability, promotion policy, containment evidence) are not wired into
stage 7 yet; `strict-spec-rules` and `lessons_guard` (below) are the two that are.

## Lessons

Stage 9 stores each lesson as a proposal (`status: proposed`, `applied: false`). `lib/lessons_gate.mjs` decides what
may be applied: a lesson that touches a gate module, a rules file, a schema, an allowlist, a threshold or the
orchestrator itself needs a human approval recorded in the lesson (`status: approved` and an `approver` handle that is
not an automation name), combined with the WP-E `lessons_guard`. `pilot.mjs lesson apply <lesson.json>` prints
`REFUSED` (exit 1) or `ELIGIBLE` (exit 0). It edits nothing: applying a lesson is an ordinary reviewed change.

## Features

`features/<id>.json` (`explorer-feature/v1`) holds an id, a goal sentence, a start path template, the general action
rules (roles, regions, excluded name patterns, uniqueness, modal policy), a budget (the pre-registered discovery budget)
and the oracle classes. It holds no route, no ordered step and no named control. `pilot run` runs the leakage checker
over the feature before any stage starts (the five rules with no exemptions on the charter-shaped fields, and a key and
phrase scan of the rest) and refuses a feature that fails.

## Verified here, and not

Verified by `selftest.mjs` (18 checks, about 45 s): the dry run end to end, no-op rerun, determinism, manual resume,
invalid and stale results, leakage rejection, duplicate rejection and review routing, verdict constraints, the lesson
gate, budgets, the static spec check, the gate registry, the secret scan against a synthetic value, the control judge on
synthetic reports, adopted oracle runs, `cmd:` providers, and the metrics shape.

Not verified (nothing here runs Docker): every live path. That is stage 0's `gate.sh` and `up.sh` calls and the
parsing of their output, the oracle runner invocation, the engine `explore` and `emit` calls and the emitted-spec path
parsing, the replay gates and the control applier. They are written against the documented interfaces and the
infra scripts' source.

## Known gaps and notes for other owners

- **The engine reads no `explorer-charter/v2`.** `src/cli.ts` accepts `explorer-session-charter/v1` (`--session`) and
  `explorer-journey-charter/v1` (`--journey`) only, and reads `sessions/<name>/charter.json`. Agents propose v2
  charters, so a live stage 5 is blocked until the engine accepts v2 (or `--engine-charter` selects an existing one).
  Dry mode records this in `5-discover/commands.json`.
- **No feature-bounded oracle runner exists.** `../oracles/measure.mjs` runs fixed measurement traversals and ignores
  the feature. The default runner is that script; `--explore-cmd` plugs in a runner that reads `{plan}`
  (`feature-plan.json`, also in `PILOT_FEATURE_PLAN`) and writes `<traversal>.run<N>.jsonl` files below `{work}`.
- **The extractor output does not match `coverage-index.schema.json`.** `index-summary.json` records
  `coverage_index_schema.conformant` from a 50-record sample (field names differ, for example `mm_t_ids` and `setup`
  against `test_ids` and `setup_calls`). The stage does not fail on it.
- **`bakeoff/freeze.config.json` lists `explorer-proto/v2/gates` as the gate directory.** The orchestrator's own gates
  live in `explorer-proto/v2/orchestrator/gates`; they are not hashed by the freeze until the config names them.
- **Two oracle classes map approximately** onto the contract vocabulary (`enter-submits-while-disabled`,
  `non-ok-submit-without-feedback`); `source_class` is kept in `3-triage/repro.json`.
- **A journey emit writes its spec into `e2e-tests/playwright/specs/` itself** (engine behaviour); the orchestrator
  reads the printed path and keeps a copy under `6-emit/specs/`.
- **Promote proposes a spec location** (`e2e-tests/playwright/specs/functional/explorer_pilot/`) that no policy has
  approved. It is text in a dry-run proposal only.

## Lint

Prettier uses the repo's `e2e-tests/playwright/.prettierrc.json`. ESLint was run through a `/tmp` mirror of
`explorer-proto/v2` placed inside a copy of the Playwright workspace config (`eslint.config.mjs`, `package.json`,
`node_modules` symlink), because `import/order` needs the workspace `package.json` and the config only targets
`.ts` and `.js`. The Prettier-owned stylistic rules and `no-process-env` that the repo relaxes for `.ts`/`.js` are
disabled by a header comment in the files that need it.
