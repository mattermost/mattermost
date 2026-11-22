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
              [--repeat <n>] [--engine-charter <session|journey>:<name>] [--session <name>] [--run-id <id>]
pilot.mjs run --target release --live --run-id <id> --verify-spec <repo-relative spec>
              --engine-charter session:<name> --control <id> [--agents manual|cmd:<template>] [--resume] [--keep-stack]
              [--verifier manual|process] [--verifier-timeout <seconds>] [--image <ref@sha256:digest>]
              [--recover-fixture] [--interrupt-after-stage <target|baseline|control|dispatch>]
              # verify an existing spec under a control, see "Verifying an existing spec"
pilot.mjs export --run-id <id> --out <dir> | summary --run-id <id> [--github] | doctor [--no-docker]
              # headless CI entry, see "Headless CI entry"
pilot.mjs lesson apply <lesson.json>      # gatekeeper only, see "Lessons"
pilot.mjs features | stages
```

| Flag                                | Meaning                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--target`                          | `release` (the pinned 12.1.0 build, `targets/release.json`) or `main` (`../targets/main.json`).                                                                                                                                                                                                                                         |
| `--feature`                         | A file in `features/` (`channels.favorites`, `channels.create-and-modals`).                                                                                                                                                                                                                                                             |
| `--mode`                            | `explore` runs stages 0, 2, 3, 9 (bug oracles). `author` runs 0, 1, 4 to 9 (new specs). `both` (default) runs all. A stage outside the mode records `skipped`.                                                                                                                                                                          |
| `--from`, `--to`                    | Stage number or name. Stages outside the range are not touched.                                                                                                                                                                                                                                                                         |
| `--dry-run` (default)               | Plans and records, starts nothing: no Docker, no stack, no engine, no oracle run. Stages that only read files (target pins, index, select, leakage, coverage, gates on files) are real.                                                                                                                                                 |
| `--live`                            | Also runs what needs a stack: `up.sh`, the oracle runner, the engine, replay gates. Needs `MM_LICENSE` exported (presence checked, value never read or printed). Refuses `--agents=stub`.                                                                                                                                               |
| `--agents`                          | `manual` (default), `stub[:scenario]` (tests only) or `cmd:<template>`. Not part of the stage input hash: switching provider does not invalidate finished stages.                                                                                                                                                                       |
| `--resume`                          | Reload target, feature, mode and agents from `<out>/run.json`; needs `--out`. Resuming is the same as re-running: stages that are up to date are skipped.                                                                                                                                                                               |
| `--force`                           | Rerun every stage in the range.                                                                                                                                                                                                                                                                                                         |
| `--keep-stack`                      | Do not run `down.sh` at the end of a live run.                                                                                                                                                                                                                                                                                          |
| `--budget`                          | Override one budget for this invocation, for example `select.time=1`.                                                                                                                                                                                                                                                                   |
| `--result`                          | Append each finished stage's record (the `metrics.mjs` shape) to a bakeoff result set's `cost.stages`.                                                                                                                                                                                                                                  |
| `--oracle-results <dir>`            | Adopt existing `<traversal>.run<N>.jsonl` oracle finding files at stage 2 (nothing is run). Fault-injection and flag-variant directories are never adopted.                                                                                                                                                                             |
| `--explore-cmd`, `--explore-repeat` | Replace the oracle runner command (placeholders `{work}` and `{plan}`), and the repeat count of the default runner (default 3).                                                                                                                                                                                                         |
| `--repeat`                          | Replays for the stability gate (default 20, the pre-registered number).                                                                                                                                                                                                                                                                 |
| `--engine-charter`                  | Run an existing engine charter (`session:bookmarks`, `journey:auto-follow`) at stages 5 and 6 instead of the selected charter. A `session:<name>` charter also selects the session stage 0 seeds (see `--session`).                                                                                                                     |
| `--session`                         | The session stage 0 seeds: `up.sh --session=<name>` (only `bookmarks` exists). Defaults to the session of `--engine-charter session:<name>` when infra can seed it; naming a different session in both is a usage error. Without a session, stage 0 seeds the default fixture exactly as before. The session is recorded in `run.json`. |
| `--run-id`                          | Run directory `explorer-proto/infra/.run/orch/<id>` (git-ignored) when `--out` is absent. `--resume --run-id <id>` reloads the run.                                                                                                                                                                                                     |
| `--verifier`                        | `manual` (default: S3 halts with exit 20 for a result file) or `process` (S3 starts the deterministic verifier as a separate OS process, see "Byte-exact handoff"). Only with `--verify-spec`. Saved in `run.json`.                                                                                                                     |
| `--verifier-timeout`                | Seconds the verifier process may run before it is killed (default 1500).                                                                                                                                                                                                                                                                |
| `--image`                           | `<ref>@sha256:<digest>`; also read from `MATTERMOST_PILOT_IMAGE`. A reference without a digest is a usage error. See "Headless CI entry".                                                                                                                                                                                               |
| `--recover-fixture`                 | With `--resume`: probe the fixture even though the dispatch released the stack, and start a new stage-0 attempt when it is gone (see "Lost fixture recovery").                                                                                                                                                                          |
| `--interrupt-after-stage`           | Test hook: the coordinator sends itself SIGKILL right after the named stage completed (or was reused or up to date). The run directory and the stack stay as they are.                                                                                                                                                                  |
| `--verify-spec`, `--control`        | Verify an existing spec instead of running the ten stages: see "Verifying an existing spec".                                                                                                                                                                                                                                            |

