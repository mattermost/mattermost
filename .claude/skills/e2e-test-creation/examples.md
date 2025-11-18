# Mattermost E2E Test Examples

This document provides real-world examples of E2E tests for Mattermost, showing the complete workflow from test planning to implementation to healing.

## Table of Contents
1. [Example 1: Channel Creation](#example-1-channel-creation)
2. [Example 2: Message Posting with Real-time Updates](#example-2-message-posting-with-real-time-updates)
3. [Example 3: User Search in System Console](#example-3-user-search-in-system-console)
4. [Example 4: Visual Regression Test](#example-4-visual-regression-test)
5. [Example 5: Test Healing Scenario](#example-5-test-healing-scenario)

---

## Example 1: Channel Creation

### Step 1: Planner Output

```markdown
# Test Plan: Channel Creation Feature

## Feature Overview
Users can create new public or private channels within a team. Channel creation includes:
- Channel name (required, alphanumeric with hyphens)
- Channel display name (required)
- Channel purpose/description (optional)
- Public or Private selection

## Prerequisites
- User is logged in
- User is member of at least one team
- User has permission to create channels

## Test Scenarios

### Scenario 1: Create Public Channel (Happy Path)
**Description**: User successfully creates a new public channel
**Priority**: High
**Tags**: [@functional, @channels, @smoke]

**Steps**:
1. Navigate to team view
2. Click "Create Channel" button (+ icon in sidebar)
3. Enter channel name: "test-public-channel"
4. Enter display name: "Test Public Channel"
5. Enter purpose: "Channel for testing"
6. Select "Public Channel" option (default)
7. Click "Create Channel" button

**Expected Results**:
- ✓ Channel is created successfully
- ✓ User is automatically navigated to the new channel
- ✓ Channel appears in left sidebar under "Public Channels"
- ✓ Channel header displays correct name and purpose
- ✓ Welcome message appears in center channel

**Selectors to Consider**:
- `[data-testid="sidebar-create-channel"]` - Create channel button
- `[data-testid="channel-name-input"]` - Channel name field
- `[data-testid="channel-display-name"]` - Display name field
- `[data-testid="channel-purpose"]` - Purpose field
- `[data-testid="channel-type-public"]` - Public radio button
- `[data-testid="create-button"]` - Submit button

**Potential Flakiness**:
- Wait for modal to be fully rendered before interacting
- Wait for API response before verifying channel in sidebar

### Scenario 2: Create Private Channel
**Description**: User creates a private channel
**Priority**: High
**Tags**: [@functional, @channels]

**Steps**:
1. Open channel creation modal
2. Enter channel details
3. Select "Private Channel" option
4. Click "Create Channel"

**Expected Results**:
- ✓ Private channel is created
- ✓ Channel appears under "Private Channels" section
- ✓ Lock icon is displayed next to channel name

### Scenario 3: Validation - Empty Channel Name
**Description**: System prevents channel creation without name
**Priority**: Medium
**Tags**: [@functional, @channels, @validation]

**Steps**:
1. Open channel creation modal
2. Leave channel name empty
3. Enter display name
4. Click "Create Channel"

**Expected Results**:
- ✓ Error message displayed: "Channel name is required"
- ✓ Channel is not created
- ✓ Modal remains open
- ✓ Create button is disabled or shows validation error

### Scenario 4: Validation - Invalid Channel Name
**Description**: System prevents invalid channel names
**Priority**: Medium
**Tags**: [@functional, @channels, @validation]

**Steps**:
1. Open channel creation modal
2. Enter invalid name: "Test Channel!" (with special chars)
3. Attempt to create channel

**Expected Results**:
- ✓ Validation error displayed
- ✓ Suggestion to use valid characters shown
- ✓ Channel is not created

## Test Data Requirements
- Test team ID (use existing or create via API)
- Clean up channels after tests via API: `DELETE /api/v4/channels/{channel_id}`

## Implementation Notes
- Use `systemConsolePage` page object if testing from admin view
- Create test data (team, user) via API in beforeEach
- Clean up in afterEach to avoid pollution
```

### Step 2: Generator Output

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '@mattermost/playwright-lib';

/**
 * @objective Verify channel creation functionality for public and private channels
 */
test.describe('Channel Creation', () => {
    let testTeam: {id: string; name: string};
    let createdChannels: string[] = [];

    test.beforeEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();

        // # Create test team
        testTeam = await adminClient.createTeam({
            name: `test-team-${Date.now()}`,
            display_name: 'Test Team',
            type: 'O',
        });
    });

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();

        // # Clean up created channels
        for (const channelId of createdChannels) {
            await adminClient.deleteChannel(channelId);
        }

        // # Clean up test team
        if (testTeam?.id) {
            await adminClient.deleteTeam(testTeam.id);
        }
    });

    test(
        'should create public channel successfully',
        {tag: ['@functional', '@channels', '@smoke']},
        async ({pw, page}) => {
            // # Navigate to team view
            await page.goto(`/${testTeam.name}/channels/town-square`);
            await page.locator('[data-testid="channel-view"]').waitFor();

            // # Open channel creation modal
            await page.click('[data-testid="sidebar-create-channel"]');
            await page.locator('[data-testid="create-channel-modal"]')
                .waitFor({state: 'visible'});

            // # Fill in channel details
            const channelName = `test-public-${Date.now()}`;
            await page.fill('[data-testid="channel-name-input"]', channelName);
            await page.fill('[data-testid="channel-display-name"]', 'Test Public Channel');
            await page.fill('[data-testid="channel-purpose"]', 'Channel for testing');

            // # Ensure public channel is selected (should be default)
            await page.click('[data-testid="channel-type-public"]');

            // # Create the channel
            await page.click('[data-testid="create-button"]');

            // # Wait for API response
            const response = await page.waitForResponse(resp =>
                resp.url().includes('/api/v4/channels') && resp.status() === 201
            );
            const channelData = await response.json();
            createdChannels.push(channelData.id);

            // * Verify user is navigated to new channel
            await expect(page).toHaveURL(new RegExp(`${testTeam.name}/channels/${channelName}`));

            // * Verify channel appears in sidebar
            await expect(page.locator(`[data-testid="sidebar-channel-${channelName}"]`))
                .toBeVisible();

            // * Verify channel header displays correct information
            await expect(page.locator('[data-testid="channel-header-title"]'))
                .toHaveText('Test Public Channel');
            await expect(page.locator('[data-testid="channel-header-description"]'))
                .toContainText('Channel for testing');
        }
    );

    test(
        'should create private channel successfully',
        {tag: ['@functional', '@channels']},
        async ({pw, page}) => {
            // # Navigate to team view
            await page.goto(`/${testTeam.name}/channels/town-square`);

            // # Open channel creation modal
            await page.click('[data-testid="sidebar-create-channel"]');
            await page.locator('[data-testid="create-channel-modal"]').waitFor();

            // # Fill in channel details
            const channelName = `test-private-${Date.now()}`;
            await page.fill('[data-testid="channel-name-input"]', channelName);
            await page.fill('[data-testid="channel-display-name"]', 'Test Private Channel');

            // # Select private channel type
            await page.click('[data-testid="channel-type-private"]');

            // # Create the channel
            await page.click('[data-testid="create-button"]');

            // # Wait for channel creation
            const response = await page.waitForResponse(resp =>
                resp.url().includes('/api/v4/channels') && resp.status() === 201
            );
            const channelData = await response.json();
            createdChannels.push(channelData.id);

            // * Verify channel appears in "Private Channels" section
            await expect(page.locator(`[data-testid="sidebar-channel-${channelName}"]`))
                .toBeVisible();

            // * Verify lock icon is displayed
            await expect(page.locator(`[data-testid="sidebar-channel-${channelName}"] [data-testid="lock-icon"]`))
                .toBeVisible();
        }
    );

    test(
        'should show validation error for empty channel name',
        {tag: ['@functional', '@channels', '@validation']},
        async ({pw, page}) => {
            // # Navigate to team view
            await page.goto(`/${testTeam.name}/channels/town-square`);

            // # Open channel creation modal
            await page.click('[data-testid="sidebar-create-channel"]');
            await page.locator('[data-testid="create-channel-modal"]').waitFor();

            // # Leave channel name empty, fill display name only
            await page.fill('[data-testid="channel-display-name"]', 'Test Channel');

            // # Attempt to create channel
            await page.click('[data-testid="create-button"]');

            // * Verify validation error is displayed
            await expect(page.locator('[data-testid="channel-name-error"]'))
                .toBeVisible();
            await expect(page.locator('[data-testid="channel-name-error"]'))
                .toContainText('required');

            // * Verify modal remains open
            await expect(page.locator('[data-testid="create-channel-modal"]'))
                .toBeVisible();
        }
    );

    test(
        'should show validation error for invalid channel name',
        {tag: ['@functional', '@channels', '@validation']},
        async ({pw, page}) => {
            // # Navigate to team view
            await page.goto(`/${testTeam.name}/channels/town-square`);

            // # Open channel creation modal
            await page.click('[data-testid="sidebar-create-channel"]');
            await page.locator('[data-testid="create-channel-modal"]').waitFor();

            // # Enter invalid channel name with special characters
            await page.fill('[data-testid="channel-name-input"]', 'Invalid Channel! @#$');

            // * Verify validation error appears immediately
            await expect(page.locator('[data-testid="channel-name-error"]'))
                .toBeVisible();
            await expect(page.locator('[data-testid="channel-name-error"]'))
                .toContainText(/alphanumeric|valid characters/i);

            // * Verify create button is disabled
            await expect(page.locator('[data-testid="create-button"]'))
                .toBeDisabled();
        }
    );
});
```

---

## Example 2: Message Posting with Real-time Updates

### Generator Output

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test, expect} from '@mattermost/playwright-lib';

/**
 * @objective Verify message posting and real-time updates between multiple users
 */
test.describe('Message Posting and Real-time Updates', () => {
    let testChannel: {id: string; name: string};

    test.beforeEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();

        // # Create test channel via API
        testChannel = await adminClient.createChannel({
            team_id: 'team-id',
            name: `test-messages-${Date.now()}`,
            display_name: 'Test Messages',
            type: 'O',
        });
    });

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        if (testChannel?.id) {
            await adminClient.deleteChannel(testChannel.id);
        }
    });

    test(
        'should post text message successfully',
        {tag: ['@functional', '@messaging', '@smoke']},
        async ({pw, page}) => {
            // # Navigate to test channel
            await page.goto(`/team/channels/${testChannel.name}`);
            await page.locator('[data-testid="channel-view"]').waitFor();

            // # Type message in post textbox
            const messageText = `Test message ${Date.now()}`;
            await page.fill('[data-testid="post-textbox"]', messageText);

            // # Send message
            await page.press('[data-testid="post-textbox"]', 'Enter');

            // # Wait for post API response
            await page.waitForResponse(resp =>
                resp.url().includes('/api/v4/posts') && resp.status() === 201
            );

            // * Verify message appears in channel
            await expect(page.locator(`text=${messageText}`).last())
                .toBeVisible();

            // * Verify textbox is cleared
            await expect(page.locator('[data-testid="post-textbox"]'))
                .toHaveValue('');
        }
    );

    test(
        'should show posted message to other users in real-time',
        {tag: ['@functional', '@messaging', '@realtime']},
        async ({browser, pw}) => {
            // # Create two user contexts
            const user1Context = await browser.newContext();
            const user2Context = await browser.newContext();

            const user1Page = await user1Context.newPage();
            const user2Page = await user2Context.newPage();

            // # Both users navigate to same channel
            await user1Page.goto(`/team/channels/${testChannel.name}`);
            await user2Page.goto(`/team/channels/${testChannel.name}`);

            // # Wait for channels to load
            await user1Page.locator('[data-testid="channel-view"]').waitFor();
            await user2Page.locator('[data-testid="channel-view"]').waitFor();

            // # User 1 posts a message
            const messageText = `Real-time test ${Date.now()}`;
            await user1Page.fill('[data-testid="post-textbox"]', messageText);
            await user1Page.press('[data-testid="post-textbox"]', 'Enter');

            // * Verify user 1 sees their message
            await expect(user1Page.locator(`text=${messageText}`).last())
                .toBeVisible();

            // * Verify user 2 sees the message in real-time (WebSocket update)
            await expect(user2Page.locator(`text=${messageText}`).last())
                .toBeVisible({timeout: 10000}); // Longer timeout for WebSocket

            // # Clean up
            await user1Context.close();
            await user2Context.close();
        }
    );

    test(
        'should post message with emoji',
        {tag: ['@functional', '@messaging', '@emoji']},
        async ({pw, page}) => {
            // # Navigate to channel
            await page.goto(`/team/channels/${testChannel.name}`);

            // # Open emoji picker
            await page.click('[data-testid="emoji-picker-button"]');
            await page.locator('[data-testid="emoji-picker-modal"]').waitFor();

            // # Select an emoji (thumbs up)
            await page.click('[data-testid="emoji-👍"]');

            // # Add text after emoji
            await page.fill('[data-testid="post-textbox"]', '👍 Great work!');

            // # Send message
            await page.press('[data-testid="post-textbox"]', 'Enter');

            // * Verify message with emoji appears
            await expect(page.locator('text=👍 Great work!').last())
                .toBeVisible();
        }
    );
});
```

---

## Example 3: User Search in System Console

### Generator Output (Based on Actual Mattermost Pattern)

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify user search functionality in System Console
 */
test('Should be able to search users with their first names', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create 2 test users via API
    const user1 = await adminClient.createUser(pw.random.user(), '', '');
    const user2 = await adminClient.createUser(pw.random.user(), '', '');

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Navigate to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Search by first user's first name
    await systemConsolePage.systemUsers.enterSearchText(user1.first_name);

    // * Verify first user appears in results
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(user1.email);

    // * Verify second user does not appear in results
    await systemConsolePage.systemUsers.verifyRowWithTextIsNotFound(user2.email);
});

