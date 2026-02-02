// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Encryption v2: Login session-based key storage.
 *
 * Keys are stored in localStorage, namespaced by Mattermost session ID.
 * This allows keys to persist across browser restarts as long as the
 * user's login session is valid.
 *
 * Storage structure:
 * - localStorage: `mm_encryption_{sessionId}_private` - Private key JWK
 * - localStorage: `mm_encryption_{sessionId}_public` - Public key JWK
 * - localStorage: `mm_encryption_{sessionId}_meta` - Key metadata (created timestamp)
 * - sessionStorage: `mm_encryption_current_session_id` - Reference to current session (fast lookup)
 */

import {importPrivateKey, importPublicKey, exportPrivateKey, exportPublicKey} from './keypair';

// Storage key prefix for localStorage
const STORAGE_PREFIX = 'mm_encryption_';

// Session reference key for sessionStorage (just stores which session we're in)
const CURRENT_SESSION_KEY = 'mm_encryption_current_session_id';

// v1 storage keys (for migration)
const V1_PRIVATE_KEY = 'mm_encryption_private_key';
const V1_PUBLIC_KEY = 'mm_encryption_public_key';
const V1_SESSION_ID = 'mm_encryption_session_id';

// Max age for stale key cleanup (30 days in ms)
const STALE_KEY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Gets the localStorage key for a given session and key type.
 */
function getStorageKey(sessionId: string, keyType: 'private' | 'public' | 'meta'): string {
    return `${STORAGE_PREFIX}${sessionId}_${keyType}`;
}

// ============================================================================
// Current Session Reference (sessionStorage - for quick lookup)
// ============================================================================

/**
 * Stores the current session ID reference.
 * This is stored in sessionStorage for quick lookup without API calls.
 * The actual keys are in localStorage keyed by this session ID.
 */
export function storeSessionId(sessionId: string): void {
    sessionStorage.setItem(CURRENT_SESSION_KEY, sessionId);
}

/**
 * Retrieves the current session ID.
 * Returns null if no session has been established.
 */
export function getSessionId(): string | null {
    return sessionStorage.getItem(CURRENT_SESSION_KEY);
}

// ============================================================================
// Key Storage (localStorage - persists across browser restarts)
// ============================================================================

/**
 * Stores the key pair in localStorage, keyed by session ID.
 * @param sessionId - The Mattermost session ID
 * @param keyPair - The CryptoKeyPair to store
 */
export async function storeKeyPair(sessionId: string, keyPair: CryptoKeyPair): Promise<void> {
    const privateKeyJwk = await exportPrivateKey(keyPair.privateKey);
    const publicKeyJwk = await exportPublicKey(keyPair.publicKey);

    localStorage.setItem(getStorageKey(sessionId, 'private'), privateKeyJwk);
    localStorage.setItem(getStorageKey(sessionId, 'public'), publicKeyJwk);
    localStorage.setItem(getStorageKey(sessionId, 'meta'), JSON.stringify({
        createdAt: Date.now(),
        sessionId,
    }));

    // Also store the session ID reference
    storeSessionId(sessionId);
}

/**
 * Retrieves the private key from localStorage for a given session.
 * If no sessionId provided, uses the current session.
 * @param sessionId - Optional session ID (defaults to current session)
 * @returns The private CryptoKey or null if not found
 */
export async function getPrivateKey(sessionId?: string): Promise<CryptoKey | null> {
    const sid = sessionId || getSessionId();
    if (!sid) {
        return null;
    }

    const privateKeyJwk = localStorage.getItem(getStorageKey(sid, 'private'));
    if (!privateKeyJwk) {
        return null;
    }

    try {
        return await importPrivateKey(privateKeyJwk);
    } catch {
        return null;
    }
}

/**
 * Retrieves the public key from localStorage for a given session.
 * If no sessionId provided, uses the current session.
 * @param sessionId - Optional session ID (defaults to current session)
 * @returns The public CryptoKey or null if not found
 */
export async function getPublicKey(sessionId?: string): Promise<CryptoKey | null> {
    const sid = sessionId || getSessionId();
    if (!sid) {
        return null;
    }

    const publicKeyJwk = localStorage.getItem(getStorageKey(sid, 'public'));
    if (!publicKeyJwk) {
        return null;
    }

    try {
        return await importPublicKey(publicKeyJwk);
    } catch {
        return null;
    }
}

/**
 * Retrieves the public key JWK string from localStorage.
 * If no sessionId provided, uses the current session.
 * @param sessionId - Optional session ID (defaults to current session)
 * @returns The JWK string or null if not found
 */
export function getPublicKeyJwk(sessionId?: string): string | null {
    const sid = sessionId || getSessionId();
    if (!sid) {
        return null;
    }
    return localStorage.getItem(getStorageKey(sid, 'public'));
}

/**
 * Checks if encryption keys are available for a given session.
 * If no sessionId provided, uses the current session.
 * @param sessionId - Optional session ID (defaults to current session)
 * @returns True if keys are available
 */
