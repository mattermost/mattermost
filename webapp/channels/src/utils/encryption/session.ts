// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Encryption v2: Session management for login session-based encryption.
 *
 * Key changes from v1:
 * - Keys are stored in localStorage, keyed by Mattermost session ID
 * - Keys persist across browser restarts as long as login session is valid
 * - Migration from v1 format happens automatically on first load
 */

import {generateKeyPair, exportPublicKey} from './keypair';
import {
    storeKeyPair,
    hasEncryptionKeys,
    getPublicKeyJwk,
    clearEncryptionKeys,
    clearAllEncryptionKeys,
    getPrivateKey,
    storeSessionId,
    getSessionId,
    migrateFromV1,
    cleanupStaleKeys,
} from './storage';
import {registerPublicKey, getEncryptionStatus, getChannelMemberKeys} from './api';
import type {EncryptionStatus, EncryptionPublicKey} from './api';
import {clearDecryptionCache} from './use_decrypt_post';

export {getSessionId} from './storage';

let initializationPromise: Promise<void> | null = null;
let migrationAttempted = false;

/**
 * Ensures encryption keys are available for the current Mattermost session.
 *
 * v2 Flow:
 * 1. Run v1 migration if needed (one-time, preserves keys from sessionStorage)
 * 2. Clean up stale keys from old sessions
 * 3. Get current Mattermost session ID from server
 * 4. Check if we have keys in localStorage for this session
 * 5. If yes and server has them too → done
 * 6. If yes but server doesn't → re-register
 * 7. If no → generate new keys
 *
 * @throws Error if key registration fails - caller should handle and notify user
 */
export async function ensureEncryptionKeys(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (initializationPromise) {
        return initializationPromise;
    }

    // Start initialization
    initializationPromise = (async () => {
        try {
            // Step 1: Run v1 migration (one-time)
            if (!migrationAttempted) {
                migrationAttempted = true;
                const migrated = migrateFromV1();
                if (migrated) {
                    console.log('[ensureEncryptionKeys] Migrated keys from v1 format');
                }

                // Clean up stale keys from old sessions
                cleanupStaleKeys();
            }

            // Step 2: Get current session info from server
            const status = await getEncryptionStatus();
            const currentSessionId = status.session_id;

            if (!currentSessionId) {
                throw new Error('Could not determine Mattermost session ID');
            }

            // Store the session ID reference for quick lookup
            storeSessionId(currentSessionId);

            // Step 3: Check if we have keys for this session in localStorage
            if (hasEncryptionKeys(currentSessionId)) {
                // Keys exist locally - verify server has them too
                if (status.has_key) {
                    console.log('[ensureEncryptionKeys] Restored existing keys for session:', currentSessionId);
                    return;
                }

                // Server doesn't have our key - re-register the existing local key
                console.log('[ensureEncryptionKeys] Local keys exist but server missing key, re-registering...');
                const existingPublicKey = getPublicKeyJwk(currentSessionId);
                if (existingPublicKey) {
                    try {
                        await registerPublicKey(existingPublicKey);
                        console.log('[ensureEncryptionKeys] Re-registered existing key with server');
                        return;
                    } catch (error) {
                        console.error('[ensureEncryptionKeys] Failed to re-register key:', error);
                        // Clear local keys since they're out of sync with server
                        clearEncryptionKeys(currentSessionId);
                        throw new Error('Failed to register encryption key with server. Please try again.');
                    }
                }

                // Couldn't get local public key, clear and regenerate
                console.log('[ensureEncryptionKeys] Could not get local public key, regenerating...');
                clearEncryptionKeys(currentSessionId);
            }

            // Step 4: Generate new key pair for this session
            console.log('[ensureEncryptionKeys] Generating new keys for session:', currentSessionId);
            const keyPair = await generateKeyPair();

            // Store in localStorage (keyed by session ID)
            await storeKeyPair(currentSessionId, keyPair);

            // Register public key with server
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            try {
                await registerPublicKey(publicKeyJwk);
                console.log('[ensureEncryptionKeys] Generated and registered new keypair');
            } catch (error) {
                console.error('[ensureEncryptionKeys] Failed to register new key:', error);
                // Clear local keys since registration failed
                clearEncryptionKeys(currentSessionId);
                throw new Error('Failed to register encryption key with server. Please try again.');
            }
        } finally {
            initializationPromise = null;
        }
    })();

    return initializationPromise;
}

