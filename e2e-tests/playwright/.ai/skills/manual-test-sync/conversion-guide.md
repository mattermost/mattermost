# Manual Test to E2E Conversion Guide

This guide explains how to convert manual test cases into executable Playwright E2E tests while maintaining traceability and quality.

## Conversion Philosophy

### Key Principles

1. **Preserve Intent** - Understand what the test verifies, not just the steps
2. **Maintain Traceability** - Always link E2E test to manual test via MM-T key
3. **Follow Conventions** - Use Mattermost's established E2E patterns
4. **Think Automation** - Adapt steps for automated execution
5. **Improve Quality** - E2E test should be more reliable than manual

### When to Convert

✅ **Convert when:**
- Manual test is Active and stable
- Feature has E2E infrastructure (page objects, etc.)
- Test can be reasonably automated
- Priority is P1 or P2 (high value)

❌ **Don't convert when:**
- Manual test is Deprecated
- Feature requires human judgment (visual design review)
- Test requires physical hardware (mobile device testing)
- Backend infrastructure doesn't exist yet

## Conversion Workflow

### Step 1: Read and Parse Manual Test

**Input:** MM-T key or file path
**Location:** `/Users/yasserkhan/Documents/mattermost/mattermost-test-management/data/test-cases/`

**Parse frontmatter:**
```yaml
---
name: "Test name"
status: Active
priority: P1|P2|P3|P4
folder: Feature area
key: MM-TXXX
playwright: null|Automated|In Progress
---
```

**Parse test body:**
```markdown
## MM-TXXX: Test Title

**Step 1**
Description
1. Substep 1
2. Substep 2
   - Expected result

**Step 2**
...

**Expected**
Overall outcome
```

### Step 2: Analyze Test Complexity

**Simple Test:** Single user, basic UI, few steps
- Direct conversion
- No planning needed
- ~2 hours

**Moderate Test:** Multi-step, state changes, some setup
- Use `@playwright-planner` for guidance
- Consider edge cases
- ~4 hours

**Complex Test:** Multi-user, real-time, backend setup
- Detailed planning with `@playwright-planner`
- Multiple page objects
- Careful wait strategies
- ~6-8 hours

**Complexity Indicators:**
```typescript
// Multi-user
"User A" && "User B" → Complex

// Real-time
"real-time", "immediately", "without refresh" → Complex

// System Console
"System Console", "admin", "configure" → Moderate

// Plugins
"plugin" → Complex

// Error handling
"error", "invalid", "failure" → Moderate

// Many steps
> 10 steps → Complex
```

### Step 3: Plan E2E Implementation

Use `@playwright-planner` to create test plan:

**Input to planner:**
```
Convert manual test MM-T5382 to E2E test:

Name: Call triggered from profile popover starts in DM
Priority: P2
Feature: Calls

Steps:
1. Login as test user and go to Off-Topic
2. Send a message
3. Switch users, login as admin and visit Off Topic
4. Open Profile Popover of the test user
5. Click on Start a call button
6. Wait for the call to start

Expected:
- Call did not start in the current channel
- DM channel with test user is created
- Call started in the DM channel
```

**Planner output:**
```markdown
Test Plan for MM-T5382

Objective: Verify calling from profile popover creates DM channel

Setup:
- Create test user
- Create admin user
- Join both to Off-Topic channel

Test Flow:
1. User 1: Login, navigate to Off-Topic, post message
2. User 2 (admin): Login, navigate to Off-Topic
3. User 2: Click username in message to open profile popover
4. User 2: Click "Start a call" button
5. Verify: DM channel appears in sidebar for User 2
6. Verify: Call widget appears in DM channel
7. Verify: Off-Topic channel does not have call widget

Page Objects Needed:
- ChannelsPage (navigation, post creation)
- UserProfilePopover (click call button)
- ChannelSidebar (verify DM created)
- CallsWidget (verify call started)

Potential Flakiness:
- DM channel creation is async - wait for sidebar update
- Call start is async - wait for widget to appear
- Multi-browser coordination - use sessions properly
```

### Step 4: Generate E2E Test

Use `@playwright-generator` with the plan:

**Output file:** `specs/functional/calls/profile_call.spec.ts`

