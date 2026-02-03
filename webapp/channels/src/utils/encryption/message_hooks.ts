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
    ensureSessionIdRestored,
} from './session';
import {getPublicKeyJwk, getSessionId} from './storage';

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

    // Get all session keys for channel members
    const sessionKeys = await getChannelRecipientKeys(post.channel_id);

    // Add sender's own session key so they can decrypt their own messages
    const senderSessionId = getSessionId();
    const senderPublicKey = getPublicKeyJwk();
    if (senderSessionId && senderPublicKey) {
        sessionKeys.push({
            userId: senderId,
            sessionId: senderSessionId,
            publicKey: senderPublicKey,
        });
    }

    if (sessionKeys.length === 0) {
        return {error: 'No recipients with encryption keys found'};
    }

    try {
        // Store original plaintext before encrypting
        const originalPlaintext = post.message;

        // Encrypt the message for all session keys
        const encryptedPayload = await encryptMessage(
            post.message,
            sessionKeys.map((k) => ({sessionId: k.sessionId, publicKey: k.publicKey})),
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
    _userId: string, // userId param kept for API compatibility but not used (we use sessionId now)
): Promise<{post: Post}> {
    // Check if this is an encrypted message
    if (!isEncryptedMessage(post.message)) {
        return {post};
    }

    // Restore session ID from server if sessionStorage was cleared.
    // This handles browser restarts where sessionStorage is lost but localStorage keys remain.
    const sessionId = await ensureSessionIdRestored();
    if (!sessionId) {
        // No valid session/keys found
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

        // Check if our session has access to decrypt
        if (!payload.keys[sessionId]) {
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

        // Decrypt the message using our session ID
        const decryptedMessage = await decryptMessage(payload, privateKey, sessionId);

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
