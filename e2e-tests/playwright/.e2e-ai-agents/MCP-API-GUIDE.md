# MCP API Quality Control Guide

**Status**: ✅ API Reference & Seed Specs Ready
**Date**: 2026-02-24
**Purpose**: Ensure MCP-generated tests use real Playwright library methods

---

## 🎯 Problem We're Solving

MCP explores the UI correctly but can **hallucinate method names** that don't exist:

### ❌ Generated (FAKE)
```typescript
await channelsPage.createChannel()        // NOT REAL
await channelsPage.sidebarChannels        // NOT REAL
await channelsPage.openBrowseChannels()   // NOT REAL
```

### ✅ Correct (REAL)
```typescript
await adminClient.createChannel({...})    // USE API
await channelsPage.goto()                 // USE NAVIGATION
```

---

## 📚 Resources

### 1. **API Reference** (Your Source of Truth)
📄 **File**: `.e2e-ai-agents/spec-bridge-api.md`

Contains:
- ✅ All real `ChannelsPage` methods
- ✅ Real `CenterView`, `SidebarRight` APIs
- ✅ Correct patterns for common operations
- ❌ List of hallucinated methods to AVOID
- 📋 Testing checklist

**Use this to validate generated tests.**

### 2. **Working Seed Specs** (For MCP Reference)

#### Spec 1: `specs/seed.spec.ts`
- **Source**: Real working test (highlight_without_notification)
- **Shows**: Settings, modals, post operations
- **Key patterns**:
  - `await channelsPage.globalHeader.openSettings()`
  - `await settingsModal.openNotificationsTab()`
  - `await channelsPage.postMessage()`

#### Spec 2: `specs/channel-navigation.seed.spec.ts`
- **Author**: Created specifically for MCP
- **Shows**: Channel navigation, creation, joining, leaving
- **Key patterns**:
  - `await adminClient.createChannel()` - Use API for creation
  - `await channelsPage.sidebarLeft.goToItem()` - Real navigation
  - `await post.postMenu.reply()` - Real post menu
  - Multi-user workflows

**MCP uses these as examples when generating new tests.**

---

## 🔍 How to Validate Generated Tests

When MCP generates new tests, **check them against the API reference**:

### Step 1: Open Generated Test
```bash
cat specs/functional/ai-assisted/[flow-name]/[flow-name].spec.ts
```

### Step 2: Search for Method Calls
Look for all `await channelsPage.` patterns

### Step 3: Verify Against Reference
Open `.e2e-ai-agents/spec-bridge-api.md` and confirm:
- ✅ Method exists in the document
- ✅ NOT in the "METHODS THAT DON'T EXIST" section
- ✅ Used correctly according to patterns

### Step 4: Fix Issues
If you find fake methods:

**Option A: Replace with Real API**
```typescript
// ❌ BEFORE
await channelsPage.createChannel(name)

// ✅ AFTER
const channel = await adminClient.createChannel(
    pw.random.channel({teamId, name, displayName})
)
```

**Option B: Use Navigation**
```typescript
// ❌ BEFORE
await channelsPage.openBrowseChannels()

// ✅ AFTER
await channelsPage.sidebarLeft.goToItem(channelName)
// OR
await channelsPage.goto(`${team.name}/channels/${channelName}`)
```

---

## 💡 Common Fixes

### Channel Creation
```typescript
// ❌ WRONG
await channelsPage.createChannel('test-channel')

// ✅ RIGHT
const channel = await adminClient.createChannel(
    pw.random.channel({
        teamId: team.id,
        name: 'test-channel',
        displayName: 'Test Channel'
    })
)
await adminClient.addToChannel(user.id, channel.id)
```

### Channel Navigation
```typescript
// ❌ WRONG
await channelsPage.switchChannel('general')

// ✅ RIGHT
await channelsPage.goto(`${team.name}/channels/general`)
// OR (if method exists)
await channelsPage.sidebarLeft.goToItem('general')
```

### User Management
```typescript
// ❌ WRONG
const user = await channelsPage.createUser('testuser')

// ✅ RIGHT
const user = await adminClient.createUser(
    await pw.random.user('testuser'),
    '',
    ''
)
await adminClient.addToTeam(team.id, user.id)
```

### Post Interactions
```typescript
// ❌ WRONG
await channelsPage.postMessage(text)
await channelsPage.editPost(text)  // Not a method

// ✅ RIGHT
await channelsPage.postMessage(text)
const post = await channelsPage.getLastPost()
await post.hover()
await post.postMenu.toBeVisible()
// Then use centerView.postEdit if available
```

---

## 📋 Testing Checklist

Before committing generated tests, verify:

- [ ] **No fictional methods** - All methods in `spec-bridge-api.md`
- [ ] **API-based setup** - Uses `adminClient` for user/channel creation
- [ ] **Proper navigation** - Uses `.goto()` or real sidebar methods
- [ ] **Message operations** - Uses `.postMessage()` or `.writeMessage()`
- [ ] **Post access** - Uses `.getLastPost()` or `.getPostById()`
- [ ] **Admin utilities** - Uses `pw.random.*` for test data
- [ ] **No UI-based setup** - Doesn't click to create users/channels

---

## 🚀 For the Team

### When generating tests:
1. **Read** `spec-bridge-api.md` before generation
2. **Review** generated tests against API reference
3. **Fix** any hallucinated methods
4. **Test** locally before committing

### When MCP hallucinates:
1. Check if method exists in reference
2. Find the correct real method in the reference
3. Update the generated test
4. (Optional) Update seed specs if pattern is missing

---

## 📞 Questions?

- **API questions?** → Check `spec-bridge-api.md`
- **Pattern examples?** → Check seed specs
- **Method doesn't exist?** → It's likely hallucinated, find the real one

---

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-24 | Initial guide, API reference, seed specs created | AI-Assisted |

