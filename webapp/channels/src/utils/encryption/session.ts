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
 * Ensures encryption keys are available for the current session.
 * If no keys exist, generates them and registers the public key with the server.
 * This is called automatically on first encrypted message send.
 */
export async function ensureEncryptionKeys(): Promise<void> {
    // Return existing promise if initialization is in progress
    if (initializationPromise) {
        return initializationPromise;
    }

    // If keys already exist, nothing to do
    if (hasEncryptionKeys()) {
        return Promise.resolve();
    }

    // Start initialization
    initializationPromise = (async () => {
        try {
            // Generate new key pair
            const keyPair = await generateKeyPair();

            // Store in sessionStorage
            await storeKeyPair(keyPair);

            // Export and register public key with server
            const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
            await registerPublicKey(publicKeyJwk);
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
