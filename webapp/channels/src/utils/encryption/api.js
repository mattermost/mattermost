"use strict";
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEncryptionStatus = getEncryptionStatus;
exports.getMyPublicKey = getMyPublicKey;
exports.registerPublicKey = registerPublicKey;
exports.getPublicKeysByUserIds = getPublicKeysByUserIds;
exports.getChannelMemberKeys = getChannelMemberKeys;
/**
 * API utilities for encryption key management.
 */
const client_1 = require("mattermost-redux/client");
/**
 * Gets the encryption status for the current user.
 */
async function getEncryptionStatus() {
    return client_1.Client4.doFetch(`${client_1.Client4.getBaseRoute()}/encryption/status`, { method: 'get' });
}
/**
 * Gets the current user's public encryption key.
 */
async function getMyPublicKey() {
    return client_1.Client4.doFetch(`${client_1.Client4.getBaseRoute()}/encryption/publickey`, { method: 'get' });
}
/**
 * Registers or updates the current user's public encryption key.
 * @param publicKey - The public key in JWK format
 */
async function registerPublicKey(publicKey) {
    return client_1.Client4.doFetch(`${client_1.Client4.getBaseRoute()}/encryption/publickey`, {
        method: 'post',
        body: JSON.stringify({ public_key: publicKey }),
    });
}
/**
 * Gets public keys for multiple users.
 * @param userIds - Array of user IDs
 */
async function getPublicKeysByUserIds(userIds) {
    return client_1.Client4.doFetch(`${client_1.Client4.getBaseRoute()}/encryption/publickeys`, {
        method: 'post',
        body: JSON.stringify({ user_ids: userIds }),
    });
}
/**
 * Gets public keys for all members of a channel.
 * @param channelId - The channel ID
 */
async function getChannelMemberKeys(channelId) {
    return client_1.Client4.doFetch(`${client_1.Client4.getBaseRoute()}/encryption/channel/${channelId}/keys`, { method: 'get' });
}
