# Native Encrypted Priority Implementation

## Overview

End-to-end encryption as a native feature in Mattermost Extended. Includes encrypted messages, encrypted attachments, and a beautiful purple-themed UI.

## Architecture Summary

### Encryption Model
- **Hybrid Encryption**: RSA-OAEP (4096-bit) + AES-256-GCM
- **Per-Session Keys**: Each browser session gets unique keys stored in `sessionStorage`
- **Multi-Device Support**: Messages encrypted for ALL active sessions of each recipient
- **Client-Side Only**: Encryption/decryption happens entirely in browser - server never sees plaintext

### Message Encryption
- Format: `PENC:v1:{base64_json_payload}`
- Encrypted for all channel members with active session keys
- Automatic decryption on receive (no user action required)

### File Encryption (v2 Format)
- **Client-side encryption**: Files encrypted before upload
- **Metadata inside payload**: Original filename, type, size encrypted inside the file
- **Server sees only**: `encrypted_xxx.penc` with MIME type `application/x-penc`
- **Per-file encryption**: Each file individually encrypted when attached with encryption ON

---

## Design Decisions

### 1. Client-Side File Encryption (Changed from original plan)
- Files encrypted in browser BEFORE upload
- Server only stores encrypted blobs
- Trade-off: Slightly slower upload, but maximum security
- Original filename/type never visible to server

### 2. File Metadata Security (v2 Format)
The encrypted file format embeds original file info inside the encrypted payload:

```
[4-byte header length][JSON header][encrypted file content]
         ↓                  ↓                  ↓
    Little-endian     Original info      AES-256-GCM
                     (name, type, size)   encrypted
```

All of this is then encrypted together, so observers only see:
- Filename: `encrypted_1706789123456.penc`
- MIME type: `application/x-penc`
- Size: Encrypted size (slightly larger than original)

### 3. Per-File Encryption
- Encryption state captured when file is attached
- Can have mixed encrypted/unencrypted files in same message
- Toggling encryption mode only affects NEW attachments

### 4. Auto-Decrypt with Permission Errors
- Files auto-decrypt on view (no click required)
- Users without keys see: "Encrypted file - You do not have permission"
- Decrypted files display normally (no special styling after decryption)

### 5. Client-Side Thumbnail Generation
- Thumbnails generated from original image BEFORE encryption
- Cached client-side by clientId for upload preview
- Never sent to server - server can't generate thumbnails from encrypted blobs

---

## File Structure

### Encryption Utilities
```
webapp/channels/src/utils/encryption/
├── index.ts           # Main exports
├── keypair.ts         # RSA key generation, import/export
├── hybrid.ts          # Hybrid encryption (RSA + AES-GCM)
├── storage.ts         # sessionStorage key management
├── session.ts         # Key lifecycle, channel recipient keys
├── api.ts             # Server API calls for key management
├── message_hooks.ts   # Message encryption/decryption hooks
├── use_decrypt_post.ts # React hook for post decryption
├── decrypt_posts.ts   # Bulk post decryption
├── file.ts            # File encryption/decryption utilities
└── file_hooks.ts      # File upload encryption, metadata caching
```

### UI Components
```
webapp/channels/src/components/encryption/
├── recipient_display.tsx        # Shows who can decrypt
├── encrypted_placeholder.tsx    # Access denied UI
└── encryption_error_bar.tsx     # Key registration error banner
```

### Styling
```
webapp/channels/src/sass/components/_encrypted.scss
```

---

## Encryption Formats

### Message Format
```
PENC:v1:{base64_json}
```

Payload structure:
```json
{
  "iv": "base64(12-byte IV)",
  "ct": "base64(AES ciphertext)",
  "keys": {
    "sessionId1": "base64(RSA-encrypted AES key)",
    "sessionId2": "base64(RSA-encrypted AES key)"
  },
  "sender": "userId"
}
```

### File Encryption Metadata (stored in post.props.encrypted_files)
```json
{
  "fileId": {
    "v": 2,
    "iv": "base64(12-byte IV)",
    "keys": {
      "sessionId1": "base64(RSA-encrypted AES key)",
      "sessionId2": "base64(RSA-encrypted AES key)"
    },
    "sender": "userId"
  }
}
```