export function hasEncryptionKeys(sessionId?: string): boolean {
    const sid = sessionId || getSessionId();
    if (!sid) {
        return false;
    }
    return localStorage.getItem(getStorageKey(sid, 'private')) !== null &&
           localStorage.getItem(getStorageKey(sid, 'public')) !== null;
}

/**
 * Clears encryption keys for a specific session.
 * @param sessionId - The session ID to clear keys for
 */
export function clearEncryptionKeys(sessionId?: string): void {
    const sid = sessionId || getSessionId();
    if (!sid) {
        return;
    }

    localStorage.removeItem(getStorageKey(sid, 'private'));
    localStorage.removeItem(getStorageKey(sid, 'public'));
    localStorage.removeItem(getStorageKey(sid, 'meta'));

    // If clearing current session, also clear the reference
    if (sid === getSessionId()) {
        sessionStorage.removeItem(CURRENT_SESSION_KEY);
    }
}

/**
 * Clears ALL encryption keys from localStorage.
 * Used during full logout or data clear.
 */
export function clearAllEncryptionKeys(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem(CURRENT_SESSION_KEY);
}

// ============================================================================
// Migration from v1 (sessionStorage-based keys)
// ============================================================================

/**
 * Migrates v1 encryption keys from sessionStorage to v2 localStorage format.
 * This is a one-time migration that runs on app load if v1 keys are detected.
 * @returns true if migration occurred, false if no v1 keys found
 */
export function migrateFromV1(): boolean {
    const oldPrivateKey = sessionStorage.getItem(V1_PRIVATE_KEY);
    const oldPublicKey = sessionStorage.getItem(V1_PUBLIC_KEY);
    const oldSessionId = sessionStorage.getItem(V1_SESSION_ID);

    if (!oldPrivateKey || !oldPublicKey || !oldSessionId) {
        return false;
    }

    console.log('[Encryption] Migrating v1 keys to v2 format for session:', oldSessionId);

    // Copy to v2 format in localStorage
    localStorage.setItem(getStorageKey(oldSessionId, 'private'), oldPrivateKey);
    localStorage.setItem(getStorageKey(oldSessionId, 'public'), oldPublicKey);
    localStorage.setItem(getStorageKey(oldSessionId, 'meta'), JSON.stringify({
        createdAt: Date.now(),
        sessionId: oldSessionId,
        migratedFromV1: true,
    }));

    // Store session reference
    storeSessionId(oldSessionId);

    // Clear v1 storage
    sessionStorage.removeItem(V1_PRIVATE_KEY);
    sessionStorage.removeItem(V1_PUBLIC_KEY);
    sessionStorage.removeItem(V1_SESSION_ID);

    console.log('[Encryption] Migration complete');
    return true;
}

// ============================================================================
// Stale Key Cleanup
// ============================================================================

interface KeyMetadata {
    createdAt: number;
    sessionId: string;
    migratedFromV1?: boolean;
}

/**
 * Removes encryption keys for sessions older than maxAge.
 * This prevents localStorage from accumulating stale keys over time.
 * @param maxAgeMs - Maximum age in milliseconds (default: 30 days)
 */
export function cleanupStaleKeys(maxAgeMs: number = STALE_KEY_MAX_AGE_MS): void {
    const now = Date.now();
    const currentSessionId = getSessionId();
    const sessionsToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX) && key.endsWith('_meta')) {
            try {
                const metaJson = localStorage.getItem(key);
                if (!metaJson) {
                    continue;
                }

                const meta: KeyMetadata = JSON.parse(metaJson);

                // Don't remove current session's keys
                if (meta.sessionId === currentSessionId) {
                    continue;
                }

                // Remove if older than maxAge
                if (now - meta.createdAt > maxAgeMs) {
                    sessionsToRemove.push(meta.sessionId);
                }
            } catch {
                // Invalid metadata, extract session ID from key and mark for cleanup
                const match = key.match(/^mm_encryption_(.+)_meta$/);
                if (match && match[1] !== currentSessionId) {
                    sessionsToRemove.push(match[1]);
                }
            }
        }
    }

    if (sessionsToRemove.length > 0) {
        console.log('[Encryption] Cleaning up stale keys for sessions:', sessionsToRemove);
        sessionsToRemove.forEach((sessionId) => {
            localStorage.removeItem(getStorageKey(sessionId, 'private'));
            localStorage.removeItem(getStorageKey(sessionId, 'public'));
            localStorage.removeItem(getStorageKey(sessionId, 'meta'));
        });
    }
}

/**
 * Gets all stored encryption session IDs.
 * Useful for debugging.
 */
export function getAllStoredSessionIds(): string[] {
    const sessionIds: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX) && key.endsWith('_meta')) {
            const match = key.match(/^mm_encryption_(.+)_meta$/);
            if (match) {
                sessionIds.push(match[1]);
            }
        }
    }
    return sessionIds;
}