The default `--out` is `explorer-proto/v2/orchestrator/.runs/<target>-<feature>` (git-ignored).

## Stages

"Real" means it runs in dry mode too. "Live" means it needs the stack and is recorded as skipped (with the exact
commands) in dry mode.

| #   | Stage      | Modes         | What it does                                                                                                                                                                                                                                                                                                                                        | Dry                                                      | Live                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | `target`   | all           | Loads and validates the target file (`explorer-target/v2`); checks the image reference against the digest pins in `infra/scripts/lib.sh` (`MM_IMAGE_DEFAULT`, `MM_IMAGE_MAIN`, `PG_IMAGE`) without Docker; for a release also resolves the tag to the pinned sha.                                                                                   | real                                                     | Runs `infra/scripts/gate.sh --keep --target=<default\|main>` then `up.sh --target=... [--session=<name>]`; records the licence result as `PASS` or `FAIL` only (a `FAIL` is a setup failure). With a session it reads `seed-manifest.json` and fails unless `session.name` equals the selection and both declared bookmarks are present with their charter titles, then probes the live fixture. Each live run is a list of attempts, see "Stage 0 attempts and resume". |
| 1   | `index`    | author, both  | Runs `../index/extract.mjs` for the current checkout into `1-index/data` (about 4 s).                                                                                                                                                                                                                                                               | real                                                     | same                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2   | `explore`  | explore, both | Validates the feature file, writes `feature-plan.json` (leakage report, budget, oracle list, runner command). Runs the oracle runner (default `../oracles/measure.mjs`), or adopts `--oracle-results`.                                                                                                                                              | records `skipped: not live`                              | runner runs; its findings are copied to `2-explore/runs/`                                                                                                                                                                                                                                                                                                                                                                                                                |
| 3   | `triage`   | explore, both | Counts reproduction deterministically across the repeated runs (`attempts`, `reproduced`); an **agent task** classifies.                                                                                                                                                                                                                            | real when findings exist (adopted); otherwise `skipped`  | same                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 4   | `select`   | author, both  | An **agent task** proposes charters plus a coverage candidate each. Code then validates the charter schema, runs the leakage checker and the coverage duplicate gate. `likely_duplicate` and leakage failures are rejected with evidence. `needs_review` goes to a reviewer **agent task** that must cite `file:line` on the three comparison axes. | real                                                     | same                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5   | `discover` | author, both  | Engine `explore` for each accepted charter (`--session` or `--journey` by charter schema).                                                                                                                                                                                                                                                          | commands recorded                                        | runs the engine; blocked when the engine cannot read the charter                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6   | `emit`     | author, both  | Engine `emit`; the emitted spec is copied to `6-emit/specs/`.                                                                                                                                                                                                                                                                                       | commands recorded                                        | runs the engine                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7   | `verify`   | author, both  | Runs every registered gate per accepted charter, then a verifier **agent task**. Writes a verdict per charter.                                                                                                                                                                                                                                      | gates on files run; the rest are `blocked` (environment) | all gates                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | `promote`  | author, both  | Writes the proposed branch name, commit message and PR body. A dry run only: no git command, no push, no PR. There is no `--open-pr`.                                                                                                                                                                                                               | real                                                     | same (still a dry run)                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 9   | `lessons`  | all           | A lesson-proposer **agent task**; lessons are stored as proposals; the application plan marks the ones that need a human approval.                                                                                                                                                                                                                  | real                                                     | same                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

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
- Stage 0 is the one exception in a live invocation: it decides by a live probe, not by its record (next section). The
  stack it started is torn down at the end of every invocation (including when the run stops to wait for an agent)
  unless `--keep-stack` is given.

