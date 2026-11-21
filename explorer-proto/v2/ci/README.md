# Exploratory pilot CI

`.github/workflows/e2e-tests-exploratory.yml` runs the v2 coordinator headlessly against one digest-pinned Mattermost server image and publishes a sanitized result. Every step calls a script in this directory, so the same sequence runs locally.

**ADVISORY: does not gate merges or releases; existing release checks remain authoritative.** The workflow is standalone, triggers on `workflow_dispatch` only, is not a required check, and its job does not use `continue-on-error`. A pass proves nothing about a release, and a red run blocks nothing.

## Before a real run (human actions)

1. **Register the workflow on the default branch.** GitHub only offers `workflow_dispatch` for a workflow file that exists on the default branch of the repository that runs it. Merging this file into the default branch of the approved pilot repository is a human action; until then the workflow cannot be dispatched, from any branch. After that, `--ref <branch>` runs the workflow file and the coordinator from that branch.
2. **Make the licence secret available.** The repository or organisation secret `MM_E2E_TEST_LICENSE_ONPREM_ENT` must be readable by the pilot repository. It is the secret the other E2E workflows use; they hand it to their jobs as `MM_LICENSE`, and so does this one. It is the Mattermost test-signed licence. A fork or a repository without the secret gets `BLOCKED`, never a pass.
3. **Runner access.** The job runs on `ubuntu-24.04` and needs outbound access for Docker Hub (the two image pulls and the registry digest check), `api.github.com` (commit and tag resolution), npm, the Playwright CDN and the GitHub Actions cache. Nothing needs a registry credential: the images are public.

```bash
gh workflow run e2e-tests-exploratory.yml --ref <branch> \
  -f target_kind=main \
  -f image='mattermostdevelopment/mattermost-enterprise-edition:2d6c285_fc5e259@sha256:ed4bcaa423e09ddc8ddb229bc55c82178d7403299ce800d4a2b0ed79cf8b105c' \
  -f commit_sha=2d6c2852eaebf2e23336332b8feeacf9db0ea0e8
```

## Inputs

| Input                 | Meaning                                                                                                                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `target_kind`         | `main` (a `mattermostdevelopment` dev image of a master commit) or `release` (a `mattermost` release image).                                                                                                                                                                                     |
| `image`               | `<repository>:<tag>@sha256:<64 lowercase hex>`, required. The repository must be the one of the kind: `mattermostdevelopment/mattermost-enterprise-edition` or `mattermost/mattermost-enterprise-edition`. A tag without a digest, a short digest, another registry or another repository fails. |
| `commit_sha`          | `main`: the full 40-character SHA the image was built from. `release`: the release tag, for example `v12.1.0`. Required.                                                                                                                                                                         |
| `test_source_ref`     | Optional full SHA. The compatible test source revision recorded in the facts. Accepted only if its `@playwright/test` pin and `package-lock.json` equal the coordinator revision's (a sparse checkout of just those two files is compared); a different lock is `BLOCKED`, never swapped in.     |
| `session`             | `bookmarks` (the only session that exists). Selects the one generated spec to verify.                                                                                                                                                                                                            |
| `control`             | A control definition under `explorer-proto/v2/orchestrator/controls/`. Allowlisted: `release-bookmark-title-changed`.                                                                                                                                                                            |
| `verifier`            | `process` (default and only value): verification is delivered to deterministic code. No model agent is started.                                                                                                                                                                                  |
| `time_budget_minutes` | Integer 15 to 90, default 45. It is the job `timeout-minutes`; the coordinator gets what is left minus ten minutes for teardown, export, scan, upload and summary.                                                                                                                               |

`check_inputs.mjs` validates all of them from `INPUT_*` environment variables. No input is interpolated into a shell line. The run id is `<session>-<first 12 hex of the digest>-a<run attempt>`, the artifact name `exploratory-<digest short>-<run id>`. The run is serialised per image and session (`concurrency`, `cancel-in-progress: false`).

## Steps

Each step is a separate named step. A stage is recorded in the ledger (`ci-status.json`) by `ci_status.mjs`; the summary lists them in this order.