test('Should be able to search users with their emails', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // # Log in as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Create 2 test users
    const user1 = await adminClient.createUser(pw.random.user(), '', '');
    const user2 = await adminClient.createUser(pw.random.user(), '', '');

    // # Visit system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Navigate to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // # Search by first user's email
    await systemConsolePage.systemUsers.enterSearchText(user1.email);

    // * Verify first user appears
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(user1.email);

    // * Verify second user does not appear
    await systemConsolePage.systemUsers.verifyRowWithTextIsNotFound(user2.email);
});
```

---

## Example 4: Visual Regression Test

### Generator Output

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Capture visual snapshots of the login page in normal and error states
 */
test(
    'login page visual check',
    {tag: ['@visual', '@login_page', '@snapshots']},
    async ({pw, page, browserName, viewport}, testInfo) => {
        // # Set up to skip landing page redirect
        await pw.hasSeenLandingPage();

        // # Navigate to login page
        const {adminClient} = await pw.getAdminClient();
        await pw.loginPage.goto();
        await pw.loginPage.toBeVisible();

        // # Remove focus from email input
        await pw.loginPage.title.click();

        // # Prepare test args
        const testArgs = {page, browserName, viewport};
        const license = await adminClient.getClientLicenseOld();
        const editionSuffix = license.IsLicensed === 'true' ? '' : 'team edition';

        // * Verify login page appears as expected
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} ${editionSuffix}`},
            testArgs
        );

        // # Trigger validation error by clicking sign in without credentials
        await pw.loginPage.signInButton.click();
        await pw.loginPage.userErrorLabel.waitFor();

        // * Verify login page with error appears as expected
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} error ${editionSuffix}`},
            testArgs
        );
    }
);
```