## Stage 0 attempts and resume

A live stage 0 writes each setup as `0-target/attempt-<n>/` (`target.json`, `target-check.json`, `setup.json`,
`attempt.json`). An attempt directory is never touched again. `0-target/status.json` lists every attempt with its
`outcome`, the `reason` it ran and the sha256 of its files. `0-target/target.json` and `target-check.json` are copies of
the newest attempt for the stages and gates that read them. `setup.json` records the session, the target file hash, the
image pin and digest, the licence and gate result (`PASS`/`FAIL`), the manifest session check and the **fixture
fingerprint**: the sha256 of the canonical map of bookmark ids per channel. Ids themselves are never stored.

On every live invocation stage 0 first asks whether it may **reuse** the newest attempt. It does when that attempt
passed, its files still hash as recorded, the recorded target file hash, session and image pin equal the current ones, the
manifest still names the session, and a probe through the seeding admin's reads finds both bookmarks with their declared
titles and the ids of the manifest, with the same fingerprint. A reused stage runs nothing, writes nothing and prints
`reused`; `down` and the seed never run against a valid fixture. Otherwise (probe failed, inputs changed, first run,
earlier attempt failed or `--force`) a new attempt starts and its `reason` says why (`initial`, `probe_failed:<code>`,
`inputs_changed:<name>`, `previous_attempt_failed`, `earlier_attempt_files_changed`, `forced`). After a verification run has
dispatched to a verifier, the stack is deliberately down and stage 0 is reused without a probe.

`up.sh` only accepts the session `bookmarks`. The default fixture (no session) is unchanged: stage 0 then runs again in
every live invocation, as an attempt.

## Verifying an existing spec

