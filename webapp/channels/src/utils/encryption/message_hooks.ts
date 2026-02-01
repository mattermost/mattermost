// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Encryption hooks for message sending and receiving.
 * These integrate with Mattermost's plugin hook system.
 */

import type {Post} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import {
    encryptMessage,
    decryptMessage,
    formatEncryptedMessage,
    parseEncryptedMessage,
    isEncryptedMessage,
} from './hybrid';
import {
    ensureEncryptionKeys,
    getChannelRecipientKeys,
    getCurrentPrivateKey,
    getCurrentPublicKey,
    isEncryptionInitialized,
} from './session';

/**
 * Cache for recently sent messages.
 * Maps encrypted message string -> original plaintext.
 * This allows instant display of our own messages without async decryption.
 */
const sentMessageCache = new Map<string, string>();
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 60000; // 1 minute

interface CacheEntry {
    plaintext: string;
    timestamp: number;
}

const sentMessageCacheWithTTL = new Map<string, CacheEntry>();

function addToSentCache(encryptedMessage: string, plaintext: string): void {
    // Clean old entries
    const now = Date.now();
    for (const [key, entry] of sentMessageCacheWithTTL.entries()) {
        if (now - entry.timestamp > CACHE_TTL_MS) {
            sentMessageCacheWithTTL.delete(key);
        }
    }

    // Limit cache size
    if (sentMessageCacheWithTTL.size >= CACHE_MAX_SIZE) {
        const firstKey = sentMessageCacheWithTTL.keys().next().value;
        if (firstKey) {
            sentMessageCacheWithTTL.delete(firstKey);
        }
    }

    sentMessageCacheWithTTL.set(encryptedMessage, {plaintext, timestamp: now});
}

/**
 * Get cached plaintext for an encrypted message we sent.
 * Returns null if not in cache.
 */
export function getCachedPlaintext(encryptedMessage: string): string | null {
    const entry = sentMessageCacheWithTTL.get(encryptedMessage);
    if (!entry) {
        console.log('[getCachedPlaintext] Cache miss, cache size:', sentMessageCacheWithTTL.size, 'message length:', encryptedMessage.length);
        return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        sentMessageCacheWithTTL.delete(encryptedMessage);
        console.log('[getCachedPlaintext] Cache entry expired');
        return null;
    }

    console.log('[getCachedPlaintext] Cache HIT!');
    return entry.plaintext;
}

/**
 * Hook to encrypt a message before it's posted.
 * Called by the MessageWillBePosted hook system.
 */
export async function encryptMessageHook(
    post: Post,
    senderId: string,
): Promise<{post: Post} | {error: string}> {
    // Check if this is an encrypted message
    if (post.metadata?.priority?.priority !== PostPriority.ENCRYPTED) {
        return {post};
    }

    // Ensure we have encryption keys
    try {
        await ensureEncryptionKeys();
    } catch (error) {
        return {error: 'Failed to initialize encryption keys'};
    }

    // Get recipient keys for the channel
    const recipientKeys = await getChannelRecipientKeys(post.channel_id);

    // Add sender's own key so they can decrypt their own messages
    const senderPublicKey = await getCurrentPublicKey();
    if (senderPublicKey) {
        recipientKeys[senderId] = senderPublicKey;
    }

    if (Object.keys(recipientKeys).length === 0) {
        return {error: 'No recipients with encryption keys found'};
    }

    try {
        // Store original plaintext before encrypting
        const originalPlaintext = post.message;

        // Encrypt the message
        const encryptedPayload = await encryptMessage(
            post.message,
            recipientKeys,
            senderId,
        );

        // Format as encrypted message string
        const encryptedMessageString = formatEncryptedMessage(encryptedPayload);

        // Cache the plaintext so we can instantly display our own message
        // without waiting for async decryption when it comes back from server
        console.log('[encryptMessageHook] Caching plaintext for encrypted message, length:', encryptedMessageString.length);
        addToSentCache(encryptedMessageString, originalPlaintext);

        // Return modified post with encrypted message
        return {
            post: {
                ...post,
                message: encryptedMessageString,
            },
        };
    } catch (error) {
        console.error('Failed to encrypt message:', error);
        return {error: 'Failed to encrypt message'};
    }
}

/**
 * Hook to decrypt a message when it's received.
 * Called by the MessageWillBeReceived hook system.
 */
export async function decryptMessageHook(
    post: Post,
    userId: string,
): Promise<{post: Post}> {
    // Check if this is an encrypted message
    if (!isEncryptedMessage(post.message)) {
        return {post};
    }

    // Check if we have decryption keys
    if (!isEncryptionInitialized()) {
        // User doesn't have keys, return post with placeholder indicator
        return {
            post: {
                ...post,
                // Keep the encrypted message but add metadata to indicate decryption failed
                props: {
                    ...post.props,
                    encryption_status: 'no_keys',
                },
            },
        };
    }

    try {
        const privateKey = await getCurrentPrivateKey();
        if (!privateKey) {
            return {
                post: {
                    ...post,
                    props: {
                        ...post.props,
                        encryption_status: 'no_keys',
                    },
                },
            };
        }

        const payload = parseEncryptedMessage(post.message);
        if (!payload) {
            return {post};
        }

        // Check if user has access to decrypt
        if (!payload.keys[userId]) {
            return {
                post: {
                    ...post,
                    props: {
                        ...post.props,
                        encryption_status: 'no_access',
                    },
                },
            };
        }

        // Decrypt the message
        const decryptedMessage = await decryptMessage(payload, privateKey, userId);

        return {
            post: {
                ...post,
                message: decryptedMessage,
                props: {
                    ...post.props,
                    encryption_status: 'decrypted',
                    encrypted_by: payload.sender,
                },
            },
        };
    } catch (error) {
        console.error('Failed to decrypt message:', error);
        return {
            post: {
                ...post,
                props: {
                    ...post.props,
                    encryption_status: 'decrypt_error',
                },
            },
        };
    }
}

/**
 * Checks if a post's encryption could not be decrypted.
 */
export function isEncryptionFailed(post: Post): boolean {
    const status = post.props?.encryption_status;
    return status === 'no_keys' || status === 'no_access' || status === 'decrypt_error';
}

/**
 * Gets the encryption status of a post.
 */
export function getPostEncryptionStatus(post: Post): 'none' | 'decrypted' | 'no_keys' | 'no_access' | 'decrypt_error' {
    const status = post.props?.encryption_status;
    if (!status) {
        return 'none';
    }
    return status as 'decrypted' | 'no_keys' | 'no_access' | 'decrypt_error';
}
