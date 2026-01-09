# Mattermost-Specific E2E Testing Patterns

This document provides Mattermost-specific patterns and conventions for E2E testing that differ from or extend standard Playwright patterns.

## Table of Contents
1. [The pw Fixture](#the-pw-fixture)
2. [Common Test Setup Patterns](#common-test-setup-patterns)
3. [Page Objects and Navigation](#page-objects-and-navigation)
4. [API Test Data Management](#api-test-data-management)
5. [Real-time and WebSocket Patterns](#real-time-and-websocket-patterns)
6. [Authentication Patterns](#authentication-patterns)
7. [System Console Testing](#system-console-testing)
8. [Visual Testing Patterns](#visual-testing-patterns)

---

## The pw Fixture

The `pw` fixture is Mattermost's custom Playwright extension that provides domain-specific helpers.

### Basic Usage
```typescript
import {test} from '@mattermost/playwright-lib';

test('my test', async ({pw, page, browserName, viewport}) => {
    // pw - Mattermost-specific helpers
    // page - Standard Playwright page object
    // browserName - Current browser ('chromium', 'firefox', 'webkit')
    // viewport - Current viewport dimensions {width, height}
});
```

### Available pw Methods

#### Authentication and Setup
```typescript
// Initialize test setup (creates admin, team, etc.)
const {adminUser, adminClient, team} = await pw.initSetup();

// Get admin API client
const {adminClient} = await pw.getAdminClient();

// Get user API client
const {userClient} = await pw.getUserClient();

// Skip landing page for logged-in tests
await pw.hasSeenLandingPage();

// Login via testBrowser
const {systemConsolePage} = await pw.testBrowser.login(adminUser);
```

#### Page Objects
```typescript
// Access built-in page objects
await pw.loginPage.goto();
await pw.loginPage.toBeVisible();
await pw.loginPage.signInButton.click();
await pw.loginPage.userErrorLabel.waitFor();
```

#### Utilities
```typescript
// Generate random test data
const randomUser = pw.random.user();
const randomTeam = pw.random.team();
const randomChannel = pw.random.channel();

// Visual regression testing
await pw.matchSnapshot(testInfo, {page, browserName, viewport});
```

---

## Common Test Setup Patterns

### Pattern 1: Basic Functional Test Setup
```typescript
test.describe('Feature Tests', () => {
    test(
        'test description',
        {tag: ['@functional', '@feature-area']},
        async ({pw, page}) => {
            // Test implementation
        }
    );
});
```

### Pattern 2: Tests with Shared Setup/Cleanup
```typescript
test.describe('Channel Operations', () => {
    let testData: {channelId: string; teamId: string};

    test.beforeEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();

        // Create test data
        const team = await adminClient.createTeam({
            name: `test-team-${Date.now()}`,
            display_name: 'Test Team',
            type: 'O',
        });

        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `test-channel-${Date.now()}`,
            display_name: 'Test Channel',
            type: 'O',
        });

        testData = {channelId: channel.id, teamId: team.id};
    });

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();

        if (testData.channelId) {
            await adminClient.deleteChannel(testData.channelId);
        }
        if (testData.teamId) {
            await adminClient.deleteTeam(testData.teamId);
        }
    });

    test('can perform operation', async ({page}) => {
        // Use testData in test
    });
});
```

### Pattern 3: System Console Tests with Admin User
```typescript
test('admin feature test', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();

    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    // Login as admin
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // Navigate to system console
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // Perform admin operations
    await systemConsolePage.sidebar.goToItem('Users');
});
```

---

## Page Objects and Navigation

### Using Built-in Page Objects

#### Login Page
```typescript
await pw.loginPage.goto();
await pw.loginPage.toBeVisible();
await pw.loginPage.emailInput.fill('user@example.com');
await pw.loginPage.passwordInput.fill('password');
await pw.loginPage.signInButton.click();
```

#### System Console Page
```typescript
const {systemConsolePage} = await pw.testBrowser.login(adminUser);

// Navigate to sections
await systemConsolePage.sidebar.goToItem('Users');
await systemConsolePage.sidebar.goToItem('Teams');

// System Users operations
await systemConsolePage.systemUsers.toBeVisible();
await systemConsolePage.systemUsers.enterSearchText('search query');
await systemConsolePage.systemUsers.verifyRowWithTextIsFound('user@example.com');
await systemConsolePage.systemUsers.verifyRowWithTextIsNotFound('other@example.com');
```

### Navigation Patterns

#### Navigate to Channel
```typescript
// Direct URL navigation
await page.goto('/team-name/channels/channel-name');

// Wait for channel to be ready
await page.locator('[data-testid="channel-view"]').waitFor();
```

#### Navigate to Team
```typescript
// Navigate to team with default channel
await page.goto(`/${teamName}/channels/town-square`);
```

#### Navigate and Wait Pattern
```typescript
// Navigate and wait for specific element
await page.goto('/path/to/feature');
await page.locator('[data-testid="feature-loaded-indicator"]')
    .waitFor({state: 'visible'});
```

---

## API Test Data Management

### Creating Test Data via API

#### Create User
```typescript
const {adminClient} = await pw.getAdminClient();

const user = await adminClient.createUser(
    pw.random.user(),  // Generates random user data
    '',                 // Password (empty uses default)
    ''                  // Verification token
);

// Access user properties
console.log(user.id, user.email, user.first_name);
```

#### Create Team
```typescript
const team = await adminClient.createTeam({
    name: `test-team-${Date.now()}`,        // Must be unique, URL-safe
    display_name: 'Test Team',               // Display name
    type: 'O',                               // 'O' for open, 'I' for invite-only
});
```

#### Create Channel
```typescript
const channel = await adminClient.createChannel({
    team_id: team.id,
    name: `test-channel-${Date.now()}`,      // Must be unique, URL-safe
    display_name: 'Test Channel',
    type: 'O',                                // 'O' for public, 'P' for private
    purpose: 'Channel purpose',               // Optional
    header: 'Channel header',                 // Optional
});
```

#### Create Post
```typescript
const post = await adminClient.createPost({
    channel_id: channel.id,
    message: 'Test message content',
});
```

#### Add User to Team/Channel
```typescript
// Add user to team
await adminClient.addUserToTeam(team.id, user.id);

// Add user to channel
await adminClient.addUserToChannel(channel.id, user.id);
```

### Cleanup Patterns

#### Single Test Cleanup
```typescript
test('feature test', async ({pw, page}) => {
    const {adminClient} = await pw.getAdminClient();

    const channel = await adminClient.createChannel({...});

    try {
        // Test code using channel
    } finally {
        // Cleanup runs even if test fails
        await adminClient.deleteChannel(channel.id);
    }
});
```

#### Describe-level Cleanup
```typescript
test.describe('Feature Tests', () => {
    const createdResources: {channels: string[]; teams: string[]} = {
        channels: [],
        teams: [],
    };

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();

        // Clean up all created resources
        for (const channelId of createdResources.channels) {
            await adminClient.deleteChannel(channelId);
        }
        for (const teamId of createdResources.teams) {
            await adminClient.deleteTeam(teamId);
        }

        // Reset arrays
        createdResources.channels = [];
        createdResources.teams = [];
    });

    test('test 1', async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        const channel = await adminClient.createChannel({...});
        createdResources.channels.push(channel.id);

        // Test code
    });
});
```

---

## Real-time and WebSocket Patterns

### Multi-User Real-time Testing

#### Basic Multi-User Pattern
```typescript
test('real-time message delivery', async ({browser, pw}) => {
    // Create separate contexts for different users
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();

    try {
        // Both users navigate to same channel
        await user1Page.goto('/team/channels/town-square');
        await user2Page.goto('/team/channels/town-square');

        // Wait for both channels to load
        await user1Page.locator('[data-testid="channel-view"]').waitFor();
        await user2Page.locator('[data-testid="channel-view"]').waitFor();

        // User 1 performs action
        const messageText = `Test ${Date.now()}`;
        await user1Page.fill('[data-testid="post-textbox"]', messageText);
        await user1Page.press('[data-testid="post-textbox"]', 'Enter');

        // Verify user 1 sees result
        await expect(user1Page.locator(`text=${messageText}`).last())
            .toBeVisible();

        // Verify user 2 sees update in real-time
        await expect(user2Page.locator(`text=${messageText}`).last())
            .toBeVisible({timeout: 10000}); // Longer timeout for WebSocket
    } finally {
        // Clean up contexts
        await user1Context.close();
        await user2Context.close();
    }
});
```

### WebSocket Event Waiting

#### Wait for WebSocket Connection
```typescript
// Wait for WebSocket to be established
const wsPromise = page.waitForEvent('websocket');
await page.goto('/team/channels/town-square');
const ws = await wsPromise;

// Verify WebSocket URL
expect(ws.url()).toContain('/api/v4/websocket');
```

#### Wait for WebSocket Frame
```typescript
// Wait for specific WebSocket message
await ws.waitForEvent('framereceived', {
    predicate: frame => {
        const data = frame.text();
        return data.includes('posted') || data.includes('event');
    },
    timeout: 10000,
});
```

### Real-time Update Assertions

#### Pattern for Real-time Assertions
```typescript
// Use longer timeout for real-time updates
await expect(page.locator('[data-testid="notification"]'))
    .toBeVisible({timeout: 10000});

// Wait for element with specific content
await expect(page.locator('text=Message delivered'))
    .toBeVisible({timeout: 10000});
```

---

## Authentication Patterns

### Skip Landing Page
```typescript
test('authenticated user test', async ({pw, page}) => {
    // Skip landing page redirect
    await pw.hasSeenLandingPage();

    // Navigate directly to app
    await page.goto('/team/channels/town-square');
});
```

### Login via TestBrowser
```typescript
test('admin test', async ({pw}) => {
    const {adminUser} = await pw.initSetup();

    // Login and get page objects
    const {systemConsolePage, page} = await pw.testBrowser.login(adminUser);

    // Now authenticated as admin
    await systemConsolePage.goto();
});
```

### Test with Different User Roles
```typescript
test.describe('Role-based tests', () => {
    test('as admin', async ({pw}) => {
        const {adminUser} = await pw.initSetup();
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // Admin-specific tests
    });

    test('as regular user', async ({pw, page}) => {
        const {adminClient} = await pw.getAdminClient();
        const user = await adminClient.createUser(pw.random.user(), '', '');

        // Login as regular user
        // User-specific tests
    });
});
```

---

## System Console Testing

### Navigate System Console Sections
```typescript
test('system console navigation', async ({pw}) => {
    const {adminUser} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // Navigate to different sections
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.sidebar.goToItem('Teams');
    await systemConsolePage.sidebar.goToItem('Environment');
});
```

### System Users Operations
```typescript
test('system users search', async ({pw}) => {
    const {adminUser, adminClient} = await pw.initSetup();
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);

    // Create test user
    const user = await adminClient.createUser(pw.random.user(), '', '');

    // Navigate to users
    await systemConsolePage.goto();
    await systemConsolePage.sidebar.goToItem('Users');
    await systemConsolePage.systemUsers.toBeVisible();

    // Search for user
    await systemConsolePage.systemUsers.enterSearchText(user.email);

    // Verify results
    await systemConsolePage.systemUsers.verifyRowWithTextIsFound(user.email);
});
```

---

## Visual Testing Patterns

### Basic Visual Snapshot
```typescript
test(
    'component visual check',
    {tag: ['@visual', '@component-name', '@snapshots']},
    async ({pw, page, browserName, viewport}, testInfo) => {
        // Navigate to component
        await page.goto('/path/to/component');
        await page.locator('[data-testid="component-loaded"]').waitFor();

        // Prepare test args
        const testArgs = {page, browserName, viewport};

        // Capture snapshot
        await pw.matchSnapshot(testInfo, testArgs);
    }
);
```

### Multi-State Visual Testing
```typescript
test(
    'component states visual check',
    {tag: ['@visual', '@component-name', '@snapshots']},
    async ({pw, page, browserName, viewport}, testInfo) => {
        await page.goto('/path/to/component');
        await page.locator('[data-testid="component"]').waitFor();

        const testArgs = {page, browserName, viewport};

        // Snapshot default state
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} default`},
            testArgs
        );

        // Change state
        await page.click('[data-testid="toggle-button"]');
        await page.locator('[data-testid="changed-indicator"]').waitFor();

        // Snapshot changed state
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} active`},
            testArgs
        );

        // Trigger error state
        await page.click('[data-testid="error-trigger"]');
        await page.locator('[data-testid="error-message"]').waitFor();

        // Snapshot error state
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} error`},
            testArgs
        );
    }
);
```

### License-aware Visual Testing
```typescript
test(
    'feature visual check',
    {tag: ['@visual', '@feature', '@snapshots']},
    async ({pw, page, browserName, viewport}, testInfo) => {
        const {adminClient} = await pw.getAdminClient();

        // Get license information
        const license = await adminClient.getClientLicenseOld();
        const editionSuffix = license.IsLicensed === 'true' ? 'enterprise' : 'team edition';

        await page.goto('/path/to/feature');
        const testArgs = {page, browserName, viewport};

        // Snapshot includes license info in title
        await pw.matchSnapshot(
            {...testInfo, title: `${testInfo.title} ${editionSuffix}`},
            testArgs
        );
    }
);
```

---

## Common Pitfalls and Solutions

### Pitfall 1: Forgetting to Wait for Channel Load
```typescript
// ❌ May fail if channel not loaded
await page.goto('/team/channels/town-square');
await page.click('[data-testid="post-textbox"]');

// ✅ Wait for channel view
await page.goto('/team/channels/town-square');
await page.locator('[data-testid="channel-view"]').waitFor();
await page.click('[data-testid="post-textbox"]');
```

### Pitfall 2: Not Using Dynamic Test Data
```typescript
// ❌ Hardcoded names cause conflicts
const channel = await adminClient.createChannel({
    name: 'test-channel',  // Will fail if exists
    ...
});

// ✅ Dynamic names
const channel = await adminClient.createChannel({
    name: `test-channel-${Date.now()}`,  // Unique
    ...
});
```

### Pitfall 3: Missing Cleanup
```typescript
// ❌ No cleanup
test('test', async ({pw}) => {
    const {adminClient} = await pw.getAdminClient();
    const channel = await adminClient.createChannel({...});
    // Test without cleanup
});

// ✅ With cleanup
test('test', async ({pw}) => {
    const {adminClient} = await pw.getAdminClient();
    const channel = await adminClient.createChannel({...});

    try {
        // Test code
    } finally {
        await adminClient.deleteChannel(channel.id);
    }
});
```

### Pitfall 4: Not Handling Real-time Delays
```typescript
// ❌ Default timeout may be too short
await expect(user2Page.locator('text=message'))
    .toBeVisible();  // May timeout before WebSocket delivers

// ✅ Longer timeout for real-time
await expect(user2Page.locator('text=message'))
    .toBeVisible({timeout: 10000});
```

---

## Best Practices Summary

1. **Always use the pw fixture** for Mattermost-specific operations
2. **Create test data via API** for speed and reliability
3. **Use dynamic naming** with timestamps to avoid conflicts
4. **Clean up test data** in afterEach or finally blocks
5. **Wait for channel load** before interacting with UI
6. **Use longer timeouts** for WebSocket/real-time updates
7. **Use pw.random helpers** for generating test data
8. **Follow the comment convention**: `#` for actions, `*` for assertions
9. **Tag tests appropriately** for organization and filtering
10. **Use page objects** when available (loginPage, systemConsolePage)

---

## Quick Reference

### Common pw Methods
```typescript
await pw.initSetup()                          // Initialize test environment
await pw.getAdminClient()                     // Get admin API client
await pw.getUserClient()                      // Get user API client
await pw.hasSeenLandingPage()                 // Skip landing page
await pw.testBrowser.login(user)              // Login as user
await pw.matchSnapshot(testInfo, testArgs)    // Visual snapshot
pw.random.user()                              // Generate random user
pw.random.team()                              // Generate random team
pw.random.channel()                           // Generate random channel
```

### Common API Operations
```typescript
await adminClient.createUser(userData, '', '')
await adminClient.createTeam({name, display_name, type})
await adminClient.createChannel({team_id, name, display_name, type})
await adminClient.createPost({channel_id, message})
await adminClient.addUserToTeam(teamId, userId)
await adminClient.addUserToChannel(channelId, userId)
await adminClient.deleteChannel(channelId)
await adminClient.deleteTeam(teamId)
await adminClient.getClientLicenseOld()
```

### Common Page Object Methods
```typescript
await pw.loginPage.goto()
await pw.loginPage.toBeVisible()
await systemConsolePage.goto()
await systemConsolePage.sidebar.goToItem('Section')
await systemConsolePage.systemUsers.enterSearchText('query')
await systemConsolePage.systemUsers.verifyRowWithTextIsFound('text')
```

---

This document should be your primary reference for Mattermost-specific E2E testing patterns. When in doubt, follow these patterns for consistency and reliability!
