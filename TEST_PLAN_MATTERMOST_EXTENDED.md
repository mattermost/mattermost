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
| AccurateStatuses | ✅ Exists | N/A (server-only) | ✅ Exists | Complete |
| NoOffline | ✅ Exists | N/A (server-only) | ✅ Exists | Complete |
| DND Extended | ✅ Exists | N/A (server-only) | ✅ Exists | Complete |
| Status Log Dashboard | ✅ Exists | ✅ Exists | ❌ Missing | Good |
| Custom Channel Icons | ✅ Exists | ✅ Exists | ✅ Exists | Complete |
| Encryption (E2EE) | ✅ Exists | ✅ Exists | ✅ Exists | Complete |
| ThreadsInSidebar | N/A (UI-only) | ✅ Exists | ✅ Exists | Complete |
| CustomThreadNames | N/A (UI-only) | ✅ Exists | ✅ Exists | Complete |
| ImageMulti | N/A (UI-only) | ✅ Exists | ✅ Exists | Complete |
| ImageSmaller | N/A (UI-only) | ✅ Exists | ✅ Exists | Complete |
| ImageCaptions | N/A (UI-only) | ✅ Exists | ✅ Exists | Complete |
| VideoEmbed | N/A (UI-only) | ✅ Exists | ✅ Exists | Complete |
| VideoLinkEmbed | N/A (UI-only) | ✅ Exists | ✅ Exists | Complete |
| EmbedYoutube | N/A (UI-only) | ✅ Exists | ✅ Exists | Complete |
| ErrorLogDashboard | ✅ Exists | ✅ Exists | ✅ Exists | Complete |
| SystemConsoleDarkMode | N/A | ✅ Exists | ✅ Exists | Complete |
| SystemConsoleHideEnterprise | N/A | ✅ Exists | ✅ Exists | Complete |
| SystemConsoleIcons | N/A | ✅ Exists | ✅ Exists | Complete |
| SettingsResorted | N/A (UI-only) | ✅ Exists | N/A | Complete |
| PreferencesRevamp | N/A (UI-only) | ✅ Exists | N/A | Complete |
| PreferenceOverridesDashboard | ✅ Exists | ✅ Exists | ✅ Exists | Complete |
| HideDeletedMessagePlaceholder | N/A (UI-only) | ✅ Exists | ✅ Exists | Complete |
| SidebarChannelSettings | N/A (UI-only) | ✅ Exists | ✅ Exists | Complete |
| HideUpdateStatusButton | N/A (UI-only) | ✅ Exists | ✅ Exists | Complete |
| SidebarBaseChannelIcon | N/A | ✅ Exists | N/A | Complete |
| MultiImageView | N/A | ✅ Exists | N/A | Complete |
| MattermostExtendedSettings | ✅ Exists | N/A | N/A | Complete |
| StatusLog Model | ✅ Exists | N/A | N/A | Complete |
| Status Logs Platform | ✅ Exists | N/A | N/A | Complete |
| PreferenceDefinitions | N/A | ✅ Exists | N/A | Complete |

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

#### A. Sidebar Base Channel Icon Tests ✅ IMPLEMENTED

**File:** `webapp/channels/src/components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel_icon.test.tsx`

Tests custom channel icons in the sidebar:
- ✅ Renders MDI icon correctly
- ✅ Renders Lucide icon correctly
- ✅ Renders Tabler icon correctly
- ✅ Renders Feather icon correctly
- ✅ Renders Simple (brand) icon correctly
- ✅ Renders Font Awesome icon correctly
- ✅ Renders registered custom SVG correctly
- ✅ Renders legacy base64 SVG correctly
- ✅ Falls back to default for invalid library/icon
- ✅ Respects channel type (public/private/DM)
- ✅ Icons have correct sizing

#### B. Multi Image View Tests ✅ IMPLEMENTED

**File:** `webapp/channels/src/components/multi_image_view/multi_image_view.test.tsx`

Tests ImageMulti feature:
- ✅ Renders multiple images
- ✅ Returns null for empty fileInfos
- ✅ Applies compact-display and is-permalink classes
- ✅ Uses preview URL when has_preview_image is true
- ✅ Opens modal with correct props when image is clicked
- ✅ Passes maxHeight/maxWidth when ImageSmaller is enabled
- ✅ Skips archived and null files
- ✅ Adds loaded class after image loads

