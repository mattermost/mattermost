# Mattermost Playwright Library - API Reference

**Use this document as the source of truth for available methods.
Do NOT invent method names that are not listed here.**

---

## Overview

The `@mattermost/playwright-lib` provides pre-built page objects and helpers for testing Mattermost.

### Key Classes

1. **ChannelsPage** - Main page object for channel interactions
2. **CenterView** - Center/main channel view
3. **SidebarLeft** - Left navigation sidebar
4. **SidebarRight** - Right sidebar (threads, mentions, etc.)
5. **GlobalHeader** - Top navigation bar
6. **PostCreate** - Message composition area

---

## ChannelsPage - Main API

### Navigation & Visibility

```typescript
await channelsPage.goto(teamName?: string)          // Navigate to team/channel
await channelsPage.toBeVisible()                    // Wait for page to load
await channelsPage.goto()                           // Go to default team
```

### Message Operations

```typescript
await channelsPage.postMessage(text: string)        // Post message quickly
await channelsPage.getLastPost()                    // Get last posted message
const postId = await channelsPage.centerView.getLastPostID()

// Find posts
const post = await channelsPage.centerView.getPostById(postId)
```

### Settings & Navigation

```typescript
// Settings
const settingsModal = await channelsPage.globalHeader.openSettings()
const notificationsSettings = await settingsModal.openNotificationsTab()
await settingsModal.close()

// Recent mentions
await channelsPage.globalHeader.openRecentMentions()

// Find/browse channels (if using modal)
const modal = await channelsPage.findChannelsModal.toBeVisible()
await channelsPage.findChannelsModal.input.fill('channel-name')
```

### API Setup (Admin/Developer)

```typescript
// Setup utilities (passed in beforeEach)
const {pw} = context
const {user, adminClient, team} = await pw.initSetup()

// Admin operations
await adminClient.createUser(userObject)
await adminClient.addToTeam(teamId, userId)
await adminClient.createChannel(channelObject)
await adminClient.getChannelByName(teamId, 'town-square')
await adminClient.createPost(postObject)
```

---

## CenterView - Message Area

### Composition & Sending

```typescript
// Write & send messages
await channelsPage.centerView.postCreate.writeMessage(text)
await channelsPage.centerView.postCreate.input.fill(text)
await channelsPage.centerView.postCreate.sendMessage()
await channelsPage.centerView.postCreate.postMessage(text)

// Emoji & additions
await channelsPage.centerView.postCreate.openEmojiPicker()
await channelsPage.centerView.postCreate.openPriorityMenu()
```

### Post Retrieval & Inspection

```typescript
// Get posts
const lastPost = await channelsPage.getLastPost()
const lastPost = await channelsPage.centerView.getLastPost()
const postId = await channelsPage.centerView.getLastPostID()
const post = await channelsPage.centerView.getPostById(postId)

// Interact with posts
await lastPost.hover()
await expect(lastPost.container.getByText('text')).toBeVisible()
```

### Post Interactions

```typescript
// Edit operations
await channelsPage.centerView.postEdit.input.fill(text)
await channelsPage.centerView.postEdit.writeMessage(text)
await channelsPage.centerView.postEdit.sendMessage()
await channelsPage.centerView.postEdit.toBeVisible()

// Delete operations
await channelsPage.deletePostModal.toBeVisible()
await channelsPage.deletePostModal.confirm()

// Flag posts (premium)
await channelsPage.centerView.flagPostConfirmationDialog.toBeVisible()
await channelsPage.centerView.flagPostConfirmationDialog.selectFlagReason()
await channelsPage.centerView.flagPostConfirmationDialog.fillFlagComment()
```

### Channel Banners

```typescript
await channelsPage.centerView.assertChannelBanner()
await channelsPage.centerView.assertChannelBannerNotVisible()
```

---

## SidebarRight - Threads & Mentions

### Access & Visibility

```typescript
await channelsPage.sidebarRight.toBeVisible()
await expect(channelsPage.sidebarRight.container.getByText('text')).toBeVisible()

// Recent mentions
await channelsPage.sidebarRight.getLastPost()
```

### Interactions

```typescript
// Reply/Thread operations
await channelsPage.sidebarRight.postMessage(text)
await channelsPage.sidebarRight.getLastPost()
```

---

## GlobalHeader - Top Bar

### Modals & Settings

```typescript
// Settings
const settingsModal = await channelsPage.globalHeader.openSettings()

// Mentions
await channelsPage.globalHeader.openRecentMentions()
```

---

## Post Object - Individual Post

### Properties & Methods

