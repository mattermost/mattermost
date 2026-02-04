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
| AccurateStatuses | ✅ Exists | ❌ Missing | ✅ Exists | Good |
| NoOffline | ✅ Exists | ❌ Missing | ✅ Exists | Good |
| DND Extended | ✅ Exists | ❌ Missing | ✅ Exists | Good |
| Status Log Dashboard | ✅ Exists | ✅ Exists | ❌ Missing | Good |
| Custom Channel Icons | ✅ Exists | ✅ Exists | ✅ Exists | Complete |
| Encryption (E2EE) | ✅ Exists | ✅ Exists | ✅ Exists | Complete |
| ThreadsInSidebar | ❌ Missing | ❌ Missing | ❌ Missing | None |
| CustomThreadNames | ❌ Missing | ❌ Missing | ❌ Missing | None |
| ImageMulti | ❌ Missing | ❌ Missing | ✅ Exists | Partial |
| ImageSmaller | ❌ Missing | ❌ Missing | ✅ Exists | Partial |
| ImageCaptions | ❌ Missing | ❌ Missing | ✅ Exists | Partial |
| VideoEmbed | ❌ Missing | ✅ Exists | ✅ Exists | Good |
| VideoLinkEmbed | ❌ Missing | ✅ Exists | ✅ Exists | Good |
| EmbedYoutube | ❌ Missing | ✅ Exists | ✅ Exists | Good |
| ErrorLogDashboard | ✅ Exists | ✅ Exists | ❌ Missing | Good |
| SystemConsoleDarkMode | N/A | ❌ Missing | ❌ Missing | None |
| SystemConsoleHideEnterprise | N/A | ❌ Missing | ❌ Missing | None |
| SystemConsoleIcons | N/A | ❌ Missing | ❌ Missing | None |
| SettingsResorted | N/A | ❌ Missing | ❌ Missing | None |
| PreferencesRevamp | ❌ Missing | ❌ Missing | ❌ Missing | None |
| PreferenceOverridesDashboard | ✅ Exists | ✅ Exists | ❌ Missing | Good |
| HideDeletedMessagePlaceholder | ❌ Missing | ❌ Missing | ❌ Missing | None |
| SidebarChannelSettings | ❌ Missing | ❌ Missing | ❌ Missing | None |
| HideUpdateStatusButton | ❌ Missing | ❌ Missing | ❌ Missing | None |
| MattermostExtendedSettings | ✅ Exists | N/A | N/A | Complete |
| StatusLog Model | ✅ Exists | N/A | N/A | Complete |
| Status Logs Platform | ✅ Exists | N/A | N/A | Complete |

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

### 4. StatusLog Model Tests
**File:** `server/public/model/status_log_test.go`

Tests the StatusLog model struct:
- ✅ `TestStatusLogPreSave` - Generates ID and timestamp
- ✅ `TestStatusLogIsValid` - Validates required fields
- ✅ `TestStatusLogIsValid` - Rejects invalid status values

### 5. Status Log Store Tests
**File:** `server/channels/store/sqlstore/status_log_store_test.go`

Tests the database layer for status logs:
- ✅ `TestStatusLogStoreSave` - Saves status log entry
- ✅ `TestStatusLogStoreGet` - Retrieves logs with pagination
- ✅ `TestStatusLogStoreGet` - Filters by user_id, status, log_type
- ✅ `TestStatusLogStoreGetStats` - Returns counts by status
- ✅ `TestStatusLogStoreDeleteOlderThan` - Deletes old logs

### 6. Custom Channel Icon API Tests
**File:** `server/channels/api4/custom_channel_icon_test.go`

Tests the REST API for custom channel icons:
- ✅ `TestGetCustomChannelIcons` - Returns empty list, returns all icons
- ✅ `TestGetCustomChannelIcons` - Returns 403 when feature disabled
- ✅ `TestCreateCustomChannelIcon` - Creates icon (admin only)
- ✅ `TestCreateCustomChannelIcon` - Returns 403 for non-admin
- ✅ `TestUpdateCustomChannelIcon` - Updates icon properties
- ✅ `TestDeleteCustomChannelIcon` - Soft-deletes icon

