# E2E Test Workflow Architecture

This document describes the architecture of the E2E test workflows for Mattermost.

## Overview

The E2E test system uses a **smoke-then-full** pattern where smoke tests run first as a gate. If smoke tests fail, full tests are skipped to save CI resources and provide fast feedback.

Both Cypress and Playwright test suites run **in parallel** with independent status checks.

**Note**: This workflow is designed for **Pull Requests only**. It will fail if the commit SHA is not associated with an open PR.

## Workflow Files

```
.github/workflows/
├── e2e-tests-ci.yml              # Main orchestrator (resolves PR, triggers both)
├── e2e-tests-cypress.yml         # Cypress: smoke → full
└── e2e-tests-playwright.yml      # Playwright: smoke → full
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    MAIN ORCHESTRATOR: e2e-tests-ci.yml                          │
└─────────────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────┐
                         │  workflow_dispatch  │
                         │  (commit_sha)       │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │     resolve-pr      │
                         │  (GitHub API call)  │
                         │                     │
                         │  Fails if no PR     │
                         │  found for commit   │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────┴──────────────────┐
                 │            (parallel)               │
                 ▼                                     ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│  e2e-tests-cypress.yml          │   │  e2e-tests-playwright.yml       │
│  (reusable workflow)            │   │  (reusable workflow)            │
│                                 │   │                                 │
│  Inputs:                        │   │  Inputs:                        │
│  • commit_sha                   │   │  • commit_sha                   │
│  • workers_number: "20"         │   │  • pr_number (required for full)│
│  • server: "onprem"             │   │  • server: "onprem"             │
│  • enable_reporting: true       │   │  • enable_reporting: true       │
│  • report_type: "PR"            │   │  • report_type: "PR"            │
└─────────────────────────────────┘   └─────────────────────────────────┘
```

## Per-Framework Workflow Flow

Each framework (Cypress/Playwright) follows the same pattern:

```
┌──────────────────────────────────────────────────────────────────┐
│                     PREFLIGHT CHECKS                             │
└──────────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌────────────┐        ┌─────────────┐          ┌─────────────┐
│ lint/tsc   │        │ shell-check │          │ update-     │
│ check      │        │             │          │ status      │
└─────┬──────┘        └──────┬──────┘          │ (pending)   │
      │                      │                 └──────┬──────┘
      └──────────────────────┴────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  GENERATE BUILD VARIABLES                        │
│                  (branch, build_id, server_image)                │
│                                                                  │
│  Server image generated from commit SHA:                         │
│  mattermostdevelopment/mattermost-enterprise-edition:<sha7>      │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       SMOKE TESTS                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  generate-test-cycle (smoke) [Cypress only]               │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  smoke-test                                                │  │
│  │  • Cypress:    TEST_FILTER: --stage=@prod --group=@smoke   │  │
│  │  • Playwright: TEST_FILTER: --grep @smoke                  │  │
│  │  • Fail fast if any smoke test fails                       │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  smoke-report                                              │  │
│  │  • Assert 0 failures                                       │  │
│  │  • Upload results to S3 (Playwright)                       │  │
│  │  • Update commit status                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              │ (only if smoke passes)
                              │ (Playwright: also requires pr_number)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                        FULL TESTS                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  generate-test-cycle (full) [Cypress only]                │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  full-test (matrix: workers)                               │  │
│  │  • Cypress:    TEST_FILTER: --stage='@prod'                │  │
│  │                --exclude-group='@smoke'                    │  │
│  │  • Playwright: TEST_FILTER: --grep-invert "@smoke|@visual" │  │
│  │  • Multiple workers for parallelism                        │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  full-report                                               │  │
│  │  • Aggregate results from all workers                      │  │
│  │  • Upload results to S3 (Playwright)                       │  │
│  │  • Publish report (if reporting enabled)                   │  │
│  │  • Update final commit status                              │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Commit Status Checks

Each workflow phase creates its own GitHub commit status check:

```
 GitHub Commit Status Checks:
 ═══════════════════════════

 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ E2E Tests/cypress-smoke      ●────────●────────●                            │
 │                           pending    running   ✓ passed / ✗ failed          │
 │                                                                             │
 │ E2E Tests/cypress-full       ○        ○        ●────────●────────●          │
 │                           (skip)   (skip)   pending  running  ✓/✗           │
 │                                      │                                      │
 │                                      └── Only runs if smoke passes          │
 └─────────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ E2E Tests/playwright-smoke   ●────────●────────●                            │
 │                           pending    running   ✓ passed / ✗ failed          │
 │                                                                             │
 │ E2E Tests/playwright-full    ○        ○        ●────────●────────●          │
 │                           (skip)   (skip)   pending  running  ✓/✗           │
 │                                      │                                      │
 │                                      └── Only runs if smoke passes          │
 │                                          AND pr_number is provided          │
 └─────────────────────────────────────────────────────────────────────────────┘
