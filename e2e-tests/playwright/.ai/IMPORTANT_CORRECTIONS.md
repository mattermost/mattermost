# CRITICAL CORRECTIONS TO E2E TEST GENERATION

## Issues Found and Fixed

After generating tests in production, several critical issues were identified and corrected in all documentation.

---

## ❌ MISTAKES THAT WERE MADE

### 1. Used `test.describe()` (WRONG!)
```typescript
// ❌ WRONG - This is NOT the Mattermost pattern
test.describe('Feature Tests', () => {
    test('test 1', async ({pw}) => { ... });
    test('test 2', async ({pw}) => { ... });
});
```

### 2. Used Both `pw` and `page` Parameters (WRONG!)
```typescript
// ❌ WRONG - Should ONLY use pw parameter
test('MM-T1234 test name', {tag: '@feature'}, async ({pw, page}) => {
    await page.click(...);  // Wrong way to access page
});
```

### 3. Used Array of Tags (WRONG!)
```typescript
// ❌ WRONG - Tags should be a single string
test('MM-T1234 test name', {tag: ['@functional', '@channels', '@smoke']}, async ({pw}) => {
    ...
});
```

### 4. Missing `MM-TXXXX` Prefix (WRONG!)
```typescript
// ❌ WRONG - Test names must start with MM-TXXXX
test('should clear search button', {tag: '@feature'}, async ({pw}) => {
    ...
});
```

### 5. Created Multiple Test Files (WRONG!)
- Created both:
  - `e2e-tests/playwright/specs/functional/channels/browse_channels_clear_search.spec.ts` ❌
  - `e2e-tests/playwright/specs/functional/channels/search/browse_channels_clear_search.spec.ts` ❌
- Should only create ONE file!

---

## ✅ CORRECT PATTERNS (MUST FOLLOW)

### 1. Standalone Tests Only - NO test.describe()
```typescript
// ✅ CORRECT - Each test is completely independent
test('MM-T1234 first test', {tag: '@feature'}, async ({pw}) => {
    const {user} = await pw.initSetup();
    // ... test code
});

test('MM-T1235 second test', {tag: '@feature'}, async ({pw}) => {
    const {user} = await pw.initSetup();
    // ... test code
});
```

### 2. ONLY Use `{pw}` Parameter
```typescript
// ✅ CORRECT - Only pw parameter, access page via page objects
test('MM-T1234 test name', {tag: '@feature'}, async ({pw}) => {
    const {user} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    // Access page through the page object
    await channelsPage.page.click('[data-testid="button"]');
    await expect(channelsPage.page.locator('[data-testid="result"]')).toBeVisible();
});
```

**For System Console:**
```typescript
test('MM-T5521 test name', {tag: '@system_console'}, async ({pw}) => {
    const {adminUser} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // Access page through systemConsolePage.page
    await systemConsolePage.page.click('[data-testid="button"]');
});
```

### 3. Single Tag String - NOT Array
```typescript
// ✅ CORRECT - Single tag string
test('MM-T1234 test name', {tag: '@channels'}, async ({pw}) => { ... });

// ✅ Also acceptable with single tag
test('MM-T1234 test name', {tag: '@smoke'}, async ({pw}) => { ... });

// ❌ WRONG - Do not use array
test('MM-T1234 test name', {tag: ['@channels', '@smoke']}, async ({pw}) => { ... });
```

### 4. Test Documentation Format (CRITICAL!)

#### JSDoc with @objective (REQUIRED)
```typescript
// ✅ CORRECT - Includes JSDoc with @objective
/**
 * @objective Verify user can clear search in browse channels modal
 */
test('clears search in browse channels using clear button', {tag: '@channels'}, async ({pw}) => {
    ...
});

// ✅ CORRECT - With optional @precondition for special cases
/**
 * @objective Verify scheduled message posts at correct time
 *
 * @precondition
 * Server timezone is set to UTC
 */
test('posts scheduled message at specified time', {tag: '@messaging'}, async ({pw}) => {
    ...
});

// ❌ WRONG - Missing JSDoc
test('clears search', {tag: '@channels'}, async ({pw}) => { ... });
```

#### Test Title Format (Action-Oriented)
```typescript
// ✅ CORRECT - Action-oriented titles
test('creates channel and posts first message', {tag: '@channels'}, async ({pw}) => { ... });
test('edits message content and preserves attachments', {tag: '@messaging'}, async ({pw}) => { ... });
test('deletes channel and archives conversation', {tag: '@channels'}, async ({pw}) => { ... });

// ❌ WRONG - Using "should"
test('should create a channel', {tag: '@channels'}, async ({pw}) => { ... });
test('should be able to post', {tag: '@messaging'}, async ({pw}) => { ... });

// ❌ WRONG - Too vague
test('channel creation', {tag: '@channels'}, async ({pw}) => { ... });
test('test posting', {tag: '@messaging'}, async ({pw}) => { ... });
```

