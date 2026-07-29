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
# Run with defaults (Postgres, Inbucket, Mattermost server — no optional sidecars)
PW_USE_TESTCONTAINERS=true npm run test -- login

# Opt in to additional services (comma-separated); webhook is separate
PW_USE_TESTCONTAINERS=true PW_TESTCONTAINERS_SERVICES=minio,openldap npm run test
PW_USE_TESTCONTAINERS=true PW_TESTCONTAINERS_WEBHOOK=true npm run test

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
docker run -it --rm -v "$(pwd):/mattermost/" --ipc=host mcr.microsoft.com/playwright:v1.59.1-noble /bin/bash
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
