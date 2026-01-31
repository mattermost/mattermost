// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Native encryption utilities for Mattermost Extended.
 * Provides end-to-end encryption using RSA-OAEP + AES-GCM hybrid encryption.
 */

// Key pair utilities
export {
    generateKeyPair,
    exportPublicKey,
    exportPrivateKey,
    importPublicKey,
    importPrivateKey,
    rsaEncrypt,
    rsaDecrypt,
} from './keypair';

// Hybrid encryption
export {
    encryptMessage,
    decryptMessage,
    parseEncryptedMessage,
    formatEncryptedMessage,
    isEncryptedMessage,
    arrayBufferToBase64,
    base64ToArrayBuffer,
} from './hybrid';
export type {EncryptedPayload} from './hybrid';

// Session storage
export {
    storeKeyPair,
    getPrivateKey,
    getPublicKey,
    getPublicKeyJwk,
    hasEncryptionKeys,
    clearEncryptionKeys,
} from './storage';

// API utilities
export {
    getEncryptionStatus,
    getMyPublicKey,
    registerPublicKey,
    getPublicKeysByUserIds,
    getChannelMemberKeys,
} from './api';
export type {EncryptionPublicKey, EncryptionStatus} from './api';

// Session management
export {
    ensureEncryptionKeys,
    checkEncryptionStatus,
    getCurrentPublicKey,
    getCurrentPrivateKey,
    isEncryptionInitialized,
    clearEncryptionSession,
    getChannelRecipientKeys,
    getChannelEncryptionInfo,
} from './session';

// Message hooks
export {
    encryptMessageHook,
    decryptMessageHook,
    isEncryptionFailed,
    getPostEncryptionStatus,
} from './message_hooks';
