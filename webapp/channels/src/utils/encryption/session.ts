// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Session management for encryption.
 * Handles automatic key generation and registration on first encrypted send.
 */

import {generateKeyPair, exportPublicKey} from './keypair';
import {storeKeyPair, hasEncryptionKeys, getPublicKeyJwk, clearEncryptionKeys, getPrivateKey, storeSessionId, getSessionId} from './storage';
import {registerPublicKey, getEncryptionStatus, getChannelMemberKeys} from './api';
import type {EncryptionStatus, EncryptionPublicKey} from './api';
import {clearDecryptionCache} from './use_decrypt_post';

export {getSessionId} from './storage';

let initializationPromise: Promise<void> | null = null;

/**
 * Ensures encryption keys are available for the current session AND registered with server.
 * If no keys exist, generates them and registers the public key with the server.
 * If local keys exist but server doesn't have them, re-registers the local key.
 * This is called automatically on first encrypted message send.
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
            // Check if we have local keys
            if (hasEncryptionKeys()) {
                // Local keys exist - verify server has them too
                const status = await getEncryptionStatus();
                if (status.has_key) {
                    // Server has our key, we're good
                    return;
                }

                // Server doesn't have our key - re-register the existing local key
                console.log('[ensureEncryptionKeys] Local keys exist but server missing key, re-registering...');
                const existingPublicKey = getPublicKeyJwk();
                if (existingPublicKey) {
                    try {
                        const response = await registerPublicKey(existingPublicKey);
                        // Store the session ID for decryption lookup
                        if (response.session_id) {
                            storeSessionId(response.session_id);
                        }
                        console.log('[ensureEncryptionKeys] Re-registered existing key with server');
                        return;
                    } catch (error) {
                        console.error('[ensureEncryptionKeys] Failed to re-register key:', error);
                        // Clear local keys since they're out of sync with server
                        clearEncryptionKeys();
                        throw new Error('Failed to register encryption key with server. Please try again.');
                    }
                }

                // Couldn't get local public key, clear and regenerate
                console.log('[ensureEncryptionKeys] Could not get local public key, regenerating...');
                clearEncryptionKeys();
            }

            // Generate new key pair
            const keyPair = await generateKeyPair();

            // Store in sessionStorage
            await storeKeyPair(keyPair);

            // Export and register public key with server
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            try {
                const response = await registerPublicKey(publicKeyJwk);
                // Store the session ID for decryption lookup
                if (response.session_id) {
                    storeSessionId(response.session_id);
                }
                console.log('[ensureEncryptionKeys] Generated and registered new keypair');
            } catch (error) {
                console.error('[ensureEncryptionKeys] Failed to register new key:', error);
                // Clear local keys since registration failed
                clearEncryptionKeys();
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
 * Clears encryption keys and decryption cache (called on logout).
 */
export function clearEncryptionSession(): void {
    clearEncryptionKeys();
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
