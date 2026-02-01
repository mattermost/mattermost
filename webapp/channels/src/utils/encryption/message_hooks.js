"use strict";
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptMessageHook = encryptMessageHook;
exports.decryptMessageHook = decryptMessageHook;
exports.isEncryptionFailed = isEncryptionFailed;
exports.getPostEncryptionStatus = getPostEncryptionStatus;
const posts_1 = require("@mattermost/types/posts");
const hybrid_1 = require("./hybrid");
const session_1 = require("./session");
/**
 * Hook to encrypt a message before it's posted.
 * Called by the MessageWillBePosted hook system.
 */
async function encryptMessageHook(post, senderId) {
    // Check if this is an encrypted message
    if (post.metadata?.priority?.priority !== posts_1.PostPriority.ENCRYPTED) {
        return { post };
    }
    // Ensure we have encryption keys
    try {
        await (0, session_1.ensureEncryptionKeys)();
    }
    catch (error) {
        return { error: 'Failed to initialize encryption keys' };
    }
    // Get recipient keys for the channel
    const recipientKeys = await (0, session_1.getChannelRecipientKeys)(post.channel_id);
    // Add sender's own key so they can decrypt their own messages
    const senderPublicKey = await (0, session_1.getCurrentPublicKey)();
    if (senderPublicKey) {
        recipientKeys[senderId] = senderPublicKey;
    }
    if (Object.keys(recipientKeys).length === 0) {
        return { error: 'No recipients with encryption keys found' };
    }
    try {
        // Encrypt the message
        const encryptedPayload = await (0, hybrid_1.encryptMessage)(post.message, recipientKeys, senderId);
        // Format as encrypted message string
        const encryptedMessageString = (0, hybrid_1.formatEncryptedMessage)(encryptedPayload);
        // Return modified post with encrypted message
        return {
            post: {
                ...post,
                message: encryptedMessageString,
            },
        };
    }
    catch (error) {
        console.error('Failed to encrypt message:', error);
        return { error: 'Failed to encrypt message' };
    }
}
/**
 * Hook to decrypt a message when it's received.
 * Called by the MessageWillBeReceived hook system.
 */
async function decryptMessageHook(post, userId) {
    // Check if this is an encrypted message
    if (!(0, hybrid_1.isEncryptedMessage)(post.message)) {
        return { post };
    }
    // Check if we have decryption keys
    if (!(0, session_1.isEncryptionInitialized)()) {
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
        const privateKey = await (0, session_1.getCurrentPrivateKey)();
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
        const payload = (0, hybrid_1.parseEncryptedMessage)(post.message);
        if (!payload) {
            return { post };
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
        const decryptedMessage = await (0, hybrid_1.decryptMessage)(payload, privateKey, userId);
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
    }
    catch (error) {
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
function isEncryptionFailed(post) {
    const status = post.props?.encryption_status;
    return status === 'no_keys' || status === 'no_access' || status === 'decrypt_error';
}
/**
 * Gets the encryption status of a post.
 */
function getPostEncryptionStatus(post) {
    const status = post.props?.encryption_status;
    if (!status) {
        return 'none';
    }
    return status;
}
