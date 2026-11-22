# CI status of the exploratory pilot workflow

Workflow: `.github/workflows/e2e-tests-exploratory.yml`. Scripts: this directory. Advisory only: it gates nothing.

The two sections below are kept apart on purpose. Nothing in the first is evidence for the second.

## Locally verified

Run from the repository root on branch `cursor/bc-67b5df99-81ef-47d3-abb4-8c0edd6a5796-477f` (Node v24.11.1). No Docker container was started, nothing was pulled, installed or downloaded, and no licence value was read or printed (`MM_LICENSE` was removed from the environment of the selftest children and of the `doctor` run below).

| Check                                                                                         | Command                                                                                                      | Result                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline selftest                                                                              | `node explorer-proto/v2/ci/selftest.mjs`                                                                     | **75 passed, 0 failed** (64 before this change)                                                                                                                                                                                                                       |
| Workflow structure lint on the real YAML                                                      | `node explorer-proto/v2/ci/lint_workflow.mjs`                                                                | `lint: PASS`; **31 unsafe mutants rejected** (28 before; added: old 45 minute default, export without the licence, licence in the teardown); the lint also fails a licence step that does not receive the licence                                                     |
| Per-step secrets map                                                                          | `node explorer-proto/v2/ci/lint_workflow.mjs --secrets-map`                                                  | `ci/stack-gate`, `ci/coordinator`, `ci/export`, `ci/leak-scan`: `MM_LICENSE` from `secrets.MM_E2E_TEST_LICENSE_ONPREM_ENT`; `ci/verify-target`: `GITHUB_TOKEN` from `github.token`; every other step, including the verifier (not a step), receives nothing directly  |
| Entry contract                                                                                | `node explorer-proto/v2/ci/check_entry_contract.mjs`                                                         | `PASS`. Flags used: `run`: `--target --live --verifier --run-id --verify-spec --engine-charter --control --image --verifier-timeout`; `export`: `--run-id --out`; `summary`: `--run-id --github`; `doctor`: `--image`. 10 mutants (unknown flag, test flag, ...) fail |
| Real orchestrator dry run, exact flags of the task                                            | `pilot.mjs run --target release --dry-run --verifier=process --run-id ci-local-dry --verify-spec <spec> ...` | exit 0; `0-target pass`, `1-baseline`, `2-control`, `verify`, `collect` `skipped: not live`; run directory removed afterwards                                                                                                                                         |
| Real orchestrator accepts the workflow's own `run` command (as a dry run, in the selftest)    | `--live` swapped for `--dry-run`, `--out <tmp>`                                                              | exit 0; `plan.json` has `image.source: override`, the 12.1.0 digest, `verifier.mode: process`, `verifier.timeout_seconds: 2280`; infra `gate.sh`/`up.sh` commands carry no `--target`; `--target main`, a digestless image and a zero timeout each exit 2             |
| Real `export` and `summary --github` on a fixture run directory (selftest, synthetic licence) | `export_run.sh` against a dry-run directory                                                                  | export has `run.json`, `plan.json`, `commands.json`, `export-manifest.json` (leak scan PASS/PASS), `ci/`; summary starts `### Explorer pilot: INCOMPLETE`; no licence: exit 3, nothing exported; a leaking value: exit 1; no run directory: `SKIPPED`                 |
| `pilot.mjs doctor --no-docker`                                                                | `env -u MM_LICENSE node explorer-proto/v2/orchestrator/pilot.mjs doctor --no-docker`                         | exit 3, 5 PASS, 2 FAIL, 4 SKIP (below)                                                                                                                                                                                                                                |
| Workflow script sequence under `--dry-run`                                                    | `check_inputs`, `run_facts init`, `verify_target --dry-run`, then each script with `--dry-run`               | all exit 0, every command printed, no tool invoked (the selftest puts failing `docker`, `npm`, `npx`, `curl` stubs first on `PATH` and checks none was called); `target_kind=main` exits 2 at the inputs step                                                         |
| Prettier (repo config `e2e-tests/playwright/.prettierrc.json`)                                | `prettier --check explorer-proto/v2/ci/*.mjs explorer-proto/v2/ci/README.md`                                 | clean. The workflow YAML is not Prettier-formatted in this repository (it keeps two spaces before the pin comment); the changed lines follow the file's style                                                                                                         |
| `actionlint`, `yamllint`                                                                      | `which actionlint yamllint`                                                                                  | **absent**; not installed. `lint_workflow.mjs` (parsed with the `yaml` package) is the only structural check, and it does not validate GitHub expression syntax                                                                                                       |
| ESLint                                                                                        | not run                                                                                                      | needs the `/tmp` mirror described in the orchestrator README                                                                                                                                                                                                          |