#### C. UI Tweak Tests ✅ IMPLEMENTED

**File:** `webapp/channels/src/tests/mattermost_extended/websocket_post_delete.test.ts`

Tests HideDeletedMessagePlaceholder:
- ✅ postDeleted dispatches POST_DELETED action (shows placeholder)
- ✅ postRemoved dispatches POST_REMOVED action (hides placeholder)
- ✅ Action types are distinct

**File:** `webapp/channels/src/tests/mattermost_extended/sidebar_channel_settings.test.tsx`

Tests SidebarChannelSettings:
- ✅ Shows Channel Settings menu item when enabled and user has access
- ✅ Shows for public channels
- ✅ Shows for private channels
- ✅ NOT shown for DM channels
- ✅ NOT shown for GM channels
- ✅ NOT shown when user does not have access
- ✅ NOT shown when tweak is disabled
- ✅ Calls openModal when clicked

**File:** `webapp/channels/src/tests/mattermost_extended/hide_update_status_button.test.ts`

Tests HideUpdateStatusButton:
- ✅ Returns false when feature flag is enabled
- ✅ Returns true when feature flag is disabled and conditions are met
- ✅ Still hides button when flag is off but modal was already viewed
- ✅ Hides button when flag is enabled regardless of modal view state
- ✅ Hides button when flag is enabled even for new users

#### D. System Console Feature Tests ✅ IMPLEMENTED

**File:** `webapp/channels/src/tests/mattermost_extended/system_console_dark_mode.test.tsx`

Tests SystemConsoleDarkMode:
- ✅ Adds admin-console-dark-mode class to body when enabled
- ✅ Does NOT add class when disabled
- ✅ Removes class when toggling from enabled to disabled
- ✅ Adds admin-console--dark-mode class to wrapper when enabled
- ✅ Config mapping from FeatureFlagSystemConsoleDarkMode
- ✅ Cleanup removes class on unmount

**File:** `webapp/channels/src/tests/mattermost_extended/admin_sidebar_features.test.tsx`

Tests SystemConsoleHideEnterprise:
- ✅ Hides items with restrictedIndicator when enabled
- ✅ Does NOT hide items without restrictedIndicator
- ✅ Does NOT hide items when disabled
- ✅ Config mapping from FeatureFlagSystemConsoleHideEnterprise

Tests SystemConsoleIcons:
- ✅ Includes icon prop when enabled
- ✅ Renders plugin icons when enabled
- ✅ Does NOT include icon prop when disabled
- ✅ Config mapping from FeatureFlagSystemConsoleIcons
- ✅ Combined behavior tests

#### E. Thread Feature Tests ✅ IMPLEMENTED

**File:** `webapp/channels/src/tests/mattermost_extended/threads_in_sidebar.test.tsx`

Tests ThreadsInSidebar feature:
- ✅ Config mapping - maps FeatureFlagThreadsInSidebar to boolean
- ✅ Config mapping - requires CRT (CollapsedReplyThreads) to be enabled
- ✅ Thread label logic - uses custom thread name when set in props
- ✅ Thread label logic - uses cleaned post message when no custom name
- ✅ Thread label logic - prefers custom name over post message
- ✅ Thread label logic - falls back to "Thread" when no message and no custom name
- ✅ Thread link generation - generates correct link to full-width thread view
- ✅ Thread link generation - handles team names with special characters
- ✅ Unread detection - detects unread when there are unread replies
- ✅ Unread detection - detects unread when there are unread mentions
- ✅ Unread detection - does NOT detect unread when no unreads
- ✅ Unread detection - detects unread with both replies and mentions
- ✅ Active thread detection - detects active when route threadIdentifier matches
- ✅ Active thread detection - does NOT detect active when route does not match
- ✅ Active thread detection - does NOT detect active when route params undefined
- ✅ Urgent thread detection - passes isUrgent when thread is urgent
- ✅ Urgent thread detection - does NOT pass isUrgent when not urgent
- ✅ Urgent thread detection - defaults to false when is_urgent undefined