### 7. Custom Channel Icon Store Tests
**File:** `server/channels/store/sqlstore/custom_channel_icon_store_test.go`

Tests the database layer for custom icons:
- ✅ `TestCustomChannelIconStoreSave` - Saves valid icon
- ✅ `TestCustomChannelIconStoreGet` - Returns icon by ID
- ✅ `TestCustomChannelIconStoreGetByName` - Returns icon by name
- ✅ `TestCustomChannelIconStoreGetAll` - Returns all non-deleted icons
- ✅ `TestCustomChannelIconStoreDelete` - Sets deleteat timestamp

### 8. Encryption API Tests
**File:** `server/channels/api4/encryption_test.go`

Tests the REST API for E2E encryption:
- ✅ `TestGetEncryptionStatus` - Returns status when enabled
- ✅ `TestGetEncryptionStatus` - Returns 403 when feature disabled
- ✅ `TestRegisterPublicKey` - Registers new public key
- ✅ `TestGetPublicKeysByUserIds` - Returns keys for users
- ✅ `TestGetChannelMemberKeys` - Returns keys for channel members

### 9. Encryption Session Key Store Tests
**File:** `server/channels/store/sqlstore/encryption_session_key_store_test.go`

Tests the database layer for encryption keys:
- ✅ `TestEncryptionSessionKeyStoreSave` - Saves new key (upsert)
- ✅ `TestEncryptionSessionKeyStoreGetBySession` - Returns key for session
- ✅ `TestEncryptionSessionKeyStoreGetByUser` - Returns all keys for user
- ✅ `TestEncryptionSessionKeyStoreDeleteExpired` - Deletes expired keys

### 10. Error Log API Tests
**File:** `server/channels/api4/error_log_test.go`

Tests the REST API for error logging:
- ✅ `TestReportError` - Accepts error report from authenticated user
- ✅ `TestReportError` - Returns 403 when feature disabled
- ✅ `TestGetErrors` - Returns all errors (admin only)
- ✅ `TestClearErrors` - Clears all errors (admin only)

### 11. Preference Override API Tests
**File:** `server/channels/api4/preference_override_test.go`

Tests the REST API for preference overrides:
- ✅ `TestGetPreferenceWithOverride` - Returns overridden value when set
- ✅ `TestGetPreferenceWithOverride` - Returns user value when no override
- ✅ `TestPreferenceOverrideApplied` - User cannot change overridden preference

### 12. Status Logs Platform Tests
**File:** `server/channels/app/platform/status_logs_test.go`

Tests the platform layer for status logs:
- ✅ `TestLogStatusChange` - Saves status change when enabled
- ✅ `TestLogStatusChange` - Does NOT save when disabled
- ✅ `TestLogStatusChange` - Sets default device when empty
- ✅ `TestLogStatusChange` - Generates trigger text for window focus
- ✅ `TestLogStatusChange` - Includes inactivity timeout in trigger
- ✅ `TestLogStatusChange` - Tracks manual flag
- ✅ `TestLogActivityUpdate` - Saves activity update when enabled
- ✅ `TestLogActivityUpdate` - Does NOT save when disabled
- ✅ `TestLogActivityUpdate` - Formats public channel with # prefix
- ✅ `TestLogActivityUpdate` - Formats DM channel with @ prefix
- ✅ `TestLogActivityUpdate` - Formats various trigger types
- ✅ `TestGetStatusLogs` - Returns empty list when no logs
- ✅ `TestGetStatusLogs` - Returns logs with default pagination
- ✅ `TestGetStatusLogsWithOptions` - Filters by user_id
- ✅ `TestGetStatusLogsWithOptions` - Filters by log_type
- ✅ `TestGetStatusLogsWithOptions` - Filters by status
- ✅ `TestGetStatusLogsWithOptions` - Paginates correctly
- ✅ `TestGetStatusLogCount` - Returns correct count
- ✅ `TestGetStatusLogCount` - Respects filters
- ✅ `TestClearStatusLogs` - Clears all logs
- ✅ `TestGetStatusLogStats` - Returns zero stats when no logs
- ✅ `TestGetStatusLogStats` - Returns correct stats
- ✅ `TestCleanupOldStatusLogs` - Deletes logs older than retention
- ✅ `TestCleanupOldStatusLogs` - Does NOT delete when retention is 0
- ✅ `TestCheckDNDTimeouts` - Sets inactive DND users to Offline
- ✅ `TestCheckDNDTimeouts` - Does NOT affect DND users within timeout
- ✅ `TestCheckDNDTimeouts` - Skips when AccurateStatuses disabled
- ✅ `TestCheckDNDTimeouts` - Skips when DNDInactivityTimeoutMinutes is 0
- ✅ `TestBuildStatusNotificationMessage` - Builds correct messages