`doctor --no-docker` items, locally:

| Item                                  | Result | Why                                                                                                                                                                                                                                                               |
| ------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| node version, TypeScript stripping    | PASS   | Node v24.11.1                                                                                                                                                                                                                                                     |
| `@playwright/test` version            | PASS   | 1.62.1, the pin                                                                                                                                                                                                                                                   |
| browser build                         | PASS   | `chromium_headless_shell-1234` is in the Playwright cache of this machine                                                                                                                                                                                         |
| fixed pilot port free                 | PASS   |                                                                                                                                                                                                                                                                   |
| `explorer-proto/node_modules` symlink | FAIL   | not created here (`setup_workspace.sh` creates it on the runner; no install or link was made in this task)                                                                                                                                                        |
| `MM_LICENSE` present                  | FAIL   | deliberately not exported for this run; on the runner the coordinator step receives it                                                                                                                                                                            |
| four Docker items                     | SKIP   | `--no-docker`. A first, full `doctor` was run once by mistake and made read-only Docker queries (`version`, `image inspect`, `ps`): the Docker daemon is reachable here, the two images are not present, no pilot container exists. Nothing was started or pulled |

The workflow runs `doctor` without `--no-docker`, so on the runner the Docker items are real, after `pull_images.sh` and the stack gate's teardown.

### What the local checks do not show

- The real `pilot.mjs run --live` was not run: it needs Docker, the two images and the licence.
- The verifier timeout the workflow passes (2280 s) was never exercised live (the orchestrator verified its default, 1500 s). The image override (`--image`) was only exercised offline.
- The time budget is arithmetic over the orchestrator's budgets, not a measurement.

## Live GitHub Actions evidence

**NONE.** No run of this workflow exists.

Read-only checks from this repository, with `gh` authenticated (no dispatch, no push, no secrets listed):

- `origin` is `mattermost/mattermost` (default branch `master`). The workflow file is on branch `cursor/bc-67b5df99-81ef-47d3-abb4-8c0edd6a5796-477f` only.
- `gh workflow list --all` shows no `e2e-tests-exploratory.yml`; `gh run list --workflow e2e-tests-exploratory.yml` answers HTTP 404 "workflow not found on the default branch"; `gh api .../contents/.github/workflows/e2e-tests-exploratory.yml?ref=master` is 404.
- Which repository is the approved pilot repository is not stated in the repository, so whether a fork carries the file cannot be told from here.

A `workflow_dispatch` cannot run until the file is on the default branch of the approved pilot repository. Registering it there is a human action that the requester said is done or will be done; it cannot be verified from this checkout, and nothing here claims it.

### Dispatch steps

1. Confirm the workflow is listed (`gh workflow list` in the pilot repository) and that the secret `MM_E2E_TEST_LICENSE_ONPREM_ENT` is readable there.
2. Release run against 12.1.0 (the only kind the coordinator accepts today):

    ```bash
    gh workflow run e2e-tests-exploratory.yml --ref <branch-or-default> \
      -f target_kind=release \
      -f image='mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7' \
      -f commit_sha=v12.1.0
    ```

    The other inputs keep their defaults (`session=bookmarks`, `control=release-bookmark-title-changed`, `verifier=process`, `time_budget_minutes=120`).

3. Main run against the main pin: inputs would be `target_kind=main`, `image=mattermostdevelopment/mattermost-enterprise-edition:2d6c285_fc5e259@sha256:ed4bcaa423e09ddc8ddb229bc55c82178d7403299ce800d4a2b0ed79cf8b105c`, `commit_sha=2d6c2852eaebf2e23336332b8feeacf9db0ea0e8`. **It fails at `ci/check-inputs` today**, by design: `pilot.mjs run --verify-spec` exits 2 for `--target main`. A dispatch of it proves only that guard, not Phase 1. It becomes runnable when the orchestrator accepts `--target main` and `COORDINATOR_TARGET_KINDS` in `lib.mjs` is extended.

