"use strict";
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureEncryptionKeys = ensureEncryptionKeys;
exports.checkEncryptionStatus = checkEncryptionStatus;
exports.getCurrentPublicKey = getCurrentPublicKey;
exports.getCurrentPrivateKey = getCurrentPrivateKey;
exports.isEncryptionInitialized = isEncryptionInitialized;
exports.clearEncryptionSession = clearEncryptionSession;
exports.getChannelRecipientKeys = getChannelRecipientKeys;
exports.getChannelEncryptionInfo = getChannelEncryptionInfo;
/**
 * Session management for encryption.
 * Handles automatic key generation and registration on first encrypted send.
 */
const keypair_1 = require("./keypair");
const storage_1 = require("./storage");
const api_1 = require("./api");
const use_decrypt_post_1 = require("./use_decrypt_post");
let initializationPromise = null;
/**
 * Ensures encryption keys are available for the current session.
 * If no keys exist, generates them and registers the public key with the server.
 * This is called automatically on first encrypted message send.
 */
async function ensureEncryptionKeys() {
    // Return existing promise if initialization is in progress
    if (initializationPromise) {
        return initializationPromise;
    }
    // If keys already exist, nothing to do
    if ((0, storage_1.hasEncryptionKeys)()) {
        return Promise.resolve();
    }
    // Start initialization
    initializationPromise = (async () => {
        try {
            // Generate new key pair
            const keyPair = await (0, keypair_1.generateKeyPair)();
            // Store in sessionStorage
            await (0, storage_1.storeKeyPair)(keyPair);
            // Export and register public key with server
            const publicKeyJwk = await (0, keypair_1.exportPublicKey)(keyPair.publicKey);
            await (0, api_1.registerPublicKey)(publicKeyJwk);
        }
        finally {
            initializationPromise = null;
        }
    })();
    return initializationPromise;
}
/**
 * Gets the encryption status from the server.
 */
async function checkEncryptionStatus() {
    return (0, api_1.getEncryptionStatus)();
}
/**
 * Gets the current session's public key JWK, initializing if necessary.
 */
async function getCurrentPublicKey() {
    await ensureEncryptionKeys();
    return (0, storage_1.getPublicKeyJwk)();
}
/**
 * Gets the current session's private key for decryption.
 */
async function getCurrentPrivateKey() {
    return (0, storage_1.getPrivateKey)();
}
/**
 * Checks if the current session has encryption keys initialized.
 */
function isEncryptionInitialized() {
    return (0, storage_1.hasEncryptionKeys)();
}
/**
 * Clears encryption keys and decryption cache (called on logout).
 */
function clearEncryptionSession() {
    (0, storage_1.clearEncryptionKeys)();
    (0, use_decrypt_post_1.clearDecryptionCache)();
}
/**
 * Gets public keys for all channel members who have active encryption sessions.
 * @param channelId - The channel ID
 * @returns Map of userId -> public key JWK
 */
async function getChannelRecipientKeys(channelId) {
    const keys = await (0, api_1.getChannelMemberKeys)(channelId);
    const keyMap = {};
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
async function getChannelEncryptionInfo(channelId, currentUserId) {
    const keys = await (0, api_1.getChannelMemberKeys)(channelId);
    // Filter out current user and separate users with/without keys
    const recipients = [];
    const usersWithoutKeys = [];
    for (const key of keys) {
        if (key.user_id === currentUserId) {
            continue;
        }
        if (key.public_key) {
            recipients.push(key);
        }
        else {
            usersWithoutKeys.push(key.user_id);
        }
    }
    return { recipients, usersWithoutKeys };
}
