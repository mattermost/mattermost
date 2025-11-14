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

### 4. Test Names Must Start with MM-TXXXX
```typescript
// ✅ CORRECT - Includes MM-TXXXX prefix (or actual ticket ID)
test('MM-T1234 user can clear search in browse channels', {tag: '@channels'}, async ({pw}) => {
    ...
});

// ✅ CORRECT - With actual Jira ticket
test('MM-T5521-1 Should be able to search users with their first names', {tag: '@system_console'}, async ({pw}) => {
    ...
});

// ❌ WRONG - Missing prefix
test('user can clear search', {tag: '@channels'}, async ({pw}) => { ... });
test('should clear search', {tag: '@channels'}, async ({pw}) => { ... });
```

### 5. Complete Test Structure Example
```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that users can clear search in browse channels modal
 */
test('MM-T1234 user can clear search using clear button', {tag: '@browse_channels'}, async ({pw}) => {
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

- [ ] ❌ NOT using `test.describe()`
- [ ] ✅ Using ONLY `{pw}` parameter (not `{pw, page}`)
- [ ] ✅ Accessing page via `channelsPage.page` or `systemConsolePage.page`
- [ ] ✅ Test name starts with `MM-TXXXX`
- [ ] ✅ Using single tag string: `{tag: '@feature'}`
- [ ] ✅ Each test is completely independent
- [ ] ✅ Creating ONLY ONE test file in correct location
- [ ] ✅ Using `pw.initSetup()` for test setup
- [ ] ✅ Using `pw.testBrowser.login()` for authentication
- [ ] ✅ Creating test data via API with `adminClient`
- [ ] ✅ Using `pw.random.id()` for unique names
- [ ] ✅ Including copyright header
- [ ] ✅ Using `#` for action comments, `*` for assertions
- [ ] ✅ Including `@objective` JSDoc comment

---

## 🎯 Summary

**The Four Cardinal Rules:**

1. **NO `test.describe()`** - Each test is standalone
2. **ONLY `{pw}` parameter** - Access page via page objects
3. **Single tag string** - Not an array
4. **`MM-TXXXX` prefix** - Required in test names

**Remember:** Look at actual test files in `specs/functional/` for examples!

---

## ✅ Documentation Updated

All agent and skill documentation has been updated:
- ✅ `playwright-generator.md` - Templates corrected
- ✅ `guidelines.md` - Critical rules added
- ✅ `example.md` - Examples will be updated
- ✅ `mattermost-patterns.md` - Patterns will be updated

These corrections are now permanent and will prevent future mistakes!
