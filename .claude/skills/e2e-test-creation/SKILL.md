---
name: e2e-test-creation
description: Automatically generates E2E Playwright tests for Mattermost frontend changes. Bridges manual test cases with E2E automation. Provides comprehensive guidelines, patterns, and examples for creating robust, maintainable tests following Mattermost conventions.
---

# E2E Test Creation Skill for Mattermost

This skill helps you automatically generate comprehensive E2E tests for Mattermost using Playwright.

## ⚠️ CRITICAL RULES - NEVER VIOLATE THESE

### 🚫 Rule #1: NEVER Use Fake MM-T Numbers
**WRONG:**
```typescript
test('MM-T5929 Configure team-specific reviewers', async ({pw}) => {
  // This is WRONG - MM-T5929 doesn't exist in Zephyr!
});
```

**CORRECT:**
```typescript
test('MM-TXXX Configure team-specific reviewers', async ({pw}) => {
  // Use MM-TXXX as placeholder until real number from Zephyr
});
```

**Why this matters:**
- Fake MM-T numbers break Zephyr integration
- Tests can't be tracked or reported correctly
- Violates the entire workflow

### 🚫 Rule #2: ALWAYS Run Tests ONE AT A TIME in Headed Chrome Mode
**WRONG:**
```bash
npx playwright test file.spec.ts  # Runs all tests, all browsers
```

**CORRECT:**
```bash
npx playwright test file.spec.ts --headed --project=chrome --grep="MM-T5929"
# Runs ONE test, in headed mode, Chrome only
```

**Why this matters:**
- You need to see what's happening in the browser
- Tests must pass one at a time before moving to next
- Zephyr status updates happen per test, not in bulk

### 🚫 Rule #3: MANDATORY User Approval Before Writing Code
**WRONG:**
```
User: "Create E2E tests for feature X"
AI: *immediately writes full test code*
```

**CORRECT:**
```
User: "Create E2E tests for feature X"
AI: *creates test plan markdown*
AI: "Here's the test plan. Should I proceed with skeleton files?"
User: "Yes"
AI: *creates skeleton files with MM-TXXX*
AI: "Should I create Zephyr test cases?"
User: "Yes"
AI: *creates Zephyr cases, gets real MM-T numbers*
AI: *implements FIRST test only*
AI: *runs that ONE test in headed Chrome*
```

**Why this matters:**
- Saves time and cost - user can reject bad plans early
- User can review test scenarios before implementation
- Prevents rework and wasted AI tokens

### 🚫 Rule #4: Update Zephyr ONLY After Test Passes
**WRONG:**
```
- Create Zephyr test case
- Set status to "Active" immediately
- Then try to run test (might fail)
```

**CORRECT:**
```
- Create Zephyr test case with status "Draft"
- Implement test code
- Run test in headed Chrome mode
- IF test passes → Update Zephyr to "Active"
- IF test fails → Fix and retry (max 3 attempts)
```

### 📋 The STRICT 10-Step Workflow

When user says: *"Create E2E tests for [feature]"*

1. ✅ Create test plan (markdown) → Get user approval
2. ✅ Create skeleton files with `MM-TXXX` → Get user approval
3. ✅ Ask: "Should I create Zephyr test cases?"
4. ✅ Create Zephyr cases (status: **Draft**)
5. ✅ Get real MM-T numbers (e.g., MM-T5929)
6. ✅ Replace `MM-TXXX` with real numbers
7. ✅ Implement **FIRST test only**
8. ✅ Run: `npx playwright test file.spec.ts --headed --project=chrome --grep="MM-T5929"`
9. ✅ If pass → Update Zephyr to **Active**
10. ✅ Repeat steps 7-9 for next test

**See [workflows/STRICT-WORKFLOW.md](workflows/STRICT-WORKFLOW.md) for detailed examples.**

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

### 3. Self-Healing Test System
**Automatically diagnoses and repairs broken tests** by:
- ✅ **Analyzing** error logs, stack traces, and failure patterns
- ✅ **Determining WHY** tests fail (selector changes, timing, flow changes, assertions)
- ✅ **Fetching test intent** from JSDoc, Zephyr, and test plans
- ✅ **Discovering** new selectors via live browser inspection (MCP)
- ✅ **Generating** patch diffs and complete fixed files
- ✅ **Verifying** fixes by re-running tests
- ✅ **Updating** Zephyr test steps if flow changed
- ✅ **Providing** alternatives if fix doesn't work (max 3 attempts)

