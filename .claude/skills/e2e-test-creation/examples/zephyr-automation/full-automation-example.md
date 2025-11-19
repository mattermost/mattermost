# Full Automation Code Examples

## Overview

This document shows complete Playwright automation code generated after Zephyr sync (Stage 3) or when automating existing test cases.

## Example 1: Authentication - Successful Login

### Test Case Details
- **Zephyr Key**: MM-T1234
- **Test Name**: Test successful login
- **Objective**: Verify user can login with valid credentials
- **Category**: auth

### Complete Test File

**File Path**: `e2e-tests/playwright/specs/functional/auth/successful_login.spec.ts`

```typescript
import {test, expect} from '@playwright/test';

/**
 * @objective Verify user can login with valid credentials
 * @test steps
 *  1. Navigate to login page
 *  2. Enter valid username and password
 *  3. Click Login button
 *  4. Verify user is redirected to dashboard
 */
test('MM-T1234 Test successful login', {tag: '@auth'}, async ({pw}) => {
    const {user} = await pw.initSetup();

    // # Navigate to login page
    const {loginPage} = await pw.testBrowser.openLoginPage();
    await expect(loginPage.page).toHaveURL(/.*\/login/);

    // # Enter valid username and password
    await loginPage.fillCredentials(user.username, user.password);

    // # Click Login button
    await loginPage.clickLoginButton();

    // * Verify user is redirected to dashboard
    await expect(pw.page).toHaveURL(/.*\/channels\/.*/);
    await expect(pw.page.locator('[data-testid="sidebar-header"]')).toBeVisible();
    await expect(pw.page.locator('[data-testid="team-display-name"]')).toHaveText(user.username);
});
```

### Key Features
- ✅ Uses actual Zephyr key: MM-T1234
- ✅ Complete JSDoc with objective and steps
- ✅ Uses Mattermost `pw` fixture
- ✅ Proper page object usage (`loginPage`)
- ✅ Comment prefixes: `// #` for actions, `// *` for verifications
- ✅ Semantic locators (`data-testid`)
- ✅ Meaningful assertions

## Example 2: Channel Creation

### Test Case Details
- **Zephyr Key**: MM-T5678
- **Test Name**: Create public channel
- **Objective**: Verify user can create a public channel
- **Category**: channels

### Complete Test File

**File Path**: `e2e-tests/playwright/specs/functional/channels/create_public_channel.spec.ts`

```typescript
import {test, expect} from '@playwright/test';

/**
 * @objective Verify user can create a public channel
 * @test steps
 *  1. Navigate to channels page
 *  2. Click "Create Channel" button
 *  3. Enter channel name and description
 *  4. Select "Public" option
 *  5. Click "Create" button
 *  6. Verify channel appears in sidebar
 */
test('MM-T5678 Create public channel', {tag: '@channels'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const channelName = `test-channel-${Date.now()}`;
    const channelDescription = 'Test channel description';

    // # Login and navigate to channels page
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);

    // # Click "Create Channel" button
    await channelsPage.page.click('[data-testid="create-channel-button"]');
    await expect(channelsPage.page.locator('[data-testid="create-channel-modal"]')).toBeVisible();

    // # Enter channel name and description
    await channelsPage.page.fill('[data-testid="channel-name-input"]', channelName);
    await channelsPage.page.fill('[data-testid="channel-description-input"]', channelDescription);

    // # Select "Public" option (default, verify it's selected)
    await expect(channelsPage.page.locator('[data-testid="channel-type-public"]')).toBeChecked();

    // # Click "Create" button
    await channelsPage.page.click('[data-testid="create-channel-submit"]');

    // * Verify channel appears in sidebar
    await expect(channelsPage.page.locator(`[data-testid="channel-${channelName}"]`)).toBeVisible();

    // * Verify channel is active
    await expect(channelsPage.page.locator('[data-testid="channel-header-title"]')).toHaveText(channelName);
});
```

### Key Features
- ✅ Dynamic test data (`Date.now()` for uniqueness)
- ✅ Proper setup with team context
- ✅ Modal handling
- ✅ Form interactions
- ✅ Multiple verification points

## Example 3: Messaging - Thread Reply

### Test Case Details
- **Zephyr Key**: MM-T9101
- **Test Name**: Post message in thread
- **Objective**: Verify user can reply to a message in a thread
- **Category**: messaging

### Complete Test File

**File Path**: `e2e-tests/playwright/specs/functional/messaging/post_message_in_thread.spec.ts`

