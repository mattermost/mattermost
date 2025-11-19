---
name: e2e-test-creation
description: Automatically generates E2E Playwright tests for Mattermost frontend changes. Bridges manual test cases with E2E automation. Provides comprehensive guidelines, patterns, and examples for creating robust, maintainable tests following Mattermost conventions.
---

# E2E Test Creation Skill for Mattermost

This skill helps you automatically generate comprehensive E2E tests for Mattermost using Playwright.

## When This Skill is Used

This skill is automatically activated when:
- You modify files in the `webapp/` directory
- You create or update React components
- You add new user-facing features
- You make changes to critical user flows (messaging, channels, auth)
- You explicitly invoke test generation
- You need to analyze test coverage gaps
- You want to convert manual test cases to E2E tests
- You work with Zephyr test management system (MM-T test cases)

## What This Skill Does

### 1. Test Planning
Analyzes your changes and creates **focused test plans** covering:
- **Core business logic** (primary user workflows)
- **Positive flow** (happy path)
- **Critical negative flows** (must-handle errors only)

**Only when explicitly requested:**
- Comprehensive edge cases
- Multi-user scenarios
- Visual regressions
- Performance testing

### 2. Test Generation
Generates **minimal, focused** Playwright tests that:
- **Test core business logic only** (1-3 tests by default)
- Follow Mattermost patterns (pw fixture, page objects)
- Use semantic selectors (data-testid, ARIA roles)
- Are isolated and independent

**Default approach:**
- 1 test for primary happy path
- 1-2 tests for critical error scenarios (if applicable)
- **Total: 1-3 tests maximum unless requested otherwise**

### 3. Test Healing
Automatically fixes flaky or broken tests by:
- Updating outdated selectors
- Improving wait strategies
- Fixing timing issues
- Strengthening assertions

### 4. Zephyr Test Automation
Automates test creation and syncs with Zephyr test management:
- **3-Stage Pipeline** - Plan → Skeleton Files → Zephyr Creation + Full Code
- **Automate Existing Tests** - Convert existing Zephyr test cases (MM-T format) to Playwright
- **Reverse Workflow (NEW)** - Create Zephyr test cases from existing E2E tests
- **Bi-directional Sync** - Create tests in Zephyr and update with automation details
- **Step Generation** - Automatically generate or refine test steps for Zephyr cases

## Three-Agent Workflow

This skill guides you through a three-phase approach:

### Phase 1: Planning
**Goal:** Explore the UI and create a detailed test plan

**Actions:**
- Analyze the feature/change
- Identify user workflows
- Map out test scenarios
- Flag potential flakiness areas
- Document prerequisites

**Output:** **Concise** markdown test plan (1-3 core scenarios only)

**Trigger comprehensive mode:** User explicitly requests "comprehensive tests", "edge cases", or "full coverage"

### Phase 2: Generation
**Goal:** Transform the plan into **minimal, focused** executable tests

**Actions:**
- Convert plan to TypeScript test code (1-3 tests only)
- Apply Mattermost patterns
- Use proper page objects
- Add meaningful assertions
- Include proper tags

**Output:** **Minimal** `.spec.ts` files (1-3 tests) ready to run

**Important:** Only generate comprehensive tests when user explicitly asks for "comprehensive", "edge cases", or "full coverage"

### Phase 3: Healing (if needed)
**Goal:** Fix failing or flaky tests

**Actions:**
- Analyze test failures
- Diagnose root causes
- Apply targeted fixes
- Improve robustness
- Prevent future issues

**Output:** Fixed tests with explanation

## Test Creation Guidelines

### ✅ Always Create Tests For:
- New user-facing features in `webapp/`
- Changes to critical flows (auth, messaging, channels)
- UI components with backend interactions
- Real-time/WebSocket features
- Plugin integrations

### ❌ Skip E2E Tests For:
- Pure utility functions (use unit tests)
- Backend-only changes (use integration tests)
- Documentation updates
- Configuration changes
- CSS-only styling changes

