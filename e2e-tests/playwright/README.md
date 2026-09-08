## Local development

#### 1. Start local server in a separate terminal.

There are two ways to run the local server:

**Option 1: Run from source**

```bash
# Typically run the local server with:
cd server && make run

# Or run webapp and server on separate terminals for better performance
# First terminal: Build and run the webapp
cd webapp && make run
# Second terminal: Run the server
cd server && make run-server
```

**Option 2: Testcontainers (recommended for testing, and what CI uses)**

No separate terminal or setup step needed — Playwright brings up Postgres, Inbucket, and the Mattermost server itself via [Testcontainers](https://node.testcontainers.org/), then tears them down after the run.

```bash
# Run with defaults (Postgres, Inbucket, Mattermost server, minio, openldap, keycloak, elasticsearch)
PW_USE_TESTCONTAINERS=true npm run test -- login

# Change which additional services start, comma-separated (or "" to start none)
PW_USE_TESTCONTAINERS=true PW_TESTCONTAINERS_SERVICES=minio,openldap npm run test

# Pin a specific server image (defaults to mattermostdevelopment/mattermost-enterprise-edition:master)
PW_USE_TESTCONTAINERS=true SERVER_IMAGE=mattermostdevelopment/mattermost-enterprise-edition:<tag> npm run test

# Pass arbitrary MM_* config overrides as comma-separated KEY=VALUE pairs
PW_USE_TESTCONTAINERS=true MM_ENV=MM_LICENSE=<your-license-key> npm run test
```

Containers are reused across invocations by default (`PW_TESTCONTAINERS_REUSE=true`) instead of being recreated every run — tear the stack down explicitly when you're done with `npm run testcontainers:down`. Set `PW_TESTCONTAINERS_REUSE=false` for a one-off run that tears itself down when it finishes. Use `npm run testcontainers:up` to just bring the stack up (or confirm an existing one's still reachable) without running any tests.

See `lib/README.md` for every available environment variable.

#### 2. Install dependencies and run the test.

```bash
# Install npm packages
npm i

# Install browser binaries as prompted if Playwright is just installed or updated
# See https://playwright.dev/docs/browsers
npx playwright install

# Run a specific test of all projects -- Chrome, Firefox, iPhone and iPad.
# See https://playwright.dev/docs/test-cli.
npm run test -- login

# Run a specific test of a project
npm run test -- login --project=chrome

# Run all tests (including visual tests)
npm run test

# Run CI tests (excludes visual tests, runs only in Chrome)
# Note: visual tests run in a separate workflow
npm run test:ci
```

#### 3. Inspect test results at `/results/output` folder when something fails unexpectedly.

## Run tests in UI mode

Check out https://playwright.dev/docs/test-ui-mode for detailed guide on UI Mode to learn more about its features.

```bash
npm run playwright-ui
```

> **Note:** If no tests appear in the UI, check your filter settings:
>
> - Test name filters
> - Project filters (setup, ipad, chrome, firefox)
> - Tag filters (@tag)
> - Execution status filters
>
> The "setup" project runs the initial configuration tests in `specs/test_setup.ts` (ensuring plugins are loaded and server deployment is correct). These setup tests are typically run only once before other tests and may be unchecked for subsequent runs, though they can remain checked if needed.

## Upgrade-path testing

Boots an older server image, seeds it, then replaces only the Mattermost container with a newer image while the same Postgres keeps running, and re-verifies through the **Client4 API** that migrations completed and prior data survived. Testcontainers mode only, since that in-place container swap is the whole mechanism.

The upgrade projects make no UI assertions: older images ship older webapps, so master POMs and testids cannot be trusted against `release-X.Y`. UI coverage comes from the normal suite, which CI runs afterwards against the upgraded server.

### How it works

Three projects in `playwright.config.ts`, each selecting its specs by directory (`upgrade-specs/from`, `upgrade-specs/to`). The `@upgrade-from` / `@upgrade-to` tags are bookkeeping for reports and ad-hoc `--grep`; no project filters on them.

