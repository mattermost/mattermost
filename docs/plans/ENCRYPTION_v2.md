# Encryption v2: Login Session-Based Key Persistence

## Problem Statement

The current encryption implementation uses **browser session keys** stored in `sessionStorage`. This means:

1. **Keys are ephemeral** - Closing the browser tab clears `sessionStorage`
2. **Every browser restart = new keys** - User loses access to all previous encrypted messages
3. **Forward secrecy is too aggressive** - While secure, it's impractical for normal usage

### Current Behavior (Undesired)

```
Day 1: User logs in, encryption keys generated, can encrypt/decrypt
Day 2: User closes browser
Day 3: User opens browser (still logged in via cookie)
       → NEW encryption keys generated
       → Cannot decrypt ANY messages from Day 1-2
```

### Desired Behavior

```
Day 1: User logs in, encryption keys generated, can encrypt/decrypt
Day 2: User closes browser
Day 3: User opens browser (still logged in via cookie)
       → SAME encryption keys restored
       → Can decrypt ALL messages from Day 1-3
Day 8: User's session expires or they logout
Day 8: User logs in again
       → NEW encryption keys generated (new login session)
       → Cannot decrypt messages from Day 1-7 (expected - new session)
```

**Key Principle**: Encryption keys should be tied to the **Mattermost login session**, not the browser tab session.

---

## Technical Analysis

### Current Implementation

| Component | Current Approach | Problem |
|-----------|------------------|---------|
| Key Storage | `sessionStorage` | Cleared on browser close |
| Session ID | Server-generated, stored in `sessionStorage` | Lost on browser close |
| Key Lifecycle | Per browser tab | Too short-lived |
| Private Key | Never leaves browser | Correct, keep this |

### Files Involved

```
webapp/channels/src/utils/encryption/
├── storage.ts      # Uses sessionStorage - NEEDS CHANGE
├── session.ts      # Key initialization - NEEDS CHANGE
├── api.ts          # Server API calls - Minor changes
└── keypair.ts      # Key generation - No change needed
```

```
server/channels/
├── api4/encryption.go                           # API endpoints - Minor changes
└── store/sqlstore/encryption_session_key_store.go  # DB storage - May need changes
```

---

## Solution Design

### Core Concept: Mattermost Session-Keyed Storage

Instead of using `sessionStorage` (tied to browser tab), use `localStorage` with keys namespaced to the Mattermost login session.

```typescript
// OLD: sessionStorage (lost on browser close)
sessionStorage.setItem('mm_encryption_private_key', privateKeyJwk);

// NEW: localStorage keyed to Mattermost session
localStorage.setItem(`mm_encryption_${mmSessionId}_private_key`, privateKeyJwk);
```

### What is a "Mattermost Session"?

Mattermost identifies login sessions via:
- **Session Token** (`MMAUTHTOKEN` cookie) - Unique per login
- **User ID** (`MMUSERID` cookie) - Identifies the user
- **Session ID** - Server-side identifier for the session

When you "stay logged in":
- Cookies persist across browser restarts
- Session token remains valid until expiration or logout
- Same session ID throughout

When you re-login:
- New session token issued
- New session ID assigned
- Old session invalidated

---

## Implementation Plan

### Phase 1: Storage Layer Changes

**File: `webapp/channels/src/utils/encryption/storage.ts`**

#### 1.1 Add Mattermost Session Detection

```typescript
/**
 * Gets the current Mattermost session ID from cookies or API.
 * This is the session that was created when the user logged in.
 */
export function getMattermostSessionId(): string | null {
    // Option A: Read from cookie (if exposed)
    // Option B: Read from Redux state
    // Option C: Make API call to /api/v4/users/me/sessions
    //
    // Recommended: Use the session ID that's already stored when
    // we register the public key with the server
}
```

#### 1.2 Change Storage Backend

```typescript
// Storage key format: mm_encryption_{sessionId}_{keyType}
const STORAGE_PREFIX = 'mm_encryption_';

function getStorageKey(sessionId: string, keyType: 'private' | 'public' | 'meta'): string {
    return `${STORAGE_PREFIX}${sessionId}_${keyType}`;
}

export async function storeKeyPair(sessionId: string, keyPair: CryptoKeyPair): Promise<void> {
    const privateKeyJwk = await exportPrivateKey(keyPair.privateKey);
    const publicKeyJwk = await exportPublicKey(keyPair.publicKey);

    // Use localStorage instead of sessionStorage
    localStorage.setItem(getStorageKey(sessionId, 'private'), privateKeyJwk);
    localStorage.setItem(getStorageKey(sessionId, 'public'), publicKeyJwk);

    // Store metadata for key management
    localStorage.setItem(getStorageKey(sessionId, 'meta'), JSON.stringify({
        createdAt: Date.now(),
        sessionId,
    }));
}

export async function getPrivateKey(sessionId: string): Promise<CryptoKey | null> {
    const privateKeyJwk = localStorage.getItem(getStorageKey(sessionId, 'private'));
    if (!privateKeyJwk) {
        return null;
    }
    return importPrivateKey(privateKeyJwk);
}
```