### 13. Status Log Dashboard Webapp Tests
**File:** `webapp/channels/src/components/admin_console/status_log_dashboard/status_log_dashboard.test.tsx`

Tests the React component for the Status Log Dashboard:
- ✅ Renders promotional card when feature is disabled
- ✅ Enables feature when enable button clicked
- ✅ Renders dashboard when feature is enabled
- ✅ Displays log entries
- ✅ Displays status change correctly
- ✅ Filters logs by log type
- ✅ Filters logs by status
- ✅ Searches logs by text
- ✅ Clears all logs when confirmed
- ✅ Does NOT clear logs when cancelled
- ✅ Exports logs as JSON
- ✅ Switches between tabs
- ✅ Displays loading state
- ✅ Displays empty state when no logs
- ✅ Loads more logs when button clicked
- ✅ Displays device icons
- ✅ Displays manual vs auto badge
- ✅ Clears all filters
- ✅ Displays activity log with trigger

### 14. Error Log Dashboard Webapp Tests
**File:** `webapp/channels/src/components/admin_console/error_log_dashboard/error_log_dashboard.test.tsx`

Tests the React component for the Error Log Dashboard:
- ✅ Renders promotional card when feature is disabled
- ✅ Enables feature when enable button clicked
- ✅ Renders dashboard when feature is enabled
- ✅ Displays error statistics
- ✅ Displays error entries
- ✅ Filters errors by type
- ✅ Searches errors by text
- ✅ Clears all errors when confirmed
- ✅ Does NOT clear errors when cancelled
- ✅ Exports errors as JSON
- ✅ Displays loading state
- ✅ Displays empty state when no errors
- ✅ Toggles view mode between list and grouped
- ✅ Displays API error details
- ✅ Displays JavaScript error details
- ✅ Expands stack trace
- ✅ Adds muted pattern
- ✅ Toggles showing muted errors
- ✅ Copies error to clipboard

### 15. Preference Overrides Dashboard Webapp Tests
**File:** `webapp/channels/src/components/admin_console/preference_overrides/preference_overrides_dashboard.test.tsx`

Tests the React component for the Preference Overrides Dashboard:
- ✅ Renders promotional card when feature is disabled
- ✅ Enables feature when enable button clicked
- ✅ Renders dashboard when feature is enabled
- ✅ Loads preferences from server
- ✅ Displays preference categories
- ✅ Displays existing overrides
- ✅ Enables save button when changes are made
- ✅ Displays loading state
- ✅ Displays error state on API failure
- ✅ Refreshes preferences
- ✅ Saves overrides
- ✅ Toggles override when lock button clicked
- ✅ Displays preference values in dropdown
- ✅ Groups preferences by category or SettingsResorted groups

### 16. Encryption Keypair Tests
**File:** `webapp/channels/src/utils/encryption/keypair.test.ts`

