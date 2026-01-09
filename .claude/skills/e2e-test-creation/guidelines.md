# E2E Test Creation Guidelines for Mattermost

## Table of Contents
1. [When to Create E2E Tests](#when-to-create-e2e-tests)
2. [Test Organization](#test-organization)
3. [Playwright Agent Workflow](#playwright-agent-workflow)
4. [Mattermost E2E Framework](#mattermost-e2e-framework)
5. [Test Creation Process](#test-creation-process)
6. [Best Practices](#best-practices)
7. [Common Patterns](#common-patterns)

---

## When to Create E2E Tests

### ✅ Always Create Tests For:
- **New user-facing features** in `webapp/`
  - New React components with user interactions
  - New pages or views
  - New modals or dialogs

- **Changes to critical user flows**
  - Authentication (login, logout, SSO, MFA)
  - Messaging (post, edit, delete, react, reply)
  - Channel operations (create, join, leave, archive)
  - Team management

- **UI components with backend interactions**
  - Forms that submit to APIs
  - Real-time updates (WebSocket events)
  - File uploads/downloads
  - Search functionality

- **Real-time and collaborative features**
  - Multi-user messaging
  - Presence indicators
  - Typing indicators
  - Live notifications

### ❌ Skip E2E Tests For:
- **Pure utility functions** (covered by unit tests)
- **Backend-only changes** (covered by integration tests)
- **Documentation updates**
- **Configuration changes**
- **CSS-only styling changes** (unless they affect layout/interaction)

---

## Test Organization

### Directory Structure
```
e2e-tests/playwright/
├── specs/
│   ├── functional/
│   │   ├── ai-assisted/     # AI-generated tests (this skill)
│   │   │   ├── channels/
│   │   │   ├── messaging/
│   │   │   ├── system_console/
│   │   │   └── ...
│   │   ├── channels/        # Manual tests
│   │   ├── messaging/       # Manual tests
│   │   └── ...
│   ├── visual/              # Visual regression tests
│   │   ├── common/
│   │   ├── channels/
│   │   └── ...
│   └── accessibility/        # Accessibility tests
├── lib/                      # Shared library code
├── .claude/
│   └── agents/              # Playwright MCP agents
└── playwright.config.ts
```

### File Naming Conventions
- **Format**: `{feature_name}.spec.ts`
- **Examples**:
  - `channel_creation.spec.ts`
  - `post_message.spec.ts`
  - `user_profile.spec.ts`
- **Location**: AI-generated tests go in `specs/functional/ai-assisted/{category}/`
  - Channel features → `e2e-tests/playwright/specs/functional/ai-assisted/channels/`
  - Messaging features → `e2e-tests/playwright/specs/functional/ai-assisted/messaging/`
  - System Console → `e2e-tests/playwright/specs/functional/ai-assisted/system_console/`
  - Visual tests → `e2e-tests/playwright/specs/visual/{category}/`

**Why `ai-assisted/`?**
- Easy to track AI-generated vs manual tests
- Can run separately: `npx playwright test specs/functional/ai-assisted/`
- Clear attribution for quality metrics and reviews

### Test Grouping
- Use `test.describe()` for related tests
- Group by user workflow or feature
- Keep files focused (< 300 lines)

---

## Playwright Agent Workflow

### The Three-Agent System

Claude will use a three-agent workflow to create and maintain E2E tests automatically.

**⚠️ IMPORTANT - Cost and Time Efficiency:**
- **Default mode:** Generate 1-3 tests maximum (core business logic only)
- **Comprehensive mode:** Only when user explicitly requests "comprehensive tests", "edge cases", or "full coverage"
- This saves AI costs and generation time while ensuring critical functionality is tested

#### 1. **Planner Agent** (`@playwright-planner`)
**Purpose**: Explores the application and creates comprehensive test plans

**When to Use**:
- After making webapp changes
- When adding new features
- When updating existing features

**What It Does**:
- Analyzes the feature's **core business logic only**
- Identifies **primary** user interactions (not all)
- Maps out **1-3 essential test scenarios** (happy path + critical errors)
- Creates **concise** test plans in markdown

**Default output:** 1-3 scenarios only
**Comprehensive mode:** Only when explicitly requested by user

**Example Invocation**:
```
@playwright-planner "Create test plan for channel creation feature"
```

**Output**: **Concise** test plan with:
- Feature overview
- **1-3 core test scenarios** (happy path + critical errors only)
- Expected results
- Selector suggestions

**Skip by default** (unless user explicitly requests):
- Edge cases
- Multi-user scenarios
- Exhaustive error conditions
- Performance testing

#### 2. **Generator Agent** (`@playwright-generator`)
**Purpose**: Transforms test plans into executable Playwright tests

**When to Use**:
- After Planner creates a test plan
- When you have a manual test plan to implement

**What It Does**:
- Converts test plan to **minimal** executable code (1-3 tests only)
- Uses proper Mattermost patterns (pw fixture, page objects)
- Includes appropriate assertions
- Follows code conventions
- Adds proper tags and comments

**Generates:** 1-3 tests maximum by default

**Example Invocation**:
```
@playwright-generator "Generate tests from the channel creation test plan"
```

**Output**: **Minimal** `.spec.ts` files with:
- Copyright headers
- Proper imports
- **1-3 test implementations** (core business logic only)
- Setup and cleanup
- Descriptive comments

**Important:** Do NOT over-generate tests. Keep it minimal (1-3 tests) unless user explicitly requests comprehensive coverage.

#### 3. **Healer Agent** (`@playwright-healer`)
**Purpose**: Automatically fixes flaky or broken tests

**When to Use**:
- When tests fail intermittently
- When selector changes break tests
- When timing issues occur
- After application updates

**What It Does**:
- Analyzes test failures
- Diagnoses root causes
- Applies targeted fixes
- Improves test robustness
- Suggests preventive measures

**Example Invocation**:
```
@playwright-healer "Fix the failing message posting test"
```

**Output**:
- Healed test code
- Explanation of changes
- Root cause analysis
- Prevention recommendations

### Typical Workflow

```mermaid
graph TD
    A[Make webapp change] --> B[Claude detects change]
    B --> C[@playwright-planner]
    C --> D[Test plan created]
    D --> E[@playwright-generator]
    E --> F[Test code generated]
    F --> G[Run tests]
    G --> H{Tests pass?}
    H -->|Yes| I[Done]
    H -->|No| J[@playwright-healer]
    J --> K[Tests fixed]
    K --> G
```

---

## Mattermost E2E Framework

### The `pw` Fixture

Mattermost provides a custom Playwright fixture that extends the standard Playwright API:

```typescript
import {test} from '@mattermost/playwright-lib';

test('my test', async ({pw, page, browserName, viewport}) => {
    // pw provides Mattermost-specific helpers
    // page is the standard Playwright page object
    // browserName: 'chromium' | 'firefox' | 'webkit'
    // viewport: {width: number, height: number}
});
```

### Available pw Methods

#### Authentication
```typescript
// Skip landing page for logged-in users
await pw.hasSeenLandingPage();

// Get admin API client
const {adminClient} = await pw.getAdminClient();

// Get user API client
const {userClient} = await pw.getUserClient();
```

#### Page Objects
```typescript
// Access built-in page objects
await pw.loginPage.goto();
await pw.loginPage.toBeVisible();
await pw.loginPage.signInButton.click();
```

#### Visual Testing
```typescript
// Capture visual snapshots
await pw.matchSnapshot(testInfo, {page, browserName, viewport});
```

### Test Structure

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective [What this test verifies]
 */
test('MM-TXXXX descriptive test name', {tag: '@feature-area'}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Create test data
    const channel = await adminClient.createChannel({
        team_id: team.id,
        name: `test-${pw.random.id()}`,
        display_name: 'Test Channel',
        type: 'O',
    });

    // # Log in user
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Navigate and perform actions (access page via page objects)
    await channelsPage.goto();
    await channelsPage.page.click('[data-testid="button"]');

    // * Verify expected results
    await expect(channelsPage.page.locator('[data-testid="result"]')).toBeVisible();
});
```

### ⚠️ CRITICAL RULES - MUST FOLLOW

**❌ NEVER DO:**
1. `test.describe()` - Don't use describe blocks
2. `async ({pw, page})` - Don't use both pw and page
3. `{tag: ['@tag1', '@tag2']}` - Don't use array of tags
4. Missing JSDoc `@objective` comment
5. Using wrong comment prefixes (not using `// #` and `// *`)

**✅ ALWAYS DO:**
1. Include JSDoc with `@objective` (required) and `@precondition` (optional)
2. `test('descriptive title', {tag: '@feature'}, async ({pw}) => {})` - Standalone tests only
3. ONLY use `{pw}` parameter, access page via `channelsPage.page` or `systemConsolePage.page`
4. Single tag string: `{tag: '@feature-area'}`
5. Test titles must be action-oriented: `"creates channel and posts message"`
6. Use `// #` for action comments, `// *` for verification comments
7. Each test is completely independent with its own setup
8. MM-T IDs are OPTIONAL for new tests (will be auto-assigned later)

### Tags System

Use tags to organize and filter tests:

| Tag | Purpose | Example |
|-----|---------|---------|
| `@visual` | Visual regression tests | Screenshot comparisons |
| `@functional` | Functional behavior tests | User interactions |
| `@smoke` | Critical path tests | Login, post message |
| `@accessibility` | A11y tests | Keyboard navigation |
| `@{feature}` | Feature-specific | `@channels`, `@messaging` |

**Example**:
```typescript
test(
    'channel creation',
    {tag: ['@functional', '@channels', '@smoke']},
    async ({pw, page}) => { /* ... */ }
);
```

---

## Test Documentation Requirements

Every test MUST follow Mattermost's documentation standards to ensure maintainability and automated validation.

### JSDoc Format (Required)

Every test must include JSDoc with the `@objective` tag:

```typescript
/**
 * @objective Clear description of what the test verifies
 */
test('creates channel and posts first message', {tag: '@channels'}, async ({pw}) => {
    // Test implementation
});
```

### Optional @precondition Tag

Include `@precondition` only for special setup requirements beyond the standard test environment:

```typescript
/**
 * @objective Verify scheduled message posts at the correct time
 *
 * @precondition
 * Server time zone is set to UTC
 * User has permission to schedule messages
 */
test('scheduled message posts at specified time', {tag: '@messaging'}, async ({pw}) => {
    // Test implementation
});
```

**When to omit @precondition:**
- Standard conditions like "test server is running" - omit these
- Default user permissions - omit these
- Normal test setup via `pw.initSetup()` - omit this
- Only include truly special prerequisites

### Test Title Format

Test titles must be **action-oriented**, **feature-specific**, **context-aware**, and **outcome-focused**.

**Good Examples:**
```typescript
test('creates scheduled message from channel and posts at scheduled time', ...)
test('edits scheduled message content while preserving send date', ...)
test('reschedules message to a future date from scheduled posts page', ...)
test('deletes scheduled message from scheduled posts page', ...)
test('converts draft message to scheduled message', ...)
```

**Title Format Pattern:**
1. **Start with a verb**: creates, edits, deletes, displays, shows, opens, closes, etc.
2. **Include the feature**: channel, message, user profile, etc.
3. **Add context**: from where, using what, when, etc.
4. **Specify outcome**: what the expected result is

**Bad Examples:**
```typescript
test('test channel creation', ...)  // ❌ Not action-oriented
test('should create a channel', ...)  // ❌ Don't use "should"
test('channel', ...)  // ❌ Too vague
test('create', ...)  // ❌ Missing context
```

### MM-T ID Requirement

**MM-T IDs are OPTIONAL for new tests:**
- New tests: Use descriptive titles without IDs
- IDs will be auto-assigned after merge via automated process
- If you have an existing Jira ticket: Include it as `'MM-T5521 descriptive title'`

**Examples:**
```typescript
// ✅ New test without ID (preferred)
test('creates channel and invites team members', {tag: '@channels'}, async ({pw}) => {

// ✅ Existing ticket with ID
test('MM-T5521 searches users by first name in system console', {tag: '@system_console'}, async ({pw}) => {
```

### Comment Prefixes (Required)

Use specific prefixes to distinguish actions from verifications:

- `// #` = Action/step being performed
- `// *` = Verification/assertion/check

**Example:**
```typescript
test('sends direct message to team member', {tag: '@messaging'}, async ({pw}) => {
    // # Initialize user and login
    const {user, otherUser} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Open direct message modal
    await channelsPage.page.click('[data-testid="add-dm-button"]');
    await channelsPage.page.locator('[data-testid="dm-modal"]').waitFor();

    // # Search for user and select
    await channelsPage.page.fill('[data-testid="user-search"]', otherUser.username);
    await channelsPage.page.click(`[data-testid="user-${otherUser.id}"]`);

    // # Send message
    const messageText = `Test message ${pw.random.id()}`;
    await channelsPage.page.fill('[data-testid="post-textbox"]', messageText);
    await channelsPage.page.press('[data-testid="post-textbox"]', 'Enter');

    // * Verify message appears in DM channel
    await expect(channelsPage.page.locator(`text=${messageText}`)).toBeVisible();

    // * Verify DM channel appears in sidebar
    await expect(channelsPage.page.locator(`[data-testid="dm-${otherUser.id}"]`)).toBeVisible();
});
```

### Test Documentation Linting

Mattermost enforces documentation standards via automated linting:

**Run Linting:**
```bash
# Check test documentation format
npm run lint:test-docs

# Run all checks (includes test docs)
npm run check
```

**What the linter checks:**
- JSDoc `@objective` tag is present
- Test titles follow format guidelines
- Feature tags are included
- Action/verification comment prefixes are used
- No common anti-patterns

**All generated tests MUST pass linting before being committed.**

### Complete Documentation Example

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify user can create a public channel and post a message
 */
test('creates public channel and posts first message', {tag: '@channels'}, async ({pw}) => {
    // # Initialize test setup
    const {adminClient, user, team} = await pw.initSetup();

    // # Login as user
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open create channel modal
    await channelsPage.sidebarLeft.createPublicChannel.click();
    await channelsPage.page.locator('[data-testid="new-channel-modal"]').waitFor();

    // # Fill channel details
    const channelName = `test-channel-${pw.random.id()}`;
    await channelsPage.page.fill('[data-testid="channel-name"]', channelName);
    await channelsPage.page.fill('[data-testid="channel-purpose"]', 'Test channel purpose');

    // # Create channel
    await channelsPage.page.click('[data-testid="create-channel-button"]');

    // * Verify channel is created and visible
    await expect(channelsPage.page.locator('[data-testid="channel-header"]')).toContainText(channelName);

    // # Post first message
    const messageText = `First message ${pw.random.id()}`;
    await channelsPage.page.fill('[data-testid="post-textbox"]', messageText);
    await channelsPage.page.press('[data-testid="post-textbox"]', 'Enter');

    // * Verify message appears in channel
    await expect(channelsPage.page.locator(`text=${messageText}`)).toBeVisible();

    // * Verify message is from current user
    await expect(channelsPage.page.locator('[data-testid="post-author"]')).toContainText(user.username);
});
```

---

## Test Creation Process

### Step-by-Step Guide

#### 1. Detect Changes
When you modify code in `webapp/`, Claude should automatically:
- Identify affected features
- Determine if E2E tests are needed
- Check for existing test coverage

#### 2. Plan Tests
Invoke the Planner agent:
```
@playwright-planner "Create test plan for [feature description]"
```

The Planner will:
- Analyze the feature
- Create test scenarios
- Identify edge cases
- Suggest test data needs

#### 3. Generate Tests
Invoke the Generator agent:
```
@playwright-generator "Generate tests from the test plan"
```

The Generator will:
- Create `.spec.ts` files
- Implement test scenarios
- Add proper setup/cleanup
- Follow Mattermost conventions

#### 4. Run Tests
Execute the generated tests:
```bash
# Run specific test file
npx playwright test e2e-tests/playwright/specs/functional/ai-assisted/channels/channel_creation.spec.ts

# Run with UI mode (for debugging)
npx playwright test --ui

# Run specific tag
npx playwright test --grep @channels
```

#### 5. Heal if Needed
If tests fail:
```
@playwright-healer "Fix the failing test in e2e-tests/playwright/specs/functional/ai-assisted/channels/channel_creation.spec.ts"
```

The Healer will:
- Diagnose the failure
- Apply fixes
- Verify the fix
- Explain changes

---

## Best Practices

### 1. Selector Strategy (Priority Order)

#### ✅ Preferred: data-testid
```typescript
await page.click('[data-testid="post-send-button"]');
```

**Why**: Stable, semantic, survives refactoring

#### ✅ Good: ARIA roles and labels
```typescript
await page.getByRole('button', {name: 'Send'}).click();
await page.getByLabel('Message input').fill('Hello');
```

**Why**: Semantic, accessible, relatively stable

#### ⚠️ Acceptable: Text content
```typescript
await page.getByText('Create Channel').click();
```

**Why**: Works for unique text, but may break with i18n changes

#### ❌ Avoid: CSS selectors
```typescript
await page.click('.btn-primary.submit'); // Brittle!
await page.click('div > div > button:nth-child(3)'); // Very brittle!
```

**Why**: Breaks easily with styling or structure changes

### 2. Async/Await Patterns

#### ✅ Always await Playwright actions
```typescript
await page.click('[data-testid="button"]');
await page.fill('[data-testid="input"]', 'text');
await expect(page.locator('[data-testid="result"]')).toBeVisible();
```

#### ❌ Never forget await
```typescript
page.click('[data-testid="button"]'); // Will cause race conditions!
```

### 3. Waiting Strategies

#### ✅ Use Playwright's auto-waiting
```typescript
// Playwright automatically waits for element to be:
// - Attached to DOM
// - Visible
// - Stable (not animating)
// - Enabled (for actions like click)
await page.click('[data-testid="button"]');
```

#### ✅ Wait for specific conditions
```typescript
// Wait for element to be visible
await page.locator('[data-testid="modal"]').waitFor({state: 'visible'});

// Wait for network response
await page.waitForResponse(resp =>
    resp.url().includes('/api/v4/posts') && resp.status() === 201
);

// Wait for WebSocket event
const ws = await page.waitForEvent('websocket');
```

#### ❌ Avoid arbitrary timeouts
```typescript
await page.waitForTimeout(5000); // Don't do this!
```

**Why**: Makes tests slow and doesn't guarantee condition is met

### 4. Test Independence

#### ✅ Each test should be isolated
```typescript
test.describe('Channel Operations', () => {
    let testChannel: {id: string, name: string};

    test.beforeEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        testChannel = await adminClient.createChannel({...});
    });

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        if (testChannel?.id) {
            await adminClient.deleteChannel(testChannel.id);
        }
    });

    test('can post in channel', async ({page}) => {
        // Test uses testChannel but doesn't affect other tests
    });
});
```

#### ❌ Don't rely on test execution order
```typescript
test('create channel', async () => { /* creates 'test-channel' */ });
test('post in channel', async () => { /* assumes 'test-channel' exists */ }); // Bad!
```

### 5. Assertions

#### ✅ Use specific assertions
```typescript
await expect(page.locator('[data-testid="count"]')).toHaveText('5');
await expect(page.locator('[data-testid="message"]')).toBeVisible();
await expect(page.locator('.post')).toHaveCount(10);
```

#### ✅ Use flexible matchers for dynamic content
```typescript
// Partial text match
await expect(page.locator('[data-testid="timestamp"]'))
    .toContainText('2:30');

// Regex for flexibility
await expect(page.locator('[data-testid="username"]'))
    .toHaveText(/user\d+/);
```

#### ❌ Don't use generic assertions
```typescript
const visible = await page.locator('[data-testid="element"]').isVisible();
expect(visible).toBeTruthy(); // Use specific assertion instead!
```

### 6. Test Data Management

#### ✅ Use dynamic test data
```typescript
const channelName = `test-channel-${Date.now()}`;
const message = `test-message-${Math.random()}`;
```

**Why**: Prevents conflicts when running tests in parallel

#### ✅ Create data via API
```typescript
const {adminClient} = await pw.getAdminClient();
const channel = await adminClient.createChannel({
    team_id: teamId,
    name: `test-${Date.now()}`,
    display_name: 'Test Channel',
    type: 'O',
});
```

**Why**: Faster than UI, more reliable

#### ✅ Clean up test data
```typescript
test.afterEach(async ({pw}) => {
    const {adminClient} = await pw.getAdminClient();
    await adminClient.deleteChannel(testChannel.id);
});
```

**Why**: Keeps test environment clean

### 7. Performance

#### ✅ Run tests in parallel
```typescript
test.describe.configure({mode: 'parallel'});

test.describe('Channel Tests', () => {
    test('test 1', async () => { /* ... */ });
    test('test 2', async () => { /* ... */ });
});
```

#### ✅ Use test.describe for related tests
```typescript
test.describe('Message Posting', () => {
    // Shared setup
    test.beforeEach(async ({pw, page}) => {
        await page.goto('/channels/town-square');
    });

    test('post text message', async () => { /* ... */ });
    test('post with emoji', async () => { /* ... */ });
    test('post with mention', async () => { /* ... */ });
});
```

---

## Common Patterns

### Pattern 1: Testing Real-time Updates

```typescript
test('message appears for other users', async ({browser, pw}) => {
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();

    // Both users go to same channel
    await user1Page.goto('/team/channels/town-square');
    await user2Page.goto('/team/channels/town-square');

    // User 1 posts message
    const message = `Test ${Date.now()}`;
    await user1Page.fill('[data-testid="post-textbox"]', message);
    await user1Page.press('[data-testid="post-textbox"]', 'Enter');

    // User 2 sees message in real-time
    await expect(user2Page.locator(`text=${message}`))
        .toBeVisible({timeout: 10000}); // Longer timeout for WebSocket

    await user1Context.close();
    await user2Context.close();
});
```

### Pattern 2: Testing Modal Interactions

```typescript
test('create channel via modal', async ({page}) => {
    // Open modal
    await page.click('[data-testid="create-channel-button"]');

    // Wait for modal to be ready
    await page.locator('[data-testid="create-channel-modal"]')
        .waitFor({state: 'visible'});

    // Fill form
    await page.fill('[data-testid="channel-name-input"]', 'new-channel');
    await page.fill('[data-testid="channel-description"]', 'Description');

    // Submit
    await page.click('[data-testid="modal-submit"]');

    // Wait for modal to close
    await page.locator('[data-testid="create-channel-modal"]')
        .waitFor({state: 'hidden'});

    // Verify channel was created
    await expect(page.locator('text=new-channel')).toBeVisible();
});
```

### Pattern 3: Testing API Error Handling

```typescript
test('shows error on network failure', async ({page}) => {
    // Intercept API call
    await page.route('**/api/v4/channels', (route) => {
        route.fulfill({
            status: 500,
            body: JSON.stringify({message: 'Internal Server Error'}),
        });
    });

    // Trigger action
    await page.click('[data-testid="create-channel"]');

    // Verify error message
    await expect(page.locator('[data-testid="error-message"]'))
        .toBeVisible();
    await expect(page.locator('[data-testid="error-message"]'))
        .toContainText('error');
});
```

---

## Running Tests Automatically

### During Development
When you make a change, Claude Code will automatically:
1. Detect webapp modifications
2. Invoke @playwright-planner
3. Invoke @playwright-generator
4. Run the generated tests
5. Invoke @playwright-healer if tests fail

### Manual Test Execution

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test e2e-tests/playwright/specs/functional/ai-assisted/channels/channel_creation.spec.ts

# Run tests matching pattern
npx playwright test channel

# Run tests with specific tag
npx playwright test --grep @smoke

# Run tests in UI mode (debugging)
npx playwright test --ui

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests in specific browser
npx playwright test --project=chrome
npx playwright test --project=firefox

# Run tests and generate report
npx playwright test && npx playwright show-report
```

### CI/CD Integration
Tests automatically run:
- On every PR affecting `webapp/`
- Pre-merge checks
- Nightly full suite runs
- With automatic healing for flaky tests

---

## Summary Checklist

Before committing changes, ensure:
- [ ] E2E tests created for all user-facing changes
- [ ] Tests follow Mattermost conventions (pw fixture, tags, comments)
- [ ] Selectors use data-testid or semantic attributes
- [ ] All async operations are properly awaited
- [ ] Tests are independent and isolated
- [ ] Test data is created via API and cleaned up
- [ ] Tests pass consistently (run 3+ times)
- [ ] Proper tags are applied
- [ ] Tests are organized in correct directory

---

**Remember**: E2E tests should test user workflows, not implementation details. Think like a user, not a developer!