`pilot run ... --verify-spec <path> --engine-charter session:<name> --control <id> --run-id <id>` does not select or
emit anything. It takes a spec that already exists, records it by repo-relative path and sha256 in `run.json`, and runs
five stages under one run directory, `explorer-proto/infra/.run/orch/<run-id>/` (git-ignored). It needs `--target
release`, `--live` for anything beyond the static target check, and a spec inside `explorer-proto/sessions/<name>/generated/`
(the directory the engine's replay runs; it must hold exactly one spec). Duplicate detection for new proposals
(`select`) is untouched: this path does not run it.

```bash
pilot.mjs run --target release --live --agents=manual --run-id bookmarks-handoff-1 \
  --verify-spec explorer-proto/sessions/bookmarks/generated/channels_bookmarks_bar_follows_switch.spec.ts \
  --engine-charter session:bookmarks --control release-bookmark-title-changed --to target --keep-stack
pilot.mjs run --resume --run-id bookmarks-handoff-1      # S0 reused, S1, S2, S3: stops with exit 20
# the verifier writes <run>/verify/agent-result.json
pilot.mjs run --resume --run-id bookmarks-handoff-1      # S4: validates the result, writes summary.json and summary.md
```

| Stage (directory) | Does                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0 `0-target`     | Live stack with the session, licence `PASS`/`FAIL`, manifest session check, fixture fingerprint, image digest; attempts and reuse as above.                                                                                                                                                                                                                                                                                   |
| S1 `1-baseline`   | Fixture probe, then the engine's replay (`node explorer-proto/src/cli.ts replay --session=<name>`, retries 0, one worker from `explorer-proto/playwright.config.ts`) of the unchanged spec. `v2/gates/replay_judge.mjs` judges it in `pass` mode. Writes `baseline.json`.                                                                                                                                                     |
| S2 `2-control`    | `v2/gates/mutation_control.mjs` `runControl`: precondition read, owner PATCH, read-back, the same spec replayed and judged `control-fail` at the named assertion, restore and read-back. Then a seed check (manifest session, declared titles, same fingerprint) and a replay of the restored fixture judged `pass`. Writes `control.json` and the sanitized `failure-trace.json`. The restore happens here, before dispatch. |
| S3 `verify`       | Writes `verify/agent-task.json` (role `independent-verifier`, prompt `prompts/independent_verify.md`, task details inline in `context`), stops the stack through `down.sh`, confirms it is gone, records both in `verify/dispatch.json`, and halts the run with **exit 20**. With `--verifier=process` it freezes the inputs and starts the verifier process instead (next section).                                          |
| S4 `collect`      | Reads `verify/agent-result.json`, validates it, cross-checks it against S0 to S2, writes `collect/collect.json`, `summary.json` and `summary.md` at the run root. After a process delivery it also checks the receipt (next section).                                                                                                                                                                                         |

### Byte-exact handoff to the verifier process (`--verifier=process`)

A hand-copied task is a defect (a typo went through once, and the verifier lacked the failure trace). With
`--verifier=process` the handoff is code, bound by hashes, and the receipt is checked by code:

1. S3 writes `verify/agent-task.json` with a random **dispatch nonce** inside it (`context.binding`, with the run id, the
   expected spec sha256 and the expected trace sha256), so the nonce is part of what is hashed. It then makes the task and
   `2-control/failure-trace.json` read-only (`chmod a-w`), hashes both, and tears the stack down. The verifier starts its
   own clean fixture, and two stacks cannot coexist on the fixed compose project name and loopback port, so the
   coordinator's stack must be gone first (the teardown is confirmed and recorded).
2. `verify/dispatch.json` gains a `delivery` record: run id, task id, nonce, the sha256 of the task and of the trace as
   written, the read-only flag, the expected spec sha256, failing line and expect call, the verifier command line (with
   `<run>` and `<scratch>` placeholders) and the delivery mode `process: same worker, artifact paths`.
3. The verifier (`verifier/bookmarks_verifier.mjs`, plain Node, no model, no vision call) runs as a **separate OS
   process** (`child_process.spawn`), in a scratch directory, with an allowlisted environment (`PATH`, `HOME`, locale,
   Docker and Playwright locations, the image and port variables, and `MM_LICENSE` only so the infra scripts can start the
   stack; `PILOT_VERIFIER_PASS_ENV` adds test-seam names) and **only paths** on its command line:
   `--task <run>/verify/agent-task.json --trace <run>/2-control/failure-trace.json --out <run>/verify/agent-result.json
--nonce-file <scratch>/dispatch-binding.json`. The binding file (nonce, task hash, trace hash, spec hash) lives outside
   the run directory. The coordinator waits within `--verifier-timeout` and writes `verify/process.json` (pid, argv, the
   environment names, exit code, signal, elapsed seconds, a post-run teardown, the blocker if any).
4. The verifier proves its inputs first: sha256 of the task equals the binding, the nonce inside the task equals the
   binding's, the sha256 of the trace equals the binding and the hash named in the task, the trace equals the trace
   embedded in the task, the trace's spec hash and the spec on disk equal the task's. Any mismatch or missing file is a
   `blocked` result (exit 3) written before any stack is touched. Otherwise it brings up its own fixture (`gate.sh --keep`,
   `up.sh --session=bookmarks`, `verify_seed.mjs`), replays the unchanged spec (retries 0, one worker; the engine's replay
   with a step reporter added), judges it with `v2/gates/replay_judge.mjs`, applies the control with its own owner patch
   (`bookmark_ctl.mjs patch`, which refuses a non-owner), replays and judges `control-fail` with the task's expectation,
   confirms one error at the expected line and records one step per awaited expect up to the failing one, restores, reads
   back, checks the seed and that the bookmark ids are unchanged (fingerprint compare, never printed), replays and judges
   `pass`, tears its stack down, and writes the result with a **receipt**.
5. S4 validates by code: the result schema; `receipt.run_id`, `task_id` and `dispatch_nonce` equal the dispatch record; the
   task and trace hashes the verifier observed equal the dispatched ones; the on-disk task and trace still hash as
   dispatched; the failing line and expect call equal the S2 records; the existing pass conditions (one error, the same
   first message line, one step per expect, restored read-back, same ids, seed check, restored replay); the spec hash
   observed and after the restore equal the recorded one. A verifier `pass` can never override a deterministic mismatch.
6. If the process did not run, crashed, timed out or produced no result, or if its result is stale (another dispatch's
   nonce), unbound (no receipt), from another run or task, or contradicts the records, the run verdict is **incomplete**
   (exit 30): not pass, not fail. The blocker is recorded in `collect/collect.json` and `summary.json`; a rejected result is
   set aside as `collect/agent-result.rejected.json` with `agent-result.errors.json` (paths and rules only). A verifier
   that reports an honest `fail` or `blocked` with a matching receipt and the right assertion is accepted as such (exit 1 or
   3); a spec hash seen differently is a hard failure (exit 1).

`summary.json` and `summary.md` report the delivery mode, the nonce sent and echoed, the task and trace hashes
dispatched and observed, the verifier exit code and elapsed time, and which side produced each row. To dispatch again
(for example after an incomplete run) use `run --resume --run-id <id> --from dispatch --force`: a new nonce, new hashes,
and the earlier result is set aside as `verify/agent-result.stale.<n>.json`. Frozen files are ordinary read-only files:
`rm -rf` of a run directory works, and `thawTree()` in `lib/verify/handoff.mjs` restores write access for tools that
need it. The manual and `cmd:` providers are unchanged; a model-assisted review can still be plugged in that way, but a
result without a receipt is only accepted from them.

### Interruption, resume and lost fixture recovery

A killed coordinator leaves the run directory and the stack as they are. `run --resume --run-id <id>` reuses stage 0
(every stage-0 file keeps its sha256, the manifest keeps its session key, the fixture fingerprint is equal, one attempt),
skips the stages that are up to date and continues; a stage that was cut off has no record and runs again.
`--interrupt-after-stage <stage>` kills the coordinator with SIGKILL after that stage, for tests.

**Lost fixture recovery.** After a completed run the stack is down (the dispatch released it), so a plain `--resume` of a
completed run is a no-op. `--resume --recover-fixture` probes the fixture instead; if it is gone, stage 0 records
`attempt-<n+1>` with the reason `fixture_lost:<code>` (attempt-1 stays byte for byte), the evidence of S1 to S4 and the
summary move to `superseded/after-attempt-<n>/`, and every later stage runs again against the new fixture (its
fingerprint differs; nothing proved about the old fixture is reused as proof for the new one). `summary.json` lists the
fingerprint of every attempt and the superseded directories.

**The control.** `controls/<id>.json` (`explorer-control-definition/v1`) holds the charter reference, the channel key, the
changed title, the owner-patch requirement and the command templates (`read`, `mutate`, `restore`; the mutator is
`bookmark_ctl.mjs patch --channel=<key> --title='<title>'`). The declared title is read from the charter's
`fixture_setup.bookmarks`. The charter describes the change only in prose (`negative_controls[].change`), so the changed
title is kept in the definition file and checked against that text when the control is loaded; a mismatch is an error. The
title change is labelled **verification control** everywhere.

**The assertion.** The expected failing call is not hard-coded. The charter's `expected_failing_assertion` text gives a
predicate id and a quoted name; the call is the first awaited `expect` in the spec whose label carries that id and whose
locator names it. Its line, text and matcher go into the judge's expectation and into the agent task, together with the
number of awaited expects up to and including it.

**Hash rule.** The spec is hashed again before every stage (also an up-to-date one), by S1 to S4 around their work, by the
dispatch record and by the verifier's own fields. Any difference from `run.json` is a hard failure (`spec_hash_mismatch`,
exit 1). A fresh invocation that reuses a run id with a different spec, control, session or image pin is a usage error.