Tests RSA key pair generation and operations:
- ✅ `generateKeyPair` creates valid 4096-bit RSA key pair
- ✅ `exportPublicKey` returns JWK format string
- ✅ `exportPrivateKey` returns JWK format string with private components
- ✅ `importPublicKey` loads JWK correctly
- ✅ `importPublicKey` throws error for invalid JWK
- ✅ `importPrivateKey` loads JWK correctly
- ✅ `rsaEncrypt/rsaDecrypt` round-trip works
- ✅ Encrypted data differs from plaintext
- ✅ Fails to decrypt with wrong key
- ✅ Handles empty data
- ✅ Handles binary data
- ✅ Key export/import round-trip works

### 17. Encryption Hybrid Tests
**File:** `webapp/channels/src/utils/encryption/hybrid.test.ts`

Tests hybrid RSA-OAEP + AES-GCM encryption:
- ✅ `arrayBufferToBase64` converts ArrayBuffer to Base64 string
- ✅ `base64ToArrayBuffer` converts Base64 string to ArrayBuffer
- ✅ `isEncryptedMessage` detects PENC format
- ✅ `parseEncryptedMessage` extracts payload from PENC format
- ✅ `parseEncryptedMessage` returns null for invalid messages
- ✅ `formatEncryptedMessage` creates correct PENC format
- ✅ `encryptMessage` produces PENC format payload
- ✅ `encryptMessage` encrypts for multiple recipients
- ✅ `encryptMessage` produces different ciphertext for same message
- ✅ `encryptMessage` skips sessions with invalid public keys
- ✅ `decryptMessage` recovers original text
- ✅ Each recipient can decrypt with their key
- ✅ Throws error when session key not found
- ✅ Fails with wrong private key
- ✅ Handles unicode characters
- ✅ Handles long messages

### 18. Encryption Storage Tests
**File:** `webapp/channels/src/utils/encryption/storage.test.ts`

Tests encryption key storage and session management:
- ✅ `storeSessionId/getSessionId` stores and retrieves session ID
- ✅ `storeKeyPair` saves to localStorage with session namespace
- ✅ `storeKeyPair` stores metadata with timestamp
- ✅ `getPublicKeyJwk` retrieves public key for session
- ✅ `getPrivateKey` retrieves private key as CryptoKey
- ✅ `getPublicKey` retrieves public key as CryptoKey
- ✅ `hasEncryptionKeys` returns correct state
- ✅ `clearEncryptionKeys` removes keys for specific session
- ✅ `clearAllEncryptionKeys` removes ALL encryption keys
- ✅ `migrateFromV1` migrates v1 keys to v2 format
- ✅ `cleanupStaleKeys` removes keys older than maxAge
- ✅ `cleanupStaleKeys` does NOT remove current session keys
- ✅ `getAllStoredSessionIds` returns all stored session IDs

### 19. Encryption File Tests
**File:** `webapp/channels/src/utils/encryption/file.test.ts`

Tests file encryption and decryption:
- ✅ `encryptFile` produces encrypted blob with correct MIME type
- ✅ `encryptFile` produces valid metadata
- ✅ `encryptFile` encrypts for multiple recipients
- ✅ Encrypted blob is different from original
- ✅ `decryptFile` recovers original file content
- ✅ `decryptFile` extracts original file info
- ✅ `decryptFile` restores correct MIME type
- ✅ Each recipient can decrypt
- ✅ Throws error when session key not found
- ✅ Handles binary files
- ✅ Handles files with unicode names
- ✅ `isEncryptedFile` detects encrypted file by MIME type
- ✅ `getEncryptedFileMetadata` returns metadata for file
- ✅ `createEncryptedFilesProps` creates correct props structure
- ✅ `createFileFromDecryptedBlob` creates File with original name

### 20. Encryption Session Tests
**File:** `webapp/channels/src/utils/encryption/session.test.ts`