Tests cleanMessageForDisplay utility:
- ✅ Returns empty string for empty message
- ✅ Returns empty string for whitespace-only message
- ✅ Truncates long messages with ellipsis
- ✅ Only uses first line of multi-line message
- ✅ Removes markdown links but keeps text
- ✅ Replaces images with [image]
- ✅ Removes bold markdown (double asterisk)
- ✅ Removes italic markdown (single asterisk)
- ✅ Removes underscore bold/italic
- ✅ Removes header markers
- ✅ Removes blockquote markers
- ✅ Replaces inline code with [code]
- ✅ Collapses multiple whitespace
- ✅ Handles complex message with multiple markdown elements
- ✅ Handles message with only whitespace on first line
- ✅ Uses custom maxLength
- ✅ Does not add ellipsis if message fits within maxLength
- ✅ Uses default maxLength of 50

**File:** `webapp/channels/src/tests/mattermost_extended/custom_thread_names.test.tsx`

Tests CustomThreadNames feature:
- ✅ Config mapping - maps FeatureFlagCustomThreadNames to boolean
- ✅ Config mapping - works independently of ThreadsInSidebar
- ✅ Thread name resolution - uses custom_name from thread props when set
- ✅ Thread name resolution - falls back to auto-generated name when no custom name
- ✅ Thread name resolution - prefers custom name over auto-generated name
- ✅ Thread name resolution - handles empty custom name as falsy
- ✅ Edit state management - starts editing with existing custom name
- ✅ Edit state management - starts editing with empty string when no custom name
- ✅ Edit state management - cancels editing and resets state
- ✅ Save thread name logic - creates props with custom_name when name provided
- ✅ Save thread name logic - clears custom_name when empty string saved
- ✅ Save thread name logic - trims whitespace from name
- ✅ Save thread name logic - clears custom_name when only whitespace saved
- ✅ Keyboard handling - saves on Enter key
- ✅ Keyboard handling - cancels on Escape key
- ✅ Keyboard handling - ignores other keys
- ✅ UI state - allows editing when CustomThreadNames is enabled
- ✅ UI state - does NOT allow editing when CustomThreadNames is disabled
- ✅ UI state - adds editable class when feature is enabled
- ✅ UI state - does NOT add editable class when feature is disabled
- ✅ UI state - shows pencil icon only when feature is enabled
- ✅ UI state - does NOT show pencil icon when feature is disabled
- ✅ patchThread API call format - formats props correctly for setting custom name
- ✅ patchThread API call format - formats props correctly for clearing custom name
- ✅ ThreadsInSidebar integration - shows enhanced header when ThreadsInSidebar enabled
- ✅ ThreadsInSidebar integration - shows simple header when ThreadsInSidebar disabled
- ✅ ThreadsInSidebar integration - shows enhanced header without edit when only ThreadsInSidebar enabled

#### F. MarkdownImage Captions Tests ✅ IMPLEMENTED

**File:** `webapp/channels/src/tests/mattermost_extended/image_captions.test.tsx`

Tests ImageCaptions feature:
- ✅ Config mapping - maps FeatureFlagImageCaptions to boolean
- ✅ Config mapping - maps MattermostExtendedMediaCaptionFontSize to number (default 12)
- ✅ Config mapping - handles non-numeric font size gracefully
- ✅ Caption rendering - shows caption when ImageCaptions enabled and title is present
- ✅ Caption rendering - NOT shown when ImageCaptions disabled
- ✅ Caption rendering - NOT shown when title is empty
- ✅ Caption rendering - NOT shown when imageCaptionsEnabled is undefined
- ✅ Caption rendering - includes "> " prefix in caption text
- ✅ Caption styling - applies custom captionFontSize
- ✅ Caption styling - uses default 12px when captionFontSize not provided
- ✅ Caption styling - applies various font sizes (10px, 20px)
- ✅ Integration - still renders image when caption is shown
- ✅ Integration - renders image directly when caption is not shown
- ✅ Integration - handles broken images without caption
- ✅ Integration - does not show caption for unsafe links post
- ✅ Caption content - displays long caption text
- ✅ Caption content - displays caption with special characters
- ✅ Caption content - displays caption with unicode characters
- ✅ Caption content - handles whitespace-only title

---

### E2E Tests (Cypress) ✅ IMPLEMENTED

All E2E tests are now implemented in `e2e-tests/cypress/tests/integration/channels/mattermost_extended/`:

#### A. Custom Channel Icons E2E ✅
**File:** `custom_channel_icons_spec.ts` (existing)