## Mattermost E2E Framework

### The `pw` Fixture
Mattermost uses a custom Playwright fixture that provides:
- `pw.testTeam` - Pre-created team for testing
- `pw.testUser` - Pre-created user for testing
- `pw.adminClient` - API client with admin privileges
- Helper methods for common operations

Example:
```typescript
test('should create a channel', async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const channelName = 'test-channel-' + Date.now();

    await pw.pages.channelsPage.goto(team.name);
    await pw.pages.channelsPage.createChannel(channelName);

    await expect(pw.page.locator(`[data-testid="channel-${channelName}"]`)).toBeVisible();
});
```

### Page Objects
Use built-in page objects:
- `pw.pages.loginPage`
- `pw.pages.channelsPage`
- `pw.pages.systemConsolePage`
- `pw.pages.globalHeader`

### Test Organization
```
e2e-tests/playwright/specs/
├── functional/          # Feature tests
│   ├── channels/
│   ├── messaging/
│   └── system_console/
├── visual/             # Visual regression tests
└── accessibility/      # A11y tests
```

## Best Practices

### 1. Selectors
**Preferred (in order):**
1. `data-testid` attributes
2. ARIA roles and labels
3. Semantic HTML (button, input, etc.)

**Avoid:**
- CSS classes (fragile)
- XPath (brittle)
- Text content (i18n issues)

### 2. Waiting Strategies
```typescript
// ✅ Good - Wait for specific condition
await expect(page.locator('[data-testid="message"]')).toBeVisible();

// ❌ Bad - Arbitrary timeout
await page.waitForTimeout(1000);
```

### 3. Test Isolation
- Each test should be independent
- Use `beforeEach` for setup
- Clean up test data in `afterEach`
- Don't rely on test execution order

### 4. Real-time Testing
For WebSocket/real-time features, use longer timeouts:
```typescript
await expect(page.locator('[data-testid="typing-indicator"]'))
    .toBeVisible({timeout: 10000});
```

### 5. Multi-user Scenarios
Use multiple browser contexts:
```typescript
test('multi-user chat', async ({browser}) => {
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    // Test real-time interactions
});
```

## Documentation Files

This skill includes comprehensive documentation:

### Core Guidelines
- **guidelines.md** - Complete test creation guidelines
- **examples.md** - Real-world test examples
- **mattermost-patterns.md** - Mattermost-specific patterns

