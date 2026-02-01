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
export type {EncryptedPayload, SessionKey} from './hybrid';

// Session storage
export {
    storeKeyPair,
    getPrivateKey,
    getPublicKey,
    getPublicKeyJwk,
    hasEncryptionKeys,
    clearEncryptionKeys,
    storeSessionId,
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
    getSessionId,
} from './session';
export type {SessionKeyInfo} from './session';

// Message hooks
export {
    encryptMessageHook,
    decryptMessageHook,
    isEncryptionFailed,
    getPostEncryptionStatus,
    getCachedPlaintext,
} from './message_hooks';

// Decryption hook for components
export {
    useDecryptPost,
    clearDecryptionCache,
} from './use_decrypt_post';

// Bulk decryption for API responses
export {
    decryptPostsInList,
    decryptPost,
} from './decrypt_posts';

// File encryption
export {
    encryptFile,
    decryptFile,
    isEncryptedFile,
    getEncryptedFileMetadata,
    createEncryptedFilesProps,
    fetchAndDecryptFile,
    createFileFromDecryptedBlob,
    generateThumbnail,
    ENCRYPTED_FILE_MIME_TYPE,
} from './file';
export type {EncryptedFileMetadata, EncryptedFileResult} from './file';

// File encryption hooks
export {
    encryptFileForChannel,
    attachFileEncryptionMetadata,
    cacheFileEncryptionMetadata,
    cacheFileEncryptionMetadataByClientId,
    mapClientIdToFileId,
    getCachedFileMetadata,
    clearCachedFileMetadata,
    hasEncryptedFiles,
    getEncryptedFileCount,
} from './file_hooks';