```

## Timeline

```
 Timeline:
 ─────────────────────────────────────────────────────────────────────────────►
 T0          T1              T2                  T3                  T4
 │           │               │                   │                   │
 │  Start    │  Preflight    │  Smoke Tests      │  Full Tests       │  Done
 │  resolve  │  Checks       │  (both parallel)  │  (both parallel)  │
 │  PR       │               │                   │  (if smoke pass)  │
```

## Test Filtering

| Framework | Smoke Tests | Full Tests |
|-----------|-------------|------------|
| **Cypress** | `--stage=@prod --group=@smoke` | See below |
| **Playwright** | `--grep @smoke` | `--grep-invert "@smoke\|@visual"` |

### Cypress Full Test Filter

```
--stage="@prod"
--excludeGroup="@smoke,@te_only,@cloud_only,@high_availability"
--sortFirst="@compliance_export,@elasticsearch,@ldap_group,@ldap"
--sortLast="@saml,@keycloak,@plugin,@plugins_uninstall,@mfa,@license_removal"
```

- **excludeGroup**: Skips smoke tests (already run), TE-only, cloud-only, and HA tests
- **sortFirst**: Runs long-running test groups early for better parallelization
- **sortLast**: Runs tests that may affect system state at the end

## Tagging Tests

### Cypress

Add `@smoke` to the Group comment at the top of spec files:

```javascript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Stage: @prod
// Group: @channels @messaging @smoke

describe('Critical messaging flow', () => {
    // ...
});
```

### Playwright

Add `@smoke` to the test tag option:

```typescript
test('critical login flow', {tag: ['@smoke', '@login']}, async ({pw}) => {
    // ...
});
```

## Worker Configuration

| Framework | Smoke Workers | Full Workers |
|-----------|---------------|--------------|
| **Cypress** | 1 | 20 |
| **Playwright** | 1 | 1 (uses internal parallelism via `PW_WORKERS`) |

## Failure Behavior

1. **Smoke test fails**: Full tests are skipped, only smoke commit status shows failure (no full test status created)
2. **Full test fails**: Full commit status shows failure with details
3. **Both pass**: Both smoke and full commit statuses show success
4. **No PR found**: Workflow fails immediately with error message

**Note**: Full test status updates use explicit job result checks (`needs.full-report.result == 'success'` / `'failure'`) rather than global `success()` / `failure()` functions. This ensures full test status is only updated when full tests actually run, not when smoke tests fail upstream.

## Manual Trigger

The workflow can be triggered manually via `workflow_dispatch` for PR commits:

```bash
# Run E2E tests for a PR commit
gh workflow run e2e-tests-ci.yml -f commit_sha=<PR_COMMIT_SHA>
```

**Note**: The commit SHA must be associated with an open PR. The workflow will fail otherwise.

## Automated Trigger (Argo Events)

The workflow is automatically triggered by Argo Events when the `Enterprise CI/docker-image` status check succeeds on a commit.

### Trigger Configuration

```yaml
# Argo Events Sensor listens for:
filters:
  - body.context: "Enterprise CI/docker-image"
  - body.state: "success"
  - body.repository.full_name: "mattermost/mattermost"

# Payload sent to workflow_dispatch:
payload:
  ref: body.branches.0.name    # Fallback: master (for fork PRs)
  inputs.commit_sha: body.sha  # Commit SHA from status event
```

### Fork PR Handling

For PRs from forked repositories:
- `body.branches` may be empty (commit doesn't exist in base repo branches)
- Falls back to `master` branch for workflow files (trusted code)
- The `commit_sha` still points to the fork's commit for testing
- PR number is resolved via GitHub API (works for fork PRs)

### Flow

```
Enterprise CI/docker-image succeeds
            │
            ▼
   Argo Events Sensor
            │
            ▼
   workflow_dispatch
   (ref, commit_sha)
            │
            ▼
   e2e-tests-ci.yml
            │
            ▼
   resolve-pr (GitHub API)
            │
            ▼
   Cypress + Playwright (parallel)
```

## S3 Report Storage

Playwright test results are uploaded to S3:

| Test Phase | S3 Path |
|------------|---------|
| Smoke | `server-pr-{PR_NUMBER}/e2e-reports/playwright-smoke/{RUN_ID}/` |
| Full | `server-pr-{PR_NUMBER}/e2e-reports/playwright-full/{RUN_ID}/` |

Reports are publicly accessible at:
`https://mattermost-cypress-report.s3.amazonaws.com/{S3_PATH}/results/reporter/index.html`

## Related Files

- `e2e-tests/cypress/` - Cypress test suite
- `e2e-tests/playwright/` - Playwright test suite
- `e2e-tests/.ci/` - CI configuration and environment files