### Encrypted File Binary Format (v2)
```
┌─────────────────┬──────────────────────────────────────────┐
│  Header Length  │           Encrypted Content              │
│   (4 bytes)     │                                          │
│  Little-endian  │  AES-256-GCM encrypted:                  │
│                 │  ┌────────────────────────────────────┐  │
│                 │  │ JSON Header:                       │  │
│                 │  │ {"name":"photo.jpg",               │  │
│                 │  │  "type":"image/jpeg",              │  │
│                 │  │  "size":12345}                     │  │
│                 │  ├────────────────────────────────────┤  │
│                 │  │ Original File Content              │  │
│                 │  └────────────────────────────────────┘  │
└─────────────────┴──────────────────────────────────────────┘
```

---

## Key Components

### Session Management (`session.ts`)

**`ensureEncryptionKeys()`**
1. Check for existing keys in `sessionStorage`
2. Verify server has the public key registered
3. Generate new RSA-4096 keypair if needed
4. Register public key with server
5. Return session info for encryption

**`getChannelRecipientKeys(channelId)`**
- Fetches all active session keys for channel members
- Used when encrypting to determine recipients

### File Encryption (`file.ts`)

**`encryptFile(file, sessionKeys, senderId)`**
- Creates v2 format with metadata inside payload
- Returns encrypted blob and metadata for post.props

**`decryptFile(encryptedData, metadata, privateKey, sessionId)`**
- Extracts header, decrypts content
- Returns `{ blob, originalInfo }` with original filename/type/size

**`fetchAndDecryptFile(url, metadata, privateKey, sessionId)`**
- Fetches encrypted file from server
- Decrypts and returns blob URL for display

### File Hooks (`file_hooks.ts`)

**Metadata Caching**
- `cacheFileEncryptionMetadataByClientId(clientId, metadata)` - Store during upload
- `mapClientIdToFileId(clientId, fileId)` - Map after upload completes
- `getCachedFileMetadata(id)` - Retrieve for attaching to post

**Thumbnail Caching**
- `cacheUploadThumbnail(clientId, url)` - Store client-side thumbnail
- `getCachedUploadThumbnail(id)` - Retrieve for preview display
- Thumbnails stay client-side only, never uploaded

### Decryption Hook (`use_encrypted_file.ts`)

React hook for encrypted file handling:
```typescript
const {
  isEncrypted,      // Is this file encrypted?
  fileUrl,          // Decrypted blob URL
  thumbnailUrl,     // Decrypted thumbnail URL
  status,           // 'idle' | 'decrypting' | 'decrypted' | 'failed'
  error,            // Error message if failed
  originalFileInfo, // { name, type, size } after decryption
  decrypt,          // Manual decrypt trigger
} = useEncryptedFile(fileInfo, postId, autoDecrypt);
```

---

## Redux State

### Encryption Views State
```typescript
state.views.encryption = {
  keyError: string | null,           // Key registration error
  decryptedFileUrls: {               // fileId → blob URL
    [fileId]: string
  },
  fileDecryptionStatus: {            // fileId → status
    [fileId]: 'idle' | 'decrypting' | 'decrypted' | 'failed'
  },
  fileDecryptionErrors: {            // fileId → error message
    [fileId]: string
  },
  fileThumbnailUrls: {               // fileId → thumbnail blob URL
    [fileId]: string
  },
  encryptedFileMetadata: {           // fileId → encryption metadata
    [fileId]: EncryptedFileMetadata
  },
  originalFileInfo: {                // fileId → decrypted file info
    [fileId]: { name, type, size }
  }
}
```

### Action Types
```typescript
ENCRYPTION_KEY_ERROR
ENCRYPTION_KEY_ERROR_CLEAR
ENCRYPTED_FILE_METADATA_RECEIVED
ENCRYPTED_FILE_DECRYPTION_STARTED
ENCRYPTED_FILE_DECRYPTED
ENCRYPTED_FILE_DECRYPTION_FAILED
ENCRYPTED_FILE_THUMBNAIL_GENERATED
ENCRYPTED_FILE_ORIGINAL_INFO_RECEIVED
ENCRYPTED_FILE_CLEANUP
```

---

## UI Styling

### CSS Variables
```scss
:root {
  --encrypted-color: 147, 51, 234;     // Purple RGB
  --encrypted-color-hex: #9333EA;
  --encrypted-text-color: #fff;
}
```

### Post Styling
- Purple left border (3px)
- Subtle purple background tint
- Purple "Encrypted" badge with lock icon

### File Attachment Styling
- Purple border around encrypted files
- Lock icon badge in corner
- "Encrypted file" label for undecrypted
- "You do not have permission" for access denied

