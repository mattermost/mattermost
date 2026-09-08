# Mattermost triage callers

These workflows run in shadow mode and never merge a PR or write an E2E success status. The existing manual approval workflow remains authoritative. Master failures are observations, not proof of PR innocence.

## Activation

Land the reviewed scripts/workflows on master first. The mechanical policy uses `pull_request_target`, checks out the exact trusted base SHA, and reads the PR commit only as Git data; its first bootstrap PR cannot exercise a policy that is not on its base yet. Require the `E2E Mechanical Edit Policy / policy` check after that bootstrap. No PR source, install hook, artifact, or candidate policy is executed by this privileged event.

Configure repository variables:

- `MM_TRIAGE_ENABLED=true`: diagnosis on failed workflow completion and every 15 minutes.
- `MM_TRIAGE_REPAIR_ENABLED=true`: latest eligible master discovery followed by one claimed repair; every 15 minutes or manual dispatch.
- `MM_TRIAGE_TSIO_URL`: trusted API URL ending `/api/v1` (choose staging explicitly for shadow rollout).
- `MM_TRIAGE_SET_STATUS`: defaults `false`; `true` fails explicitly during shadow-v1. There is no success-status implementation or permission.
- `MM_TRIAGE_PROVIDER=openai` and `MM_TRIAGE_MODEL`: an enabled model supporting Responses structured JSON output. This Guardian provider is independent of the existing Cursor diagnosis workflow.
- `MM_TRIAGE_CLEAN_RUNS`: defaults 5, minimum 3, maximum 20.

Secrets and trust:

- Prefer GitHub OIDC, audience `mattermost-test-system-io`. Allow the exact master workflow refs `mattermost/mattermost/.github/workflows/e2e-triage-shadow.yml@refs/heads/master` and `mattermost/mattermost/.github/workflows/e2e-triage-repair.yml@refs/heads/master` in server `TSIO_TRIAGE_WORKFLOW_REFS`. The server also enforces repository/ref and workflow trust.
- Alternatively, set dedicated `TSIO_TRIAGE_API_KEY`; callers send `X-Triage-Key`. Ordinary report-upload credentials are insufficient.
- Guardian requires `MM_TRIAGE_OPENAI_API_KEY`. It makes real calls to the [OpenAI Responses API structured outputs interface](https://platform.openai.com/docs/guides/structured-outputs). It sends the single test source and reproduction evidence; the provider has no tools or workspace authority. It first returns `repair`, `product_suspect`, or `blocked`. Only `repair` permits a second source-replacement request.
- `MM_E2E_TEST_LICENSE_ONPREM_ENT` is required when the recorded run had a license. The provider and isolated candidate process never receive the license; the original trusted setup installs it on the test server.
- Optional `MM_TRIAGE_GITHUB_TOKEN` is a GitHub App/user token with contents/PR write access. Without it, the workflow token must be permitted to create PRs; PR events created by `GITHUB_TOKEN` do not start other workflows, so a human must initiate any additional PR CI. Neither token can authorize automatic merge here.
- Add real E2E owners to trusted `CODEOWNERS`. The repository currently has no E2E owner rules. Discovery fails visibly rather than inventing an owner. Repair queue tickets are optional; quarantine remains governed by the separate mandatory owner/ticket/expiry API.

## Evidence and execution

Discovery reads complete, nontruncated master reports and asks the server to derive the failed test identity. It verifies the exact GitHub merge workflow run/attempt and master ancestry. The API additionally requires immutable verified master upload provenance and a pullable recorded `server_image_digest`/`image_digest`. It rejects unsupported/ambiguous identities. Only the newest observed `(framework, suite, stable_key)` is enqueued. Existing product-suspect observations go directly to the deduplicating defect endpoint, including uncertain Jira submission reconciliation; they never enter test repair again.

The workflow revision and tested commit are separate identities: master E2E uses `workflow_dispatch`, whose `inputs.commit_sha` can differ from the workflow's GitHub/OIDC SHA. Every report shard must carry the same verified source workflow revision, repository, ref, run, attempt, workflow and event; any Begin receipt supplying the shard count must match these claims and the immutable tested commit. The server returns that revision as `source_workflow_sha`. Guardian compares it to the source GitHub run's `head_sha`, then independently checks the tested commit's master ancestry. Existing queued items without this source field stop explicitly and need fresh evidence; historical rows are not retrospectively attested.

The controller atomically claims work and renews its lease every 30 seconds. It checks out the recorded master test commit into an isolated directory and validates current CODEOWNERS. It pulls the recorded server image by digest, checks its architecture and the image ID of the actual running server, and requires the recorded framework version. Mutable image tags and bare local image IDs are rejected.

The supported runtime is a nonroot Linux x64 GitHub runner with Docker. Playwright uses the repository's original Testcontainers setup; Cypress uses `make cloud-init` and `make start-server` with the recorded service set. Cloud-server runs and unknown frameworks/projects fail explicitly. Playwright Chrome, Firefox and iPad projects are supported; Cypress supports the recorded default Electron project. A trusted Cypress wrapper carries allowlisted Compose bootstrap/expose settings into the current Cypress configuration. A trusted Playwright wrapper preserves project/test/use settings and disables its global setup after the host has prepared the exact stack.

Every reproduction/verification test executes in a fresh Docker container with no host PID access, Docker socket, controller credentials, or writable source. The trusted checkout and bounded candidate source are read-only mounts; only that run's result/runtime folders are writable. The container runs as the runner's nonroot UID, with a read-only root filesystem, dropped capabilities and `no-new-privileges`. Playwright service-mutation tests that require Docker inside the test cannot use this isolated harness and fail/skip explicitly; skipped results never verify a repair. The runner image digest is resolved from the framework-pinned Playwright image or the existing Cypress Compose runner and recorded separately.

The original failure must reproduce in the claimed test. Verification then requires N independent clean stack/test runs, retry overrides set to zero, one actual attempt per test, no skipped/interrupted tests, and unchanged nonempty test identities. Cypress results are joined to the actual `after:spec` attempt sidecar; missing/ambiguous sidecars fail. Report reads must stay inside their bounded artifact directory. Reports, image digests, diagnosis, policy annotations and PR receipts are uploaded for human review. This implementation has protocol/fixture tests; it has not yet been exercised against a live credentialed Linux repair run.

The mechanical CI policy blocks syntactic skips/only/fixme, new skip/ignore tags, arbitrary waits/timers, removed tests/assertions and raised literal timeout/retry settings. Matcher/expected-value changes, dynamic control flow and other semantic changes are annotated for human review. Guardian's stricter mode additionally refuses changed assertions and timeout/retry settings. This policy is not a proof of semantic safety; every repair still requires human review.

PR publication uses one deterministic branch per queue item. Each GitHub mutation checks live lease ownership and is cancellable. Uncertain ref/PR responses are reconciled with GET rather than blindly creating another PR. Once a PR exists its receipt is persisted before the reviewer request, so a review-request failure does not requeue it. Unresolved publication uncertainty stays visible for reconciliation. Branches and reused PRs must retain the recorded test commit as their sole parent. Master must still equal that verified commit when publication begins, before PR creation, and before recording the receipt; a matching spec alone cannot establish that its fixtures, setup or product behavior stayed unchanged. Even unrelated master merges currently require fresh evidence and revalidation. A GitHub ref can still advance after the last read; human review and normal PR CI remain required.

A product-suspect decision first completes the repair claim terminally, then invokes the defect endpoint. It invokes no patch provider or test edit and leaves the test red. Jira uncertainty remains an API-owned reconciliation state; the caller never infers resolution from a local copy. The metrics step reads actual GitHub PR state and reports observed opened/merged/open/closed-without-merge counts; truncated queue results are labeled as a subset. No escaped-release metric is inferred.

## Local checks

Install TypeScript 6.0.3 in a temporary directory (or use an existing trusted installation), then run:

```sh
TRIAGE_TYPESCRIPT_PATH=/absolute/path/to/typescript/lib/typescript.js node --test .github/scripts/triage-*.test.mjs
actionlint .github/workflows/e2e-triage-*.yml
```

These checks do not create external PRs, call a provider, submit Jira issues, or merge anything.
