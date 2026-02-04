# Mattermost Extended - Comprehensive Test Plan

This document outlines the complete test coverage plan for all Mattermost Extended features, including existing tests and new tests to be implemented.

## Table of Contents

1. [Test Coverage Overview](#test-coverage-overview)
2. [Existing Tests](#existing-tests)
3. [New Tests Required](#new-tests-required)
   - [Server-Side Tests (Go)](#server-side-tests-go)
   - [Client-Side Tests (TypeScript/React)](#client-side-tests-typescriptreact)
   - [E2E Tests (Cypress)](#e2e-tests-cypress)

---

## Test Coverage Overview

| Feature | Server Tests | Webapp Tests | E2E Tests | Coverage Status |
|---------|--------------|--------------|-----------|-----------------|
| AccurateStatuses | ✅ Exists | ❌ Missing | ❌ Missing | Partial |
| NoOffline | ✅ Exists | ❌ Missing | ❌ Missing | Partial |
| DND Extended | ✅ Exists | ❌ Missing | ❌ Missing | Partial |
| Status Log Dashboard | ❌ Missing | ❌ Missing | ❌ Missing | None |
| Custom Channel Icons | ❌ Missing | ❌ Missing | ❌ Missing | None |
| Encryption (E2EE) | ❌ Missing | ❌ Missing | ❌ Missing | None |
| ThreadsInSidebar | ❌ Missing | ❌ Missing | ❌ Missing | None |
| CustomThreadNames | ❌ Missing | ❌ Missing | ❌ Missing | None |
| ImageMulti | ❌ Missing | ❌ Missing | ❌ Missing | None |
| ImageSmaller | ❌ Missing | ❌ Missing | ❌ Missing | None |
| ImageCaptions | ❌ Missing | ❌ Missing | ❌ Missing | None |
| VideoEmbed | ❌ Missing | ❌ Missing | ❌ Missing | None |
| VideoLinkEmbed | ❌ Missing | ❌ Missing | ❌ Missing | None |
| EmbedYoutube | ❌ Missing | ❌ Missing | ❌ Missing | None |
| ErrorLogDashboard | ❌ Missing | ❌ Missing | ❌ Missing | None |
| SystemConsoleDarkMode | N/A | ❌ Missing | ❌ Missing | None |
| SystemConsoleHideEnterprise | N/A | ❌ Missing | ❌ Missing | None |
| SystemConsoleIcons | N/A | ❌ Missing | ❌ Missing | None |
| SettingsResorted | N/A | ❌ Missing | ❌ Missing | None |
| PreferencesRevamp | ❌ Missing | ❌ Missing | ❌ Missing | None |
| PreferenceOverridesDashboard | ❌ Missing | ❌ Missing | ❌ Missing | None |
| HideDeletedMessagePlaceholder | ❌ Missing | ❌ Missing | ❌ Missing | None |
| SidebarChannelSettings | ❌ Missing | ❌ Missing | ❌ Missing | None |
| HideUpdateStatusButton | ❌ Missing | ❌ Missing | ❌ Missing | None |
| MattermostExtendedSettings | ✅ Exists | N/A | N/A | Complete |

---

## Existing Tests

### 1. MattermostExtendedSettings Tests
**File:** `server/public/model/mattermost_extended_settings_test.go`

Tests the configuration struct defaults and value preservation:
- ✅ `TestMattermostExtendedSettingsSetDefaults` - All defaults on empty struct
- ✅ `TestMattermostExtendedSettingsSetDefaults` - Does not override existing values
- ✅ `TestMattermostExtendedPostsSettingsSetDefaults`
- ✅ `TestMattermostExtendedChannelsSettingsSetDefaults`
- ✅ `TestMattermostExtendedMediaSettingsSetDefaults`
- ✅ `TestMattermostExtendedStatusesSettingsSetDefaults`
- ✅ `TestMattermostExtendedPreferencesSettingsSetDefaults`

### 2. AccurateStatuses Scenario Tests
**File:** `server/channels/api4/status_extended_test.go`

Comprehensive user flow tests:
- ✅ `TestAccurateStatusesScenario` - User idle → Away → returns → Online
- ✅ `TestAccurateStatusesScenario` - Channel switch counts as activity
- ✅ `TestAccurateStatusesScenario` - Manual status NOT changed by heartbeat
- ✅ `TestAccurateStatusesScenario` - DND → Offline after inactivity → restores DND
- ✅ `TestAccurateStatusesScenario` - Feature disabled has no effect
- ✅ `TestNoOfflineScenario` - Offline user shows activity → Online
- ✅ `TestNoOfflineScenario` - Away user shows activity → Online
- ✅ `TestNoOfflineScenario` - DND NOT affected by NoOffline
- ✅ `TestNoOfflineScenario` - DND restores from Offline on activity
- ✅ `TestNoOfflineScenario` - Feature disabled has no effect
- ✅ `TestManualActionActivityScenario` - Mark unread → Online
- ✅ `TestManualActionActivityScenario` - Send message updates LastActivityAt
- ✅ `TestCombinedFeaturesScenario` - Both features enabled
- ✅ `TestMultiUserStatusScenario` - User2 sees User1 status changes
- ✅ `TestMultiUserStatusScenario` - Bulk status check
- ✅ `TestConfigurationScenario` - Custom inactivity timeout
- ✅ `TestConfigurationScenario` - DND timeout of 0 disables offline
- ✅ `TestWebSocketStatusEvents` - Status change broadcasts WS event

### 3. DND Extended Tests
**File:** `server/channels/app/platform/dnd_extended_test.go`

Platform-level DND functionality:
- ✅ `TestDNDInactivityTimeout` - DND → Offline after extended inactivity
- ✅ `TestDNDInactivityTimeout` - DND stays before timeout
- ✅ `TestDNDInactivityTimeout` - Timeout of 0 disables transition
- ✅ `TestDNDRestoration` - DND restores on heartbeat activity
- ✅ `TestDNDRestoration` - DND restores on manual action
- ✅ `TestDNDRestoration` - DND restores via SetStatusOnline
- ✅ `TestDNDRestoration` - No restoration when feature disabled
- ✅ `TestSetStatusDoNotDisturbExtended` - Sets DND status
- ✅ `TestSetStatusDoNotDisturbExtended` - Preserves LastActivityAt
- ✅ `TestSetStatusDoNotDisturbTimedExtended` - Timed DND with PrevStatus
- ✅ `TestSetStatusDoNotDisturbTimedExtended` - Away → DND saves Away
- ✅ `TestSetStatusOutOfOfficeExtended` - Sets OOO status
- ✅ `TestSetStatusOutOfOfficeExtended` - OOO not changed by heartbeat
- ✅ `TestDNDWithNoOffline` - NoOffline doesn't change DND
- ✅ `TestDNDWithNoOffline` - NoOffline restores DND from Offline

---

## New Tests Required

### Server-Side Tests (Go)

#### A. Custom Channel Icons (`server/channels/api4/custom_channel_icon_test.go`)

```go
// API Tests
func TestGetCustomChannelIcons(t *testing.T)
    - Returns empty list when no icons
    - Returns all icons when icons exist
    - Returns 403 when feature flag disabled
    - Pagination works correctly

func TestGetCustomChannelIcon(t *testing.T)
    - Returns icon by ID
    - Returns 404 for non-existent icon
    - Returns 404 for deleted icon

func TestCreateCustomChannelIcon(t *testing.T)
    - Creates icon successfully (admin)
    - Returns 403 for non-admin
    - Validates name (required, max 64 chars)
    - Validates SVG (required, max 50KB)
    - Returns 403 when feature flag disabled

func TestUpdateCustomChannelIcon(t *testing.T)
    - Updates name successfully
    - Updates SVG successfully
    - Updates normalizeColor successfully
    - Returns 403 for non-admin
    - Returns 404 for non-existent icon

func TestDeleteCustomChannelIcon(t *testing.T)
    - Soft-deletes icon successfully
    - Returns 403 for non-admin
    - Returns 404 for non-existent icon
    - Returns 404 for already deleted icon
```

```go
// Store Tests (server/channels/store/sqlstore/custom_channel_icon_store_test.go)
func TestCustomChannelIconStoreSave(t *testing.T)
    - Saves valid icon
    - Generates ID if empty
    - Sets timestamps
    - Validates required fields

func TestCustomChannelIconStoreGet(t *testing.T)
    - Returns icon by ID
    - Returns nil for non-existent
    - Returns nil for deleted icon

func TestCustomChannelIconStoreGetByName(t *testing.T)
    - Returns icon by name
    - Case-sensitive name lookup
    - Returns nil for deleted icon

func TestCustomChannelIconStoreGetAll(t *testing.T)
    - Returns all non-deleted icons
    - Sorted by name

func TestCustomChannelIconStoreDelete(t *testing.T)
    - Sets deleteat timestamp
    - Does not physically delete

func TestCustomChannelIconStoreSearch(t *testing.T)
    - Searches by name prefix
    - Respects limit parameter
    - Excludes deleted icons
```

#### B. Encryption (`server/channels/api4/encryption_test.go`)

```go
// API Tests
func TestGetEncryptionStatus(t *testing.T)
    - Returns status when enabled
    - Returns 403 when feature flag disabled
    - Shows key registered status

func TestRegisterPublicKey(t *testing.T)
    - Registers new public key
    - Updates existing key for session
    - Validates JWK format
    - Returns 403 when feature flag disabled

func TestGetPublicKeysByUserIds(t *testing.T)
    - Returns keys for valid users
    - Returns empty for users without keys
    - Handles multiple users

func TestGetChannelMemberKeys(t *testing.T)
    - Returns keys for channel members
    - Excludes users without keys
    - Returns 403 for non-channel members

func TestAdminGetAllKeys(t *testing.T)
    - Returns all keys (admin only)
    - Returns 403 for non-admin
    - Includes session and user info

func TestAdminDeleteKey(t *testing.T)
    - Deletes key by session ID (admin)
    - Returns 403 for non-admin
    - Returns 404 for non-existent

func TestAdminCleanupOrphanedKeys(t *testing.T)
    - Removes keys for expired sessions
    - Returns count of deleted keys
```

```go
// Store Tests (server/channels/store/sqlstore/encryption_session_key_store_test.go)
func TestEncryptionSessionKeyStoreSave(t *testing.T)
    - Saves new key
    - Updates existing key (upsert)
    - Sets timestamps

func TestEncryptionSessionKeyStoreGetBySession(t *testing.T)
    - Returns key for session
    - Returns nil for non-existent

func TestEncryptionSessionKeyStoreGetByUser(t *testing.T)
    - Returns all keys for user
    - Returns empty for user without keys

func TestEncryptionSessionKeyStoreDeleteExpired(t *testing.T)
    - Deletes keys for expired sessions
    - Keeps keys for active sessions

func TestEncryptionSessionKeyStoreDeleteOrphaned(t *testing.T)
    - Deletes keys without valid sessions
```

#### C. Status Logs (`server/channels/api4/status_log_test.go`)

```go
// API Tests
func TestGetStatusLogs(t *testing.T)
    - Returns logs with pagination
    - Filters by user_id
    - Filters by username
    - Filters by log_type
    - Filters by status
    - Filters by time range (since/until)
    - Searches by text
    - Returns 403 for non-admin
    - Returns 403 when feature disabled

func TestDeleteStatusLogs(t *testing.T)
    - Clears all logs (admin)
    - Returns 403 for non-admin

func TestExportStatusLogs(t *testing.T)
    - Returns JSON file
    - Applies same filters as GET
    - Returns 403 for non-admin

// Notification Rules Tests
func TestStatusNotificationRulesAPI(t *testing.T)
    - CRUD operations for notification rules
    - Validates rule structure
    - Returns 403 for non-admin
```

```go
// Store Tests (server/channels/store/sqlstore/status_log_store_test.go)
func TestStatusLogStoreSave(t *testing.T)
    - Saves status log entry
    - Generates ID
    - Sets timestamp

func TestStatusLogStoreGet(t *testing.T)
    - Returns logs with pagination
    - Applies all filters correctly
    - Orders by timestamp descending

func TestStatusLogStoreGetStats(t *testing.T)
    - Returns counts by status type
    - Applies time filters

func TestStatusLogStoreDeleteOlderThan(t *testing.T)
    - Deletes logs older than timestamp
    - Returns count of deleted
```

```go
// Platform Tests (server/channels/app/platform/status_logs_test.go)
func TestLogStatusChange(t *testing.T)
    - Logs status changes when enabled
    - Does not log when disabled
    - Includes all required fields
    - Broadcasts WebSocket event to admins

func TestLogActivityUpdate(t *testing.T)
    - Logs activity without status change
    - Includes trigger information

func TestCleanupOldStatusLogs(t *testing.T)
    - Deletes logs based on retention setting
    - Does not delete when retention is 0

func TestCheckDNDTimeouts(t *testing.T)
    - Sets inactive DND users to Offline
    - Preserves DND as PrevStatus
    - Does not affect active DND users
```

#### D. Error Log Dashboard (`server/channels/api4/error_log_test.go`)

```go
func TestReportError(t *testing.T)
    - Accepts error report from authenticated user
    - Validates error structure
    - Returns 403 when feature disabled

func TestGetErrors(t *testing.T)
    - Returns all errors (admin)
    - Supports filtering
    - Returns 403 for non-admin

func TestClearErrors(t *testing.T)
    - Clears all errors (admin)
    - Returns 403 for non-admin
```

#### E. Preference Overrides (`server/channels/api4/preference_override_test.go`)

```go
func TestGetPreferenceWithOverride(t *testing.T)
    - Returns overridden value when set
    - Returns user value when no override
    - Respects PreferencesRevamp feature flag

func TestPreferenceOverrideApplied(t *testing.T)
    - User cannot change overridden preference
    - Override persists across sessions
    - Override applies to all users
```

---

### Client-Side Tests (TypeScript/React)

#### A. Encryption Tests (`webapp/channels/src/utils/encryption/*.test.ts`)

```typescript
// keypair.test.ts
describe('RSA Key Pair', () => {
    test('generateKeyPair creates valid 4096-bit RSA key pair')
    test('exportPublicKey returns JWK format')
    test('exportPrivateKey returns JWK format')
    test('importPublicKey loads JWK correctly')
    test('importPrivateKey loads JWK correctly')
    test('rsaEncrypt/rsaDecrypt round-trip works')
})

// hybrid.test.ts
describe('Hybrid Encryption', () => {
    test('encryptMessage produces PENC format')
    test('decryptMessage recovers original text')
    test('isEncryptedMessage detects PENC format')
    test('parseEncryptedMessage extracts payload')
    test('formatEncryptedMessage creates correct format')
    test('encrypts for multiple recipients')
    test('each recipient can decrypt with their key')
})

// storage.test.ts
describe('Key Storage', () => {
    test('storeKeyPair saves to localStorage')
    test('getPublicKeyJwk retrieves public key')
    test('getPrivateKey retrieves private key')
    test('clearEncryptionKeys removes all keys')
    test('hasEncryptionKeys returns correct state')
    test('v1 to v2 migration works')
})

// file.test.ts
describe('File Encryption', () => {
    test('encryptFile produces valid encrypted blob')
    test('decryptFile recovers original file')
    test('isEncryptedFile detects encrypted files')
    test('metadata preserved through encryption')
    test('thumbnail generation works')
})

// session.test.ts
describe('Session Management', () => {
    test('ensureEncryptionKeys generates keys if missing')
    test('checkEncryptionStatus returns correct state')
    test('getChannelRecipientKeys returns member keys')
    test('clearEncryptionSession removes all data')
})
```

#### B. Custom Channel Icons Tests

```typescript
// icon_libraries/custom_svgs.test.ts
describe('Custom SVG Management', () => {
    test('validateSvg accepts valid SVG')
    test('validateSvg rejects invalid SVG')
    test('validateSvg rejects oversized SVG')
    test('sanitizeSvg removes dangerous elements')
    test('normalizeSvgColors converts to currentColor')
    test('normalizeSvgViewBox fixes viewBox')
    test('encodeSvgToBase64 encodes correctly')
    test('decodeSvgFromBase64 decodes correctly')
    test('getCustomSvgsFromServer fetches all')
    test('addCustomSvgToServer creates new')
    test('updateCustomSvgOnServer patches existing')
    test('deleteCustomSvgFromServer soft-deletes')
})

// icon_libraries/types.test.ts
describe('Icon Value Parsing', () => {
    test('parseIconValue extracts library and name')
    test('parseIconValue handles invalid format')
    test('formatIconValue creates correct format')
})

// sidebar_base_channel_icon.test.tsx
describe('SidebarBaseChannelIcon', () => {
    test('renders MDI icon correctly')
    test('renders Lucide icon correctly')
    test('renders custom SVG correctly')
    test('falls back to default for invalid library')
    test('respects channel type (public/private/DM)')
})
```

#### C. Media Feature Tests

```typescript
// multi_image_view.test.tsx
describe('MultiImageView', () => {
    test('renders multiple images vertically')
    test('applies maxHeight/maxWidth when ImageSmaller enabled')
    test('handles click to expand')
    test('shows loading state')
})

// video_player.test.tsx
describe('VideoPlayer', () => {
    test('renders video element with controls')
    test('respects maxHeight/maxWidth')
    test('shows error state on load failure')
    test('double-click opens preview modal')
})

// video_link_embed.test.tsx
describe('VideoLinkEmbed', () => {
    test('isVideoUrl detects video URLs')
    test('isVideoLinkText detects video link text')
    test('renders video from URL')
    test('shows error on invalid URL')
})

// youtube_video_discord.test.tsx
describe('YoutubeVideoDiscord', () => {
    test('renders Discord-style card')
    test('shows red accent bar')
    test('loads thumbnail')
    test('click shows embedded player')
    test('always visible (no toggle)')
})

// markdown_image.test.tsx (caption tests)
describe('MarkdownImage Captions', () => {
    test('shows caption when ImageCaptions enabled')
    test('hides caption when disabled')
    test('respects captionFontSize setting')
    test('displays title attribute as caption')
})
```

#### D. Status Log Dashboard Tests

```typescript
// status_log_dashboard.test.tsx
describe('StatusLogDashboard', () => {
    test('renders log entries')
    test('shows statistics correctly')
    test('filters by user')
    test('filters by log type')
    test('filters by status')
    test('filters by time range')
    test('searches by text')
    test('paginates correctly')
    test('clears logs on button click')
    test('exports logs as JSON')
    test('receives real-time WebSocket updates')
    test('shows user profile pictures')
})
```

#### E. Preference Overrides Dashboard Tests

```typescript
// preference_overrides_dashboard.test.tsx
describe('PreferenceOverridesDashboard', () => {
    test('renders all preference categories')
    test('shows current override values')
    test('allows setting override')
    test('allows clearing override')
    test('saves changes correctly')
    test('respects PreferencesRevamp flag')
})
```

#### F. UI Tweak Tests

```typescript
// websocket_actions.test.ts (HideDeletedMessagePlaceholder)
describe('HideDeletedMessagePlaceholder', () => {
    test('removes post when enabled and post deleted')
    test('shows placeholder when disabled')
})

// sidebar_channel_menu.test.tsx (SidebarChannelSettings)
describe('SidebarChannelSettings', () => {
    test('shows Channel Settings menu item when enabled')
    test('hides menu item when disabled')
    test('only shows for public/private channels')
    test('respects user permissions')
})

// custom_status.test.ts (HideUpdateStatusButton)
describe('HideUpdateStatusButton', () => {
    test('hides button when feature enabled')
    test('shows button when disabled')
})
```

#### G. System Console Feature Tests

```typescript
// admin_console.test.tsx (SystemConsoleDarkMode)
describe('SystemConsoleDarkMode', () => {
    test('adds dark mode class when enabled')
    test('removes dark mode class when disabled')
})

// admin_sidebar.test.tsx
describe('Admin Sidebar Features', () => {
    test('hides enterprise sections when SystemConsoleHideEnterprise enabled')
    test('shows icons when SystemConsoleIcons enabled')
    test('hides icons when SystemConsoleIcons disabled')
})
```

---

### E2E Tests (Cypress)

#### A. Custom Channel Icons E2E

```javascript
// e2e-tests/cypress/tests/integration/custom_channel_icons_spec.js
describe('Custom Channel Icons', () => {
    it('Admin can create custom SVG icon')
    it('Admin can edit custom icon')
    it('Admin can delete custom icon')
    it('User can set channel icon from library')
    it('User can set channel icon from custom SVG')
    it('Icon displays correctly in sidebar')
    it('Icon displays correctly in channel header')
    it('Feature disabled hides icon tab')
})
```

#### B. Encryption E2E

```javascript
// e2e-tests/cypress/tests/integration/encryption_spec.js
describe('End-to-End Encryption', () => {
    it('Keys generated automatically on login')
    it('Encrypted message sent and received')
    it('Multiple users in channel can decrypt')
    it('Encrypted file upload and download')
    it('Admin can view encryption keys')
    it('Admin can delete encryption keys')
    it('Feature disabled prevents encryption')
})
```

#### C. Status Features E2E

```javascript
// e2e-tests/cypress/tests/integration/status_extended_spec.js
describe('Accurate Statuses', () => {
    it('User goes Away after inactivity')
    it('User returns to Online on activity')
    it('Channel switch updates activity')
    it('Manual status preserved')
    it('DND timeout works')
})

describe('Status Log Dashboard', () => {
    it('Admin can view status logs')
    it('Filters work correctly')
    it('Export downloads JSON')
    it('Clear removes all logs')
})
```

#### D. Media Features E2E

```javascript
// e2e-tests/cypress/tests/integration/media_extended_spec.js
describe('ImageMulti', () => {
    it('Multiple images display full-size')
})

describe('ImageSmaller', () => {
    it('Images constrained to max dimensions')
})

describe('ImageCaptions', () => {
    it('Caption displays below image')
})

describe('VideoEmbed', () => {
    it('Video file plays inline')
})

describe('VideoLinkEmbed', () => {
    it('Video URL embeds player')
})

describe('EmbedYoutube', () => {
    it('YouTube shows Discord-style card')
})
```

#### E. Thread Features E2E

```javascript
// e2e-tests/cypress/tests/integration/threads_extended_spec.js
describe('ThreadsInSidebar', () => {
    it('Followed threads appear under channels')
    it('Thread can be unfollowed')
    it('Thread followers visible')
})

describe('CustomThreadNames', () => {
    it('User can rename thread')
    it('Thread name displays in sidebar')
    it('Thread name displays in header')
})
```

#### F. UI Tweaks E2E

```javascript
// e2e-tests/cypress/tests/integration/ui_tweaks_spec.js
describe('HideDeletedMessagePlaceholder', () => {
    it('Deleted message disappears immediately')
})

describe('SidebarChannelSettings', () => {
    it('Channel Settings in right-click menu')
    it('Opens channel settings modal')
})

describe('HideUpdateStatusButton', () => {
    it('Update status button hidden')
})
```

#### G. Admin Console Features E2E

```javascript
// e2e-tests/cypress/tests/integration/admin_console_extended_spec.js
describe('SystemConsoleDarkMode', () => {
    it('Dark mode applied to admin console')
})

describe('SystemConsoleHideEnterprise', () => {
    it('Enterprise features hidden')
})

describe('SystemConsoleIcons', () => {
    it('Icons display next to sections')
})

describe('PreferenceOverridesDashboard', () => {
    it('Admin can set preference overrides')
    it('Override applies to users')
    it('User cannot change overridden preference')
})

describe('ErrorLogDashboard', () => {
    it('Errors displayed in dashboard')
    it('Filters work correctly')
    it('Clear removes all errors')
})
```

---

## Test File Locations Summary

### Server Tests (Go)
| Feature | File Path |
|---------|-----------|
| Settings Defaults | `server/public/model/mattermost_extended_settings_test.go` ✅ |
| Status API | `server/channels/api4/status_extended_test.go` ✅ |
| DND Platform | `server/channels/app/platform/dnd_extended_test.go` ✅ |
| Custom Icons API | `server/channels/api4/custom_channel_icon_test.go` ❌ |
| Custom Icons Store | `server/channels/store/sqlstore/custom_channel_icon_store_test.go` ❌ |
| Encryption API | `server/channels/api4/encryption_test.go` ❌ |
| Encryption Store | `server/channels/store/sqlstore/encryption_session_key_store_test.go` ❌ |
| Status Logs API | `server/channels/api4/status_log_test.go` ❌ |
| Status Logs Store | `server/channels/store/sqlstore/status_log_store_test.go` ❌ |
| Status Logs Platform | `server/channels/app/platform/status_logs_test.go` ❌ |
| Error Log API | `server/channels/api4/error_log_test.go` ❌ |
| Preferences | `server/channels/api4/preference_override_test.go` ❌ |

### Webapp Tests (TypeScript)
| Feature | File Path |
|---------|-----------|
| Encryption Utils | `webapp/channels/src/utils/encryption/*.test.ts` ❌ |
| Custom SVGs | `webapp/channels/src/components/channel_settings_modal/icon_libraries/*.test.ts` ❌ |
| Sidebar Icon | `webapp/channels/src/components/sidebar/sidebar_channel/sidebar_base_channel/*.test.tsx` ❌ |
| Multi Image View | `webapp/channels/src/components/multi_image_view/*.test.tsx` ❌ |
| Video Player | `webapp/channels/src/components/video_player/*.test.tsx` ❌ |
| Video Link Embed | `webapp/channels/src/components/video_link_embed/*.test.tsx` ❌ |
| YouTube Discord | `webapp/channels/src/components/youtube_video/*.test.tsx` ❌ |
| Status Log Dashboard | `webapp/channels/src/components/admin_console/status_log_dashboard/*.test.tsx` ❌ |
| Preference Overrides | `webapp/channels/src/components/admin_console/preference_overrides/*.test.tsx` ❌ |
| Error Log Dashboard | `webapp/channels/src/components/admin_console/error_log_dashboard/*.test.tsx` ❌ |

### E2E Tests (Cypress)
| Feature | File Path |
|---------|-----------|
| Custom Channel Icons | `e2e-tests/cypress/tests/integration/custom_channel_icons_spec.js` ❌ |
| Encryption | `e2e-tests/cypress/tests/integration/encryption_spec.js` ❌ |
| Status Extended | `e2e-tests/cypress/tests/integration/status_extended_spec.js` ❌ |
| Media Extended | `e2e-tests/cypress/tests/integration/media_extended_spec.js` ❌ |
| Threads Extended | `e2e-tests/cypress/tests/integration/threads_extended_spec.js` ❌ |
| UI Tweaks | `e2e-tests/cypress/tests/integration/ui_tweaks_spec.js` ❌ |
| Admin Console Extended | `e2e-tests/cypress/tests/integration/admin_console_extended_spec.js` ❌ |

---

## Implementation Priority

### Phase 1: Core Server Tests (High Priority)
1. ❌ Custom Channel Icons API + Store tests
2. ❌ Encryption API + Store tests
3. ❌ Status Logs API + Store + Platform tests
4. ❌ Error Log API tests

### Phase 2: Core Webapp Tests (High Priority)
1. ❌ Encryption utility tests (most complex)
2. ❌ Custom SVG management tests
3. ❌ Video player/embed tests
4. ❌ Status/Error dashboard tests

### Phase 3: E2E Tests (Medium Priority)
1. ❌ Encryption E2E (critical path)
2. ❌ Custom Channel Icons E2E
3. ❌ Status features E2E
4. ❌ Media features E2E

### Phase 4: Remaining Tests (Lower Priority)
1. ❌ UI tweak tests (simple toggles)
2. ❌ System Console feature tests (CSS-based)
3. ❌ Thread feature tests
4. ❌ Preference override tests

---

## Running Tests

### Quick Start (Local)

**MANDATORY: Run tests before every release.**

```bash
# Full test suite (requires Docker)
./tests.bat

# Quick unit tests only (no Docker needed)
./tests.bat quick

# Status-related tests only
./tests.bat status

# Stop test containers when done
./tests.bat stop
```

| Command | What it Tests | Docker Required |
|---------|---------------|-----------------|
| `./tests.bat` | Full suite (model + integration) | Yes |
| `./tests.bat quick` | Unit tests only | No |
| `./tests.bat status` | Status feature tests | Yes |
| `./tests.bat stop` | Stop test containers | - |

### GitHub Actions

Tests run automatically on release tags via GitHub Actions:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | On release tags (`v*-custom.*`) | Custom test suite |
| `upstream-tests.yml` | Manual dispatch | Upstream Mattermost tests |

**Custom Tests (`test.yml`):**
- Triggered automatically when you run `build.bat`
- Tests: MattermostExtended models, AccurateStatuses, NoOffline, DND Extended
- Must pass for successful release

**Upstream Tests (`upstream-tests.yml`):**
- Run manually via GitHub Actions UI
- Use when syncing with a new upstream version
- Scope options: `status`, `app`, `api`, `store`, `full`

To run upstream tests:
1. Go to https://github.com/stalecontext/mattermost-extended/actions
2. Select "Upstream Tests" workflow
3. Click "Run workflow"
4. Choose test scope

### Server Tests (Manual)

```bash
# Run all extended tests
cd server && go test ./... -run "Extended|CustomChannelIcon|Encryption|StatusLog|ErrorLog"

# Run specific test file
cd server && go test ./channels/api4 -run "TestCustomChannelIcon" -v

# Run with verbose output
cd server && gotestsum --format testname -- -v -run "TestMattermostExtended" ./public/model/...
```

### Webapp Tests

```bash
# Run all tests
cd webapp && npm test

# Run specific test file
cd webapp && npm test -- --testPathPattern="encryption"
```

### E2E Tests

```bash
# Run all E2E tests
cd e2e-tests && npm run cypress:run

# Run specific spec
cd e2e-tests && npm run cypress:run -- --spec "cypress/tests/integration/encryption_spec.js"
```

---

## Notes

1. **Feature Flag Testing**: All tests should verify behavior both when feature is enabled AND disabled
2. **Permission Testing**: API tests should verify admin-only endpoints return 403 for regular users
3. **WebSocket Testing**: Dashboard tests should verify real-time updates via WebSocket
4. **Migration Testing**: Encryption tests should verify v1→v2 key migration
5. **Multi-Device Testing**: Encryption tests should verify multiple keys per user
6. **Retention Testing**: Status logs tests should verify cleanup based on retention setting