#### B. Encryption E2E ✅
**File:** `encryption_spec.ts` (existing)

#### C. Status Features E2E ✅
**File:** `status_extended_spec.ts` (existing)

#### D. Media Features E2E ✅
**File:** `media_extended_spec.ts` (existing)

#### E. Thread Features E2E ✅ NEW
**File:** `threads_extended_spec.ts`

Tests ThreadsInSidebar:
- ✅ MM-EXT-TH001 Followed threads appear under parent channel in sidebar
- ✅ MM-EXT-TH002 Thread shows message preview as label
- ✅ MM-EXT-TH003 Clicking thread in sidebar opens full-width thread view
- ✅ MM-EXT-TH004 Unread threads show unread indicator
- ✅ MM-EXT-TH005 Unfollowing thread removes it from sidebar
- ✅ MM-EXT-TH006 Thread with mentions shows mention badge

Tests CustomThreadNames:
- ✅ MM-EXT-TH007 User can rename thread in full-width view
- ✅ MM-EXT-TH008 Custom thread name appears in sidebar
- ✅ MM-EXT-TH009 Clearing custom name reverts to message preview
- ✅ MM-EXT-TH010 Escape key cancels thread name edit
- ✅ MM-EXT-TH011 Thread name is trimmed of whitespace

Tests Feature Flag Configuration:
- ✅ MM-EXT-TH012 ThreadsInSidebar can be toggled
- ✅ MM-EXT-TH013 CustomThreadNames can be toggled
- ✅ MM-EXT-TH014 ThreadsInSidebar requires CRT to be enabled
- ✅ MM-EXT-TH015 Admin console shows thread feature flags

#### F. UI Tweaks E2E ✅ NEW
**File:** `ui_tweaks_spec.ts`

Tests HideDeletedMessagePlaceholder:
- ✅ MM-EXT-UI001 Deleted messages disappear immediately
- ✅ MM-EXT-UI002 Multiple deleted messages all disappear
- ✅ MM-EXT-UI003 Placeholder shown when tweak is disabled

Tests SidebarChannelSettings:
- ✅ MM-EXT-UI004 Channel Settings appears in right-click menu
- ✅ MM-EXT-UI005 Clicking Channel Settings opens modal
- ✅ MM-EXT-UI006 Channel Settings available for public channels
- ✅ MM-EXT-UI007 Channel Settings available for private channels
- ✅ MM-EXT-UI008 Channel Settings NOT shown for DM channels
- ✅ MM-EXT-UI009 Channel Settings NOT shown when tweak disabled

Tests HideUpdateStatusButton:
- ✅ MM-EXT-UI010 Update status button is hidden on posts
- ✅ MM-EXT-UI011 Status button visible when feature disabled

Tests Tweak Configuration:
- ✅ MM-EXT-UI012-014 Tweaks can be toggled via API
- ✅ MM-EXT-UI015-018 Admin console shows tweak settings

#### G. Admin Console Features E2E ✅ NEW
**File:** `admin_console_extended_spec.ts`

Tests SystemConsoleDarkMode:
- ✅ MM-EXT-AC001 Dark mode is applied to admin console
- ✅ MM-EXT-AC002 Dark mode styling is visible
- ✅ MM-EXT-AC003 Dark mode can be toggled

Tests SystemConsoleHideEnterprise:
- ✅ MM-EXT-AC004 Enterprise features are hidden
- ✅ MM-EXT-AC005 Non-enterprise features are still visible
- ✅ MM-EXT-AC006 Enterprise features visible when disabled

Tests SystemConsoleIcons:
- ✅ MM-EXT-AC007 Icons are shown next to sidebar sections
- ✅ MM-EXT-AC008 Icons removed when feature disabled

Tests PreferenceOverridesDashboard:
- ✅ MM-EXT-AC009 Preference overrides dashboard accessible
- ✅ MM-EXT-AC010 Admin can view preference categories
- ✅ MM-EXT-AC011 Admin can set preference overrides
- ✅ MM-EXT-AC012 Override applies to users
- ✅ MM-EXT-AC013 User cannot change overridden preference