**Core Principle:** Repairs root cause, NEVER masks failures or simply retries.

**Healing Strategies:**
- Automatic selector replacement (getByTestId → getByRole)
- Automatic wait improvements (remove arbitrary timeouts)
- Automatic assertion updates (exact match → partial match)
- Automatic flow adjustment (detect new intermediate steps)

**Output:** Full healing report with patch diff, explanation, and verification results

### 4. Zephyr Test Automation
Automates test creation and syncs with Zephyr test management:
- **3-Stage Pipeline** - Plan → Skeleton Files → Zephyr Creation + Full Code
- **Automate Existing Tests** - Convert existing Zephyr test cases (MM-T format) to Playwright
- **Reverse Workflow (NEW)** - Create Zephyr test cases from existing E2E tests
- **Bi-directional Sync** - Create tests in Zephyr and update with automation details
- **Step Generation** - Automatically generate or refine test steps for Zephyr cases

## Playwright MCP Integration

### Live Browser Exploration

This skill integrates with **Playwright MCP** (Model Context Protocol) for live browser interaction:

**What it does:**
- 🔍 Launches real browser (Chrome/Firefox)
- 🖱️ Interacts with live Mattermost application
- 📸 Takes screenshots during exploration
- 🎯 Discovers actual selectors from DOM (no guessing!)
- ⏱️ Observes timing and async behavior

**Setup Required:**

Add to `~/.config/claude-code/config.json`:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp-server@latest"]
    }
  }
}
```

**Restart Claude Code** after adding this configuration.

### MCP Agents Location

MCP browser automation agents are in: `e2e-tests/playwright/.claude/agents/`

These agents use Playwright MCP tools to:
- Navigate live Mattermost UI
- Inspect real DOM elements
- Discover data-testid attributes and ARIA labels
- Validate selectors work correctly
- Debug test failures with live inspection

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

## Example Workflows

### Workflow 1: Create Tests with Zephyr (STRICT 10-STEP MANDATORY)

When you say: *"Create E2E tests for post reactions"*

**All 10 steps are mandatory - no skipping:**

1. **Launch browser via MCP** → Playwright explores live UI
2. **Explore UI** → Interact with post reactions feature
3. **Discover selectors** → Find actual `data-testid` from DOM
4. **Create skeleton tests** → Generate files with `MM-TXXX` placeholder
5. **User confirmation** → Ask: "Create Zephyr Test Cases?"
6. **Push to Zephyr** → Create cases (Status: Draft), get MM-T5928, MM-T5929
7. **Generate full code** → Complete Playwright implementation with discovered selectors
8. **Place in ai-assisted/** → `specs/functional/ai-assisted/messaging/post_reactions.spec.ts`
9. **Run tests (mandatory)** → `npx playwright test --project=chrome`, must pass
10. **Fix & update Zephyr** → Heal if needed, then set Zephyr status to "Active"

**Result:** ✅ Passing tests + ✅ Zephyr cases Active

---

### Workflow 2: Automate Existing Test (MANDATORY EXECUTION)

When you say: *"Automate MM-T5928"*

1. Fetch test case from Zephyr
2. Generate test steps if missing
3. Update Zephyr with steps
4. Generate full Playwright code
5. Write file to `ai-assisted/` directory
6. **Execute test (mandatory)** with Chrome
7. **Heal until passing** (max 3 attempts)
8. **Update Zephyr to "Active"** only after test passes

---

### Workflow 3: Quick Tests (No Zephyr)

For quick iteration without Zephyr:
1-4: Same as Workflow 1
5: User says "no" to Zephyr creation
Result: Tests remain with MM-TXXX, ready for later Zephyr sync

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
- Over-generated: `e2e-tests/playwright/specs/functional/ai-assisted/channels/browse_channels_min_char_autocomplete.spec.ts` (5 tests)
- Focused version: `e2e-tests/playwright/specs/functional/ai-assisted/channels/browse_channels_min_char_autocomplete_focused.spec.ts` (2 tests)

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