#### 1.3 Session Validation

```typescript
/**
 * Checks if stored keys match the current Mattermost session.
 * Returns true if we have valid keys for this session.
 */
export function hasValidKeysForSession(sessionId: string): boolean {
    const privateKey = localStorage.getItem(getStorageKey(sessionId, 'private'));
    const publicKey = localStorage.getItem(getStorageKey(sessionId, 'public'));
    return privateKey !== null && publicKey !== null;
}
```

#### 1.4 Key Cleanup on Logout

```typescript
/**
 * Clears encryption keys for a specific session.
 * Called when user logs out or session expires.
 */
export function clearEncryptionKeys(sessionId: string): void {
    localStorage.removeItem(getStorageKey(sessionId, 'private'));
    localStorage.removeItem(getStorageKey(sessionId, 'public'));
    localStorage.removeItem(getStorageKey(sessionId, 'meta'));
}

/**
 * Clears ALL encryption keys (used during full logout/clear data).
 */
export function clearAllEncryptionKeys(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
}
```

---

### Phase 2: Session Management Changes

**File: `webapp/channels/src/utils/encryption/session.ts`**

#### 2.1 Get Current Mattermost Session

```typescript
import {Client4} from 'mattermost-redux/client';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

/**
 * Gets the current Mattermost session ID.
 *
 * Strategy:
 * 1. First check if we already have a registered encryption session ID
 * 2. If not, register our public key and get the session ID from that
 *
 * The "encryption session ID" IS the Mattermost session ID - the server
 * uses the current auth session when registering encryption keys.
 */
export async function getCurrentMattermostSessionId(): Promise<string | null> {
    try {
        // Check if we already know our encryption session ID
        const storedSessionId = getStoredEncryptionSessionId();
        if (storedSessionId) {
            return storedSessionId;
        }

        // We don't have a stored session ID - need to check with server
        // This happens on first load or after browser restart
        const status = await getEncryptionStatus();
        if (status.session_id) {
            return status.session_id;
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Storage for the "known" session ID that we've confirmed with the server.
 * This lives in sessionStorage since it's just a reference, not the actual keys.
 */
function getStoredEncryptionSessionId(): string | null {
    return sessionStorage.getItem('mm_encryption_current_session_id');
}

function storeEncryptionSessionId(sessionId: string): void {
    sessionStorage.setItem('mm_encryption_current_session_id', sessionId);
}
```

#### 2.2 Modified Key Initialization

```typescript
/**
 * Ensures encryption keys are available for the current Mattermost session.
 *
 * Flow:
 * 1. Get current Mattermost session ID
 * 2. Check if we have keys stored for this session in localStorage
 * 3. If yes, verify server has our public key registered
 * 4. If no, generate new keys and register
 */
export async function ensureEncryptionKeys(): Promise<void> {
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            // Step 1: Get current session from server
            const status = await getEncryptionStatus();
            const currentSessionId = status.session_id;

            if (!currentSessionId) {
                throw new Error('Could not determine Mattermost session ID');
            }

            // Store the session ID reference
            storeEncryptionSessionId(currentSessionId);

            // Step 2: Check if we have keys for this session in localStorage
            if (hasValidKeysForSession(currentSessionId)) {
                // Keys exist locally - verify server has them
                if (status.has_key) {
                    console.log('[ensureEncryptionKeys] Restored keys for session:', currentSessionId);
                    return;
                }

                // Server doesn't have our key - re-register
                console.log('[ensureEncryptionKeys] Re-registering existing key...');
                const existingPublicKey = getPublicKeyJwk(currentSessionId);
                if (existingPublicKey) {
                    await registerPublicKey(existingPublicKey);
                    return;
                }

                // Couldn't get key, need to regenerate
                clearEncryptionKeys(currentSessionId);
            }

            // Step 3: Generate new keys for this session
            console.log('[ensureEncryptionKeys] Generating new keys for session:', currentSessionId);
            const keyPair = await generateKeyPair();
            await storeKeyPair(currentSessionId, keyPair);

            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            await registerPublicKey(publicKeyJwk);

        } finally {
            initializationPromise = null;
        }
    })();

    return initializationPromise;
}
```

