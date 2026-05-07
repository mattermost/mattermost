# E2E Test Pipelines

Three automated E2E test pipelines cover different stages of the development lifecycle.

## Pipelines

| Pipeline | Trigger | Editions Tested | Image Source |
|----------|---------|----------------|--------------|
| **PR** (`e2e-tests-ci.yml`) | Argo Events on `Enterprise CI/docker-image` status | enterprise | `mattermostdevelopment/**` |
| **Merge to master/release** (`e2e-tests-on-merge.yml`) | Platform delivery after docker build (`delivery-platform/.github/workflows/mattermost-platform-delivery.yaml`) | enterprise, fips | `mattermostdevelopment/**` |
| **Release cut** (`e2e-tests-on-release.yml`) | Platform release after docker build (`delivery-platform/.github/workflows/release-mattermost-platform.yml`) | enterprise, fips, team (future) | `mattermost/**` |

All pipelines follow the **smoke-then-full** pattern: smoke tests run first, full tests only run if smoke passes.

## Workflow Files

```
.github/workflows/
├── e2e-tests-ci.yml                    # PR orchestrator
├── e2e-tests-on-merge.yml              # Merge orchestrator (master/release branches)
├── e2e-tests-on-release.yml            # Release cut orchestrator
├── e2e-tests-cypress.yml               # Shared wrapper: cypress smoke -> full
├── e2e-tests-playwright.yml            # Shared wrapper: playwright smoke -> full
├── e2e-tests-cypress-template.yml      # Template: actual cypress test execution
└── e2e-tests-playwright-template.yml   # Template: actual playwright test execution
```

### Call hierarchy

```
e2e-tests-ci.yml ─────────────────┐
e2e-tests-on-merge.yml ───────────┤──► e2e-tests-cypress.yml ──► e2e-tests-cypress-template.yml
e2e-tests-on-release.yml ─────────┘    e2e-tests-playwright.yml ──► e2e-tests-playwright-template.yml
```

---

## Pipeline 1: PR (`e2e-tests-ci.yml`)

Runs E2E tests for every PR commit after the enterprise docker image is built. Fails if the commit is not associated with an open PR.

**Trigger chain:**
```
PR commit ─► Enterprise CI builds docker image
           ─► Argo Events detects "Enterprise CI/docker-image" status
           ─► dispatches e2e-tests-ci.yml
```

For PRs from forks, `body.branches` may be empty so the workflow falls back to `master` for workflow files (trusted code), while `commit_sha` still points to the fork's commit.

**Jobs:** 2 (cypress + playwright), each does smoke -> full

**Commit statuses (4 total):**

| Context | Description (pending) | Description (result) |
|---------|----------------------|---------------------|
| `e2e-test/cypress-smoke\|enterprise` | `tests running, image_tag:abc1234` | `100% passed (1313), 440 specs, image_tag:abc1234` |
| `e2e-test/cypress-full\|enterprise` | `tests running, image_tag:abc1234` | `100% passed (1313), 440 specs, image_tag:abc1234` |
| `e2e-test/playwright-smoke\|enterprise` | `tests running, image_tag:abc1234` | `100% passed (200), 50 specs, image_tag:abc1234` |
| `e2e-test/playwright-full\|enterprise` | `tests running, image_tag:abc1234` | `99.5% passed (199/200), 1 failed, 50 specs, image_tag:abc1234` |

**Manual trigger (CLI):**
```bash
gh workflow run e2e-tests-ci.yml \
  --repo mattermost/mattermost \
  --field pr_number="35171"
```

**Manual trigger (GitHub UI):**
1. Go to **Actions** > **E2E Tests (smoke-then-full)**
2. Click **Run workflow**
3. Fill in `pr_number` (e.g., `35171`)
4. Click **Run workflow**

### On-demand testing

For on-demand E2E testing, the existing triggers still work:
- **Comment triggers**: `/e2e-test`, `/e2e-test fips`, or with `MM_ENV` parameters
- **Label trigger**: `E2E/Run`

These are separate from the automated workflow and can be used for custom test configurations or re-runs.

---

## Pipeline 2: Merge (`e2e-tests-on-merge.yml`)

Runs E2E tests after every push/merge to `master` or `release-*` branches.

**Trigger chain:**
```
Push to master/release-*
  ─► Argo Events (mattermost-platform-package sensor)
  ─► delivery-platform/.github/workflows/mattermost-platform-delivery.yaml
  ─► builds docker images (enterprise + fips)
  ─► trigger-e2e-tests job dispatches e2e-tests-on-merge.yml
```

**Jobs:** 4 (cypress + playwright) x (enterprise + fips), smoke skipped, full tests only

**Commit statuses (4 total):**

