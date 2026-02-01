// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';
import type {FileDecryptionStatus} from 'types/store/views';
import type {EncryptedFileMetadata} from 'utils/encryption/file';

/**
 * Gets the decrypted blob URL for a file, if available.
 */
export function getDecryptedFileUrl(state: GlobalState, fileId: string): string | undefined {
    return state.views.encryption.encryptedFiles?.decryptedUrls?.[fileId];
}

/**
 * Gets the decrypted thumbnail URL for a file, if available.
 */
export function getDecryptedThumbnailUrl(state: GlobalState, fileId: string): string | undefined {
    return state.views.encryption.encryptedFiles?.thumbnailUrls?.[fileId];
}

/**
 * Gets the decryption status for a file.
 */
export function getFileDecryptionStatus(state: GlobalState, fileId: string): FileDecryptionStatus | undefined {
    return state.views.encryption.encryptedFiles?.status?.[fileId];
}

/**
 * Gets the decryption error message for a file.
 */
export function getFileDecryptionError(state: GlobalState, fileId: string): string | undefined {
    return state.views.encryption.encryptedFiles?.errors?.[fileId];
}

/**
 * Gets the encryption metadata for a file.
 */
export function getEncryptedFileMetadata(state: GlobalState, fileId: string): EncryptedFileMetadata | undefined {
    return state.views.encryption.encryptedFiles?.metadata?.[fileId];
}

/**
 * Checks if a file is currently being decrypted.
 */
export function isFileDecrypting(state: GlobalState, fileId: string): boolean {
    return state.views.encryption.encryptedFiles?.status?.[fileId] === 'decrypting';
}

/**
 * Checks if a file has been decrypted.
 */
export function isFileDecrypted(state: GlobalState, fileId: string): boolean {
    return state.views.encryption.encryptedFiles?.status?.[fileId] === 'decrypted';
}

/**
 * Checks if file decryption has failed.
 */
export function hasFileDecryptionFailed(state: GlobalState, fileId: string): boolean {
    return state.views.encryption.encryptedFiles?.status?.[fileId] === 'failed';
}

/**
 * Gets the encryption key error (used for key pair issues).
 */
export function getEncryptionKeyError(state: GlobalState): string | null {
    return state.views.encryption.keyError;
}
