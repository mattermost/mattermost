---
name: e2e-test-creation
description: Automatically generates E2E Playwright tests for Mattermost frontend changes. Provides comprehensive guidelines, patterns, and examples for creating robust, maintainable tests following Mattermost conventions.
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

## What This Skill Does

### 1. Test Planning
Analyzes your changes and creates comprehensive test plans covering:
- User interactions and workflows
- Edge cases and error conditions
- Real-time/WebSocket behaviors
- Multi-user scenarios
- Visual regressions

### 2. Test Generation
Generates executable Playwright tests that:
- Follow Mattermost patterns (pw fixture, page objects)
- Use semantic selectors (data-testid, ARIA roles)
- Include proper setup, teardown, and cleanup
- Handle async operations correctly
- Are isolated and independent

### 3. Test Healing
Automatically fixes flaky or broken tests by:
- Updating outdated selectors
- Improving wait strategies
- Fixing timing issues
- Strengthening assertions

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

**Output:** Markdown test plan with scenarios and expected results

### Phase 2: Generation
**Goal:** Transform the plan into executable tests

**Actions:**
- Convert plan to TypeScript test code
- Apply Mattermost patterns
- Use proper page objects
- Add meaningful assertions
- Include proper tags

**Output:** Complete `.spec.ts` files ready to run

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
specs/
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

- **guidelines.md** - Complete test creation guidelines
- **examples.md** - Real-world test examples
- **mattermost-patterns.md** - Mattermost-specific patterns
- **agents/planner.md** - Test planning guidance
- **agents/generator.md** - Test generation patterns
- **agents/healer.md** - Test healing strategies

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

1. **You detect** changes in `webapp/components/post/reactions/`
2. **Plan phase**: Analyze the feature and create test plan covering:
   - Adding reactions to posts
   - Removing reactions
   - Multiple users reacting (real-time)
   - Reaction counts updating
   - Edge cases and errors
3. **Generate phase**: Create `e2e-tests/playwright/specs/functional/messaging/post_reactions.spec.ts`
4. **Run tests**: `npx playwright test post_reactions`
5. **Heal phase** (if needed): Fix any failures automatically

## Quality Standards

Generated tests must:
- ✅ Use proper page objects and fixtures
- ✅ Include meaningful assertions
- ✅ Test both happy paths and edge cases
- ✅ Be isolated and independent
- ✅ Use semantic locators
- ✅ Handle async operations properly
- ✅ Include descriptive comments
- ✅ Follow Mattermost conventions

## Support

For detailed guidance, refer to:
- `guidelines.md` - Comprehensive guidelines (692 lines)
- `examples.md` - Real-world examples (760 lines)
- `mattermost-patterns.md` - Mattermost patterns (700 lines)
- Agent documentation in `agents/` directory

---

**Result:** Developers contribute high-quality E2E tests automatically!
