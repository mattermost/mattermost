# Test Plan: Channel Switching in Sidebar

**Created**: 2025-11-19
**Feature**: User switching between channels via left sidebar
**Priority**: High (Core user workflow)

## Feature Overview

Users can navigate between different channels by clicking on channel items in the left sidebar. The center view updates to show the selected channel's content, and the active channel is visually highlighted in the sidebar.

## Prerequisites

- Mattermost server running at `http://localhost:8065`
- User authenticated
- User has access to multiple channels in a team
- Channels visible in left sidebar

## Discovered Selectors (from Page Objects)

### Sidebar Left (`sidebar_left.ts`)
- **Container**: `#SidebarContainer`
- **Channel/DM Item**: `#sidebarItem_{channelName}` (dynamic)
- **Browse/Create Button**: `#browseOrAddChannelMenuButton`
- **Find Channel Button**: `[role="button"][name="Find Channels"]`
- **Team Menu Button**: `#sidebarTeamMenuButton`

### Center View (`center_view.ts`)
- **Container**: `[data-testid="channel_view"]`
- **Post Create Area**: `[data-testid="post-create"]`
- **Post List**: `[data-testid="postView"]`

### Channel Header (`header.ts`)
- **Header Container**: `.channel-header`
- **Channel Name/Title**: Within header container

## Test Scenarios

### Scenario 1: Switch Between Public Channels (Happy Path)

**Objective**: Verify user can successfully switch between public channels and content updates correctly

**Priority**: High
**Tags**: @channels @smoke @sidebar

**Preconditions**:
- 2 test channels created via API
- User is member of both channels
- User logged in and on channels page

**Test Steps**:

1. **Navigate to first test channel**
   - Selector: `#sidebarItem_{channel1_name}`
   - Action: Click on channel item in sidebar

2. **Verify channel view updates**
   - Selector: `[data-testid="channel_view"]`
   - Verification: Container is visible
   - Selector: `.channel-header`
   - Verification: Contains channel 1 display name

3. **Post a test message in channel 1**
   - Selector: `[data-testid="post-create"] input`
   - Action: Fill with "Test message in channel one"
   - Action: Press Enter

4. **Verify message appears**
   - Selector: `[data-testid="postView"]`
   - Verification: Contains text "Test message in channel one"

5. **Switch to second test channel**
   - Selector: `#sidebarItem_{channel2_name}`
   - Action: Click on channel item in sidebar

6. **Verify channel switched**
   - Selector: `.channel-header`
   - Verification: Contains channel 2 display name (NOT channel 1)
   - Selector: `[data-testid="postView"]`
   - Verification: Does NOT contain "Test message in channel one"

7. **Return to first channel**
   - Selector: `#sidebarItem_{channel1_name}`
   - Action: Click

8. **Verify message persistence**
   - Selector: `[data-testid="postView"]`
   - Verification: Still contains "Test message in channel one"

**Expected Results**:
- ✓ Channel header updates with correct channel name
- ✓ Message list refreshes for each channel
- ✓ Messages persist when returning to previous channel
- ✓ No cross-channel message leakage

**Potential Flakiness**:
- Channel switch may take 100-300ms for content to load
- Use `waitFor()` on center view visibility after each switch
- Message may take 50-100ms to appear after posting

**API Setup Required**:
- `POST /api/v4/channels` - Create 2 test channels
- `POST /api/v4/channels/{id}/members` - Add user to both channels

---

### Scenario 2: Switch to Direct Message Channel

**Objective**: Verify user can switch from public channel to DM and conversation loads correctly

**Priority**: Medium
**Tags**: @channels @direct-messages @sidebar

**Preconditions**:
- 1 public test channel created
- 1 additional test user created
- DM channel exists between main user and test user
- User logged in

**Test Steps**:

1. **Start in public channel**
   - Selector: `#sidebarItem_{public_channel_name}`
   - Action: Click to ensure in public channel
   - Verification: `.channel-header` contains public channel name

2. **Switch to DM channel**
   - Selector: `#sidebarItem_{dm_channel_name}` (usually username)
   - Action: Click on DM in sidebar

3. **Verify DM channel opened**
   - Selector: `.channel-header`
   - Verification: Contains other user's username/name
   - Verification: DM-specific header styling present

4. **Send message in DM**
   - Selector: `[data-testid="post-create"] input`
   - Action: Fill with "Direct message test"
   - Action: Press Enter

5. **Verify DM message appears**
   - Selector: `[data-testid="postView"]`
   - Verification: Contains "Direct message test"

6. **Switch back to public channel**
   - Selector: `#sidebarItem_{public_channel_name}`
   - Action: Click

7. **Return to DM**
   - Selector: `#sidebarItem_{dm_channel_name}`
   - Action: Click

8. **Verify DM message persists**
   - Selector: `[data-testid="postView"]`
   - Verification: Still contains "Direct message test"

**Expected Results**:
- ✓ Can switch between public and DM channels seamlessly
- ✓ DM header shows correct user information
- ✓ DM messages persist across channel switches
- ✓ No message leakage between public and DM

**Potential Flakiness**:
- DM channels may load slightly slower (check for async user info fetch)
- User avatars/names may load after initial render
- Wait for DM header to fully load before verifying content

**API Setup Required**:
- `POST /api/v4/users` - Create test user for DM
- `POST /api/v4/channels/direct` - Create DM channel
- `POST /api/v4/teams/{id}/members` - Add test user to team

---

## Test Data Requirements

### Channels:
- **Public Channel 1**:
  - Name: `test-channel-switch-one-{timestamp}`
  - Display Name: `Test Channel Switch One`

- **Public Channel 2**:
  - Name: `test-channel-switch-two-{timestamp}`
  - Display Name: `Test Channel Switch Two`

### Users:
- **Main Test User**: From `pw.initSetup()`
- **DM Test User**:
  - Username: `dm-test-user-{timestamp}`
  - Email: `dm-test-{timestamp}@example.com`

### Messages:
- Test messages should be unique per test run
- Use timestamps or random strings to avoid conflicts

## Implementation Notes

### Page Objects to Use:
- `channelsPage.sidebarLeft` - For sidebar interactions
- `channelsPage.centerView` - For message area
- `channelsPage.centerView.postCreate` - For posting messages

### Helper Methods Available:
- `channelsPage.sidebarLeft.goToItem(channelName)` - Navigate to channel
- `channelsPage.centerView.toBeVisible()` - Wait for channel load
- `pw.initSetup()` - Get test user, admin client, team

### Timing Considerations:
- Use `await channelsPage.centerView.toBeVisible()` after each channel switch
- Use `waitFor()` on message elements after posting
- No arbitrary `waitForTimeout()` - use explicit conditions

### Test Isolation:
- Each test should create its own channels
- Clean up is handled by test framework
- Tests can run in parallel if using different channels

## Accessibility Considerations

- Channel items should be keyboard navigable
- Active channel should have proper ARIA attributes
- Screen reader should announce channel switches

## Success Criteria

Tests pass when:
1. All assertions pass without errors
2. No flaky test failures (3 consecutive runs pass)
3. Tests complete in reasonable time (< 30 seconds each)
4. Tests follow Mattermost conventions (copyright, JSDoc, proper structure)

## Next Steps

1. **Generate Skeleton Files** - Create .spec.ts with placeholders
2. **Create Zephyr Test Cases** - Get MM-T numbers
3. **Replace Placeholders** - Update with real MM-T keys
4. **Generate Full Code** - Complete test implementation
5. **Execute Tests** - Run in headed mode
6. **Heal if Needed** - Fix any failures
7. **Update Zephyr** - Mark as Active after passing