Tests encryption session management:
- ✅ `getSessionId` returns null when no session
- ✅ `isEncryptionInitialized` returns correct state
- ✅ `checkEncryptionStatus` calls API and returns status
- ✅ `ensureEncryptionKeys` generates keys when none exist
- ✅ `ensureEncryptionKeys` re-registers existing keys when server missing
- ✅ `ensureEncryptionKeys` skips registration when server has keys
- ✅ `ensureEncryptionKeys` throws when session ID not available
- ✅ `getCurrentPublicKey` returns public key JWK
- ✅ `getCurrentPrivateKey` returns private CryptoKey
- ✅ `ensureSessionIdRestored` returns cached session ID when available
- ✅ `ensureSessionIdRestored` restores from server when cache missing
- ✅ `clearEncryptionSession` clears keys and decryption cache
- ✅ `clearAllEncryptionData` clears all keys and cache
- ✅ `getChannelRecipientKeys` returns session keys for channel members
- ✅ `getChannelEncryptionInfo` returns unique recipients excluding current user

### 21. Custom SVG Management Tests
**File:** `webapp/channels/src/components/channel_settings_modal/icon_libraries/custom_svgs.test.ts`

Tests custom SVG CRUD and validation:
- ✅ `generateCustomSvgId` generates unique IDs
- ✅ `getCustomSvgs/saveCustomSvgs` stores and retrieves SVGs
- ✅ `addCustomSvg` adds new SVG with generated ID and timestamp
- ✅ `updateCustomSvg` updates existing SVG
- ✅ `deleteCustomSvg` deletes SVG
- ✅ `getCustomSvgById` finds SVG by ID
- ✅ `getCustomSvgByName` finds SVG by name (case-insensitive)
- ✅ `validateSvg` accepts valid SVG
- ✅ `validateSvg` rejects content without SVG tag
- ✅ `validateSvg` rejects SVG with script tags
- ✅ `validateSvg` rejects SVG with event handlers
- ✅ `sanitizeSvg` removes dangerous elements
- ✅ `normalizeSvgColors` converts to currentColor
- ✅ `extractSvgViewBox` extracts viewBox dimensions
- ✅ `extractSvgInnerContent` extracts content inside SVG tags
- ✅ `normalizeSvgViewBox` normalizes to 24x24 viewBox
- ✅ `encodeSvgToBase64/decodeSvgFromBase64` round-trip works
- ✅ `formatCustomSvgValue/parseCustomSvgValue` formats and parses values
- ✅ Server API functions (`getCustomSvgsFromServer`, `addCustomSvgToServer`, etc.)

### 22. Icon Types Tests
**File:** `webapp/channels/src/components/channel_settings_modal/icon_libraries/types.test.ts`

Tests icon value parsing and search:
- ✅ `parseIconValue` parses MDI icon format
- ✅ `parseIconValue` parses Lucide, Tabler, Feather, Simple, FontAwesome formats
- ✅ `parseIconValue` parses custom SVG and inline SVG formats
- ✅ `parseIconValue` handles empty and invalid values
- ✅ `formatIconValue` formats all icon types correctly
- ✅ Round-trip with parseIconValue/formatIconValue works
- ✅ `matchesSearch` matches by name, tags, and aliases
- ✅ `matchesSearch` supports case-sensitive and case-insensitive modes
- ✅ `matchesSearch` supports contains, startsWith, and exact match modes
- ✅ `matchesSearch` respects field restrictions

### 23. Video Link Embed Tests
**File:** `webapp/channels/src/components/video_link_embed/video_link_embed.test.tsx`

Tests video URL detection and embedding:
- ✅ `isVideoUrl` detects .mp4, .webm, .mov, .avi, .mkv, .m4v, .ogv URLs
- ✅ `isVideoUrl` handles URLs with query strings
- ✅ `isVideoUrl` returns false for non-video URLs
- ✅ `isVideoLinkText` detects "Video" link text
- ✅ `isVideoLinkText` handles emoji prefixes
- ✅ Renders video element with controls
- ✅ Sets video source from href
- ✅ Respects maxHeight prop
- ✅ Shows error state on video load failure
- ✅ Download button opens URL in new tab
- ✅ Extracts filename from URL for fallback link