**The failure trace** (`2-control/failure-trace.json`, `orch#failure-trace`) holds the spec path and sha256, the test
title, the failing line and call, the scrubbed message (origins, hosts, ports, ids, tokens, channel and team names and
absolute paths replaced), the bookmark-bar part of Playwright's `error-context.md` (found through the bar's items; link
targets dropped), the judge verdict, the mutation description and the restore instruction. It is scanned for unsafe text
and, with `MM_LICENSE` exported, by `infra/scripts/leak_scan.mjs` (PASS or FAIL only). The agent task gets the same scans.

**The verifier result** is `verify/agent-result.json`, schema `schemas/verifier-result.schema.json` (`task_id`,
`spec_sha256_observed`, `clean_fixture_confirmed`, `baseline_pass`, `control_applied`, `reproduced_failure`, `restored`,
`verdict`, `notes`). S4 rejects it (exit 21, set aside as `collect/agent-result.rejected.json` with
`agent-result.errors.json` holding paths and rules only) when it is invalid, belongs to another task, matches the
unsafe-text scan, or contradicts the records. `verdict: pass` needs every one of these to hold: clean fixture, baseline
exit 0 and judged `pass`, control accepted, the failure judged at the named assertion, one error only, the same failing
line, call and first message line as S2, step evidence with one entry per awaited expect up to the failing one, a restored
read-back, the same bookmark id, a seed check, a restored replay judged `pass`. A `fail` or `blocked` verdict over fields that
all show success is also rejected, so a verdict never overrides the data. An accepted `fail` ends the run with exit 1, an
accepted `blocked` with exit 3. A verifier that observed a different spec hash is a hard failure.