| Context | Description example |
|---------|-------------------|
| `e2e-test/cypress-full\|enterprise` | `100% passed (1313), 440 specs, image_tag:abc1234_def5678` |
| `e2e-test/cypress-full\|fips` | `100% passed (1313), 440 specs, image_tag:abc1234_def5678` |
| `e2e-test/playwright-full\|enterprise` | `100% passed (200), 50 specs, image_tag:abc1234_def5678` |
| `e2e-test/playwright-full\|fips` | `100% passed (200), 50 specs, image_tag:abc1234_def5678` |

**Manual trigger (CLI):**
```bash
# For master
gh workflow run e2e-tests-on-merge.yml \
  --repo mattermost/mattermost \
  --field branch="master" \
  --field commit_sha="<full_commit_sha>" \
  --field server_image_tag="<image_tag>"

# For release branch
gh workflow run e2e-tests-on-merge.yml \
  --repo mattermost/mattermost \
  --field branch="release-11.4" \
  --field commit_sha="<full_commit_sha>" \
  --field server_image_tag="<image_tag>"
```

**Manual trigger (GitHub UI):**
1. Go to **Actions** > **E2E Tests (master/release - merge)**
2. Click **Run workflow**
3. Fill in:
   - `branch`: `master` or `release-11.4`
   - `commit_sha`: full 40-char SHA
   - `server_image_tag`: e.g., `abc1234_def5678`
4. Click **Run workflow**

---

## Pipeline 3: Release Cut (`e2e-tests-on-release.yml`)

Runs E2E tests after a release cut against the published release images.

**Trigger chain:**
```
Manual release cut
  ─► delivery-platform/.github/workflows/release-mattermost-platform.yml
  ─► builds and publishes release docker images
  ─► trigger-e2e-tests job dispatches e2e-tests-on-release.yml
```

**Jobs:** 4 (cypress + playwright) x (enterprise + fips), smoke skipped, full tests only. Team edition planned for future.

**Commit statuses (4 total, 6 when team is enabled):**

Descriptions include alias tags showing which rolling docker tags point to the same image.

RC example (11.4.0-rc3):

| Context | Description example |
|---------|-------------------|
| `e2e-test/cypress-full\|enterprise` | `100% passed (1313), 440 specs, image_tag:11.4.0-rc3 (release-11.4, release-11)` |
| `e2e-test/cypress-full\|fips` | `100% passed (1313), 440 specs, image_tag:11.4.0-rc3 (release-11.4, release-11)` |
| `e2e-test/cypress-full\|team` (future) | `100% passed (1313), 440 specs, image_tag:11.4.0-rc3 (release-11.4, release-11)` |

Stable example (11.4.0) — includes `MAJOR.MINOR` alias:

| Context | Description example |
|---------|-------------------|
| `e2e-test/cypress-full\|enterprise` | `100% passed (1313), 440 specs, image_tag:11.4.0 (release-11.4, release-11, 11.4)` |
| `e2e-test/cypress-full\|fips` | `100% passed (1313), 440 specs, image_tag:11.4.0 (release-11.4, release-11, 11.4)` |
| `e2e-test/cypress-full\|team` (future) | `100% passed (1313), 440 specs, image_tag:11.4.0 (release-11.4, release-11, 11.4)` |

**Manual trigger (CLI):**
```bash
gh workflow run e2e-tests-on-release.yml \
  --repo mattermost/mattermost \
  --field branch="release-11.4" \
  --field commit_sha="<full_commit_sha>" \
  --field server_image_tag="11.4.0" \
  --field server_image_aliases="release-11.4, release-11, 11.4"
```

**Manual trigger (GitHub UI):**
1. Go to **Actions** > **E2E Tests (release cut)**
2. Click **Run workflow**
3. Fill in:
   - `branch`: `release-11.4`
   - `commit_sha`: full 40-char SHA
   - `server_image_tag`: e.g., `11.4.0` or `11.4.0-rc3`
   - `server_image_aliases`: e.g., `release-11.4, release-11, 11.4` (optional)
4. Click **Run workflow**

---

## Commit Status Format

**Context name:** `e2e-test/<phase>|<edition>`

Where `<phase>` is `cypress-smoke`, `cypress-full`, `playwright-smoke`, or `playwright-full`.

**Description format:**
- All passed: `100% passed (<count>), <specs> specs, image_tag:<tag>[ (<aliases>)]`
- With failures: `<rate>% passed (<passed>/<total>), <failed> failed, <specs> specs, image_tag:<tag>[ (<aliases>)]`
- Pending: `tests running, image_tag:<tag>[ (<aliases>)]`

- Pass rate: `100%` if all pass, otherwise one decimal (e.g., `99.5%`)
- Aliases only present for release cuts

### Failure behavior

