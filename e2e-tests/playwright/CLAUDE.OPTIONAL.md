# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is the Playwright E2E testing suite for Mattermost. It contains end-to-end tests for validating the Mattermost web application functionality using the Playwright testing framework.

## Key Commands

### Installation

```bash
# Install npm packages
npm i

# Install browser binaries (if prompted)
npx playwright install
```

### Running Tests

```bash
# Run a specific test across all browsers (Chrome, Firefox, iPad)
npm run test -- <test-name>

# Run a specific test for a specific browser
npm run test -- <test-name> --project=chrome
npm run test -- <test-name> --project=firefox
npm run test -- <test-name> --project=ipad

# Run all tests (including visual tests)
npm run test

# Run CI tests (excludes visual tests, runs only in Chrome)
npm run test:ci

# Run tests with UI mode
npm run playwright-ui

# Run tests with slow-motion to debug
npm run test:slomo

# Run visual tests
npm run test -- visual

# Update visual test snapshots
npm run test:update-snapshots

# Visual testing with Percy
npm run percy:docker
```

### Development Commands

```bash
# Build the project
npm run build

# Watch mode for development
npm run build:watch

# Type checking
npm run tsc

# Linting
npm run lint

# Format code
npm run prettier:fix

# Verify test documentation format
npm run lint:test-docs

# Run all checks (lint, prettier, typescript, test docs)
npm run check

# Clean the project
npm run clean

# Show test report
npm run show-report
```

## Architecture Overview

### Key Components

1. **`lib/` Directory**: Contains the shared library (`@mattermost/playwright-lib`) that provides:
    - Page objects for Mattermost UI pages
    - Component abstractions for UI elements
    - Test utilities and fixtures
    - Server setup and management functions
    - Visual testing support

2. **`specs/` Directory**: Contains the actual test files organized by type:
    - `functional/` - Functional tests for various features
    - `visual/` - Visual regression tests
    - `accessibility/` - Accessibility tests
    - `client/` - Client API tests

3. **Test Fixtures**: The main test fixture (`pw`) provides:
    - Browser context management
    - Page actions and utilities
    - Server API helpers
    - Random data generators
    - Visual testing helpers

4. **Page Object Model**: UI abstractions are organized in:
    - `lib/src/ui/pages/` - Page objects (Login, Channels, etc.)
    - `lib/src/ui/components/` - Component objects (Posts, Menus, etc.)

### Test Flow

1. Tests typically follow this pattern:
    - Initialize test setup with `pw.initSetup()`
    - Login to a test account with `pw.testBrowser.login()`
    - Navigate to the relevant page
    - Perform actions and assertions
    - Optionally take visual snapshots

2. Visual tests also:
    - Hide dynamic content with `pw.hideDynamicChannelsContent()`
    - Take snapshots with `pw.matchSnapshot()`

## Environment Configuration

Tests can be configured through environment variables:

- `PW_BASE_URL` - Mattermost server URL (default: http://localhost:8065)
- `PW_ADMIN_USERNAME` - Admin username (default: sysadmin)
- `PW_ADMIN_PASSWORD` - Admin password (default: Sys@dmin-sample1)
- `PW_HEADLESS` - Run tests headless (default: true)
- `PW_SNAPSHOT_ENABLE` - Enable snapshot testing (default: false)
- `PW_SLOWMO` - Add delay between actions in ms (default: 0)
- `PW_WORKERS` - Number of parallel workers (default: 1)
- `PERCY_TOKEN` - Authentication token for Percy visual testing service (required for Percy tests)

## Server Setup

Before running tests, a Mattermost server must be available. Two options:

1. **Run from source**:

    ```bash
    cd server && make run
    ```

2. **Run using Docker** (recommended for testing):
    ```bash
    # Configure environment in e2e-tests/.ci/env
    cd e2e-tests && TEST=playwright make
    ```

## Best Practices

1. **Page Object Pattern**: Always use page/component objects from the library. No static UI selectors should be in test files.

2. **Locator Priority**: Follow the Playwright recommended locator strategy (see [Playwright Locators Quick Guide](https://playwright.dev/docs/locators#quick-guide)). Use locators in this priority order:
    1. `getByRole()` - Preferred. Locates by accessibility role and accessible name (e.g., `getByRole('button', {name: 'Submit'})`).
    2. `getByText()` - Locates by visible text content.
    3. `getByLabel()` - Locates form controls by their associated label text.
    4. `getByPlaceholder()` - Locates inputs by placeholder text.
    5. `getByAltText()` - Locates elements (usually images) by alt text.
    6. `getByTitle()` - Locates by the `title` attribute.
    7. `getByTestId()` - Last resort. Locates by `data-testid` attribute.
    - **Avoid** CSS selectors (`.class`, `#id`), XPath, and raw `locator()` calls unless none of the above locators can identify the element.
    - Use `{exact: true}` when the accessible name might partially match other elements (e.g., `getByRole('button', {name: 'Invite', exact: true})`).

3. **Visual Testing**: For visual tests:
    - Place all visual tests in the `specs/visual/` directory
    - Always include the `@visual` tag in the test tags array
    - Run via Docker container for consistency to maintain screenshot integrity
    - Use `pw.hideDynamicChannelsContent()` to hide dynamic elements that could cause flaky tests
    - Update snapshots with `npm run test:update-snapshots` only from within the Docker container
    - For Percy-based visual testing:
        - A valid `PERCY_TOKEN` environment variable must be set
        - Tests should only be run inside the Playwright Docker container
    - Follow the visual test documentation format like other tests, with proper JSDoc and comments

4. **Test Title Validation with Claude Code**: When using Claude:
    - Run `claude spec/path/to/file.spec.ts` to check your test file
    - Ask: "Check if test titles follow the format in CLAUDE.md"
    - Claude will analyze each test title and suggest improvements
    - Format should be action-oriented, feature-specific, context-aware, and outcome-focused
    - Example: `creates scheduled message from channel and posts at scheduled time`

5. **Test Structure**:
    - Use descriptive test titles that follow this format:
        - **Action-oriented**: Start with a verb that describes the main action
        - **Feature-specific**: Include the feature or component being tested
        - **Context-aware**: Include relevant context (where/how it's being performed)
        - **Outcome-focused**: Specify the expected outcome or behavior
    - Examples of well-formatted test titles:
        - `"creates scheduled message from channel and posts at scheduled time"`
        - `"edits scheduled message content while preserving send date"`
        - `"reschedules message to a future date from scheduled posts page"`
        - `"deletes scheduled message from scheduled posts page"`
        - `"converts draft message to scheduled message"`
    - Test keys (`MM-T\d+`) in test titles are optional for new tests
        - New tests without keys will automatically be registered in the test management system after merge
        - Test keys will be assigned later through a separate automated process
    - Follow the `# Action` and `* Verification` comment pattern
    - Group related tests in the same spec file
    - Keep tests independent and isolated
    - Use tags to categorize tests with `{tag: '@feature_name'}`

6. **Test Documentation Format**:
    - Include JSDoc-style documentation before each test:
        ```typescript
        /**
         * @objective Clear description of what the test verifies
         *
         * @precondition
         * Special setup or conditions required for the test
         * Note: Only include preconditions that are not part of the default setup.
         * Standard conditions like "a test server is running" should be omitted.
         */
        test('MM-T1234 descriptive test title', {tag: '@feature_tag'}, async ({pw}) => {
            // Test implementation
        });
        ```
    - If no special preconditions are needed, omit the `@precondition` tag entirely:
        ```typescript
        /**
         * @objective Clear description of what the test verifies
         */
        test('descriptive test title', {tag: '@feature_tag'}, async ({pw}) => {
            // Test implementation
        });
        ```
    - For new tests, the MM-T ID is optional and will be assigned later:
        ```typescript
        /**
         * @objective Clear description of what the test verifies
         */
        test('descriptive test title', {tag: '@feature_tag'}, async ({pw}) => {
            // Test implementation
        });
        ```
    - Use comment prefixes to clearly indicate actions and verifications:
        - `// # descriptive action` - Comments that describe steps being taken (e.g., `// # Initialize user and login`)
        - `// * descriptive verification` - Comments that describe assertions/checks (e.g., `// * Verify message appears in channel`)

7. **Browser Compatibility**:
    - Tests run on Chrome, Firefox, and iPad by default
    - Consider browser-specific behaviors for certain features
    - Use `test.skip()` for browser-specific limitations

8. **Test Documentation Linting**:
    - Run `npm run lint:test-docs` to verify all spec files follow the documentation format
    - The linter checks for proper JSDoc tags, test titles, feature tags, and action/verification comments
    - This is also included in the standard `npm run check` command
    - See the example in `specs/functional/channels/scheduled_messages/scheduled_messages.spec.ts`

## POM & Locator Migration Playbook

This section documents conventions for migrating E2E specs from raw DOM selectors to semantic-locator Page Object Model (POM) classes, and for adding leaf-component aria-snapshot coverage.

### Locator conventions

1. **Page Object Pattern**: Always use page/component objects from the library. No static UI selectors in test files.
2. **Locator priority**: `getByRole()` (preferred; use `{exact: true}` when the accessible name may partially match) → `getByText()` → `getByLabel()` → `getByPlaceholder()` → `getByAltText()` → `getByTitle()` → `getByTestId()` (last resort). **Avoid** CSS selectors (`.class`, `#id`), XPath, and raw `locator()` calls unless none of the above can identify the element.
3. `locator('#id')` is acceptable only for elements that already carry that id in the live DOM. For dynamic ids use `getByTestId(/^prefix-/)` or `locator('[data-testid^="..."]')`.
4. **POM shape**: pages take `(page: Page)` → `this.page`; components take `(container: Locator)` → `this.container`; every class exposes `async toBeVisible()`; compose children via `new Child(container.locator(...))`; register new classes in the barrels `lib/src/ui/components/index.ts` / `lib/src/ui/pages/index.ts`.
5. **`data-testid` naming**: descriptive kebab-case; add to React source only when no role/text/label locator works. Regenerate affected webapp Jest `__snapshots__/*.snap` when React source changes.

### Agent-browser verify loop

Before writing locators for a new or extended POM:

1. Start the Mattermost server (`cd server && ENABLED_DOCKER_SERVICES='postgres redis' RUN_SERVER_IN_BACKGROUND=true make run`).
2. Use the agent browser (or `npm run codegen`) to log in, open the target UI, and inspect real ARIA roles, accessible names, labels, and `data-testid` values.
3. Prefer semantic locators from that inspection; add `data-testid` to React only as a last resort.
4. Assertions still run through the Playwright test runner — the browser is for inspection only.

### Component aria-snapshot project

Leaf-component aria snapshots live in a dedicated Playwright project separate from functional, visual, and accessibility runs:

- **Specs**: `specs/components/` — tag snapshot tests with `@snapshots` (and `@components` for categorization).
- **Project**: `components` in `playwright.config.ts` (`testDir: 'specs/components'`, `dependencies: ['setup']`).
- **Isolation**: `chrome`, `firefox`, and `ipad` projects set `testIgnore: /specs[\\/]+components[\\/]+/` so browser suites skip component specs. The default `npm run test` and `npm run test:ci` scripts do not include the `components` project.
- **Baselines**: `toMatchAriaSnapshot` writes under `specs/components/<file>-snapshots-a11y/` (configured via `expect.toMatchAriaSnapshot.pathTemplate`).
- **Commands**:
    - `npm run test:components` — run component aria-snapshot specs only.
    - `npm run test:components-update-snapshots` — regenerate baselines for `@snapshots` tests in the components project.

Example component snapshot spec:

```typescript
test('aria-snapshot of login body card', {tag: ['@components', '@snapshots']}, async ({pw}) => {
    await pw.hasSeenLandingPage();
    await pw.loginPage.goto();
    await pw.loginPage.toBeVisible();
    await expect(pw.loginPage.bodyCard).toMatchAriaSnapshot();
});
```