**Summary.** `summary.json` (`orch#run-summary`) and `summary.md` list original pass, controlled failure, independent
reproduction and restored pass with who produced each, the assertion location, whether the spec hash held at every
stage, and every stage's status with the stage-0 attempts. A row reads `verified` only when the orchestrator produced it;
the independent reproduction counts only because both the dispatch and the collection went through it.

**Page snapshot.** In this engine the guarded session's page is not a Playwright-managed page, and Playwright's
`error-context.md` holds the page snapshot as a bare ```yaml block under the error details (no "Page snapshot" heading).
The trace takes that block; a control run whose `error-context.md` yields no bookmark-bar part fails stage 2.

**Test seams.** `PILOT_INFRA_DIR` points the orchestrator at a directory laid out like `explorer-proto/infra` (the
scripts, the bookmark helper and `.run/seed-manifest.json`); `PILOT_REPLAY_CMD` and `PILOT_REPLAY_REPORT` replace the
engine's replay command and its report path. The selftest uses them with `selftest_fake_infra.mjs`; a real run sets none.

## Exit codes

| Code | Meaning                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------- |
| 0    | Every stage in the range is `pass` or `skipped` (dry-run skips and per-charter rejections are normal).     |
| 1    | A stage failed: a deterministic failure, a failed verdict, an invalid artifact, or a budget exceeded.      |
| 2    | Usage error: bad flags, unknown feature, invalid configuration, `--live` with the stub agent.              |
| 3    | Blocked: a precondition is missing (for example `MM_LICENSE`, or the engine cannot read the charter).      |
| 20   | Awaiting an agent result (`--agents=manual`). The task and result paths are printed.                       |
| 21   | An agent result was invalid or stale and was set aside; the task stays open.                               |
| 22   | The agent command failed to run cleanly on every attempt.                                                  |
| 30   | Pending/incomplete: the verification is missing, rejected or unbound (`--verifier=process`). Never a pass. |

## Headless CI entry

The contract a CI workflow can rely on. Everything below is plain Node 24 and needs no install; `doctor` says what is
missing. The workflow supplies `MM_LICENSE` as a secret and pulls the two images by digest before the run (the infra
scripts never pull).

```bash
node explorer-proto/v2/orchestrator/pilot.mjs doctor [--no-docker] [--image <ref@sha256:digest>]
node explorer-proto/v2/orchestrator/pilot.mjs run --target release --live --verifier=process \
  --run-id <id> --image <ref@sha256:digest> \
  --verify-spec explorer-proto/sessions/bookmarks/generated/channels_bookmarks_bar_follows_switch.spec.ts \
  --engine-charter session:bookmarks --control release-bookmark-title-changed