### 24. Video Player Tests
**File:** `webapp/channels/src/components/video_player/video_player.test.tsx`

Tests video player component:
- ✅ Renders video element with controls
- ✅ Sets video source from fileInfo
- ✅ Displays filename caption
- ✅ Respects maxHeight/maxWidth props
- ✅ Calculates aspect ratio from file dimensions
- ✅ Opens preview modal on double-click
- ✅ Shows error state on video load failure
- ✅ Download button opens download URL
- ✅ Returns null when no fileInfo provided
- ✅ Handles missing mime_type and name with defaults
- ✅ Applies compact display class when enabled

### 25. YouTube Discord Embed Tests
**File:** `webapp/channels/src/components/youtube_video/youtube_video_discord.test.tsx`

Tests Discord-style YouTube embed:
- ✅ Renders Discord-style card
- ✅ Shows YouTube source label
- ✅ Displays video title from metadata
- ✅ Displays default title when no metadata
- ✅ Loads maxresdefault thumbnail initially
- ✅ Falls back to hqdefault on image error
- ✅ Shows thumbnail initially (not playing)
- ✅ Click shows embedded player
- ✅ Enter/Space key triggers play
- ✅ Iframe has correct src with autoplay
- ✅ Handles youtu.be short URLs
- ✅ Includes timestamp in embed URL
- ✅ Title link goes to YouTube
- ✅ Thumbnail is keyboard accessible
- ✅ Shows play button overlay on thumbnail
- ✅ Applies referrer policy when enabled
- ✅ Iframe has security sandbox attribute

---

## Remaining Tests

### Webapp Tests (TypeScript/React) - Remaining

#### A. Sidebar Base Channel Icon Tests (Not Implemented)

```typescript
// sidebar_base_channel_icon.test.tsx
describe('SidebarBaseChannelIcon', () => {
    test('renders MDI icon correctly')
    test('renders Lucide icon correctly')
    test('renders custom SVG correctly')
    test('falls back to default for invalid library')
    test('respects channel type (public/private/DM)')
})
```

#### B. Multi Image View Tests (Not Implemented)

```typescript
// multi_image_view.test.tsx
describe('MultiImageView', () => {
    test('renders multiple images vertically')
    test('applies maxHeight/maxWidth when ImageSmaller enabled')
    test('handles click to expand')
    test('shows loading state')
})

// markdown_image.test.tsx (caption tests)
describe('MarkdownImage Captions', () => {
    test('shows caption when ImageCaptions enabled')
    test('hides caption when disabled')
    test('respects captionFontSize setting')
    test('displays title attribute as caption')
})
```

#### C. UI Tweak Tests (Not Implemented)

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

#### D. System Console Feature Tests (Not Implemented)

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

### E2E Tests (Cypress) - Not Implemented

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
| StatusLog Model | `server/public/model/status_log_test.go` ✅ |
| Status API | `server/channels/api4/status_extended_test.go` ✅ |
| Accurate Statuses Platform | `server/channels/app/platform/accurate_statuses_test.go` ✅ |
| No Offline Platform | `server/channels/app/platform/no_offline_test.go` ✅ |
| DND Platform | `server/channels/app/platform/dnd_extended_test.go` ✅ |
| Custom Icons API | `server/channels/api4/custom_channel_icon_test.go` ✅ |
| Custom Icons Store | `server/channels/store/sqlstore/custom_channel_icon_store_test.go` ✅ |
| Encryption API | `server/channels/api4/encryption_test.go` ✅ |
| Encryption Store | `server/channels/store/sqlstore/encryption_session_key_store_test.go` ✅ |
| Status Logs Store | `server/channels/store/sqlstore/status_log_store_test.go` ✅ |
| Status Logs Platform | `server/channels/app/platform/status_logs_test.go` ✅ |
| Error Log API | `server/channels/api4/error_log_test.go` ✅ |
| Preferences | `server/channels/api4/preference_override_test.go` ✅ |