### Upload Preview Styling
- Purple border with lock icon
- Shows cached thumbnail for images
- Lock icon for non-image files

---

## Server API Endpoints

### Encryption Key Management
```
GET  /api/v4/encryption/status          # Check user's encryption status
GET  /api/v4/encryption/publickey       # Get current user's public key
POST /api/v4/encryption/publickey       # Register public key for session
POST /api/v4/encryption/publickeys      # Bulk fetch keys by user IDs
GET  /api/v4/encryption/channel/{id}/keys # Get all channel member keys
```

### Database Tables

**EncryptionSessionKeys**
| Column | Type | Description |
|--------|------|-------------|
| SessionId | varchar(26) | Primary key, session identifier |
| UserId | varchar(26) | User who owns this session |
| PublicKey | text | JWK-formatted public key |
| CreateAt | bigint | Creation timestamp |

---

## File Upload Flow

```
1. User attaches file with encryption ON
   ├── Generate thumbnail (images only) → cache by clientId
   ├── Encrypt file content with AES-256-GCM
   ├── Create v2 format (metadata inside encrypted payload)
   ├── Wrap AES key with RSA for each recipient session
   └── Cache metadata by clientId

2. Upload encrypted file
   ├── Server receives: encrypted_xxx.penc (application/x-penc)
   ├── Server stores encrypted blob
   └── Returns fileId

3. Map clientId to fileId
   └── Update metadata cache with fileId

4. On message send
   ├── Retrieve metadata from cache
   ├── Attach to post.props.encrypted_files
   └── Clear cache

5. On message receive (other users)
   ├── Extract metadata from post.props
   ├── Auto-decrypt file
   ├── Store blob URL in Redux
   └── Display normal file/image
```

---

## File Display Flow

```
1. FileAttachment/SingleImageView/ImagePreview renders
   ├── Check if file is encrypted (MIME type or metadata)
   └── Call useEncryptedFile hook

2. useEncryptedFile (autoDecrypt=true)
   ├── Check Redux for cached decrypted URL
   ├── If not cached, dispatch decryptEncryptedFile action
   └── Return status and URLs

3. decryptEncryptedFile action
   ├── Get encryption metadata from post.props
   ├── Get user's private key from sessionStorage
   ├── Check if user has key for their session
   ├── Fetch encrypted file from server
   ├── Decrypt and create blob URL
   ├── Generate thumbnail for images
   └── Store in Redux

4. Component re-renders
   ├── isDecrypted=true, no encrypted styling
   └── Display using decrypted blob URL
```

---

## Error States

### No Permission
- User doesn't have session key in encrypted_files.keys
- Shows: "Encrypted file - You do not have permission"
- Lock icon with red/warning tint

### Decryption Failed
- Invalid key, corrupted data, etc.
- Shows: "Encrypted file - Decryption failed"
- Can retry by clicking

### Key Registration Failed
- Network error during public key registration
- Shows error banner at top of screen
- "Retry" button to attempt again

---

## Security Considerations

1. **Private keys never leave browser**: Stored in `sessionStorage`, cleared on logout/tab close
2. **Server never sees plaintext**: Files encrypted client-side before upload
3. **Metadata protected**: Original filename/type inside encrypted payload (v2)
4. **Forward secrecy**: New session = new keys, can't decrypt old messages
5. **No backdoors**: Server cannot decrypt without recipient's private key
6. **Thumbnails stay local**: Generated client-side, never uploaded

---

## Testing Checklist

### Message Encryption
- [ ] Send encrypted message
- [ ] Receive and auto-decrypt
- [ ] User without keys sees placeholder
- [ ] Multi-device: both sessions can decrypt

### File Encryption
- [ ] Upload encrypted image
- [ ] Upload encrypted non-image file
- [ ] Preview shows thumbnail in compose
- [ ] Auto-decrypt on view
- [ ] Download decrypted file
- [ ] User without keys sees "No permission"
- [ ] Mix encrypted and non-encrypted files

### Session Management
- [ ] Keys generated on first encrypted action
- [ ] Keys cleared on logout
- [ ] New login = new keys
- [ ] Can't decrypt old messages after re-login
- [ ] Recipient display updates when users get keys

### Error Handling
- [ ] Key registration failure shows banner
- [ ] Retry button works
- [ ] Decryption failure shows appropriate error
- [ ] Network errors handled gracefully