node explorer-proto/v2/orchestrator/pilot.mjs export --run-id <id> --out <dir>
node explorer-proto/v2/orchestrator/pilot.mjs summary --run-id <id> --github >> "$GITHUB_STEP_SUMMARY"
```

- **Image override.** `--image <ref@sha256:digest>` or the environment variable `MATTERMOST_PILOT_IMAGE` (the variable
  `infra/docker-compose.yml` reads). It is validated (a reference without a `@sha256:` digest is exit 2), saved in
  `run.json`, and forwarded to `gate.sh` and `up.sh` through that variable; with an override the orchestrator does not
  pass `--target=` (the infra scripts' `--target=default` would unset the variable), and the verifier process inherits
  the variable. `0-target/attempt-<n>/target.json` and `setup.json` carry the digest actually used, and the static
  check `image_pin_matches_lib_sh` reads `info` (the pin in `lib.sh` is not in effect). Both images must already be
  present locally by digest.
- **Dry run.** `run ... --dry-run` (the default without `--live`) parses every flag and writes `<run>/plan.json`
  (`explorer-run-plan/v1`: target, session, spec hash, control, image source and reference, verifier mode and command,
  stages, the infra and engine commands, the exit-code table) without Docker, and `commands.json`.
- **Exit codes** of `run`: `0` pass, `1` fail, `2` usage error, `3` blocked, `20` awaiting a manual agent result,
  `21` agent result invalid (`--verifier=manual`), `22` agent command failed, `30` pending/incomplete (verification
  missing, rejected, unbound, timed out). Only `0` is a pass.
- **`export --run-id <id> --out <dir>`** (or `--run-dir <dir>`) copies an allowlisted, sanitized subset of the run
  directory: `run.json`, `plan.json`, `commands.json` (the exact commands and their exit codes), `summary.json`,
  `summary.md`, stage 0's `status.json` and every attempt's `attempt`, `setup` (the manifest session summary: session
  name, bookmark titles, fixture fingerprint, no ids, ports or origins), `target` and `target-check`, `baseline.json`,
  `control.json`, `failure-trace.json`, and `verify/` `agent-task.json`, `dispatch.json` (with the task and trace
  hashes, nonce and expected assertion), `process.json`, `agent-result.json` (the verifier report), `collect/`
  `collect.json`, plus the same files of `superseded/after-attempt-<n>/`. Logs, `.state`, `.work`, agent calls,
  symlinks and every other file are never read. Absolute paths become `<run>`, `<repo>`, `<scratch>` or `<path>`.
  `export-manifest.json` lists each file with its sha256, the spec path and hash, the task and trace hashes, the manifest
  session summary and the leak scan. The copy is scanned for unsafe text and, with `infra/scripts/leak_scan.mjs`, for the
  licence (PASS or FAIL only); a FAIL removes the copy (exit 1), and so does a missing `MM_LICENSE` to scan with (exit 3).
  `--out` must be empty or absent and outside the run directory.
- **`summary --run-id <id> --github`** prints a short markdown (verdict, the four rows with who produced them, hashes
  shortened, delivery) for `$GITHUB_STEP_SUMMARY`; without `--github` it prints `summary.md`. It exits 0 whatever the
  verdict (use the exit code of `run`).
- **`doctor`** prints PASS, FAIL or SKIP per item and exits 0 or 3: Node 24 and TypeScript stripping, the
  git-ignored `explorer-proto/node_modules` symlink (`ln -s ../e2e-tests/playwright/node_modules explorer-proto/node_modules`),
  `@playwright/test` at the pinned version, the pinned browser build in the Playwright cache, `MM_LICENSE` present (by
  name only, never its value), the fixed loopback port free (number not printed), and with Docker: server reachable as
  linux/amd64, both images present by digest, no leftover `explorer-pilot` containers. `--no-docker` skips the Docker
  items.

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

Verified by `selftest.mjs` (see the count it prints, about a minute): the stage 0 session seed, resume reuse and
attempts, and the verification of an existing spec end to end against a fake infra stack (S0 to S4, rejection of
inconsistent verifier results, spec hash mismatch); the dry run end to end, no-op rerun, determinism, manual resume,
invalid and stale results, leakage rejection, duplicate rejection and review routing, verdict constraints, the lesson
gate, budgets, the static spec check, the gate registry, the secret scan against a synthetic value, the control judge on
synthetic reports, adopted oracle runs, `cmd:` providers, and the metrics shape.

Run live once on the pinned 12.1.0 stack for the bookmarks session: stage 0 with the session, a `--resume` that reused it
(every stage-0 file keeps its sha256, the manifest keeps its `session` key, the fixture fingerprint is equal), the
baseline, the control with its restore, and the dispatch with the stack stopped (exit 20). Collection of a real
independent result was rehearsed on a copy of that run directory with a synthetic result, not with a verifier.

Not verified by the selftest (nothing here runs Docker): every live path. That is stage 0's `gate.sh` and `up.sh` calls and the
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
