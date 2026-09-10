# Mattermost E2E triage and master repair

These workflows run in shadow mode and never merge a PR or write an E2E success status. The existing manual approval workflow remains authoritative. Master failures are observations, not proof of PR innocence.

The delivery scope is two outcomes: evidence-backed automatic clearance of unrelated PR E2E failures, and periodic verified test repairs proposed as PRs. The first is not implemented by the current shadow policy. The repair implementation below still needs credentialed live acceptance and default-branch activation. Impact Gate, Test Analysis integration and Jira are not dependencies of these two workflows.

As checked on 10 September 2026, neither outcome is ready for a working-system demo. The new workflows are absent from Mattermost master. Staging is healthy, but its master reports lack the recorded environment and verified upload source required for reproduction. Production has current reports but not the new evidence API. A live PR with failures is an investigation example, not a successful automatic waiver. The existing repair provider also needs an authorized CI credential; finding an available credential does not enable or validate that provider.

## Analyze a PR by number

After this workflow is reviewed and merged to master, open **Actions → E2E PR Triage → Run workflow**, select master and enter `pr_number`, for example `38407`. The equivalent command is:

```sh
gh workflow run e2e-triage-shadow.yml --repo mattermost/mattermost --ref master -f pr_number=38407
```

This manual path supports same-repository and fork PRs through GitHub's read APIs. It executes the selected workflow's scripts and never checks out or executes the target PR. It needs only the workflow's read-only GitHub token. Cursor, a model credential and a TSIO write key are not required. Empty input retains the existing recent-failure reconciliation path and its activation flag.

The job saves `analysis.md` and `analysis.json` as an artifact and writes the human-readable result to its job summary. It reads the current PR head/base, paginated changed files and latest E2E commit statuses/check runs. It follows supported Cypress/Playwright enterprise/FIPS report links to production or staging and binds the full tested commit, workflow run and attempt. Older report links without an attempt are accepted only when GitHub confirms the original attempt. Changed heads, statuses or workflow attempts invalidate the result. Incomplete/binary/oversized patches are labeled, never presented as a complete diff.

It preserves original failures and verifies worker-report counts independently. Orchestration's final execution determines whether a test still fails or survived a retry, including retries on another worker. If orchestration is missing, raw report outcomes describe only that worker. Production's older consolidated/orchestration APIs are supported; they cannot establish verified upload provenance. A green status does not hide a failed linked workflow or missing reports.

For final failures it searches at most 1,000 recent report groups and considers up to three prior master candidates, preferring the exact PR base; older candidates must be ancestors of that base. The artifact records the chosen run and comparison limits. It compares full file/title/project and the final error. Missing Playwright projects cannot support a cross-run match. The possible assessments are:

| Assessment | What it establishes |
| --- | --- |
| `observed_flaky` | This test failed, then passed on retry in the recorded run. |
| `observed_on_master` | The same test and final error also appear in the selected prior master run. |
| `pr_suspect` | The final failed test's own file is changed by the PR and needs investigation. |
| `unknown` | The available evidence cannot support the other observations. |

None proves causality or authorizes a waiver. Environment comparability, the effect of product/fixture changes, and the commit that introduced a master defect remain unresolved. An AI review can propose a diagnosis; controlled reproduction or bisect is needed to establish a culprit commit. The disabled Cursor automation is not replaced with an AI diagnosis by this manual reader. AI provider reuse remains pending authorization. No comments, labels or check statuses are written by the manual path.

