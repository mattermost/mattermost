# Native Encrypted Priority Implementation Plan

## Overview

Implement end-to-end encryption as a native feature in the Mattermost Extended fork, removing the plugin dependency. This includes encrypted messages, encrypted attachments, beautiful UI, and a "Mattermost Extended" settings section in System Console.

## Design Decisions

Based on user preferences:

1. **Attachment Encryption**: Server-side encryption
   - Files uploaded as plaintext, encrypted on server before storage
   - Faster uploads, simpler client code
   - Trade-off: temporary plaintext exposure on server

2. **No-Key User Experience**: Show "Encrypted - Set up keys to view"
   - Prompts users to set up encryption keys
   - Links to key setup modal
   - Encourages adoption without blocking access to other content

3. **Lock Button Behavior**: Toggle mode
   - Click to enable encryption mode (stays active)
   - Click again to disable
   - Visual indicator (purple highlight) when active
   - Both formatting bar button and priority dropdown do the same thing

4. **Session-Based Keys**: Maximum security
   - Private keys stored in `sessionStorage` (cleared on logout/tab close)
   - Keys generated per-session, not persisted
   - When logged out or session ends: no decryption possible
   - Keypair prompt modal shown when user has no keys registered
   - Message for non-recipients: "🔒 Encrypted - You do not have permission to view this"
   - **Key Registration Verification**: Client verifies server has the key, not just local storage
   - **Error Recovery**: If registration fails, error banner with retry button is shown

5. **Visible Recipient List**: Transparency
   - When encryption mode is enabled, show list of recipients who can decrypt
   - Display below editor: "Sending encrypted to: @user1, @user2, @user3..."
   - Users can see exactly who will receive the decrypted message

---

## Phase 1: Server-Side Configuration

### 1.1 Add MattermostExtendedSettings to Config

**File: `server/public/model/config.go`**

Add new settings struct (~line 3940, before Config struct):

```go
type MattermostExtendedSettings struct {
    EnableEncryption *bool `access:"mattermost_extended"`
    AdminModeOnly    *bool `access:"mattermost_extended"` // Only admins can use encryption
}

func (s *MattermostExtendedSettings) SetDefaults() {
    if s.EnableEncryption == nil {
        s.EnableEncryption = NewPointer(true)
    }
    if s.AdminModeOnly == nil {
        s.AdminModeOnly = NewPointer(false)
    }
}
```

Add to Config struct (~line 3997):
```go
MattermostExtendedSettings MattermostExtendedSettings
```

Call SetDefaults in `Config.SetDefaults()` method.

### 1.2 Add Encryption Key API Endpoints

**New file: `server/channels/api4/encryption.go`**

API endpoints:
- `GET /api/v4/encryption/publickey` - Get current user's public key
- `POST /api/v4/encryption/publickey` - Register public key
- `POST /api/v4/encryption/publickeys` - Bulk fetch keys by user IDs
- `GET /api/v4/encryption/channel/{id}/keys` - Get all channel member keys
- `GET /api/v4/encryption/status` - Check if user can encrypt (admin mode check)

### 1.3 Add Key Storage

**New file: `server/channels/store/sqlstore/encryption_store.go`**

Table: `EncryptionKeys`
- `UserId` (primary key)
- `PublicKey` (text, JWK format)
- `CreateAt` (bigint)
- `UpdateAt` (bigint)

---

## Phase 2: Webapp Core Encryption

### 2.1 Add Native Crypto Utilities

**New directory: `webapp/channels/src/utils/encryption/`**

Files to create:
- `keypair.ts` - RSA-OAEP key generation, import/export
- `hybrid.ts` - Hybrid encryption (RSA + AES-GCM)
- `storage.ts` - **sessionStorage** key management (cleared on logout)
- `api.ts` - API calls for key management
- `session.ts` - Auto-generate keys on first encrypted send, register public key with server

### 2.2 Add "encrypted" as Native Priority Type

**File: `webapp/platform/types/src/posts.ts`**

Add to PostPriority enum:
```typescript
export enum PostPriority {
    URGENT = 'urgent',
    IMPORTANT = 'important',
    ENCRYPTED = 'encrypted', // NEW
}
```

