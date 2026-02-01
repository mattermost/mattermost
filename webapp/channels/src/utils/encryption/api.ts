// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * API utilities for encryption key management.
 */

import {Client4} from 'mattermost-redux/client';

export interface EncryptionPublicKey {
    user_id: string;
    session_id?: string; // Session this key belongs to (for per-session keys)
    public_key: string;
    create_at?: number;
    update_at?: number;
}

export interface EncryptionStatus {
    enabled: boolean;
    can_encrypt: boolean;
    has_key: boolean;
}

/**
 * Gets the encryption status for the current user.
 */
export async function getEncryptionStatus(): Promise<EncryptionStatus> {
    return Client4.doFetch<EncryptionStatus>(
        `${Client4.getBaseRoute()}/encryption/status`,
        {method: 'get'},
    );
}

/**
 * Gets the current user's public encryption key.
 */
export async function getMyPublicKey(): Promise<EncryptionPublicKey> {
    return Client4.doFetch<EncryptionPublicKey>(
        `${Client4.getBaseRoute()}/encryption/publickey`,
        {method: 'get'},
    );
}

/**
 * Registers or updates the current user's public encryption key.
 * @param publicKey - The public key in JWK format
 */
export async function registerPublicKey(publicKey: string): Promise<EncryptionPublicKey> {
    return Client4.doFetch<EncryptionPublicKey>(
        `${Client4.getBaseRoute()}/encryption/publickey`,
        {
            method: 'post',
            body: JSON.stringify({public_key: publicKey}),
        },
    );
}

/**
 * Gets public keys for multiple users.
 * @param userIds - Array of user IDs
 */
export async function getPublicKeysByUserIds(userIds: string[]): Promise<EncryptionPublicKey[]> {
    return Client4.doFetch<EncryptionPublicKey[]>(
        `${Client4.getBaseRoute()}/encryption/publickeys`,
        {
            method: 'post',
            body: JSON.stringify({user_ids: userIds}),
        },
    );
}

/**
 * Gets public keys for all members of a channel.
 * @param channelId - The channel ID
 */
export async function getChannelMemberKeys(channelId: string): Promise<EncryptionPublicKey[]> {
    return Client4.doFetch<EncryptionPublicKey[]>(
        `${Client4.getBaseRoute()}/encryption/channel/${channelId}/keys`,
        {method: 'get'},
    );
}