---

## Example 5: Test Healing Scenario

### Failing Test (Before Healing)

```typescript
test('should create channel', async ({page}) => {
    // # Click create button
    await page.click('.create-channel-btn'); // ❌ CSS class selector

    // # Fill form
    await page.fill('#channelName', 'test'); // ❌ ID selector

    // # Submit
    await page.click('.submit'); // ❌ CSS class selector

    // Wait for success
    await page.waitForTimeout(3000); // ❌ Arbitrary timeout

    // * Verify
    const element = page.locator('.channel-name'); // ❌ CSS class
    expect(await element.isVisible()).toBe(true); // ❌ Generic assertion
});
```

### Healer Analysis

```markdown
## Test Healing Report

### Test: channel_creation.spec.ts - "should create channel"

### Failure Analysis
**Error**: `locator.click: Timeout 30000ms exceeded`
**Failure Type**: Selector issues + timing issues + assertion issues
**Root Cause**:
1. CSS class selectors are brittle and broke after UI refactor
2. Arbitrary timeout instead of waiting for specific condition
3. Generic assertion instead of Playwright's built-in assertions
**Consistency**: Consistent failure (100% fail rate)

### Healing Strategy
1. Replace CSS selectors with data-testid attributes
2. Use proper Playwright waiting strategies
3. Use Playwright's expect assertions
4. Add proper modal wait handling

### Changes Made
- Replaced `.create-channel-btn` with `[data-testid="sidebar-create-channel"]`
- Replaced `#channelName` with `[data-testid="channel-name-input"]`
- Replaced `.submit` with `[data-testid="create-button"]`
- Added modal visibility wait
- Replaced waitForTimeout with waitForResponse for API call
- Replaced generic assertion with Playwright's expect