```typescript
import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that calling from profile popover creates DM channel and starts call there
 *
 * @precondition
 * Calls plugin must be enabled
 */
test('MM-T5382 call triggered from profile popover starts in DM', {tag: '@calls'}, async ({pw}) => {
    // # Initialize test data
    const {user, adminClient, team} = await pw.initSetup();
    const admin = await adminClient.getMe();

    // # User login and post message in Off-Topic
    const {channelsPage: userPage} = await pw.testBrowser.login(user);
    await userPage.goto('off-topic');
    await userPage.postMessage('Hello from test user');

    // # Admin login and navigate to Off-Topic
    const {channelsPage: adminPage} = await pw.testBrowser.loginAsAdmin({otherSessions: [userPage]});
    await adminPage.goto('off-topic');

    // # Open profile popover for test user
    const lastPost = await adminPage.getLastPost();
    await lastPost.openUserProfile();
    const profilePopover = adminPage.userProfilePopover;

    // # Click "Start a call" button
    await profilePopover.startCall();

    // * Verify DM channel is created in sidebar
    const dmChannel = adminPage.sidebar.getDMChannel(user.username);
    await expect(dmChannel).toBeVisible();

    // * Verify call widget appears in DM channel
    await expect(adminPage.callsWidget.container).toBeVisible();

    // * Verify call is NOT in Off-Topic
    await adminPage.goto('off-topic');
    await expect(adminPage.callsWidget.container).not.toBeVisible();
});
```

### Step 5: Validate Conversion

Check generated test:

✅ **Structure:**
- [ ] Imports are correct
- [ ] Test has `@objective` documentation
- [ ] Test title includes MM-T key
- [ ] Test has appropriate tag (@calls)
- [ ] Uses `pw` fixture

✅ **Implementation:**
- [ ] Uses `pw.initSetup()` for test data
- [ ] Uses `pw.testBrowser.login()` for authentication
- [ ] Uses page objects (not raw selectors)
- [ ] Action comments start with `// #`
- [ ] Verification comments start with `// *`
- [ ] Proper async/await usage

✅ **Test Logic:**
- [ ] All manual test steps converted
- [ ] All expected outcomes verified
- [ ] Edge cases handled
- [ ] Cleanup not needed (Playwright handles)

