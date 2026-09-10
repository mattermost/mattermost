# Mattermost E2E: unblock PRs and repair tests

There are two jobs to explain:

1. GitHub Actions investigates a failed PR run and can clear it after a complete successful re-verification.
2. Cursor proposes a small repair for a failing or flaky master test. GitHub Actions verifies the repair, and yasserfaraazkhan reviews the PR.

Test System IO stores the test results and the details needed to reproduce them. Impact Gate, Jira, another model API key and a Cursor label token are not dependencies of this path.

## Automatic PR clearance

The first policy is deliberately specific. It does not claim that AI can prove every failure unrelated to every code change.

- Read the PR's current commit, base, complete diff and all current E2E statuses. Same-repository and fork PRs use the same GitHub read APIs.
- Require complete reports showing that every final PR failure matches a recorded failed attempt in the exact current base commit, with the same test, error and comparable test environment. The base test may still fail or may have passed on retry; that distinction is retained.
- Save a request and run the existing full Cypress and Playwright suites once on the unchanged PR commit. Preserve any required enterprise/FIPS coverage and use the original recorded server image by digest.
- Keep the original failed statuses while verification runs. The new run uploads reports without replacing those statuses.
- Require complete successful verification, the same test and spec coverage, the same skips, the same environment and no newly observed failing test. Ordinary CI retries remain unchanged; a recovered retry is recorded as such.
- Save the evidence in a PR comment, check that the PR and statuses are still current, then change only the original failed contexts to success. Recheck around each write. A failed verification does not trigger another automatic attempt.

The result means **“a matching failed attempt was observed on the base, and the full unchanged PR has now passed verification.”** It does not mean a finite run proves the PR can never affect flakiness. A persistent failure, missing report, changed commit, pending check, new failure or ambiguous evidence leaves the PR blocked.

This version supports ordinary full Cypress/Playwright enterprise and FIPS contexts. It stops when rolling-upgrade coverage is required. Normal CI continues to select and run rolling upgrades; automatic clearance does not remove that coverage. Historical uploads without verified source and image records cannot authorize clearance.

The controller runs only from reviewed master workflows. PR code never executes in the status-writing controller. The worker jobs run the existing E2E suites; the completed run's report data is checked independently before a status changes. GitHub has no atomic compare-and-set for commit statuses, so there remains a small race after a final read. Recovery restores only this controller's own statuses and reports any uncertain write explicitly.

## Cursor master repairs

Use [the replacement Cursor prompt](triage-cursor-repair.md) in the existing automation. It selects one real master failure or flake, reproduces it, diagnoses the cause and proposes one test-file repair. It requests review from yasserfaraazkhan. A suspected product defect keeps its assertion and needs human investigation.

Cursor cannot certify its own explanation. **E2E Verify Repair PR** independently:

1. Fetches the exact original master report and GitHub run.
2. Reads the PR as Git data and allows only one existing test file, at most 150 changed lines.
3. Reproduces the same original test and error using the recorded master commit and server image.
4. Applies only that candidate test file in the existing isolated test runner.
5. Requires five complete passing executions with retries disabled, preserving identities and assertions.
6. Saves the actual results, original error, patch, image, tested base and PR commit for review.

The verifier has read-only GitHub access and needs no model credential. It never checks out the PR onto the host or executes PR installation scripts. Candidate tests run in the existing Docker sandbox without controller credentials or a Docker socket. A changed PR head or changed original test stops verification. An unrelated newer master commit is allowed, but the result explicitly names the recorded ancestor that was tested; ordinary PR CI and human review must check compatibility with newer product changes.

Use **Actions → E2E Verify Repair PR → Run workflow**, select master, and supply the repair PR number plus `evidence_json`:

```json
{"repository":"mattermost/mattermost","commit_sha":"FULL_RECORDED_TEST_COMMIT","gh_run_id":"RECORDED_RUN_ID","gh_run_attempt":"RECORDED_ATTEMPT","name":"RECORDED_SUITE_NAME","stable_key":"EXACT_RECORDED_KEY"}
```

These are selectors, not a caller's assertion that the repair is correct. All error, source, image and environment details come from the fetched records.

The supported repair runner is Linux x64 with Docker: Playwright Chrome/Firefox/iPad or Cypress Electron in an on-premise environment. It needs the existing enterprise test license when the original run was licensed. Tests requiring capabilities outside that sandbox remain for human repair. Static edit checks block tested skip/assertion/control-flow bypasses, but cannot prove arbitrary JavaScript semantics. Every repair still needs review.

## Enable the reviewed implementation

The implementation must first be reviewed and merged to Mattermost master. Deploy the TSIO evidence API and collect fresh master and PR results with verified upload sources and recorded image digests. Do not label historical records as verified after the fact.

For PR clearance, configure:

- `MM_TRIAGE_TSIO_URL`: the exact production or staging URL ending in `/api/v1`. Staging activation must not clear production statuses.
- `MM_TRIAGE_SET_STATUS=true`: enables the new clearance controller. Leave false during read-only rollout.

The existing **E2E PR Triage** workflow handles failed workflow events and reconciles recent runs every 15 minutes. To request clearance by PR number, use its `pr_number` input and select `request_clearance`. With that option off it only saves an analysis. The normal **E2E Tests (pull request)** workflow retains its existing inputs; the `triage_source_run_id` and `triage_source_run_attempt` inputs are used by the controller to request a single frozen verification.

For repairs, keep the old PR-diagnosis Cursor automation disabled while replacing its prompt. Use the existing Mattermost connection/environment and a daily master schedule, with PR creation and reviewer requests. Complete company SSO yourself. Do not add a label token or bypass an administrator's restriction. Enable it only after the manual CI verifier works with a real repair candidate.

The older OpenAI Guardian implementation remains available for a separately configured deployment. Its `MM_TRIAGE_REPAIR_ENABLED` switch must remain false when using Cursor, so two repair workers do not compete. The optional historical `MM_TRIAGE_ENABLED` observer still writes shadow assessments; those records cannot authorize status changes.

## What has and has not been demonstrated

The scripts and workflow changes have automated tests for their decisions, source bindings, changed commits, failed writes, missing reports, hidden assertions and retry handling. Test counts and current checks belong in the PR's latest validation result.

A live automatic clearance and a live Cursor repair PR are separate acceptance requirements. Neither can be claimed from simulated GitHub responses or a proposed patch. The reviewed workflows are not yet on master, and the currently captured master flake lacks the immutable image/verified environment needed by the verifier. Cursor settings remain unchanged pending the user's sign-in decision. This is not yet a live-demo approval.

## Local checks

```sh
TRIAGE_TYPESCRIPT_PATH=/absolute/path/to/typescript/lib/typescript.js node --test .github/scripts/e2e-change-scope.test.mjs .github/scripts/e2e-resolve-pr.test.mjs .github/scripts/triage-*.test.mjs .github/scripts/manual-e2e-verification.test.mjs
actionlint .github/workflows/e2e-tests*.yml .github/workflows/e2e-triage*.yml
```

Use TypeScript 6.0.3. The existing E2E Tests Check workflow runs the script tests in a read-only job. These tests do not call a model, waive a live PR, or open a repair PR.