### Zephyr Test Automation
- **QUICK_START.md** - 5-minute quick start guide
- **workflows/README.md** - Zephyr workflows overview
- **workflows/main-workflow.md** - 3-Stage pipeline (Plan → Skeleton → Zephyr + Code)
- **workflows/automate-existing.md** - Automate existing Zephyr test cases
- **tools/zephyr-api.md** - Zephyr API integration
- **tools/placeholder-replacer.md** - Placeholder replacement utility
- **e2e-tests/playwright/zephyr-helpers/** - Working Zephyr integration scripts

### Specialized Agents
- **agents/planner.md** - Test planning guidance
- **agents/generator.md** - Test generation patterns
- **agents/healer.md** - Test healing strategies
- **agents/skeleton-generator.md** - Generate skeleton test files
- **agents/zephyr-sync.md** - Zephyr sync orchestration
- **agents/test-automator.md** - Automate existing test cases
- **agents/e2e-to-zephyr-sync.md** - Reverse workflow: E2E test → Zephyr test case

## Running Tests

```bash
# Run all tests
npx playwright test

# Run specific feature
npx playwright test channels/

# Run with UI mode (debugging)
npx playwright test --ui

# Run in headed mode
npx playwright test --headed
```

## Example Workflow

When you add a new "Post Reactions" feature:

**DEFAULT MODE (Automatic):**
1. **You detect** changes in `webapp/components/post/reactions/`
2. **Plan phase**: Create FOCUSED test plan (1-3 scenarios):
   - Happy path: User adds reaction to post
   - Critical error: API failure when adding reaction
   - (SKIP: Multi-user, edge cases, etc.)
3. **Generate phase**: Create 1-2 tests in `e2e-tests/playwright/specs/functional/messaging/post_reactions.spec.ts`
4. **Run tests**: `npx playwright test post_reactions`
5. **Heal phase** (if needed): Fix any failures automatically

**COMPREHENSIVE MODE (User requests explicitly):**
User says: "create comprehensive tests for post reactions with edge cases"
1. **Plan phase**: Create comprehensive test plan (5+ scenarios):
   - Adding/removing reactions
   - Multiple users reacting (real-time)
   - Reaction counts updating
   - Edge cases (network failures, permission errors, etc.)
2. **Generate phase**: Create 5-8 tests covering all scenarios
3. **Run and heal** as needed

## Real-World Example Comparison

**Feature:** 3-character minimum for channel autocomplete

**❌ OLD APPROACH (Over-generated):**
- 5 tests generated automatically
- 288 lines of code
- Tests: basic minimum, 4+ characters, clear search, special characters, empty string
- **Problem:** Wasted AI costs, unnecessary tests

**✅ NEW APPROACH (Focused):**
- 2 tests generated by default
- 136 lines of code (53% less)
- Tests: basic minimum requirement, clear-and-retype behavior
- **Result:** Core business logic tested, costs saved

See examples:
- Over-generated: `e2e-tests/playwright/specs/functional/channels/search/browse_channels_min_char_autocomplete.spec.ts` (5 tests)
- Focused version: `e2e-tests/playwright/specs/functional/channels/search/browse_channels_min_char_autocomplete_focused.spec.ts` (2 tests)

## Quality Standards

Generated tests must:
- ✅ Use proper page objects and fixtures
- ✅ Include meaningful assertions
- ✅ **Test core business logic only (1-3 tests by default)**
- ✅ Be isolated and independent
- ✅ Use semantic locators
- ✅ Handle async operations properly
- ✅ Include descriptive comments
- ✅ Follow Mattermost conventions

## Test Documentation Requirements

Every test MUST include:
- **JSDoc with `@objective`** (required) - Describes what the test verifies
- **`@precondition`** (optional) - Only for special setup requirements
- **Action-oriented test titles** - Start with verb, include context and outcome
- **Comment prefixes** - `// #` for actions, `// *` for verifications
- **Single tag string** - `{tag: '@feature-area'}` not array
- **Standalone tests** - No `test.describe()` blocks

## Key Patterns

### Pattern 1: Basic Test Structure
```typescript
/**
 * @objective Verify user can create a channel
 */
test('creates public channel and posts first message', {tag: '@channels'}, async ({pw}) => {
    const {adminClient, user, team} = await pw.initSetup();

    // # Login as user
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Navigate and perform action
    await channelsPage.goto();
    await channelsPage.page.click('[data-testid="create-channel"]');

    // * Verify expected result
    await expect(channelsPage.page.locator('[data-testid="new-channel"]')).toBeVisible();
});
```

### Pattern 2: System Console Tests
```typescript
test('searches users by first name in system console', {tag: '@system_console'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Login as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Navigate to Users section
    await systemConsolePage.goto();
    await systemConsolePage.sidebar.goToItem('Users');

    // * Verify search works
    await systemConsolePage.systemUsers.enterSearchText(user.first_name);
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(user.email);
});
```

## Activation

This skill automatically activates when changes are detected in `webapp/` directory. You can also manually invoke it by requesting E2E test generation in conversation.

## Cost Efficiency

**Default behavior saves costs:**
- Generates 1-3 tests instead of 5+ tests
- Focuses on business value, not edge cases
- Reduces AI generation time by 50%+
- Only expands when explicitly requested

This approach ensures comprehensive coverage of critical functionality while minimizing unnecessary test generation.