| Project           | Does                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `upgrade-from`    | Boots fresh on `PW_UPGRADE_FROM_SERVER_IMAGE`, runs `setup`, seeds content via Client4, writes `.upgrade_baseline.json` |
| `upgrade-swap-to` | Restarts the container on `SERVER_IMAGE` with the same boot env as from, including host `MM_LICENSE`                    |
| `upgrade-to`      | Re-verifies every baseline slice against the upgraded server                                                            |

- **The swap.** `pw.upgradeServerImage(image)` (`lib/src/server/version.ts`) repoints `testConfig.serverImage` and calls the same `restartMattermostContainer()` used by `pw.ensureMinio()` — stop the Mattermost container, start a fresh one on the same network. Postgres is never touched.
- **State that must survive lives outside the container.** Config is stored in Postgres (`MM_CONFIG` set to the SQL datasource in `lib/src/containers/mattermost_container.ts`, a supported production mode) and `/mattermost/data` is bind-mounted to `.mattermost_data/` (`lib/src/containers/constants.ts`). Both are Docker volumes by default, so the swap would otherwise factory-reset the config and discard uploads.
- **API-first harness.** `upgrade-specs/{from,to}/*.spec.ts` use Client4 / PlaywrightClient4 — no POMs. Authenticated binary downloads use Playwright's `request` fixture; browser login only via `loginByAPI` when a real session is needed. Helpers in `upgrade-specs/upgrade_fixtures.ts`.
- **Continuity across phases.** Fixed (non-random) team/user/channel names are looked up idempotently, plus `.upgrade_baseline.json` for version identity, license, plugin state, and post/channel IDs. The from-phase container uses Testcontainers `withReuse()` so Ryuk does not reap it when that process exits.
- **Plugins are driven by API, not env.** upgrade-from enables playbooks and installs the demo plugin, upgrade-to asserts both survived, and global setup's plugin reset is skipped for those phases. The first normal spec afterwards deactivates the demo plugin, which otherwise overrides the webapp's attachment button and breaks every UI file-upload spec.
- **Phase logs.** `pw.saveUpgradePhaseLogs('from'|'to')` writes Mattermost/Postgres docker logs to `logs/upgrade/`, plus a migration/license/panic highlights file. The from-image has to be captured before swap-to replaces the container. CI uploads `logs/` via `ci/upload-debug-artifacts`.

### Run locally

The stack stays up between the two commands so you can inspect it. `test:upgrade:from` requires a clean slate — tear down any leftover stack first. `upgrade-to` adopts that stack, which needs `testcontainers.reuse.enable=true` in `~/.testcontainers.properties` (see `lib/README.md`).

```bash
npm run testcontainers:down

# Phase 1 — boots fresh on the older from-image. Use a release-* tag; patch tags like 11.9.1 are
# not published. `node script/resolve_upgrade_matrix.mjs` prints the tags CI uses.
# MM_LICENSE is optional; when set, the baseline records license details.
MM_LICENSE=<your-license-key> \
  PW_UPGRADE_FROM_SERVER_IMAGE=mattermostdevelopment/mattermost-enterprise-edition:release-11.9 \
  npm run test:upgrade:from

# Phase 2 — swaps to SERVER_IMAGE (defaults to :master) with the same env as from.
MM_LICENSE=<your-license-key> \
  SERVER_IMAGE=mattermostdevelopment/mattermost-enterprise-edition:master \
  npm run test:upgrade:to

npm run testcontainers:down
```

Both env vars can live in a local `.env` file instead of the command line.

### CI

CI tests a rolling matrix rather than one fixed version: the last 3 minor releases plus any release still in its Extended Support (ESR) window. `script/resolve_upgrade_matrix.mjs` resolves it at run time — last-3-minors from this checkout's `server/public/model/version.go`, support-end dates and ESR status fetched live from the published releases table on `master`, since those lapse with calendar time and a stale branch should not be trusted for them.

```bash
node script/resolve_upgrade_matrix.mjs
# [{"dockerTag":"release-10.11","minor":"10.11","patch":"10.11.22","isESR":true,"contextLabel":"release-10.11-esr"}, ...]
```

Rolling upgrades run in a **separate pipeline** from the normal full suite, not inside `e2e-tests-playwright-template.yml`:

- `e2e-tests-playwright-rolling-upgrades.yml` resolves the matrix and calls the template once per from-version, in parallel.
- `e2e-tests-playwright-rolling-upgrades-template.yml` tests **one** from-version, and owns that version's Test System IO run, dispatch workers, and commit status.

Each of a version's `workers` (default 20, same as the full suite) runs `--project=upgrade-from`, then `--project=upgrade-to`, then `dispatch-run` for its share of the normal suite. Nothing is re-prepared in between — no `setup`, no re-patching, no restart — so the suite exercises a server that reached the to-image by upgrading. An upgrade that needed the suite's setup re-run to be usable would not be a passing upgrade, which is why that step is absent. The upgrade specs themselves live in `upgrade-specs/`, outside `testDir`, so `dispatch-begin` never sees them.

Every worker upgrades its own server, since a server cannot be shared across runners: the harness runs `workers` times per from-version and the pipeline costs `matrix size × workers` runners, each on a 60m timeout. `dispatch-run` is skipped when the harness fails. No `testcontainers:down` first — the runner is fresh, so the clean-slate guard has nothing to trip over.

**When it runs**

| Pipeline                        | Rolling upgrades                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR (automated)                  | On when the diff touches `upgrade-specs/`, `lib/`, `playwright.config.ts`, `script/resolve_upgrade_matrix.mjs`, or either rolling-upgrade workflow |
| PR (manual `workflow_dispatch`) | Opt-in via **Run rolling upgrades** checkbox                                                                                                       |
| Merge to `master` / `release-*` | Off — too expensive per merge                                                                                                                      |
| Release cut                     | On automatically                                                                                                                                   |
| Ad-hoc                          | **Run workflow** on _E2E Tests - Playwright Rolling Upgrades_; no PR needed — pick a ref, to-image tag, edition, and worker count                  |

**Commit statuses** — one per matrix entry and nothing else, so a 4-entry matrix produces exactly 4 contexts. When the resolver returns `[]`, no matrix jobs run and the workflow posts a single `upgrade-from-none` context instead. All sit under `e2e-test/playwright-full/{edition}/upgrade-from-*`, which is how the verified-label and override-status workflows discover them:

| Context                     | Covers                                                                         |
| --------------------------- | ------------------------------------------------------------------------------ |
| `upgrade-from-release-11.9` | that from-version's harness and post-upgrade suite (ESR entries append `-esr`) |
| `upgrade-from-none`         | resolver returned an empty matrix; nothing ran                                 |

There is no "skipped" context: when rolling upgrades are not requested the job never starts and posts nothing. The pipeline is deliberately not gated on the generic `should_run` — its own triggers already decide, and the `.mjs` resolver falls outside `should_run`'s `^e2e-tests/.*\.(ts|tsx|js|jsx)$` pattern, so deferring to it would drop requested runs. The normal full suite keeps using `e2e-test/playwright-full/enterprise`, with no `/upgrade-from-…` suffix.

## Visual Testing

All visual tests must be placed in the `specs/visual/` directory and tagged with `@visual` in the test tags array. This organization ensures proper test discovery and execution patterns.

Visual tests are used to verify the UI appearance is consistent across browsers and remains stable across code changes. There are two types of visual tests supported:

1. **Built-in snapshot testing**: Uses Playwright's built-in snapshot comparison
2. **Percy integration**: Uses the Percy service for more advanced visual testing and reporting

### CI Pipeline for Visual Tests

In CI environments, visual tests run in a separate dedicated pipeline:

- Regular tests run with `npm run test:ci` which excludes all tests with the `@visual` tag
- Visual tests run in a separate workflow using the Playwright Docker container
- This separation prevents visual tests from slowing down the main test pipeline
- It also ensures visual tests always run in a consistent environment

### Writing Visual Tests

When creating visual tests:

1. **Follow the test documentation format** like other tests:
    - Include JSDoc with `@objective` tag
    - Use action-oriented test title
    - Add proper comment prefixes (`// #` for actions, `// *` for verifications)

2. **Place in the correct location**:
    - Put visual tests in the `specs/visual/` directory, organized by feature area
    - Example: `specs/visual/channels/intro_channel.spec.ts`