```typescript
import {test, expect} from '@playwright/test';

/**
 * @objective Verify user can reply to a message in a thread
 * @test steps
 *  1. Navigate to a channel with existing messages
 *  2. Hover over a message
 *  3. Click "Reply" button
 *  4. Enter reply text
 *  5. Click "Send" button
 *  6. Verify reply appears in thread
 */
test('MM-T9101 Post message in thread', {tag: '@messaging'}, async ({pw}) => {
    const {user, team, channel, adminClient} = await pw.initSetup();
    const parentMessage = `Parent message ${Date.now()}`;
    const replyMessage = `Reply message ${Date.now()}`;

    // # Create a parent message via API
    const post = await adminClient.createPost({
        channel_id: channel.id,
        message: parentMessage
    });

    // # Login and navigate to channel
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);

    // * Verify parent message is visible
    const postLocator = channelsPage.page.locator(`[data-testid="post-${post.id}"]`);
    await expect(postLocator).toBeVisible();

    // # Hover over the message to reveal actions
    await postLocator.hover();

    // # Click "Reply" button
    await channelsPage.page.click(`[data-testid="post-${post.id}-reply-button"]`);

    // * Verify RHS (Right Hand Sidebar) opens with thread
    await expect(channelsPage.page.locator('[data-testid="rhs-thread"]')).toBeVisible();
    await expect(channelsPage.page.locator('[data-testid="rhs-root-post"]')).toContainText(parentMessage);

    // # Enter reply text in thread
    await channelsPage.page.fill('[data-testid="rhs-message-input"]', replyMessage);

    // # Click "Send" button in RHS
    await channelsPage.page.click('[data-testid="rhs-send-button"]');

    // * Verify reply appears in thread
    await expect(channelsPage.page.locator('[data-testid="rhs-thread"]')).toContainText(replyMessage);

    // * Verify reply count is updated in center
    await expect(postLocator.locator('[data-testid="reply-count"]')).toHaveText('1 reply');
});
```

### Key Features
- ✅ API setup for test data (creates parent post)
- ✅ Hover interactions
- ✅ RHS (Right Hand Sidebar) handling
- ✅ Thread-specific assertions
- ✅ Reply count verification

## Example 4: System Console - User Search

### Test Case Details
- **Zephyr Key**: MM-T3456
- **Test Name**: Search users by email in system console
- **Objective**: Verify admin can search users by email address
- **Category**: system_console

### Complete Test File

**File Path**: `e2e-tests/playwright/specs/functional/system_console/search_users_by_email.spec.ts`

```typescript
import {test, expect} from '@playwright/test';

/**
 * @objective Verify admin can search users by email address
 * @test steps
 *  1. Login as admin user
 *  2. Navigate to System Console
 *  3. Go to Users section
 *  4. Enter user email in search field
 *  5. Verify matching user appears in results
 */
test('MM-T3456 Search users by email in system console', {tag: '@system_console'}, async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    // # Create a test user with known email
    const testUser = await adminClient.createUser({
        username: `testuser-${Date.now()}`,
        email: `testuser-${Date.now()}@example.com`,
        password: 'password123',
        first_name: 'Test',
        last_name: 'User'
    });

    // # Login as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // # Navigate to System Console
    await systemConsolePage.goto();
    await expect(systemConsolePage.page).toHaveURL(/.*\/admin_console/);

    // # Go to Users section
    await systemConsolePage.sidebar.goToItem('Users');
    await expect(systemConsolePage.systemUsers.page).toHaveURL(/.*\/admin_console\/user_management\/users/);

    // # Enter user email in search field
    await systemConsolePage.systemUsers.enterSearchText(testUser.email);

    // * Verify matching user appears in results
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(testUser.email);
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(testUser.username);
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(`${testUser.first_name} ${testUser.last_name}`);

    // * Verify only one result is shown
    const userRows = systemConsolePage.page.locator('[data-testid="user-row"]');
    await expect(userRows).toHaveCount(1);
});
```

### Key Features
- ✅ Admin user context
- ✅ User creation via API for test data
- ✅ System console navigation
- ✅ Page object methods (`systemConsolePage.systemUsers`)
- ✅ Search functionality testing
- ✅ Result count verification

## Example 5: Multi-Step Workflow

### Test Case Details
- **Zephyr Key**: MM-T7890
- **Test Name**: Complete channel workflow - create, post, archive
- **Objective**: Verify complete channel lifecycle
- **Category**: channels

### Complete Test File

**File Path**: `e2e-tests/playwright/specs/functional/channels/complete_channel_workflow.spec.ts`