### Verification
- [x] Fix maintains original test intent
- [x] Fix follows Mattermost best practices
- [x] Fix makes test more robust
- [x] Cleanup is adequate
- [x] Similar patterns checked in other tests

### Recommendations
1. Add data-testid attributes to all interactive elements
2. Create page objects for channel creation flow
3. Add this pattern to test creation guidelines
```

### Healed Test (After Healing)

```typescript
test(
    'should create channel successfully',
    {tag: ['@functional', '@channels']},
    async ({pw, page}) => {
        // # Navigate to team view
        await page.goto('/team/channels/town-square');
        await page.locator('[data-testid="channel-view"]').waitFor();

        // # Open channel creation modal
        await page.click('[data-testid="sidebar-create-channel"]');

        // # Wait for modal to be visible
        await page.locator('[data-testid="create-channel-modal"]')
            .waitFor({state: 'visible'});

        // # Fill in channel name
        const channelName = `test-channel-${Date.now()}`;
        await page.fill('[data-testid="channel-name-input"]', channelName);

        // # Submit form
        await page.click('[data-testid="create-button"]');

        // # Wait for API response
        await page.waitForResponse(resp =>
            resp.url().includes('/api/v4/channels') && resp.status() === 201
        );

        // * Verify channel appears in sidebar
        await expect(page.locator(`[data-testid="sidebar-channel-${channelName}"]`))
            .toBeVisible();
    }
);
```

---

## Key Takeaways from Examples

### 1. Always Use the Mattermost pw Fixture
```typescript
import {test} from '@mattermost/playwright-lib';