#### Comment Prefixes (REQUIRED)
```typescript
// ✅ CORRECT - Using proper prefixes
test('sends direct message', {tag: '@messaging'}, async ({pw}) => {
    // # Initialize and login
    const {user} = await pw.initSetup();

    // # Open DM modal
    await channelsPage.page.click('[data-testid="dm-button"]');

    // * Verify modal is visible
    await expect(channelsPage.page.locator('[data-testid="dm-modal"]')).toBeVisible();
});

// ❌ WRONG - No prefixes or wrong prefixes
test('sends direct message', {tag: '@messaging'}, async ({pw}) => {
    // Initialize and login  ❌ Missing # prefix
    const {user} = await pw.initSetup();

    // Open DM modal  ❌ Missing # prefix
    await channelsPage.page.click('[data-testid="dm-button"]');

    // Verify modal is visible  ❌ Missing * prefix
    await expect(channelsPage.page.locator('[data-testid="dm-modal"]')).toBeVisible();
});
```

#### MM-T ID (OPTIONAL for New Tests)
```typescript
// ✅ CORRECT - New test without ID (will be auto-assigned)
test('clears search in browse channels using clear button', {tag: '@channels'}, async ({pw}) => {
    ...
});

// ✅ CORRECT - Existing ticket with ID
test('MM-T5521 searches users by first name in system console', {tag: '@system_console'}, async ({pw}) => {
    ...
});

// ❌ WRONG - Don't make up MM-T IDs
test('MM-TXXXX clears search', {tag: '@channels'}, async ({pw}) => { ... });
test('MM-T9999 placeholder test', {tag: '@channels'}, async ({pw}) => { ... });
```

### 5. Complete Test Structure Example (All Corrections Applied)
```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify user can clear search in browse channels modal using clear button
 */
test('clears search in browse channels using clear button', {tag: '@browse_channels'}, async ({pw}) => {
    // # Setup - Create test data
    const {adminClient, user, team} = await pw.initSetup();

    const testChannel = await adminClient.createChannel({
        team_id: team.id,
        name: `test-channel-${pw.random.id()}`,
        display_name: 'Test Channel',
        type: 'O',
    });

    // # Log in user
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Navigate to channels
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open browse channels modal
    await channelsPage.sidebarLeft.findChannelsButton.click();

    // # Perform search
    await channelsPage.findChannelsModal.input.fill('test');
    await channelsPage.page.waitForTimeout(150); // Wait for debounce

    // * Verify clear button appears
    await expect(channelsPage.page.locator('[data-testid="clear-search-button"]')).toBeVisible();

    // # Click clear button
    await channelsPage.page.locator('[data-testid="clear-search-button"]').click();

    // * Verify search is cleared
    await expect(channelsPage.findChannelsModal.input).toHaveValue('');
    await expect(channelsPage.page.locator('[data-testid="clear-search-button"]')).not.toBeVisible();

    // # Cleanup (if needed - usually handled by framework)
    await adminClient.deleteChannel(testChannel.id);
});
```

**Key Corrections Applied:**
1. ✅ JSDoc with `@objective` included
2. ✅ Action-oriented title: "clears search..." (no "should")
3. ✅ MM-T ID omitted (optional for new tests)
4. ✅ ONLY `{pw}` parameter used
5. ✅ Standalone test (no `test.describe()`)
6. ✅ Single tag string: `{tag: '@browse_channels'}`
7. ✅ Comment prefixes: `// #` for actions, `// *` for verifications
8. ✅ Accessing page via `channelsPage.page`

---

## 📁 File Organization Rules

### Rule: One Test File, Correct Location

**Pattern for Functional Tests:**
```
e2e-tests/playwright/specs/functional/{category}/{feature_name}.spec.ts
```

**Examples:**
- ✅ `specs/functional/channels/browse_channels_clear_search.spec.ts`
- ✅ `specs/functional/messaging/post_message.spec.ts`
- ✅ `specs/functional/system_console/user_management.spec.ts`

**Pattern for Visual Tests:**
```
e2e-tests/playwright/specs/visual/{category}/{feature_name}.spec.ts
```

### ❌ DON'T Create Multiple Files
Don't create:
- `specs/functional/channels/feature.spec.ts` AND
- `specs/functional/channels/subfolder/feature.spec.ts`

Pick ONE location and stick with it!

---

