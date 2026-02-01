// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Session management for encryption.
 * Handles automatic key generation and registration on first encrypted send.
 */

import {generateKeyPair, exportPublicKey} from './keypair';
import {storeKeyPair, hasEncryptionKeys, getPublicKeyJwk, clearEncryptionKeys, getPrivateKey} from './storage';
import {registerPublicKey, getEncryptionStatus, getChannelMemberKeys} from './api';
import type {EncryptionStatus, EncryptionPublicKey} from './api';
import {clearDecryptionCache} from './use_decrypt_post';

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
                        await registerPublicKey(existingPublicKey);
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
                await registerPublicKey(publicKeyJwk);
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
 * Gets public keys for all channel members who have active encryption sessions.
 * @param channelId - The channel ID
 * @returns Map of userId -> public key JWK
 */
export async function getChannelRecipientKeys(channelId: string): Promise<Record<string, string>> {
    const keys = await getChannelMemberKeys(channelId);
    const keyMap: Record<string, string> = {};

    for (const key of keys) {
        if (key.public_key) {
            keyMap[key.user_id] = key.public_key;
        }
    }

    return keyMap;
}

/**
 * Gets information about which channel members can receive encrypted messages.
 * @param channelId - The channel ID
 * @param currentUserId - The current user's ID (to exclude from list)
 * @returns Object with recipients array and users without keys
 */
export async function getChannelEncryptionInfo(
    channelId: string,
    currentUserId: string,
): Promise<{
    recipients: EncryptionPublicKey[];
    usersWithoutKeys: string[];
}> {
    const keys = await getChannelMemberKeys(channelId);

    // Filter out current user and separate users with/without keys
    const recipients: EncryptionPublicKey[] = [];
    const usersWithoutKeys: string[] = [];

    for (const key of keys) {
        if (key.user_id === currentUserId) {
            continue;
        }
        if (key.public_key) {
            recipients.push(key);
        } else {
            usersWithoutKeys.push(key.user_id);
        }
    }

    return {recipients, usersWithoutKeys};
}