### What to look for

Count the live run as reproducing Phase 1 (`bookmarks-handoff-3`) only if all of this holds.

In the job summary:

- `Overall: PASS`, and every stage `PASS`, including `Coordinator preflight (pilot.mjs doctor)` (detail `exit 0: N PASS, 0 FAIL, ...`) and `Coordinator run (pilot.mjs run)` (`exit 0: the coordinator run passed`).
- Image digest `sha256:059c6ae2...ade0e7`, target commit `v12.1.0`, provenance `verified, live verified`, run id `bookmarks-059c6ae272a7-a1`, `Spec hash unchanged: yes`, verifier delivery `process`.
- The coordinator summary block (shown only after the leak scan passed): `Explorer pilot: PASS`, the failing assertion of the verification control at line 45, all rows PASS, and `Delivery: process; ... nonce echo matches: yes; task and trace hashes equal on both sides: yes`.

In the uploaded artifact `exploratory-059c6ae272a7-bookmarks-059c6ae272a7-a1`:

- `export-manifest.json`: `verdict: pass`, `leak_scan` `PASS`/`PASS`, non-null `task_sha256` and `trace_sha256`, `spec.sha256` equal to the sha256 of `channels_bookmarks_bar_follows_switch.spec.ts` in the dispatched revision, `manifest_session` with the bookmarks session and both charter titles.
- `run.json` with the image override and `verifier_timeout_seconds: 2280`; `plan.json` with `image.source: override`; `verify/process.json`, `verify/agent-result.json`, `verify/dispatch.json`, `collect/collect.json`; `commands.json` with exit codes 0.
- `ci/ci-status.json` all `PASS`; `ci/run-facts.json` with the three revisions; no png, webm, zip, trace or har file.

A first live run is also the first live check of `--image` and of a 2280 s verifier timeout. A `BLOCKED` or `PENDING` result is a finding about the run, never a pass, and does not reproduce Phase 1. The interruption, resume and lost-fixture recovery of Phase 1 are not part of a CI run.

## Design limits and deviations

- **Provenance.** `verify_target.mjs` fails closed, but tags are mutable and the registry attests no commit. It establishes that the tag embeds the commit and that the tag resolves to the input digest (repository target pin as the offline record, Docker Hub as the online one, GitHub API for the commit or tag). Only the live `BuildHash` of the running server ties the bytes to the commit, and that runs after the stack is up. For a release the `BuildHash` check was never observed on a release image; if it differs the run is `BLOCKED` and a human decides. A build record is as trustworthy as whoever wrote it.
- **Runner label.** `ubuntu-24.04`, the label the other E2E workflows use. A floating `ubuntu-latest` would move Docker and the kernel under a pinned image, and the Enterprise 12.1.0 and dev images are linux/amd64 only, as this runner is. A self-hosted runner is not used.
- **`main` is not runnable.** Described above; it needs an orchestrator change, outside this task.
- **Licence on four steps, not three.** `pilot.mjs export` scans its copy with the licence and fails closed (exit 3, copy removed) without `MM_LICENSE`, so `ci/export` receives it in addition to the stack gate, the coordinator and the leak scan. `doctor` runs inside the coordinator step and needs no step of its own.
- **Credential separation.** The verifier (`--verifier=process`) is a child process of `pilot.mjs run`, inside the `ci/coordinator` step; it inherits the same `MM_LICENSE`, which it uses only to start its own stack through the infra scripts. It is not a separate credential domain. The "separate agent credentials from the test executor" requirement is met only because no model agent exists in this workflow, so no agent credential is in play.
- **Release metadata.** A release other than 12.1.0 runs, but the orchestrator's records still describe `targets/release.json`.
- **Time budget.** 45 minutes is not feasible: worst case 112 minutes (20 setup, 82 coordinator budgets, 10 teardown and export). Default 120, minimum 100, maximum 180. See the README's "Time budget".
