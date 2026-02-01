# Encrypted Attachments - Architecture Document

This document describes the architecture for end-to-end encrypted file attachments in Mattermost, following the same patterns established in [MESSAGE_INTERCEPTION.md](./MESSAGE_INTERCEPTION.md).

## Overview

Encrypted attachments use the same hybrid encryption scheme as messages (AES-256-GCM for content, RSA-OAEP for key exchange per session). Files are encrypted client-side before upload and decrypted client-side after download.

## Key Design Principles

1. **Intercept before render** - Decrypt files before they reach UI components, so Mattermost's normal display processing works unchanged
2. **Transparent to components** - File attachment components don't know about encryption; they just use URLs
3. **Blob URL replacement** - Decrypted files are exposed via blob URLs that replace server URLs
4. **Lazy decryption** - Decrypt files when they're about to be displayed, not when post is received

## Data Flow

### Upload Flow (Encryption)

```
User selects file
       ↓
[1] checkPluginHooksAndUploadFiles() in file_upload.tsx
       ↓
[2] encryptFile(file, sessionKeys) → {encryptedBlob, metadata}
       ↓
[3] Construct FormData with encrypted blob
       ↓
[4] Include encryption metadata in request headers or separate field
       ↓
[5] Upload to /api/v4/files
       ↓
[6] Server stores encrypted file + metadata
       ↓
[7] FileInfo returned (with encryption indicator)
```

### Download/Display Flow (Decryption)

```
Post received via WebSocket or API
       ↓
[1] Redux action: RECEIVED_POST / RECEIVED_POSTS
       ↓
[2] files.ts reducer stores FileInfo (encrypted indicator present)
       ↓
[3] FileAttachment component renders, calls getFileUrl(fileId)
       ↓
[4] getFileUrl checks encryptedFiles state:
    - If blob URL exists: return blob URL
    - If file is encrypted and no blob URL: trigger decryption
    - If file not encrypted: return server URL
       ↓
[5] decryptFile() fetches encrypted blob, decrypts, creates blob URL
       ↓
[6] Store blob URL in Redux: encryptedFiles.decryptedUrls[fileId]
       ↓
[7] Component re-renders with decrypted blob URL
```

## Encryption Metadata Format

### EncryptedFileMetadata

```typescript
interface EncryptedFileMetadata {
    v: number;           // Version (1)
    iv: string;          // Base64-encoded 12-byte IV for AES-GCM
    keys: Record<string, string>;  // sessionId → Base64 RSA-encrypted AES key
    sender: string;      // Sender's user ID
    original: {
        name: string;    // Original filename
        type: string;    // Original MIME type
        size: number;    // Original file size
    };
}
```

### Storage in Post

The encryption metadata is stored in `post.props.encrypted_files`:

```typescript
// In post.props
{
    encrypted_files: {
        [fileId]: EncryptedFileMetadata
    }
}
```

This follows the same pattern as encrypted messages where the payload is stored in a structured format.

### FileInfo Indicator

When a file is encrypted, the `FileInfo.mime_type` is set to `application/x-penc` (Pence ENCrypted). This allows quick detection without needing to check post props.

## Redux State

### New State: state.views.encryptedFiles

```typescript
interface EncryptedFilesState {
    // Map of fileId → decrypted blob URL
    decryptedUrls: Record<string, string>;

    // Decryption status per file
    status: Record<string, 'pending' | 'decrypting' | 'decrypted' | 'failed'>;

    // Error messages for failed decryptions
    errors: Record<string, string>;

    // Cache of encryption metadata (extracted from post.props)
    metadata: Record<string, EncryptedFileMetadata>;
}
```

### Actions

```typescript
type EncryptedFileActions =
    | { type: 'ENCRYPTED_FILE_DECRYPTION_STARTED'; fileId: string }
    | { type: 'ENCRYPTED_FILE_DECRYPTED'; fileId: string; blobUrl: string }
    | { type: 'ENCRYPTED_FILE_DECRYPTION_FAILED'; fileId: string; error: string }
    | { type: 'ENCRYPTED_FILE_METADATA_RECEIVED'; fileId: string; metadata: EncryptedFileMetadata }
    | { type: 'ENCRYPTED_FILE_CLEANUP'; fileIds: string[] };
```

## File Utilities Integration

### Modified getFileUrl

The `getFileUrl` function in `mattermost-redux/utils/file_utils.ts` is enhanced:

```typescript
export function getFileUrl(fileId: string, state?: GlobalState): string {
    // Check if we have a decrypted blob URL
    if (state) {
        const blobUrl = state.views?.encryptedFiles?.decryptedUrls?.[fileId];
        if (blobUrl) {
            return blobUrl;
        }
    }

    // Fall back to server URL
    return Client4.getFileRoute(fileId);
}
```

### Selector: getDecryptedFileUrl

```typescript
export function getDecryptedFileUrl(state: GlobalState, fileId: string): string | undefined {
    return state.views.encryptedFiles.decryptedUrls[fileId];
}

export function isFileEncrypted(state: GlobalState, fileId: string): boolean {
    const fileInfo = getFile(state, fileId);
    return fileInfo?.mime_type === 'application/x-penc';
}

export function getFileDecryptionStatus(state: GlobalState, fileId: string): string | undefined {
    return state.views.encryptedFiles.status[fileId];
}
```