```typescript
import {test, expect} from '@playwright/test';

/**
 * @objective Verify complete channel lifecycle from creation to archiving
 * @test steps
 *  1. Create a new public channel
 *  2. Post a message in the channel
 *  3. Verify message is visible
 *  4. Archive the channel
 *  5. Verify channel is no longer in sidebar
 *  6. Verify archived channel is accessible from archived channels view
 */
test('MM-T7890 Complete channel workflow - create, post, archive', {tag: '@channels'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const channelName = `workflow-channel-${Date.now()}`;
    const testMessage = `Test message ${Date.now()}`;

    // # Login and navigate to channels page
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name);

    // # Step 1: Create a new public channel
    await channelsPage.page.click('[data-testid="create-channel-button"]');
    await channelsPage.page.fill('[data-testid="channel-name-input"]', channelName);
    await channelsPage.page.click('[data-testid="create-channel-submit"]');

    // * Verify channel is created and active
    await expect(channelsPage.page.locator('[data-testid="channel-header-title"]')).toHaveText(channelName);

    // # Step 2: Post a message in the channel
    await channelsPage.postMessage(testMessage);

    // # Step 3: Verify message is visible
    const messageLocator = channelsPage.page.locator(`text=${testMessage}`).first();
    await expect(messageLocator).toBeVisible();

    // # Step 4: Archive the channel
    await channelsPage.page.click('[data-testid="channel-header-menu"]');
    await channelsPage.page.click('[data-testid="archive-channel-option"]');

    // * Confirm archive modal appears
    await expect(channelsPage.page.locator('[data-testid="archive-channel-modal"]')).toBeVisible();
    await channelsPage.page.click('[data-testid="confirm-archive-button"]');

    // # Step 5: Verify channel is no longer in sidebar
    await expect(channelsPage.page.locator(`[data-testid="channel-${channelName}"]`)).not.toBeVisible();

    // * Verify redirect to Town Square (default channel)
    await expect(channelsPage.page.locator('[data-testid="channel-header-title"]')).toHaveText('Town Square');

    // # Step 6: Verify archived channel is accessible from archived channels view
    await channelsPage.page.click('[data-testid="sidebar-menu"]');
    await channelsPage.page.click('[data-testid="view-archived-channels"]');

    // * Verify archived channel appears in list
    await expect(channelsPage.page.locator('[data-testid="archived-channels-list"]')).toContainText(channelName);

    // # Click on archived channel
    await channelsPage.page.click(`[data-testid="archived-channel-${channelName}"]`);

    // * Verify archived channel opens in read-only mode
    await expect(channelsPage.page.locator('[data-testid="channel-archived-banner"]')).toBeVisible();
    await expect(channelsPage.page.locator('[data-testid="channel-archived-banner"]')).toContainText('This channel has been archived');

    // * Verify previous message is still visible
    await expect(channelsPage.page.locator(`text=${testMessage}`).first()).toBeVisible();
});
```

### Key Features
- ✅ Multi-step workflow in single test
- ✅ Channel lifecycle testing
- ✅ Modal handling
- ✅ Navigation verification
- ✅ Read-only mode verification

## Common Patterns

### 1. Setup Pattern
```typescript
const {user, team, channel, adminClient} = await pw.initSetup();
const {channelsPage} = await pw.testBrowser.login(user);
```

### 2. Dynamic Test Data
```typescript
const uniqueId = Date.now();
const testData = `test-data-${uniqueId}`;
```

### 3. API Setup for Test Data
```typescript
const post = await adminClient.createPost({
    channel_id: channel.id,
    message: 'Test message'
});
```

### 4. Comment Prefixes
```typescript
// # Action step
await page.click('[data-testid="button"]');

// * Verification/assertion
await expect(page.locator('[data-testid="result"]')).toBeVisible();
```

### 5. Semantic Locators
```typescript
// ✅ Preferred
page.locator('[data-testid="element-id"]')
page.getByRole('button', { name: 'Submit' })
page.getByLabel('Username')

// ❌ Avoid
page.locator('.css-class')
page.locator('div > span:nth-child(2)')
```

### 6. Proper Wait Strategies
```typescript
// ✅ Good - Wait for specific condition
await expect(page.locator('[data-testid="message"]')).toBeVisible();
await page.waitForURL(/.*\/channels\/.*/);

// ❌ Bad - Arbitrary timeout
await page.waitForTimeout(1000);
```

## After Zephyr Update

Once tests are executed successfully, Zephyr test cases are updated with:

```json
{
  "status": "Approved",
  "customFields": {
    "Automation Status": "Automated",
    "Automation File": "specs/functional/auth/successful_login.spec.ts",
    "Last Automated": "2025-01-15T14:30:00Z"
  }
}
```

This creates a complete bi-directional sync between local automation and Zephyr test management.