1. **Smoke test fails**: Full tests are skipped, only smoke commit status shows failure
2. **Full test fails**: Full commit status shows failure with pass rate
3. **Both pass**: Both smoke and full commit statuses show success
4. **No PR found** (PR pipeline only): Workflow fails immediately

---

## Smoke-then-Full Pattern

Each wrapper (Cypress/Playwright) follows this flow:

```
generate-build-variables (branch, build_id, server_image)
  ─► smoke tests (1 worker, minimal docker services)
    ─► if smoke passes ─► full tests (20 workers cypress / 1 worker playwright, all docker services)
      ─► report (aggregate results, update commit status)
```

### Test filtering

| Framework | Smoke | Full |
|-----------|-------|------|
| **Cypress** | `--stage=@prod --group=@smoke` | `--stage="@prod" --excludeGroup="@te_only,@cloud_only,@high_availability" --sortFirst=... --sortLast=...` |
| **Playwright** | `--grep @smoke` | `--grep-invert "@smoke\|@visual"` |

### Worker configuration

| Framework | Smoke Workers | Full Workers |
|-----------|---------------|--------------|
| **Cypress** | 1 | 20 |
| **Playwright** | 1 | 1 (uses internal parallelism via `PW_WORKERS`) |

### Docker services

| Test Phase | Docker Services |
|------------|-----------------|
| Smoke | `postgres inbucket` |
| Full | `postgres inbucket minio openldap elasticsearch keycloak` |

---

## Tagging Smoke Tests

### Cypress

Add `@smoke` to the Group comment at the top of spec files:

```javascript
// Stage: @prod
// Group: @channels @messaging @smoke
```

### Playwright

Add `@smoke` to the test tag option:

```typescript
test('critical login flow', {tag: ['@smoke', '@login']}, async ({pw}) => {
    // ...
});
```

---

## Shared Wrapper Inputs

The wrappers (`e2e-tests-cypress.yml`, `e2e-tests-playwright.yml`) accept these inputs:

| Input | Default | Description |
|-------|---------|-------------|
| `server_edition` | `enterprise` | Edition: `enterprise`, `fips`, or `team` |
| `server_image_repo` | `mattermostdevelopment` | Docker namespace: `mattermostdevelopment` or `mattermost` |
| `server_image_tag` | derived from `commit_sha` | Docker image tag |
| `server_image_aliases` | _(empty)_ | Alias tags shown in commit status description |
| `ref_branch` | _(empty)_ | Source branch name for webhook messages (e.g., `master` or `release-11.4`) |

The automation dashboard branch name is derived from context:
- PR: `server-pr-<pr_number>` (e.g., `server-pr-35205`)
- Master merge: `server-master-<image_tag>` (e.g., `server-master-abc1234_def5678`)
- Release merge: `server-release-<version>-<image_tag>` (e.g., `server-release-11.4-abc1234_def5678`)
- Fallback: `server-commit-<image_tag>`

The test type suffix (`-smoke` or `-full`) is appended by the template.

The server image is derived as:
```
{server_image_repo}/{edition_image_name}:{server_image_tag}
```

Where `edition_image_name` maps to:
- `enterprise` -> `mattermost-enterprise-edition`
- `fips` -> `mattermost-enterprise-fips-edition`
- `team` -> `mattermost-team-edition`

---

## Webhook Message Format

After full tests complete, a webhook notification is sent to the configured `REPORT_WEBHOOK_URL`. The results line uses the same `commit_status_message` as the GitHub commit status. The source line varies by pipeline using `report_type` and `ref_branch`.

**Report types:** `PR`, `MASTER`, `RELEASE`, `RELEASE_CUT`

### PR

```
:open-pull-request: mattermost-pr-35205
:docker: mattermostdevelopment/mattermost-enterprise-edition:abc1234
100% passed (1313), 440 specs | full report
```

### Merge to master

```
:git_merge: abc1234 on master
:docker: mattermostdevelopment/mattermost-enterprise-edition:abc1234_def5678
100% passed (1313), 440 specs | full report
```

### Merge to release branch

```
:git_merge: abc1234 on release-11.4
:docker: mattermostdevelopment/mattermost-enterprise-edition:abc1234_def5678
100% passed (1313), 440 specs | full report
```

### Release cut

```
:github_round: abc1234 on release-11.4
:docker: mattermost/mattermost-enterprise-edition:11.4.0-rc3
100% passed (1313), 440 specs | full report
```

The commit short SHA links to the commit on GitHub. The PR number links to the pull request.

---

## Related Files

- `e2e-tests/cypress/` - Cypress test suite
- `e2e-tests/playwright/` - Playwright test suite
- `e2e-tests/.ci/` - CI configuration and environment files
- `e2e-tests/Makefile` - Makefile with targets for running tests, generating cycles, and reporting