### Webapp Tests (TypeScript)
| Feature | File Path |
|---------|-----------|
| Encryption Utils | `webapp/channels/src/utils/encryption/*.test.ts` ✅ |
| Custom SVGs | `webapp/channels/src/components/channel_settings_modal/icon_libraries/*.test.ts` ✅ |
| Sidebar Icon | `webapp/channels/src/components/sidebar/sidebar_channel/sidebar_base_channel/*.test.tsx` ❌ |
| Multi Image View | `webapp/channels/src/components/multi_image_view/*.test.tsx` ❌ |
| Video Player | `webapp/channels/src/components/video_player/*.test.tsx` ✅ |
| Video Link Embed | `webapp/channels/src/components/video_link_embed/*.test.tsx` ✅ |
| YouTube Discord | `webapp/channels/src/components/youtube_video/*.test.tsx` ✅ |
| Status Log Dashboard | `webapp/channels/src/components/admin_console/status_log_dashboard/status_log_dashboard.test.tsx` ✅ |
| Preference Overrides | `webapp/channels/src/components/admin_console/preference_overrides/preference_overrides_dashboard.test.tsx` ✅ |
| Error Log Dashboard | `webapp/channels/src/components/admin_console/error_log_dashboard/error_log_dashboard.test.tsx` ✅ |

### E2E Tests (Cypress)
| Feature | File Path |
|---------|-----------|
| Custom Channel Icons | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/custom_channel_icons_spec.ts` ✅ |
| Encryption | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/encryption_spec.ts` ✅ |
| Status Extended | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/status_extended_spec.ts` ✅ |
| Media Extended | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/media_extended_spec.ts` ✅ |
| Threads Extended | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/threads_extended_spec.ts` ❌ |
| UI Tweaks | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/ui_tweaks_spec.ts` ❌ |
| Admin Console Extended | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/admin_console_extended_spec.ts` ❌ |

---

## Implementation Priority

### Phase 1: Core Server Tests (High Priority) ✅ COMPLETE
1. ✅ Custom Channel Icons API + Store tests
2. ✅ Encryption API + Store tests
3. ✅ Status Logs Store tests (API tests pending)
4. ✅ Error Log API tests
5. ✅ Preference Override API tests

### Phase 2: Core Webapp Tests (High Priority) ✅ COMPLETE
1. ✅ Encryption utility tests (keypair, hybrid, storage, file, session)
2. ✅ Custom SVG management tests (custom_svgs, types)
3. ✅ Video player/embed tests (video_player, video_link_embed, youtube_video_discord)
4. ✅ Status Log Dashboard tests
5. ✅ Error Log Dashboard tests
6. ✅ Preference Overrides Dashboard tests

### Phase 3: E2E Tests (Medium Priority) ✅ COMPLETE
1. ✅ Encryption E2E (critical path)
2. ✅ Custom Channel Icons E2E
3. ✅ Status features E2E
4. ✅ Media features E2E

### Phase 4: Remaining Tests (Lower Priority)
1. ❌ UI tweak tests (simple toggles)
2. ❌ System Console feature tests (CSS-based)
3. ❌ Thread feature tests
4. ✅ Status Logs Platform tests

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

# Store layer tests only
./tests.bat store

# API endpoint tests only
./tests.bat api

# Stop test containers when done
./tests.bat stop
```

| Command | What it Tests | Docker Required |
|---------|---------------|-----------------|
| `./tests.bat` | Full suite (13 tests) | Yes |
| `./tests.bat quick` | Unit tests only | No |
| `./tests.bat status` | Status/Platform tests | Yes |
| `./tests.bat store` | Store layer tests | Yes |
| `./tests.bat api` | API endpoint tests | Yes |
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