---

### Phase 3: Server-Side Considerations

**File: `server/channels/api4/encryption.go`**

#### 3.1 Session ID Exposure

The server needs to return the Mattermost session ID when:
1. Checking encryption status (`GET /api/v4/encryption/status`)
2. Registering a public key (`POST /api/v4/encryption/publickey`)

**Current behavior**: Server already uses `c.AppContext.Session().Id` as the session ID.

**Verify**: The session ID returned matches the auth session that persists across browser restarts.

```go
// In getEncryptionStatus handler
func (api *API) getEncryptionStatus(c *Context, w http.ResponseWriter, r *http.Request) {
    userId := c.AppContext.Session().UserId
    sessionId := c.AppContext.Session().Id  // This IS the Mattermost login session ID

    // ... existing logic ...

    response := map[string]interface{}{
        "has_key":     hasKey,
        "session_id":  sessionId,  // Return for client storage
        "user_id":     userId,
    }
    // ...
}
```

#### 3.2 Session Cleanup Webhook

When a Mattermost session is invalidated (logout, expiry, revoked), the encryption keys should be cleaned up:

```go
// In session cleanup/logout handler
func (a *App) RevokeSession(session *model.Session) *model.AppError {
    // ... existing session revocation logic ...

    // Clean up encryption keys for this session
    if err := a.Srv().Store().EncryptionSessionKey().Delete(session.Id); err != nil {
        mlog.Warn("Failed to delete encryption key on session revoke", mlog.Err(err))
    }

    return nil
}
```

---

### Phase 4: Logout/Session Expiry Handling

#### 4.1 Logout Handler (Client)

```typescript
// In logout action or hook
export async function handleLogout(): Promise<void> {
    const sessionId = getStoredEncryptionSessionId();
    if (sessionId) {
        // Clear keys for this specific session
        clearEncryptionKeys(sessionId);
    }
    // Clear the session reference
    sessionStorage.removeItem('mm_encryption_current_session_id');

    // Clear decryption cache
    clearDecryptionCache();
}
```

#### 4.2 Session Expiry Detection (Client)

```typescript
// In API error handler or middleware
function handleApiError(error: any): void {
    if (error.status_code === 401 || error.id === 'api.context.session_expired.app_error') {
        // Session expired - clear encryption keys
        const sessionId = getStoredEncryptionSessionId();
        if (sessionId) {
            clearEncryptionKeys(sessionId);
        }
    }
}
```

---

### Phase 5: Migration from v1

Users with existing encrypted messages need a migration path.

#### 5.1 Migration Strategy

**Option A: Clean Break (Recommended for simplicity)**
- v2 keys are completely separate from v1
- Old messages encrypted with v1 keys become unreadable after browser restart
- Users are warned about this in release notes

**Option B: One-Time Migration**
- On first v2 load, check for v1 keys in `sessionStorage`
- If found, migrate them to v2 format in `localStorage`
- This only works if user hasn't closed browser since last v1 use

```typescript
// Migration helper (Option B)
function migrateFromV1(): void {
    const oldPrivateKey = sessionStorage.getItem('mm_encryption_private_key');
    const oldPublicKey = sessionStorage.getItem('mm_encryption_public_key');
    const oldSessionId = sessionStorage.getItem('mm_encryption_session_id');

    if (oldPrivateKey && oldPublicKey && oldSessionId) {
        // Migrate to v2 format
        localStorage.setItem(`mm_encryption_${oldSessionId}_private`, oldPrivateKey);
        localStorage.setItem(`mm_encryption_${oldSessionId}_public`, oldPublicKey);

        // Clear old v1 storage
        sessionStorage.removeItem('mm_encryption_private_key');
        sessionStorage.removeItem('mm_encryption_public_key');
        sessionStorage.removeItem('mm_encryption_session_id');

        console.log('[Encryption] Migrated v1 keys to v2 format');
    }
}
```

---

## Security Considerations

### 1. localStorage vs sessionStorage

| Aspect | sessionStorage (v1) | localStorage (v2) |
|--------|---------------------|-------------------|
| Persistence | Tab only | Until cleared |
| XSS Risk | Lower (shorter exposure) | Higher (persists) |
| Usability | Poor (constant key loss) | Good (keys persist) |
| Session Binding | None | Namespaced by session ID |