/**
 * Gets the encryption status from the server.
 */
export async function checkEncryptionStatus(): Promise<EncryptionStatus> {
    return getEncryptionStatus();
}

/**
 * Gets the current session's public key JWK, initializing if necessary.
 */
export async function getCurrentPublicKey(): Promise<string | null> {
    await ensureEncryptionKeys();
    return getPublicKeyJwk();
}

/**
 * Gets the current session's private key for decryption.
 */
export async function getCurrentPrivateKey(): Promise<CryptoKey | null> {
    return getPrivateKey();
}

/**
 * Checks if the current session has encryption keys initialized.
 */
export function isEncryptionInitialized(): boolean {
    return hasEncryptionKeys();
}

/**
 * Clears encryption keys and decryption cache for the current session.
 * Called on logout.
 */
export function clearEncryptionSession(): void {
    clearEncryptionKeys();
    clearDecryptionCache();
}

/**
 * Clears ALL encryption keys and decryption cache.
 * Called on full logout or data clear.
 */
export function clearAllEncryptionData(): void {
    clearAllEncryptionKeys();
    clearDecryptionCache();
}

/**
 * Session key info for encryption - includes session ID for multi-device support.
 */
export interface SessionKeyInfo {
    userId: string;
    sessionId: string;
    publicKey: string;
}

/**
 * Gets ALL public keys for all channel members who have active encryption sessions.
 * Each user can have multiple keys (one per active session/device).
 * @param channelId - The channel ID
 * @returns Array of session keys (may have multiple entries per user)
 */
export async function getChannelRecipientKeys(channelId: string): Promise<SessionKeyInfo[]> {
    const keys = await getChannelMemberKeys(channelId);
    const sessionKeys: SessionKeyInfo[] = [];

    for (const key of keys) {
        if (key.public_key && key.session_id) {
            sessionKeys.push({
                userId: key.user_id,
                sessionId: key.session_id,
                publicKey: key.public_key,
            });
        }
    }

    return sessionKeys;
}

/**
 * Gets information about which channel members can receive encrypted messages.
 * Returns UNIQUE users (deduplicated) for display purposes.
 * @param channelId - The channel ID
 * @param currentUserId - The current user's ID (to exclude from list)
 * @returns Object with unique recipients and users without keys
 */
export async function getChannelEncryptionInfo(
    channelId: string,
    currentUserId: string,
): Promise<{
    recipients: EncryptionPublicKey[];
    usersWithoutKeys: string[];
}> {
    const keys = await getChannelMemberKeys(channelId);

    // Track unique users with keys
    const usersWithKeysSet = new Set<string>();
    const uniqueRecipients: EncryptionPublicKey[] = [];

    for (const key of keys) {
        if (key.user_id === currentUserId) {
            continue;
        }
        if (key.public_key) {
            // Only add each user once (they may have multiple session keys)
            if (!usersWithKeysSet.has(key.user_id)) {
                usersWithKeysSet.add(key.user_id);
                uniqueRecipients.push(key);
            }
        }
    }

    // Note: usersWithoutKeys is harder to determine now since the API only returns
    // users who HAVE keys. We'd need a separate call to get channel members.
    // For now, return empty array - the warning about missing users won't show.
    // TODO: Implement proper user enumeration if needed.
    const usersWithoutKeys: string[] = [];

    return {recipients: uniqueRecipients, usersWithoutKeys};
}