```typescript
const post = await channelsPage.getLastPost()

// Container (Locator)
post.container                           // Root element
post.container.getByText(text)          // Find text in post
post.container.getByRole(role, options) // Find by role

// Interactions
await post.hover()                      // Hover post
await expect(post.container).toBeVisible()

// Menu
await post.postMenu.toBeVisible()
await post.postMenu.reply()            // Open thread reply
```

---

## SidebarLeft - Channel List

```typescript
// Access
channelsPage.sidebarLeft
channelsPage.sidebarLeft.container

// Methods (if available)
await channelsPage.sidebarLeft.goToItem(itemName)
```

---

## Settings Modal - NotificationsTab

```typescript
const notificationsSettings = await settingsModal.openNotificationsTab()

// Expand sections
await notificationsSettings.expandSection('keysWithHighlight')

// Get inputs
const keywordsInput = await notificationsSettings.getKeywordsInput()
await keywordsInput.fill(keyword)
await keywordsInput.press('Enter')  // Also: 'Tab', ','

// Descriptions
const keysWithHighlightDesc = notificationsSettings.keysWithHighlightDesc
await keysWithHighlightDesc.waitFor()

// Save
await notificationsSettings.save()
```

---

## Random Utilities

```typescript
const {pw} = context

// Generate random data
const randomId = await pw.random.id()
const randomUser = await pw.random.user('username-prefix')
const randomChannel = await pw.random.channel({
    teamId: team.id,
    name: 'channel-name',
    displayName: 'Display Name',
})
const randomPost = await pw.random.post({
    message: 'text',
    channel_id: channel.id,
    user_id: user.id,
})
```

---

## ❌ METHODS THAT DON'T EXIST

These are commonly hallucinated but NOT REAL:

```typescript
// FAKE - Don't use
❌ channelsPage.createChannel()           // Use adminClient.createChannel() instead
❌ channelsPage.sidebarChannels           // Use sidebarLeft instead
❌ channelsPage.openBrowseChannels()      // Browse modal not standard
❌ channelsPage.joinChannelButton         // Use modal/API instead
❌ channelsPage.openChannelMenu()         // Use post.postMenu instead
❌ channelsPage.channelMenu               // Not a real property
❌ channelsPage.switchChannel(name)       // Use navigation instead
❌ channelsPage.leaveChannel()            // Use API instead
```

---

## Pattern Examples

### Pattern 1: Basic Navigation & Posting

```typescript
const {user, adminClient, team} = await pw.initSetup()
const {channelsPage} = await pw.testBrowser.login(user)

await channelsPage.goto()
await channelsPage.toBeVisible()

await channelsPage.postMessage('Hello World')
const lastPost = await channelsPage.getLastPost()
await expect(lastPost.container.getByText('Hello World')).toBeVisible()
```

### Pattern 2: Multi-User Scenario

```typescript
const {user: user1, adminClient, team} = await pw.initSetup()
const user2 = await adminClient.createUser(await pw.random.user('user2'))
await adminClient.addToTeam(team.id, user2.id)

// User 1 posts
const {channelsPage: page1} = await pw.testBrowser.login(user1)
await page1.goto()
await page1.postMessage('Message from user1')

// User 2 reads
const {channelsPage: page2} = await pw.testBrowser.login(user2)
await page2.goto()
const post = await page2.getLastPost()
await expect(post.container.getByText('Message from user1')).toBeVisible()
```

### Pattern 3: Settings & Configuration

```typescript
const {channelsPage} = await pw.testBrowser.login(user)
await channelsPage.goto()

const settingsModal = await channelsPage.globalHeader.openSettings()
const notificationsTab = await settingsModal.openNotificationsTab()
await notificationsTab.expandSection('keysWithHighlight')

const input = await notificationsTab.getKeywordsInput()
await input.fill('keyword')
await input.press('Enter')
await notificationsTab.save()

await settingsModal.close()
```

---

## Testing Checklist

Before running generated tests:

- [ ] All methods exist in this reference ✅
- [ ] No fictional method names used ✅
- [ ] Using `adminClient` for channel/user creation (not modal clicks) ✅
- [ ] Using `pw.random.*` for test data generation ✅
- [ ] Navigation uses `.goto()` pattern ✅
- [ ] Messages use `.postMessage()` or `.writeMessage()` + `.sendMessage()` ✅
- [ ] Posts accessed with `.getLastPost()` or `.getPostById()` ✅

---

## Resources

- **Source**: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/channels
- **Test Framework**: @mattermost/playwright-lib
- **Updated**: 2026-02-24