## Encryption Middleware Integration

The existing `encryption_middleware.ts` is extended to handle files:

```typescript
// In decryptActionData, after handling posts:

// Extract encryption metadata from post.props for files
if (post.props?.encrypted_files && post.metadata?.files) {
    for (const fileInfo of post.metadata.files) {
        if (fileInfo.mime_type === 'application/x-penc') {
            const metadata = post.props.encrypted_files[fileInfo.id];
            if (metadata) {
                // Store metadata for later decryption
                store.dispatch({
                    type: 'ENCRYPTED_FILE_METADATA_RECEIVED',
                    fileId: fileInfo.id,
                    metadata,
                });
            }
        }
    }
}
```

## Component Integration

### FileAttachment (lazy decryption trigger)

Components that display files trigger decryption when they detect an encrypted file:

```tsx
// In file_attachment.tsx or a wrapper hook
const fileUrl = useFileUrl(fileInfo.id);

function useFileUrl(fileId: string): string {
    const dispatch = useDispatch();
    const fileInfo = useSelector((state) => getFile(state, fileId));
    const decryptedUrl = useSelector((state) => getDecryptedFileUrl(state, fileId));
    const status = useSelector((state) => getFileDecryptionStatus(state, fileId));

    useEffect(() => {
        if (isEncryptedFile(fileInfo) && !decryptedUrl && status !== 'decrypting') {
            dispatch(decryptFile(fileId));
        }
    }, [fileId, fileInfo, decryptedUrl, status]);

    if (decryptedUrl) {
        return decryptedUrl;
    }

    // Return placeholder or loading state URL for encrypted files
    if (isEncryptedFile(fileInfo)) {
        return ENCRYPTED_FILE_PLACEHOLDER;
    }

    return getFileUrl(fileId);
}
```

### FileThumbnail

For thumbnails, we have two options:
1. **Decrypt the full file and generate thumbnail client-side** (more secure)
2. **Upload an encrypted thumbnail separately** (better UX)

We'll use option 1 for simplicity - the full file is decrypted, and we use canvas to generate thumbnails client-side.

## Server Integration

### Minimal Server Changes Required

1. **Accept encrypted files as-is** - Server already accepts binary blobs
2. **Store encryption metadata** - Already stored in `post.props.encrypted_files`
3. **Return metadata with FileInfo** - Already included in post metadata

The server treats encrypted files as opaque blobs. All encryption/decryption is client-side.

### File Size Considerations

Encrypted files are slightly larger than originals due to:
- AES-GCM authentication tag (16 bytes)
- IV (12 bytes)
- Encryption metadata in post.props

Total overhead is minimal (< 1KB) regardless of file size.

## Cleanup

### Blob URL Management

Blob URLs consume memory and must be revoked when no longer needed:

```typescript
// When post is removed or user navigates away
function cleanupDecryptedFiles(fileIds: string[]) {
    for (const fileId of fileIds) {
        const blobUrl = state.encryptedFiles.decryptedUrls[fileId];
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
        }
    }
    dispatch({ type: 'ENCRYPTED_FILE_CLEANUP', fileIds });
}
```

### Automatic Cleanup Triggers

- POST_REMOVED action
- Channel leave
- Logout (UserTypes.LOGOUT_SUCCESS)

## Files to Create/Modify

### New Files

1. `utils/encryption/file.ts` - File encryption/decryption utilities
2. `reducers/views/encrypted_files.ts` - Redux reducer for encrypted file state
3. `actions/encrypted_files.ts` - Redux actions for file encryption
4. `selectors/encrypted_files.ts` - Selectors for encrypted file state
5. `components/file_attachment/use_file_url.ts` - Hook for file URL resolution

### Modified Files

1. `store/encryption_middleware.ts` - Add file metadata extraction
2. `actions/file_actions.ts` - Add encryption before upload
3. `components/file_upload/file_upload.tsx` - Integrate encryption hook
4. `mattermost-redux/utils/file_utils.ts` - Add blob URL fallback

## Security Considerations

1. **Memory Security** - Decrypted file contents are held in browser memory as blobs. They're automatically garbage collected when blob URLs are revoked.

2. **Private Key Protection** - The session private key never leaves the browser and is stored in sessionStorage.

3. **Forward Secrecy** - Each file uses a unique AES key. Compromising one file key doesn't affect others.

4. **Server-Side Security** - The server never sees plaintext file contents. Even server administrators cannot read encrypted files.

5. **Thumbnail Generation** - Since we generate thumbnails client-side, there are no server-side thumbnail previews of encrypted content.

## Implementation Order

1. Create `utils/encryption/file.ts` with encrypt/decrypt functions
2. Add Redux state for encrypted files
3. Modify upload flow to encrypt files
4. Add metadata extraction in encryption middleware
5. Create useFileUrl hook for components
6. Modify file display components to use hook
7. Add cleanup logic
8. Test end-to-end flow