test('my test', async ({pw, page}) => {
    const {adminClient} = await pw.getAdminClient();
    // Use pw methods...
});
```

### 2. Create Test Data via API
```typescript
const user = await adminClient.createUser(pw.random.user(), '', '');
const channel = await adminClient.createChannel({...});
```

### 3. Use Proper Selectors
```typescript
// ✅ data-testid
await page.click('[data-testid="button-name"]');

// ❌ CSS classes
await page.click('.btn-submit');
```

### 4. Wait for Specific Conditions
```typescript
// ✅ Wait for API response
await page.waitForResponse(resp =>
    resp.url().includes('/api/v4/posts') && resp.status() === 201
);

// ❌ Arbitrary timeout
await page.waitForTimeout(5000);
```

### 5. Use Playwright Assertions
```typescript
// ✅ Playwright expect
await expect(page.locator('[data-testid="element"]')).toBeVisible();

// ❌ Generic assertion
expect(await element.isVisible()).toBe(true);
```

### 6. Clean Up Test Data
```typescript
test.afterEach(async ({pw}) => {
    const {adminClient} = await pw.getAdminClient();
    await adminClient.deleteChannel(channelId);
});
```

### 7. Handle Real-time Updates
```typescript
// Use longer timeout for WebSocket updates
await expect(user2Page.locator(`text=${message}`))
    .toBeVisible({timeout: 10000});
```

---

## Conclusion

These examples demonstrate:
- Complete workflow from planning to implementation
- Actual Mattermost patterns (pw fixture, page objects)
- Proper selector strategies
- Robust waiting mechanisms
- Test isolation and cleanup
- Real-time testing patterns
- Visual regression testing
- Test healing process

Use these as templates when creating new E2E tests!