3. **Add required tags**:
    - Always include `@visual` tag
    - Add feature-specific tags as needed (e.g., `@login_page`, `@channel_page`)

4. **Manage dynamic content**:
    - Use `pw.hideDynamicChannelsContent()` to hide elements that could change between runs
    - Take snapshots only after UI is fully loaded and stable

Example:

```typescript
/**
 * @objective Capture visual snapshot of the landing/login page
 */
test(
    'displays landing page with login options',
    {tag: ['@visual', '@landing_page']},
    async ({pw, page, browserName, viewport}, testInfo) => {
        // # Go to landing login page
        await pw.landingLoginPage.goto();
        await pw.landingLoginPage.toBeVisible();

        // * Verify landing page appears as expected
        await pw.matchSnapshot(testInfo, {page, browserName, viewport});
    },
);
```

## Updating screenshots is done strictly via Playwright's docker container for consistency

#### 1. Run Playwright's docker container

Change to the `./` project directory, then run the docker container. (See https://playwright.dev/docs/docker for reference.)

```bash
docker run -it --rm -v "$(pwd):/mattermost/" --ipc=host mcr.microsoft.com/playwright:v1.62.0-noble /bin/bash
```

#### 2. Inside the docker container

```bash
export PW_BASE_URL=http://host.docker.internal:8065
export PW_HEADLESS=true
cd mattermost/e2e-tests/playwright

# Install npm packages. Use "npm ci" to match the automated environment
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci

# Run specific test. See https://playwright.dev/docs/test-cli.
npm run test -- login --project=chrome

# Or run all tests
npm run test

# Run visual tests (must be run inside Docker for consistency)
npm run test -- specs/visual

# Update snapshots of visual tests (must be run inside Docker)
npm run test -- specs/visual --update-snapshots

# Run Percy visual tests (requires PERCY_TOKEN environment variable)
export PERCY_TOKEN=<your-percy-token>
npm run percy:docker
```

## Accessibility Testing

Accessibility tests ensure Mattermost meets WCAG 2.1 AA compliance standards. Tests are located in `specs/accessibility/` and cover keyboard navigation, screen reader support, focus management, and automated accessibility scanning.

For comprehensive guidelines on writing accessibility tests, aria snapshots, and folder structure, see [docs/accessibility/](docs/accessibility/).

### Accessibility Locators

**Playwright's accessibility locators should be the preferred approach for all tests, not just accessibility tests.** These locators query elements based on how users and assistive technologies perceive them, making tests more resilient to implementation changes and ensuring better accessibility by design.

#### Why Use Accessibility Locators?

- **Resilient to changes**: Tests won't break when CSS classes or data-testid attributes change
- **Encourages accessibility**: Forces proper ARIA roles, labels, and semantic HTML
- **Better readability**: `page.getByRole('button', {name: 'Save'})` is clearer than `page.locator('[data-testid="save-btn"]')`
- **Aligns with user experience**: Tests what users actually perceive, not implementation details

#### Preferred Locators (in order of preference)

1. **Role-based**: `page.getByRole('button', {name: 'Save'})`, `page.getByRole('textbox', {name: 'Email'})`
2. **Label-based**: `page.getByLabel('Email address')`
3. **Text-based**: `page.getByText('Welcome')`, `page.getByPlaceholder('Enter email')`
4. **Test IDs**: `page.locator('[data-testid="..."]')` - Use only when accessibility locators aren't possible
5. **CSS selectors**: `page.locator('.class')` - Avoid unless absolutely necessary

#### When Test IDs Are Acceptable

Use `data-testid` only when:

- Element has no semantic role (e.g., decorative divs)
- Multiple identical elements need distinction
- Component is not interactive or visible to assistive tech

For all test examples, see [docs/accessibility/](docs/accessibility/) for comprehensive patterns and best practices.

## Page/Component Object Model

See https://playwright.dev/docs/test-pom.

Page and component abstractions are in shared library located at `./lib/src/ui`. They should be established before writing a spec file so that any future changes in the DOM structure will be made in one place only. No static UI text or fixed locator should be written in the spec file.