| Step                                     | Script                                                                | Stage                                         |
| ---------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| `ci/checkout-coordinator`                | `actions/checkout` of the workflow's own `GITHUB_SHA`                 |                                               |
| `ci/check-inputs`                        | `check_inputs.mjs`                                                    | `inputs`                                      |
| `ci/checkout-test-source` (optional)     | `actions/checkout`, sparse, into `.test-source`                       |                                               |
| `ci/run-facts`                           | `run_facts.mjs init`                                                  | `facts`                                       |
| `ci/verify-target`                       | `verify_target.mjs --from-inputs --repo-pin --online`                 | `provenance`                                  |
| `ci/setup-webapp-node-modules`           | `./.github/actions/webapp-setup` (Node from `.nvmrc`, cache restored) |                                               |
| `ci/setup-playwright-workspace`          | `setup_workspace.sh`, then `run_facts.mjs toolchain`                  | `setup`                                       |
| `ci/pull-images`                         | `pull_images.sh`                                                      | `images`                                      |
| `ci/assert-no-capture-config`            | `assert_no_capture.mjs`                                               | `capture-config`                              |
| `ci/containment`                         | `containment.sh`                                                      | `containment`, `containment-journey`          |
| `ci/stack-gate` (licence)                | `stack_gate.sh`                                                       | `gate`, `licence`, `provenance-live`          |
| `ci/coordinator` (licence)               | `run_coordinator.sh`                                                  | `coordinator`                                 |
| `ci/teardown` (always)                   | `explorer-proto/infra/scripts/down.sh`                                | `teardown`                                    |
| `ci/export` (always)                     | `export_run.sh`                                                       | `export`, `capture-export`                    |
| `ci/leak-scan` (always, licence)         | `explorer-proto/infra/scripts/leak_scan.mjs`                          | `leak-scan`                                   |
| `ci/upload-export` (always, scan passed) | `actions/upload-artifact`, the export directory only                  |                                               |
| `ci/final-summary` (always)              | `final_summary.mjs`                                                   | writes the job summary and sets the exit code |

What the steps do:

- **Revisions** (`run_facts.mjs`). The _target commit_ is the input. The _coordinator revision_ is `GITHUB_SHA`, the tree the workflow runs from (the coordinator, the infra scripts and the specs live there, not at a master commit). The _compatible test source revision_ defaults to the coordinator revision. They go to `run-facts.json`.
- **Setup** (`setup_workspace.sh`). The Node version must equal `.nvmrc`. `npm ci` runs in `e2e-tests/playwright` with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, exactly as the Playwright template does it, then `git diff --exit-code` over every `package-lock.json`, then `npx playwright install chromium` (never firefox, webkit or `--with-deps`, never a global install), then the git-ignored `node_modules` symlink in `explorer-proto` (to the Playwright workspace's). `run_facts.mjs toolchain` records the Playwright version and the Chromium and headless shell revisions from `playwright-core/browsers.json`, checks the build directories exist, and blocks if the version or revision differs from the target pin (`explorer-proto/v2/targets/main.json`, `explorer-proto/v2/orchestrator/targets/release.json`).
- **Images** (`pull_images.sh`). `docker pull --platform linux/amd64` of the input image and of `postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5`, then `RepoDigests` must carry the requested digest and the platform must be linux/amd64. The script also refuses if the PostgreSQL pin in `explorer-proto/infra/scripts/lib.sh` differs from the one it expects.
- **Capture off** (`assert_no_capture.mjs`). `screenshot`, `video` and `trace` must each be `'off'` in `explorer-proto/playwright.config.ts` and not set in the repo `chrome` project. After the export, no png, jpg, gif, webp, webm, mp4, zip, trace, network or har file and no symlink may be in it.
- **Containment** (`containment.sh`). `node explorer-proto/src/cli.ts guard-check` and `guard-journey --journey=auto-follow`. They start their own loopback servers, need no Docker and run without the licence in the environment.
- **Stack gate** (`stack_gate.sh`). `MATTERMOST_PILOT_IMAGE=<input image>` and `explorer-proto/infra/scripts/gate.sh --keep` (isolation and licence gate). The licence check is the gate's own `IsLicensed === 'true'` line, recorded as PASS or FAIL. With the stack still up, `verify_target.mjs live` compares the server's own build hash. Then `down.sh`, so the coordinator starts from a clean stack (it runs the gate and the seed itself).
- **Coordinator** (`run_coordinator.sh`). See [Coordinator contract](#coordinator-contract).
- **Teardown first.** `down.sh` runs right after the coordinator (also after a failure or a cancel), before the export, so the container that holds the licence stops as early as possible and the teardown result is in the uploaded facts. The coordinator also tears the stack down itself; `down.sh` is idempotent.
- **Export and scan.** `export_run.sh` writes the coordinator's sanitized export plus `ci/` (run facts, stage ledger, provenance) into one directory. The leak scan covers that directory and the coordinator's summary file. The upload step runs only if the export succeeded and the scan passed (an unset licence makes the scan `BLOCKED`, which also withholds the upload). Only that directory is uploaded, 14 days. Hidden files are not uploaded (the action default).
- **Summary** (`final_summary.mjs`). Target commit, image digest, coordinator revision, test source revision, Playwright version, Chromium revision, licence check (PASS, FAIL or BLOCKED, never a value), the stage table, the verifier delivery mode, the spec hash flag (the sha256 of the verified spec at the start against now), the teardown result, the coordinator's own summary (only after a passing leak scan) and the advisory sentence. It exits 0 for PASS, 3 for BLOCKED, 30 for PENDING and 1 otherwise, so the job result follows the ledger even if every earlier step exited 0.

## Provenance

`verify_target.mjs` fails closed: exit 3 and `status: blocked` unless the commit-to-image association is established. It never passes on missing data.

**What the repository offers.** There is no queryable build record in the repository or in the workflows. What exists:

1. The tag convention. Main images are tagged `<mm sha[0:7]>_<enterprise sha[0:7]>` by the delivery pipeline (`.github/e2e-tests-workflows.md`; `explorer-proto/v2/targets/main.json` is an example) or `<mm sha[0:7]>` by the Enterprise CI job (`TAG="${MM_SHA:0:7}"` in the enterprise repository's `ci-template.yml`). Release images are tagged with the release version (the release tag without its `v`).
2. The digest the tag resolves to. Offline, from a build record: `explorer-build-record/v1` (`repository`, `tag`, `digest`, `commit_sha`, `release_tag` for a release, `source`) or a repository target pin (`explorer-proto/v2/targets/main.json`, `explorer-proto/v2/orchestrator/targets/release.json`, reviewed by a human). Online, from the Docker Hub registry API (`--online`): the tag must resolve to the input digest. A GitHub API call confirms that a main commit exists in `mattermost/mattermost`, and resolves a release tag (annotated tags included) to its commit.
3. After the stack is up, the server inside the image reports its own `BuildHash` (and `BuildHashEnterprise`, `Version`) at `GET /api/v4/config/client?format=old` on loopback. It must equal the target commit (main), the enterprise short sha of the tag, and for a release the tag's version. `explorer-proto/infra/INTERFACE.md` records this was observed on the main image.

**Decision.** The tag must embed the commit (any other tag, such as `master`, is refused). At least one source must bind the digest: a matching build record or the online registry check. Any definite contradiction (another digest, another commit, a missing tag or commit) is a mismatch and blocks, even if another source agrees. An unavailable network, a rate limit or a missing record is "unverifiable" and blocks too. A release must also be resolved to a commit by a record or the GitHub API, or it blocks. The CI step uses the repository pin of the kind as the offline record and the registry as the online one, so an already approved image passes without a network and a new one needs Docker Hub.

**Limits.** Tags are mutable and the registry attests no commit: sources 1 and 2 say that the tag that embeds the commit has this digest. Source 3 is what ties the bytes to the commit, and it can only run once the stack is up. A build record is as trustworthy as whoever wrote it. Source 3 for a release (`BuildHash` equal to the tag's commit) was not observed on a release image; if it differs, the run is blocked and a human decides.

## Secrets and permissions

| Step                                              | Receives                                            | As                                  |
| ------------------------------------------------- | --------------------------------------------------- | ----------------------------------- |
| `ci/stack-gate`, `ci/coordinator`, `ci/leak-scan` | secret `MM_E2E_TEST_LICENSE_ONPREM_ENT`             | environment variable `MM_LICENSE`   |
| `ci/verify-target`                                | `github.token` (read access to public repositories) | environment variable `GITHUB_TOKEN` |
| every other step                                  | nothing                                             |                                     |

- `permissions: {}` for the workflow and `contents: read` for the one job. Nothing else: no statuses, no id-token, no write.
- The licence is only an environment variable of the steps that start the stack, run the coordinator, or scan for the licence. It is never in a `run` line, an action input, a file or an `echo`, and never at job level. `leak_scan.mjs` works in memory and prints PASS or FAIL only. Nothing derives a value from it, so there is nothing to `::add-mask::`; adding a derived value later must come with a mask.
- The orchestrator is a test executor, not an agent: **no model agent is started**, so no agent credential exists in this workflow. If a model-assisted review is ever added, it must be a separate job with its own secret, a read-only artifact input (the uploaded export) and no licence. None is added here.
- The secret is `MM_E2E_TEST_LICENSE_ONPREM_ENT` rather than a secret literally named `MM_LICENSE` because that is the name the E2E callers (`e2e-tests-on-merge.yml`, `e2e-tests-on-release.yml`) read; `MM_LICENSE` is the name of the environment variable and of the reusable-workflow secret input.
- Network: the loopback-only isolation (an internal Docker network, the loopback forwarder, the exact-origin guard) applies to the test runtime only. The setup steps (checkout, caches, `npm ci`, the Playwright download, `docker pull`, the registry and GitHub API checks) use the network.

## Coordinator contract

`run_coordinator.sh` runs exactly:

```bash
node explorer-proto/v2/orchestrator/pilot.mjs run --target <kind> --live --verifier=process --image <ref@digest> \
  --run-id <id> --verify-spec <spec> --engine-charter session:<session> --control <control>
```

and `export_run.sh` calls `pilot.mjs export --run-id <id> --out <dir>` and `pilot.mjs summary --run-id <id> --github`. Exit codes: 0 PASS; 1 FAIL; 3 BLOCKED; 30 PENDING (incomplete); 20, 21 and 22 (agent exits) are FAIL because `--verifier=process` starts no agent; 2 and anything else FAIL; a timeout is FAIL. Every non-zero code fails the step with an error annotation, and the summary names it. The command lives in one place so the "Headless CI entry" section of the orchestrator README can be followed by editing that one script.

The coordinator contract (`--verifier=process`, `--image`, `export`, `summary --github`, `doctor`) was coded against the task statement; it had not landed in `pilot.mjs` when this was written. `doctor` is not called.

## Conventions copied from the existing workflows

| Convention                                                                                                                         | Copied from                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd` (v6.0.2), `persist-credentials: false`                                 | every E2E workflow, for example `e2e-tests-playwright-template.yml`                                                                                             |
| `actions/upload-artifact@bbbca2ddaa5d8feaa63e36b76fdaad77386f024f` (v7.0.0)                                                        | `e2e-tests-playwright-template.yml`, `server-ci.yml`                                                                                                            |
| `./.github/actions/webapp-setup` (it pins `actions/setup-node@6044e13b5dc448c55e2357c09f80417699197238` v6.2.0 and reads `.nvmrc`) | `e2e-tests-playwright-template.yml` (`ci/setup-webapp-node-modules`)                                                                                            |
| `ubuntu-24.04`                                                                                                                     | every E2E workflow. A floating `ubuntu-latest` would move the Docker and kernel under a pinned image; the server images are linux/amd64 only, as this runner is |
| `permissions: {}` at the top, `contents: read` on the job                                                                          | `e2e-tests-on-merge.yml`, `e2e-tests-on-release.yml`                                                                                                            |
| `MM_E2E_TEST_LICENSE_ONPREM_ENT` mapped to `MM_LICENSE`                                                                            | `e2e-tests-on-merge.yml`, `e2e-tests-on-release.yml`                                                                                                            |
| `ci/<name>` step names, `INPUT_*` environment variables instead of expressions in `run`                                            | `e2e-tests-on-merge.yml`, `e2e-tests-ci.yml`                                                                                                                    |
| `npm ci` with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, then `npx playwright install chromium`                                         | `e2e-tests-playwright-template.yml` (`ci/install-playwright-deps`, `ci/install-playwright-chromium`)                                                            |
| `concurrency` with `cancel-in-progress: false`                                                                                     | `e2e-tests-playwright.yml`                                                                                                                                      |

The file name matches the glob of `e2e-tests-status-wiring.yml`, so that check runs when this file changes. Its tests read every `e2e-tests-*.yml` for `jobs.<job>.steps` and the lane-reader inputs; this workflow has none of those and `lint_workflow.mjs` emulates the same assumptions.

## What is implemented, verified locally, and verified only in CI

| Part                                                                                                                                             | Implemented | Verified locally by `selftest.mjs`                  | Only verifiable in CI or live                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| Input validation, run id                                                                                                                         | yes         | yes, including hostile values                       |                                                                     |
| Provenance: convention, record, online (loopback stubs), live                                                                                    | yes         | yes, every blocked path                             | the real Docker Hub and GitHub API responses; a release `BuildHash` |
| Run facts, toolchain pin checks                                                                                                                  | yes         | yes, on synthetic trees; init on the real checkout  | the real Playwright install and browser cache                       |
| No-capture assertion                                                                                                                             | yes         | yes, real config and mutants                        |                                                                     |
| Stage ledger, summary, exit mapping                                                                                                              | yes         | yes                                                 |                                                                     |
| Coordinator mapping, stack gate and export scripts                                                                                               | yes         | yes, with a fake coordinator and fake infra scripts | the real coordinator and a real stack                               |
| Leak scan wiring                                                                                                                                 | yes         | yes, with a synthetic value                         |                                                                     |
| Workflow structure, pins, secrets map, permissions, thin steps                                                                                   | yes         | yes, `lint_workflow.mjs` and 28 mutants             | that GitHub accepts the file and runs the steps                     |
| `npm ci`, lock guard, Chromium install, `docker pull`, the gate, containment checks on the runner, upload, retention, `workflow_dispatch` itself | yes         | `bash -n` and `--dry-run` only (printed, not run)   | everything                                                          |

## Run the same sequence locally

No GitHub is needed for the offline parts. The state directory is `EXPLORER_CI_DIR` (default: `ci` in the git-ignored `.run` directory of the infra directory).

```bash
node explorer-proto/v2/ci/selftest.mjs                 # every script, offline
node explorer-proto/v2/ci/lint_workflow.mjs --secrets-map

export INPUT_TARGET_KIND=main INPUT_SESSION=bookmarks INPUT_VERIFIER=process INPUT_TIME_BUDGET_MINUTES=45
export INPUT_CONTROL=release-bookmark-title-changed INPUT_TEST_SOURCE_REF=
export INPUT_IMAGE='<repo:tag@sha256:digest>' INPUT_COMMIT_SHA='<sha>'
node explorer-proto/v2/ci/check_inputs.mjs
node explorer-proto/v2/ci/run_facts.mjs init
node explorer-proto/v2/ci/verify_target.mjs --from-inputs --repo-pin --online   # --dry-run: offline checks only
bash explorer-proto/v2/ci/setup_workspace.sh --dry-run
bash explorer-proto/v2/ci/pull_images.sh --dry-run
node explorer-proto/v2/ci/assert_no_capture.mjs
bash explorer-proto/v2/ci/containment.sh --dry-run
bash explorer-proto/v2/ci/stack_gate.sh --dry-run
bash explorer-proto/v2/ci/run_coordinator.sh --dry-run
bash explorer-proto/v2/ci/export_run.sh --dry-run
```

Without `--dry-run` the shell scripts do what the workflow does (Docker, `npm ci`, the stack); the two that need the licence read `MM_LICENSE` from the invoking shell, which a person exports, as `explorer-proto/README.md` says. A human approves starting a live run and any download by digest; running the workflow is that decision.

## Files

| File                                                                  | Role                                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `lib.mjs`                                                             | Constants (pins, allowlists, stages) and helpers.                |
| `check_inputs.mjs`                                                    | Validates the dispatch inputs.                                   |
| `run_facts.mjs`                                                       | Revisions and toolchain facts.                                   |
| `verify_target.mjs`                                                   | Provenance, offline, online and live.                            |
| `assert_no_capture.mjs`                                               | Screenshot, video and trace off; no capture files in the export. |
| `ci_status.mjs`                                                       | Stage ledger and the `run` wrapper.                              |
| `final_summary.mjs`                                                   | Job summary and exit code.                                       |
| `ci_lib.sh`, `setup_workspace.sh`, `pull_images.sh`, `containment.sh` | Shell helpers and the setup, image and containment steps.        |
| `stack_gate.sh`, `run_coordinator.sh`, `export_run.sh`                | The licence-bearing steps and the export.                        |
| `lint_workflow.mjs`                                                   | Offline workflow lint and the per-step secrets map.              |
| `selftest.mjs`, `fixtures/`                                           | The offline test suite and its fixtures.                         |