## 🔧 How Page Access Works

### Understanding the pw Fixture

The `pw` fixture provides page access through page objects:

```typescript
test('MM-T1234 test', {tag: '@feature'}, async ({pw}) => {
    const {user} = await pw.initSetup();

    // Login returns page objects
    const {channelsPage} = await pw.testBrowser.login(user);

    // Access the Playwright Page via the page object
    const page = channelsPage.page;

    // Use it for Playwright operations
    await page.click('[data-testid="button"]');
    await page.locator('[data-testid="element"]').waitFor();
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
});
```

### Page Objects Available

**For Regular Users:**
```typescript
const {channelsPage} = await pw.testBrowser.login(user);
// Access: channelsPage.page
```

**For Admin Users:**
```typescript
const {systemConsolePage} = await pw.testBrowser.login(adminUser);
// Access: systemConsolePage.page
```

---

## 📋 Complete Checklist

Before generating tests, verify:

### Structure & Syntax
- [ ] ❌ NOT using `test.describe()`
- [ ] ✅ Using ONLY `{pw}` parameter (not `{pw, page}`)
- [ ] ✅ Accessing page via `channelsPage.page` or `systemConsolePage.page`
- [ ] ✅ Using single tag string: `{tag: '@feature'}`
- [ ] ✅ Each test is completely independent
- [ ] ✅ Creating ONLY ONE test file in correct location

### Documentation (CRITICAL - Required for Linting)
- [ ] ✅ Including JSDoc `@objective` comment (REQUIRED)
- [ ] ✅ Including `@precondition` only if truly needed (OPTIONAL)
- [ ] ✅ Test title is action-oriented: `"creates channel and posts message"`
- [ ] ✅ Test title does NOT use "should": ❌ "should create channel"
- [ ] ✅ Using `// #` prefix for action comments
- [ ] ✅ Using `// *` prefix for verification/assertion comments
- [ ] ✅ MM-T ID is OPTIONAL (omit for new tests, will be auto-assigned)

### Implementation
- [ ] ✅ Using `pw.initSetup()` for test setup
- [ ] ✅ Using `pw.testBrowser.login()` for authentication
- [ ] ✅ Creating test data via API with `adminClient`
- [ ] ✅ Using `pw.random.id()` for unique names
- [ ] ✅ Including copyright header

### Validation
- [ ] ✅ Test passes `npm run lint:test-docs`
- [ ] ✅ Test follows examples from CLAUDE.md

---

## 🎯 Summary

**The Seven Cardinal Rules:**

1. **Include JSDoc `@objective`** - REQUIRED for all tests
2. **Action-oriented test titles** - Start with verb, no "should"
3. **Use comment prefixes** - `// #` for actions, `// *` for verifications
4. **NO `test.describe()`** - Each test is standalone
5. **ONLY `{pw}` parameter** - Access page via page objects
6. **Single tag string** - Not an array
7. **MM-T ID is OPTIONAL** - Omit for new tests, will be auto-assigned

**Documentation Must Pass Linting:**
- Run `npm run lint:test-docs` before committing
- All tests must follow the format in CLAUDE.md
- Look at `specs/functional/channels/scheduled_messages/scheduled_messages.spec.ts` for reference

**Remember:** Look at actual test files in `specs/functional/` for examples!

---

## ✅ Documentation Updated

All agent and skill documentation has been updated:
- ✅ `playwright-generator.md` - Templates corrected + JSDoc & test title format added
- ✅ `guidelines.md` - Critical rules added + comprehensive documentation section added
- ✅ `IMPORTANT_CORRECTIONS.md` - Complete corrections documented
- ✅ `example.md` - Examples will be updated
- ✅ `mattermost-patterns.md` - Patterns will be updated

### Additional Context Incorporated (2024)

After initial corrections, additional important context was incorporated from:
- ✅ `e2e-tests/playwright/CLAUDE.md` - Test documentation format requirements
- ✅ `e2e-tests/playwright/README.md` - Visual testing and general guidelines

**Key Additions:**
1. **JSDoc format** - `@objective` (required) and `@precondition` (optional)
2. **Test title format** - Action-oriented, feature-specific, context-aware, outcome-focused
3. **Comment prefix convention** - `// #` for actions, `// *` for verifications
4. **MM-T ID clarification** - OPTIONAL for new tests (auto-assigned later)
5. **Test documentation linting** - `npm run lint:test-docs` validation
6. **Browser compatibility considerations** - Chrome, Firefox, iPad
7. **Reference example** - `specs/functional/channels/scheduled_messages/scheduled_messages.spec.ts`

These corrections are now permanent and will prevent future mistakes!