**Encrypted Messages Compact Normally:**

Unlike `urgent` and `important` priorities, encrypted messages should compact like regular messages. When two encrypted messages are sent consecutively by the same user, the second one should appear in compact form (no avatar, reduced header).

This requires a special case in `webapp/channels/src/components/post/index.tsx`:

```typescript
// Line 82 - posts with priority are never consecutive, EXCEPT encrypted
if (previousPost && post) {
    // Encrypted priority should still allow consecutive posts
    const hasPriorityButNotEncrypted = post.metadata?.priority?.priority &&
        post.metadata.priority.priority !== PostPriority.ENCRYPTED;
    if (!hasPriorityButNotEncrypted) {
        consecutivePost = areConsecutivePostsBySameUser(post, previousPost);
    }
}
```

This means encrypted posts will:
- Compact normally when consecutive from the same user
- Still show the encrypted badge and purple styling
- Allow for natural conversation flow in encrypted channels

### 2.3 Modify Priority Picker

**File: `webapp/channels/src/components/post_priority/post_priority_picker.tsx`**

Add "Encrypted" option with lock icon between native priorities and plugin priorities.

### 2.4 Modify Priority Label

**File: `webapp/channels/src/components/post_priority/post_priority_label.tsx`**

Add rendering for `PostPriority.ENCRYPTED` with purple badge and lock icon.

---

## Phase 3: Encryption UI Components

### 3.1 Lock Button in Formatting Bar (Toggle Mode)

**File: `webapp/channels/src/components/advanced_text_editor/formatting_bar/formatting_bar.tsx`**

Add lock icon button with toggle behavior:
- Click to enable encryption mode (button stays highlighted purple)
- Click again to disable encryption mode
- When active: purple background, triggers encryption on send
- Shows recipient display below editor when enabled
- Syncs state with priority picker (both show same encryption state)

### 3.2 Key Generation and Registration

**File: `webapp/channels/src/utils/encryption/session.ts`**

The `ensureEncryptionKeys()` function handles key lifecycle:

1. **Check local keys exist** - Look in `sessionStorage`
2. **Verify server has key** - Call `/api/v4/encryption/status` to check `has_key`
3. **Handle mismatches**:
   - If local keys exist but server doesn't have them → re-register existing key
   - If registration fails → clear local keys, throw error with user-friendly message
4. **Generate new keys** if none exist:
   - Generate RSA-4096 keypair using Web Crypto API
   - Store in `sessionStorage` (session-only, cleared on tab close)
   - Register public key with server
   - If registration fails → clear local keys, throw error

**Critical: Server verification prevents "orphaned keys"** where local keys exist but server doesn't know about them (e.g., if registration failed silently).

### 3.2.1 Logout Clears Encryption Session

**File: `webapp/channels/src/actions/global_actions.tsx`**

On logout, `clearEncryptionSession()` is called to:
- Remove private/public keys from `sessionStorage`
- Clear decryption cache

This ensures each login session gets fresh keys, and old encrypted messages become unreadable after logout (by design - maximum security).

### 3.2.2 Error Handling with Banner

**Files:**
- `webapp/channels/src/components/encryption/encryption_error_bar.tsx`
- `webapp/channels/src/actions/views/encryption.ts`
- `webapp/channels/src/reducers/views/encryption.ts`

When key registration fails:
1. Error is stored in Redux: `state.views.encryption.keyError`
2. `EncryptionKeyErrorBar` component shows critical banner at top of screen
3. Banner includes "Retry" button to attempt registration again
4. Banner persists until dismissed or retry succeeds

This provides clear feedback when encryption setup fails, rather than silent failure.

### 3.3 Recipient Display

**New file: `webapp/channels/src/components/encryption/recipient_display.tsx`**