**Mitigation for XSS**: Keys are namespaced by session ID, so even if XSS extracts keys, they're only valid for that specific session. Session invalidation (logout) should clear server-side key registrations.

### 2. Stale Key Cleanup

Keys in localStorage could accumulate over time. Implement cleanup:

```typescript
/**
 * Removes encryption keys for sessions older than maxAge.
 * Called periodically or on app start.
 */
function cleanupStaleKeys(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.endsWith('_meta')) {
            try {
                const meta = JSON.parse(localStorage.getItem(key) || '{}');
                if (now - meta.createdAt > maxAgeMs) {
                    const sessionId = key.replace('mm_encryption_', '').replace('_meta', '');
                    keysToRemove.push(sessionId);
                }
            } catch {
                // Invalid meta, mark for cleanup
                const sessionId = key.replace('mm_encryption_', '').replace('_meta', '');
                keysToRemove.push(sessionId);
            }
        }
    }

    keysToRemove.forEach(sessionId => clearEncryptionKeys(sessionId));
}
```

### 3. Multi-Device Considerations

Each device/browser still gets its own keys:
- Device A (Chrome): Session 123 → Keys A
- Device A (Firefox): Session 456 → Keys B
- Device B (Chrome): Session 789 → Keys C

Messages are encrypted for ALL active session keys, so all devices can decrypt.

### 4. Session Hijacking

If session token is stolen:
- Attacker can use existing encryption keys
- But they can't access old messages from previous sessions
- Logout invalidates both auth session AND encryption keys

---

## Implementation Checklist

### Client-Side

- [ ] **storage.ts**: Change from `sessionStorage` to `localStorage` with session namespacing
- [ ] **storage.ts**: Add session-keyed storage functions
- [ ] **storage.ts**: Add cleanup functions for stale keys
- [ ] **session.ts**: Modify `ensureEncryptionKeys()` to use Mattermost session ID
- [ ] **session.ts**: Add `getCurrentMattermostSessionId()` function
- [ ] **session.ts**: Update logout handling to clear correct keys
- [ ] **api.ts**: Ensure session ID is returned from status endpoint
- [ ] Add v1 → v2 migration (optional)
- [ ] Add periodic stale key cleanup

### Server-Side

- [ ] **encryption.go**: Verify session ID is exposed in API responses
- [ ] **encryption.go**: Verify session ID matches auth session (not separate encryption session)
- [ ] Consider: Auto-cleanup encryption keys when session is revoked

### Testing

- [ ] Test: Close browser, reopen, verify can decrypt old messages
- [ ] Test: Logout, login, verify cannot decrypt pre-logout messages
- [ ] Test: Multiple devices, verify all can decrypt
- [ ] Test: Session expiry, verify keys cleaned up
- [ ] Test: Migration from v1 (if implemented)

---

## Rollout Plan

1. **Development**: Implement client-side changes first
2. **Testing**: Deploy to test environment, verify behavior
3. **Staging**: Test migration path with real data
4. **Documentation**: Update user docs about key persistence change
5. **Release**: Deploy with release notes explaining the change
6. **Monitoring**: Watch for key-related errors in logs

---

## Alternative Approaches Considered

### A. IndexedDB Instead of localStorage

**Pros**: More secure, can store CryptoKey objects directly
**Cons**: More complex, async API, same XSS risk

**Decision**: localStorage is simpler and sufficient for JWK strings.

### B. Server-Side Key Escrow

**Pros**: Keys backed up server-side, survive device loss
**Cons**: Defeats purpose of E2E encryption (server can decrypt)

**Decision**: Rejected - security is more important than convenience.

### C. Password-Protected Key Export

**Pros**: User can backup keys, restore on new device
**Cons**: Complex UX, users forget passwords

**Decision**: Future consideration - not blocking v2.

---

## FAQ

**Q: What happens to messages encrypted before this change?**
A: If the user's browser session is still active when they upgrade, migration can preserve keys. Otherwise, those messages become unreadable.

**Q: Can I read encrypted messages from a different computer?**
A: Yes, if you log in on that computer while your original session is still active. The message is encrypted for all active sessions.

**Q: What if my session expires while I'm offline?**
A: Keys for that session remain in localStorage. When you log in again, you get a new session with new keys. Old messages from the expired session are unreadable.

**Q: Is this less secure than v1?**
A: Slightly different tradeoffs. localStorage persists longer (higher XSS exposure window), but keys are still session-bound and cleared on logout. The practical security is similar, with much better usability.