Tests ErrorLogDashboard:
- ✅ MM-EXT-AC014 Error log dashboard accessible
- ✅ MM-EXT-AC015 Error dashboard displays
- ✅ MM-EXT-AC016 Error filters work
- ✅ MM-EXT-AC017 Clear errors functionality

Tests Mattermost Extended Sidebar:
- ✅ MM-EXT-AC018-023 All subsections exist in admin sidebar

Tests Feature Flag Toggles:
- ✅ MM-EXT-AC024-028 All feature flags can be toggled

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
| Sidebar Base Channel Icon | `webapp/channels/src/components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel_icon.test.tsx` ✅ |
| Multi Image View | `webapp/channels/src/components/multi_image_view/multi_image_view.test.tsx` ✅ |
| Video Player | `webapp/channels/src/components/video_player/*.test.tsx` ✅ |
| Video Link Embed | `webapp/channels/src/components/video_link_embed/*.test.tsx` ✅ |
| YouTube Discord | `webapp/channels/src/components/youtube_video/*.test.tsx` ✅ |
| Status Log Dashboard | `webapp/channels/src/components/admin_console/status_log_dashboard/status_log_dashboard.test.tsx` ✅ |
| Preference Overrides | `webapp/channels/src/components/admin_console/preference_overrides/preference_overrides_dashboard.test.tsx` ✅ |
| Error Log Dashboard | `webapp/channels/src/components/admin_console/error_log_dashboard/error_log_dashboard.test.tsx` ✅ |
| HideDeletedMessagePlaceholder | `webapp/channels/src/tests/mattermost_extended/websocket_post_delete.test.ts` ✅ |
| SidebarChannelSettings | `webapp/channels/src/tests/mattermost_extended/sidebar_channel_settings.test.tsx` ✅ |
| HideUpdateStatusButton | `webapp/channels/src/tests/mattermost_extended/hide_update_status_button.test.ts` ✅ |
| SystemConsoleDarkMode | `webapp/channels/src/tests/mattermost_extended/system_console_dark_mode.test.tsx` ✅ |
| SystemConsoleHideEnterprise | `webapp/channels/src/tests/mattermost_extended/admin_sidebar_features.test.tsx` ✅ |
| SystemConsoleIcons | `webapp/channels/src/tests/mattermost_extended/admin_sidebar_features.test.tsx` ✅ |
| ThreadsInSidebar | `webapp/channels/src/tests/mattermost_extended/threads_in_sidebar.test.tsx` ✅ |
| CustomThreadNames | `webapp/channels/src/tests/mattermost_extended/custom_thread_names.test.tsx` ✅ |
| cleanMessageForDisplay | `webapp/channels/src/tests/mattermost_extended/threads_in_sidebar.test.tsx` ✅ |
| ImageCaptions | `webapp/channels/src/tests/mattermost_extended/image_captions.test.tsx` ✅ |
| SettingsResorted | `webapp/channels/src/tests/mattermost_extended/settings_resorted.test.tsx` ✅ |
| PreferenceDefinitions | `webapp/channels/src/utils/preference_definitions.test.ts` ✅ |

### E2E Tests (Cypress)
| Feature | File Path |
|---------|-----------|
| Custom Channel Icons | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/custom_channel_icons_spec.ts` ✅ |
| Encryption | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/encryption_spec.ts` ✅ |
| Status Extended | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/status_extended_spec.ts` ✅ |
| Media Extended | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/media_extended_spec.ts` ✅ |
| Threads Extended | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/threads_extended_spec.ts` ✅ |
| UI Tweaks | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/ui_tweaks_spec.ts` ✅ |
| Admin Console Extended | `e2e-tests/cypress/tests/integration/channels/mattermost_extended/admin_console_extended_spec.ts` ✅ |

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

### Phase 4: Remaining Tests (Lower Priority) ✅ COMPLETE
1. ✅ UI tweak tests (HideDeletedMessagePlaceholder, SidebarChannelSettings, HideUpdateStatusButton)
2. ✅ System Console feature tests (SystemConsoleDarkMode, SystemConsoleHideEnterprise, SystemConsoleIcons)
3. ✅ Multi Image View tests
4. ✅ Sidebar Base Channel Icon tests
5. ✅ Status Logs Platform tests
6. ✅ Thread feature tests (ThreadsInSidebar, CustomThreadNames)
7. ✅ MarkdownImage Captions tests (ImageCaptions)

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