Shows who can decrypt the message (displayed below editor when encryption enabled):
- Format: "🔒 Sending encrypted to: @user1, @user2, @user3..."
- Lists all channel members who have active sessions (public keys registered)
- **Excludes current user** from the list (you don't need to see yourself)
- If some members don't have keys: "⚠️ X member(s) without active encryption will not see this message"
- Provides transparency about exactly who will receive decrypted content
- **Auto-refreshes every 5 seconds** while visible to catch new key registrations

### 3.4 Access Denied Placeholder

**New file: `webapp/channels/src/components/encryption/encrypted_placeholder.tsx`**

Styled component shown when user can't decrypt a message:
- Purple-tinted card with lock icon
- Text: "🔒 Encrypted - You do not have permission to view this"
- No action button (session-based keys mean you either can decrypt or you can't)
- Clean, minimal design that doesn't distract from other messages

### 3.5 Encrypted Message Styling

**New file: `webapp/channels/src/sass/components/_encrypted.scss`**

Beautiful styling for encrypted posts with purple theme, using CSS variables for customization:

**1. CSS Variables (add to theme or root):**
```scss
:root {
    // Encrypted message theming - can be overridden by custom themes
    --encrypted-color: 147, 51, 234; // RGB values for purple (#9333EA)
    --encrypted-color-hex: #9333EA;
    --encrypted-text-color: #fff;
}
```

**2. Purple Post Background Highlight:**
```scss
// Encrypted posts get a subtle purple background tint
.post[data-priority="encrypted"],
.post.post--encrypted {
    background: rgba(var(--encrypted-color), 0.04);
    border-left: 3px solid rgba(var(--encrypted-color), 1);

    &:hover {
        background: rgba(var(--encrypted-color), 0.08);
    }
}

// In compact mode, maintain the styling
.post--compact.post--encrypted {
    background: rgba(var(--encrypted-color), 0.04);
    border-left: 3px solid rgba(var(--encrypted-color), 1);
}
```

**3. Encrypted Badge (purple with lock icon):**
```scss
.encrypted-priority-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(var(--encrypted-color), 1);
    color: var(--encrypted-text-color);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;

    svg {
        width: 12px;
        height: 12px;
    }
}
```

**Theme Customization:**

Users can override the encrypted color in their custom theme CSS:
```css
/* Example: Change encrypted color to teal */
:root {
    --encrypted-color: 20, 184, 166;
    --encrypted-color-hex: #14b8a6;
}
```

**3. Additional Styling:**
- Recipient display (shows who can decrypt)
- Access denied placeholder (for users without keys)
- Lock button active/inactive states

**Modify: `webapp/channels/src/components/post/post_component.tsx`**

Add encrypted class to post container when priority is 'encrypted':
```typescript
// Around line 302, modify the classNames call:
return classNames('a11y__section post', {
    'post--highlight': shouldHighlight && !fadeOutHighlight,
    'post--encrypted': post.metadata?.priority?.priority === 'encrypted', // NEW
    // ... other classes
});
```

**Import styles in: `webapp/channels/src/sass/components/_index.scss`**
```scss
@import 'encrypted';
```

---

## Phase 4: Message Encryption Flow

### 4.1 Encrypt on Send

**File: `webapp/channels/src/actions/hooks.ts`**

Add `encryptMessageIfNeeded()` function called in `runMessageWillBePostedHooks`:
1. Check if encryption mode is enabled
2. Fetch channel member keys
3. Encrypt message with hybrid encryption
4. Add `priority: 'encrypted'` to metadata

### 4.2 Decrypt on Receive

**File: `webapp/channels/src/actions/new_post.ts`**

Wire up `runMessageWillBeReceivedHooks` in `completePostReceive`:
1. Check if post has `priority: 'encrypted'`
2. Check if user has decryption key
3. Decrypt and update post in store

### 4.3 Encrypted Format

Message format: `PENC:v1:{base64_json_payload}`

Payload:
```json
{
  "iv": "base64(12-byte IV)",
  "ct": "base64(AES ciphertext)",
  "keys": { "userId1": "base64(RSA-encrypted AES key)", ... },
  "sender": "senderId"
}
```

---

## Phase 5: Encrypted Attachments (Server-Side)

### 5.1 Server-Side File Encryption

**File: `server/channels/app/file.go`**

Modify `UploadFileX` to encrypt files when post has encryption metadata:
1. Receive plaintext file from client (fast upload)
2. Generate AES-256-GCM key for file
3. Encrypt file content in memory
4. Write encrypted file to configured storage backend (S3 or local filesystem)
5. Store encrypted AES key for each recipient (RSA-encrypted)
6. Save encryption metadata to FileInfo

**Storage Backend Support:**

The encrypted file is stored using Mattermost's configured `FileSettings.DriverName`:
- `"amazons3"` → Upload encrypted bytes to S3 bucket (`FileSettings.AmazonS3*` settings)
- `"local"` → Write encrypted bytes to local filesystem (`FileSettings.Directory`)

This uses the existing `FileBackend` interface, so no special handling is needed - the encryption happens in memory before calling the standard file write methods. The file backend is already abstracted in `server/platform/shared/filestore/`.

**Key point:** The client uploads plaintext → server encrypts in memory → encrypted bytes written to storage. The storage backend (S3 or local) only ever sees encrypted content.

### 5.2 File Encryption Metadata

**File: `server/public/model/file_info.go`**

Add encryption fields:
```go
type FileInfo struct {
    // ... existing fields ...
    EncryptedFor map[string]string `json:"encrypted_for,omitempty"` // userId -> RSA-encrypted AES key
    EncryptionIV string            `json:"encryption_iv,omitempty"` // Base64 IV
}
```

### 5.3 Server-Side File Decryption API

**File: `server/channels/api4/file.go`**

New endpoint: `GET /api/v4/files/{file_id}/decrypt`
1. Verify user is in `EncryptedFor` list
2. Return user's RSA-encrypted AES key
3. Client decrypts the AES key with their private key
4. Client uses AES key to decrypt downloaded file

### 5.4 Client-Side File Decryption

**New file: `webapp/channels/src/utils/encryption/file_crypto.ts`**

Functions:
- `decryptFileKey(encryptedKey: string, privateKey: CryptoKey)` - Unwrap file AES key
- `decryptFile(encryptedData: ArrayBuffer, aesKey: CryptoKey, iv: string)` - Decrypt file

### 5.5 Modify File Download/Preview

**Files:**
- `webapp/channels/src/components/file_preview/`
- `webapp/channels/src/components/file_attachment/`

When viewing encrypted attachment:
1. Download encrypted file from storage (S3 or local - transparent to client)
2. Fetch user's encrypted AES key from `/decrypt` endpoint
3. Decrypt AES key with user's private RSA key
4. Decrypt file content with AES key in browser
5. Display/download decrypted content

**Note:** The download uses standard Mattermost file endpoints (`/api/v4/files/{file_id}`). The server retrieves from whatever storage backend is configured (S3 or local) and returns the encrypted bytes. Decryption happens client-side in the browser.

---

## Phase 6: System Console Settings

### 6.1 Add Admin Definition

**File: `webapp/channels/src/components/admin_console/admin_definition.tsx`**

Add new section "Mattermost Extended" with icon `ShieldOutlineIcon`:

```typescript
mattermost_extended: {
    icon: ShieldOutlineIcon,
    sectionTitle: 'Mattermost Extended',
    subsections: {
        encryption: {
            title: 'Message Encryption',
            settings: [
                {
                    type: 'bool',
                    key: 'MattermostExtendedSettings.EnableEncryption',
                    label: 'Enable End-to-End Encryption',
                    help_text: 'Allow users to send encrypted messages...',
                },
                {
                    type: 'bool',
                    key: 'MattermostExtendedSettings.AdminModeOnly',
                    label: 'Admin-Only Mode',
                    help_text: 'Restrict encryption to system administrators...',
                },
            ],
        },
    },
},
```

### 6.2 Add Permission Keys

**File: `webapp/packages/mattermost-redux/src/constants/permissions_sysconsole.ts`**

Add:
```typescript
MATTERMOST_EXTENDED: 'mattermost_extended',
```

---

## Phase 7: Local Testing Setup

### 7.1 Extract and Configure Backup

```bash
# Extract backup
cd G:\_Backups\Mattermost
tar -xzf "app-backup-2026-01-31-18-58-33 (chat.sourcemod.xyz).tar.gz"

# This contains:
# - data/ (files, plugins)
# - postgresql.dump (database)
```

### 7.2 Local Development Server

```bash
# Terminal 1: Start server
cd G:\Modding\_Github\mattermost\server
make run-server

# Terminal 2: Start webapp (hot reload)
cd G:\Modding\_Github\mattermost\webapp
npm run dev
```

### 7.3 Configure Desktop App for Local

1. Open Mattermost Desktop
2. Add server: `http://localhost:8065`
3. Login with test account

### 7.4 Import Backup Database

```bash
# Create local PostgreSQL database
createdb mattermost_local

# Import backup
psql mattermost_local < postgresql.dump

# Update server config to use local DB
# Edit server/config/config.json
```

---

## Critical Files to Modify

### Server (Go)

| File | Changes |
|------|---------|
| `server/public/model/config.go` | Add MattermostExtendedSettings |
| `server/channels/api4/encryption.go` | NEW - Key management API endpoints |
| `server/channels/store/sqlstore/encryption_store.go` | NEW - Key storage table |
| `server/public/model/file_info.go` | Add encryption metadata fields |
| `server/channels/app/file.go` | Add server-side file encryption |
| `server/channels/api4/file.go` | Add decrypt key endpoint |

### Webapp (TypeScript/React)

| File | Changes |
|------|---------|
| `webapp/platform/types/src/posts.ts` | Add ENCRYPTED priority |
| `webapp/channels/src/components/post_priority/post_priority_picker.tsx` | Add Encrypted option + sync with lock button |
| `webapp/channels/src/components/post_priority/post_priority_label.tsx` | Add Encrypted badge (purple + lock) |
| `webapp/channels/src/components/advanced_text_editor/formatting_bar/` | Add Lock toggle button |
| `webapp/channels/src/actions/hooks.ts` | Add encryption hook |
| `webapp/channels/src/actions/new_post.ts` | Wire receive hook |
| `webapp/channels/src/actions/global_actions.tsx` | Clear encryption session on logout |
| `webapp/channels/src/actions/views/encryption.ts` | NEW - Redux actions for encryption error state |
| `webapp/channels/src/reducers/views/encryption.ts` | NEW - Redux reducer for encryption error state |
| `webapp/channels/src/components/admin_console/admin_definition.tsx` | Add MM Extended section |
| `webapp/channels/src/utils/encryption/` | NEW - Crypto utilities (keypair, hybrid, storage, api, session, file_crypto) |
| `webapp/channels/src/components/encryption/` | NEW - UI (recipient_display, encrypted_placeholder, keypair_prompt, encryption_error_bar) |
| `webapp/channels/src/components/announcement_bar/announcement_bar_controller.tsx` | Add KeypairPromptController and EncryptionKeyErrorBar |
| `webapp/channels/src/utils/constants.tsx` | Add ENCRYPTION_KEY_ERROR action types |

---

## Verification Steps

1. **Build server**: `cd server && make build`
2. **Build webapp**: `cd webapp && npm run build`
3. **Run tests**: `make test` (add encryption unit tests)
4. **Manual testing**:
   - Enable encryption in System Console
   - Generate keypair via modal prompt
   - Send encrypted message
   - Verify badge appears
   - Verify decryption works
   - Test with user without keys (access denied placeholder)
   - Test encrypted attachment upload/download
   - Test Lock button and Priority picker both work
   - **Session-based key testing**:
     - User 1 logs in, generates keys, sends encrypted message
     - User 2 logs in, generates keys → recipient display updates within 5 seconds
     - User 2 can decrypt User 1's new messages
     - User 1 logs out → encryption keys cleared
     - User 1 logs back in → cannot decrypt old messages (new keypair)
   - **Error handling testing**:
     - Simulate failed key registration (e.g., network error)
     - Verify error banner appears with "Retry" button
     - Click Retry → verify registration succeeds and banner disappears
     - Verify modal shows inline error on failure

---

## Estimated Scope

| Phase | Complexity | Files |
|-------|------------|-------|
| 1. Server Config | Low | 3 |
| 2. Webapp Core | Medium | 6 |
| 3. UI Components | Medium | 8 |
| 4. Message Flow | Medium | 4 |
| 5. Attachments | High | 8 |
| 6. System Console | Low | 3 |
| 7. Local Testing | Setup | - |

**Total: ~32 files, fresh implementation (no backward compatibility needed)**