✅ **Quality:**
- [ ] No hardcoded waits (`page.waitForTimeout(1000)`)
- [ ] Uses proper locator waits (`expect(...).toBeVisible()`)
- [ ] Test data is dynamic (not hardcoded IDs)
- [ ] Test is isolated (doesn't depend on other tests)

## Conversion Patterns

### Pattern 1: Simple UI Interaction

**Manual test:**
```markdown
**Step 1**
1. Click Settings button
2. Navigate to Display
3. Change theme to Dark
   - Verify theme changes to dark
```

**E2E test:**
```typescript
test('MM-T1234 changes theme to dark in settings', {tag: '@settings'}, async ({pw}) => {
  const {user} = await pw.initSetup();
  const {channelsPage} = await pw.testBrowser.login(user);

  // # Open settings
  await channelsPage.openSettings();

  // # Navigate to Display section
  await channelsPage.settings.navigateToDisplay();

  // # Change theme to Dark
  await channelsPage.settings.display.selectTheme('Dark');
  await channelsPage.settings.save();

  // * Verify theme is dark
  await expect(channelsPage.body).toHaveAttribute('data-theme', 'dark');
});
```

### Pattern 2: Message Posting

**Manual test:**
```markdown
**Step 1**
1. Login as user
2. Go to channel
3. Post message with text "Hello World"
   - Verify message appears in channel
   - Verify timestamp is shown
```

**E2E test:**
```typescript
test('MM-T2345 posts message in channel', {tag: '@messaging'}, async ({pw}) => {
  const {user, channel} = await pw.initSetup();
  const {channelsPage} = await pw.testBrowser.login(user);

  // # Navigate to channel
  await channelsPage.goto(channel.name);

  // # Post message
  const message = 'Hello World';
  await channelsPage.postMessage(message);

  // * Verify message appears
  const lastPost = await channelsPage.getLastPost();
  await expect(lastPost.text).toContain(message);

  // * Verify timestamp is shown
  await expect(lastPost.timestamp).toBeVisible();
});
```

### Pattern 3: Multi-User Real-Time

**Manual test:**
```markdown
**Step 1**
1. User A posts message in channel
2. User B should see message appear immediately
   - Verify message appears without refresh
   - Verify correct author shown
```

**E2E test:**
```typescript
test('MM-T3456 displays messages in real-time to other users', {tag: '@messaging'}, async ({pw}) => {
  const {user, channel} = await pw.initSetup();
  const user2 = await pw.adminClient.createUser();
  await pw.adminClient.addToTeam(channel.team_id, user2.id);
  await pw.adminClient.addToChannel(channel.id, user2.id);

  // # User A login and navigate to channel
  const {channelsPage: page1} = await pw.testBrowser.login(user);
  await page1.goto(channel.name);

  // # User B login and navigate to same channel
  const {channelsPage: page2} = await pw.testBrowser.login(user2, {otherSessions: [page1]});
  await page2.goto(channel.name);

  // # User A posts message
  const message = `Test message ${Date.now()}`;
  await page1.postMessage(message);

  // * Verify message appears for User B in real-time
  const lastPost = await page2.getLastPost();
  await expect(lastPost.text).toContain(message);

  // * Verify correct author
  await expect(lastPost.author).toContain(user.username);
});
```

### Pattern 4: System Console Configuration

**Manual test:**
```markdown
**Step 1**
1. Login as system admin
2. Go to System Console > Site Configuration
3. Enable "Show Email Address"
4. Save configuration
   - Verify setting is saved
   - Verify users can see emails
```

**E2E test:**
```typescript
test('MM-T4567 enables email visibility in system console', {tag: '@system_console'}, async ({pw}) => {
  const {adminClient} = await pw.initSetup();

  // # Login as system admin
  const {systemConsolePage} = await pw.testBrowser.loginAsAdmin();
  await systemConsolePage.goto();

  // # Navigate to Site Configuration
  await systemConsolePage.navigateTo('Site Configuration', 'Users and Teams');

  // # Enable "Show Email Address"
  await systemConsolePage.enableSetting('ShowEmailAddress');
  await systemConsolePage.saveConfig();

  // * Verify setting is saved via API
  const config = await adminClient.getConfig();
  expect(config.PrivacySettings.ShowEmailAddress).toBe(true);

  // # Test that users can see emails
  const {user} = await pw.initSetup();
  const {channelsPage} = await pw.testBrowser.login(user);
  await channelsPage.openUserProfile(user.id);

  // * Verify email is visible
  const profilePopover = channelsPage.userProfilePopover;
  await expect(profilePopover.email).toBeVisible();
  await expect(profilePopover.email).toContain(user.email);
});
```

### Pattern 5: Error Handling

**Manual test:**
```markdown
**Step 1**
1. Try to create channel with name "!!!"
   - Verify error message: "Invalid channel name"
   - Verify channel is not created
```

**E2E test:**
```typescript
test('MM-T5678 shows error when creating channel with invalid name', {tag: '@channels'}, async ({pw}) => {
  const {user, team} = await pw.initSetup();
  const {channelsPage} = await pw.testBrowser.login(user);

  // # Attempt to create channel with invalid name
  await channelsPage.sidebar.openCreateChannelModal();
  await channelsPage.createChannelModal.fillName('!!!');
  await channelsPage.createChannelModal.clickCreate();

  // * Verify error message appears
  const errorMessage = channelsPage.createChannelModal.errorMessage;
  await expect(errorMessage).toBeVisible();
  await expect(errorMessage).toContain('Invalid channel name');

  // * Verify modal is still open (channel not created)
  await expect(channelsPage.createChannelModal.container).toBeVisible();

  // * Verify channel is not in sidebar
  await channelsPage.createChannelModal.close();
  const channelLink = channelsPage.sidebar.getChannel('!!!');
  await expect(channelLink).not.toBeVisible();
});
```

### Pattern 6: Search and Filter

**Manual test:**
```markdown
**Step 1**
1. Go to System Console > Users
2. Search for user by email
3. Filter by status: Active
   - Verify correct users shown
   - Verify count matches
```

**E2E test:**
```typescript
test('MM-T6789 filters users by email and status', {tag: '@system_console'}, async ({pw}) => {
  // # Create test users
  const {adminClient} = await pw.initSetup();
  const testUser = await adminClient.createUser();

  // # Login as admin and navigate to Users page
  const {systemConsolePage} = await pw.testBrowser.loginAsAdmin();
  await systemConsolePage.goto();
  await systemConsolePage.navigateToUsers();

  // # Search by email
  await systemConsolePage.usersPage.search(testUser.email);

  // # Filter by Active status
  await systemConsolePage.usersPage.filterByStatus('Active');

  // * Verify user appears in results
  const userRow = systemConsolePage.usersPage.getUserRow(testUser.email);
  await expect(userRow).toBeVisible();

  // * Verify user count
  const count = await systemConsolePage.usersPage.getResultCount();
  expect(count).toBeGreaterThan(0);
});
```

## Directory Mapping

Determine where to place E2E test based on manual test path:

**Use key-and-path.json:**
```json
{
  "MM-T5382": {
    "key": "MM-T5382",
    "path": "calls",
    "id": 79351388
  }
}
```

**Path mapping:**
```
Manual Test Path    → E2E Test Path
─────────────────────────────────────────────
calls               → specs/functional/calls/
channels/messaging  → specs/functional/channels/messaging/
channels/settings   → specs/functional/channels/settings/
system-console/users → specs/functional/system_console/users/
authentication      → specs/functional/authentication/
search              → specs/functional/search/
plugins             → specs/functional/plugins/
```

**File naming:**
- Group related tests in same file
- Use descriptive names: `feature_name.spec.ts`
- Example: `profile_call.spec.ts`, `channel_creation.spec.ts`

## Test Documentation

Every E2E test must have proper documentation:

```typescript
/**
 * @objective Clear, concise description of what the test verifies
 *
 * @precondition
 * Special setup or requirements (omit if none beyond defaults)
 * Example: "Calls plugin must be enabled"
 */
test('MM-TXXX descriptive test title', {tag: '@feature'}, async ({pw}) => {
    // Test implementation
});
```

**Title format:**
- Include MM-T key: `MM-T5382`
- Be descriptive: What action and what outcome
- Use lowercase: `call triggered from profile popover starts in DM`
- Be specific: Not "test calls" but "call from profile creates DM"

## Common Conversion Challenges

### Challenge 1: Vague Manual Steps
**Manual:** "Verify functionality works correctly"

**Solution:**
- Interpret based on feature knowledge
- Add TODO comment if unclear
- Ask for clarification
- Make best-effort conversion

```typescript
// * Verify functionality works correctly
// TODO: Clarify what "works correctly" means - added basic verification
await expect(element).toBeVisible();
```

### Challenge 2: Multiple Expected Outcomes
**Manual:** "Verify A, B, C, D, E all happen"

**Solution:**
- Create separate assertion for each
- Use clear verification comments
- Test each independently

```typescript
// * Verify A happens
await expect(a).toBeVisible();

// * Verify B happens
await expect(b).toHaveText('expected');

// * Verify C happens
await expect(c).toBeChecked();
```

### Challenge 3: Manual-Only Steps
**Manual:** "Notice the color change"

**Solution:**
- Convert to programmatic check
- Use attribute/class checks instead of visual
- Add visual snapshot test if needed

```typescript
// * Verify color changed to dark (was "Notice the color change")
await expect(element).toHaveClass(/dark-theme/);
```

### Challenge 4: External Dependencies
**Manual:** "Check email inbox for notification"

**Solution:**
- Use API to verify email sent
- Mock external services
- Or mark as "Requires manual verification"

```typescript
// * Verify email was sent (check via API, not inbox)
const emails = await pw.adminClient.getEmailLog();
expect(emails).toContainEqual(expect.objectContaining({
  to: user.email,
  subject: 'Notification'
}));
```

### Challenge 5: Timing Issues
**Manual:** "Wait for 5 seconds"

**Solution:**
- Never use arbitrary timeouts
- Use proper Playwright waits
- Wait for specific conditions

```typescript
// ❌ Bad
await page.waitForTimeout(5000);

// ✅ Good
await expect(element).toBeVisible({timeout: 10000});
```

## Quality Checklist

Before finalizing conversion:

**Functional:**
- [ ] All steps from manual test are covered
- [ ] All expected outcomes are verified
- [ ] Edge cases are tested
- [ ] Error conditions are handled

**Technical:**
- [ ] Uses pw fixture
- [ ] Uses page objects
- [ ] No hardcoded selectors in test
- [ ] No arbitrary waits
- [ ] Dynamic test data

**Documentation:**
- [ ] @objective is clear
- [ ] @precondition listed if any
- [ ] MM-T key in title
- [ ] Appropriate tag
- [ ] Action/verification comments

**Maintainability:**
- [ ] Test is isolated
- [ ] Test is repeatable
- [ ] Test is readable
- [ ] No magic numbers
- [ ] Good variable names

## Testing the Conversion

After generating E2E test:

1. **Run the test:**
```bash
npx playwright test specs/functional/calls/profile_call.spec.ts
```

2. **If it fails, use @playwright-healer:**
```
@playwright-healer "Fix failing test in profile_call.spec.ts"
```

3. **Verify it passes consistently:**
```bash
# Run 3 times to check for flakiness
npx playwright test profile_call.spec.ts --repeat-each=3
```

4. **Review and commit:**
```bash
git add specs/functional/calls/profile_call.spec.ts
git commit -m "Add E2E test for MM-T5382: Call from profile popover"
```

## Summary

Successful conversion requires:
1. **Understanding** - Know what the manual test verifies
2. **Planning** - Use planner for complex tests
3. **Implementation** - Use generator with proper patterns
4. **Validation** - Check quality and run test
5. **Iteration** - Use healer to fix issues

Result: High-quality E2E test that maintains traceability to manual test and follows Mattermost conventions.