Read-only live acceptance covered a same-repository final failure (#38407), a fork with no current E2E statuses (#38353), and a green-status/failed-workflow mismatch with only 32/40 Cypress worker reports (#38356). A failed fork is covered by fixtures, not a live acceptance run. Automatic clearance and a real generated repair PR remain unproved.

## Human approval

The existing **E2E Tests - Override Status** workflow defaults to maintainer approval and no longer requires a running Cursor automation. A maintainer with write access supplies the exact PR head, the selected context/status/run/attempt values, and the reason for accepting those failures. Historical Cursor reviews/comments can still be supplied as supporting records. The workflow saves the approval before changing a status, checks it again around writes, and preserves any newer independent CI status during recovery.

Up to 24 explicitly selected contexts can be approved, including Playwright rolling-upgrade PR checks for enterprise, FIPS and team editions. The `upgrade-from-none` skip marker and master/release contexts are excluded. Approval never silently expands to other failed checks. Unsupported workflow/tested-commit combinations still stop for investigation. This is human approval, not the missing automatic unrelated-failure decision.

## Activation

Land the reviewed scripts/workflows on master first. The mechanical policy uses `pull_request_target`, checks out the exact trusted base SHA, and reads the PR commit only as Git data; its first bootstrap PR cannot exercise a policy that is not on its base yet. Require the `E2E Mechanical Edit Policy / policy` check after that bootstrap. No PR source, install hook, artifact, or candidate policy is executed by this privileged event.

Configure repository variables:

- `MM_TRIAGE_ENABLED=true`: diagnosis on failed workflow completion and every 15 minutes.
- `MM_TRIAGE_REPAIR_ENABLED=true`: latest eligible master discovery followed by one claimed repair; daily at 03:00 UTC or manual dispatch.
- `MM_TRIAGE_TSIO_URL`: trusted API URL ending `/api/v1` (choose staging explicitly for shadow rollout).
- `MM_TRIAGE_SET_STATUS`: defaults `false`; `true` fails explicitly during shadow-v1. There is no success-status implementation or permission.
- `MM_TRIAGE_PROVIDER=openai` and `MM_TRIAGE_MODEL`: an enabled model supporting Responses structured JSON output. The repair provider is independent of Cursor.
- `MM_TRIAGE_CLEAN_RUNS`: defaults 5, minimum 3, maximum 20.

Secrets and trust:

- Prefer GitHub OIDC, audience `mattermost-test-system-io`. Allow the exact master workflow refs `mattermost/mattermost/.github/workflows/e2e-triage-shadow.yml@refs/heads/master` and `mattermost/mattermost/.github/workflows/e2e-triage-repair.yml@refs/heads/master` in server `TSIO_TRIAGE_WORKFLOW_REFS`. The server also enforces repository/ref and workflow trust.
- Alternatively, set dedicated `TSIO_TRIAGE_API_KEY`; callers send `X-Triage-Key`. Ordinary report-upload credentials are insufficient.
- Guardian requires `MM_TRIAGE_OPENAI_API_KEY`. It makes real calls to the [OpenAI Responses API structured outputs interface](https://platform.openai.com/docs/guides/structured-outputs). It sends the single test source and reproduction evidence; the provider has no tools or workspace authority. It first returns `repair`, `product_suspect`, or `blocked`. Only `repair` permits a second source-replacement request.
- `MM_E2E_TEST_LICENSE_ONPREM_ENT` is required when the recorded run had a license. The provider and isolated candidate process never receive the license; the original trusted setup installs it on the test server.
- Optional `MM_TRIAGE_GITHUB_TOKEN` is a GitHub App/user token with contents/PR write access. Without it, the workflow token must be permitted to create PRs. GitHub documents that PRs opened or updated with `GITHUB_TOKEN` create approval-required CI runs; a user with write access must approve those runs. See [GitHub's workflow trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow). Neither token can authorize automatic merge here.
- This PR adds `@yasserfaraazkhan` as the user-approved reviewer for Cypress and Playwright under `CODEOWNERS`. Those rules must be on trusted master before activation. Discovery fails visibly when no owner matches. No tracking ticket or Jira configuration is required for test repair.

## Evidence and execution

Discovery reads complete, nontruncated master reports and asks the server to derive the failed test identity. It verifies the exact GitHub merge workflow run/attempt and master ancestry. The API additionally requires immutable verified master upload provenance and a pullable recorded `server_image_digest`/`image_digest`. It rejects unsupported/ambiguous identities. Only the newest observed `(framework, suite, stable_key)` is enqueued. Existing product-suspect observations remain a durable human handoff and do not invoke Jira or enter test repair again.

The workflow revision and tested commit are separate identities: master E2E uses `workflow_dispatch`, whose `inputs.commit_sha` can differ from the workflow's GitHub/OIDC SHA. Every report shard must carry the same verified source workflow revision, repository, ref, run, attempt, workflow and event; any Begin receipt supplying the shard count must match these claims and the immutable tested commit. The server returns that revision as `source_workflow_sha`. Guardian compares it to the source GitHub run's `head_sha`, then independently checks the tested commit's master ancestry. Existing queued items without this source field stop explicitly and need fresh evidence; historical rows are not retrospectively attested.

The controller atomically claims work and renews its lease every 30 seconds. It rejects stale master claims before expensive execution. It checks out the recorded master test commit into an isolated directory and validates current CODEOWNERS. It pulls the recorded server image by digest, checks its architecture and the image ID of the actual running server, and requires the recorded framework version. Mutable image tags and bare local image IDs are rejected.

The supported runtime is a nonroot Linux x64 GitHub runner with Docker. Playwright uses the repository's original Testcontainers setup; Cypress uses `make cloud-init` and `make start-server` with the recorded service set. Cloud-server runs and unknown frameworks/projects fail explicitly. Playwright Chrome, Firefox and iPad projects are supported; Cypress supports the recorded default Electron project. A trusted Cypress wrapper carries allowlisted Compose bootstrap/expose settings into the current Cypress configuration. A trusted Playwright wrapper preserves project/test/use settings and disables its global setup after the host has prepared the exact stack.

Every reproduction/verification test executes in a fresh Docker container with no host PID access, Docker socket, controller credentials, or writable source. The trusted checkout and bounded candidate source are read-only mounts; only that run's result/runtime folders are writable. The container runs as the runner's nonroot UID, with a read-only root filesystem, dropped capabilities and `no-new-privileges`. Playwright service-mutation tests that require Docker inside the test cannot use this isolated harness and fail/skip explicitly; skipped results never verify a repair. The runner image digest is resolved from the framework-pinned Playwright image or the existing Cypress Compose runner and recorded separately.

Before asking the model for a repair, the original failure must reproduce with the same file, project, full test title, failure status and recorded error. Only terminal formatting and whitespace are ignored when comparing errors; a different error does not establish reproduction. The controller reads the original rows from the exact run evidence API and rejects missing, incomplete or ambiguous retry evidence. Verification then requires N independent clean stack/test runs, retry overrides set to zero, one actual attempt per test, no skipped/interrupted tests, and unchanged nonempty file/project/title identities. Cypress results are joined to the actual `after:spec` attempt sidecar; missing/ambiguous sidecars fail. A failing runner exit cannot be excused by a passing report. Reports, image digests, diagnosis, policy annotations and PR receipts are uploaded for human review. These checks have automated regression tests; a real Linux repair run and its resulting PR still need to be demonstrated.

The mechanical CI policy blocks syntactic skips/only/fixme, new skip/ignore tags, arbitrary waits/timers, removed tests/assertions and raised literal timeout/retry settings. Guardian's stricter mode also refuses changes that bypass existing assertions or actions, such as an early return, a new condition that avoids the test, or a swallowed error. Existing control flow can remain while an event-based wait is added. Static checks cannot establish that every possible JavaScript edit preserves behavior; every repair still requires human review.

PR publication uses one deterministic branch per queue item. Each GitHub mutation checks live lease ownership and is cancellable. Uncertain ref/PR responses are reconciled with GET rather than blindly creating another PR. Once a PR exists its receipt is persisted before the reviewer request, so a review-request failure does not requeue it. Unresolved publication uncertainty stays visible for reconciliation. Branches and reused PRs must retain the recorded test commit as their sole parent. Master must still equal that verified commit when publication begins, before PR creation, and before recording the receipt; a matching spec alone cannot establish that its fixtures, setup or product behavior stayed unchanged. Even unrelated master merges currently require fresh evidence and revalidation. A GitHub ref can still advance after the last read; human review and normal PR CI remain required.

A product-suspect decision completes the repair claim terminally with an explicit request for the assigned owner to investigate. It invokes no patch provider, tracker or test edit and leaves the test red. The metrics step reads actual GitHub PR state and reports observed opened/merged/open/closed-without-merge counts; truncated queue results are labeled as a subset. No escaped-release metric is inferred.

## Local checks

Install TypeScript 6.0.3 in a temporary directory (or use an existing trusted installation), then run:

```sh
TRIAGE_TYPESCRIPT_PATH=/absolute/path/to/typescript/lib/typescript.js node --test .github/scripts/triage-*.test.mjs .github/scripts/manual-e2e-verification.test.mjs
actionlint .github/workflows/e2e-triage-*.yml
```

These checks do not create external PRs, call a provider, submit Jira issues, or merge anything.

The existing **E2E Tests Check** workflow also runs these candidate tests in its read-only job. This is separate from the trusted-base edit policy, which enforces the already-reviewed rules against PR test changes.
