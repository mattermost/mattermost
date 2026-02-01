// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

import {ActionTypes} from 'utils/constants';
import {
    fetchAndDecryptFile,
    generateThumbnail,
    getEncryptedFileMetadata as getMetadataFromProps,
    isEncryptedFile,
} from 'utils/encryption/file';
import type {EncryptedFileMetadata, OriginalFileInfo} from 'utils/encryption/file';
import {getCurrentPrivateKey, getSessionId} from 'utils/encryption/session';

import type {ThunkActionFunc} from 'types/store';

import {
    getDecryptedFileUrl,
    getFileDecryptionStatus,
    getEncryptedFileMetadata,
} from 'selectors/views/encrypted_files';

import {getFile} from 'mattermost-redux/selectors/entities/files';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

// Key error actions
export function setEncryptionKeyError(error: string) {
    return {
        type: ActionTypes.ENCRYPTION_KEY_ERROR,
        error,
    };
}

export function clearEncryptionKeyError() {
    return {
        type: ActionTypes.ENCRYPTION_KEY_ERROR_CLEAR,
    };
}

// Encrypted file metadata action
export function encryptedFileMetadataReceived(fileId: string, metadata: EncryptedFileMetadata) {
    return {
        type: ActionTypes.ENCRYPTED_FILE_METADATA_RECEIVED,
        fileId,
        metadata,
    };
}

// Decryption actions
export function encryptedFileDecryptionStarted(fileId: string) {
    return {
        type: ActionTypes.ENCRYPTED_FILE_DECRYPTION_STARTED,
        fileId,
    };
}

export function encryptedFileDecrypted(fileId: string, blobUrl: string) {
    return {
        type: ActionTypes.ENCRYPTED_FILE_DECRYPTED,
        fileId,
        blobUrl,
    };
}

export function encryptedFileDecryptionFailed(fileId: string, error: string) {
    return {
        type: ActionTypes.ENCRYPTED_FILE_DECRYPTION_FAILED,
        fileId,
        error,
    };
}

export function encryptedFileThumbnailGenerated(fileId: string, thumbnailUrl: string) {
    return {
        type: ActionTypes.ENCRYPTED_FILE_THUMBNAIL_GENERATED,
        fileId,
        thumbnailUrl,
    };
}

export function encryptedFileOriginalInfoReceived(fileId: string, originalInfo: OriginalFileInfo) {
    return {
        type: ActionTypes.ENCRYPTED_FILE_ORIGINAL_INFO_RECEIVED,
        fileId,
        originalInfo,
    };
}

export function encryptedFileCleanup(fileIds: string[]) {
    return {
        type: ActionTypes.ENCRYPTED_FILE_CLEANUP,
        fileIds,
    };
}

/**
 * Decrypts a file and stores the blob URL in Redux.
 * This is called when a component needs to display an encrypted file.
 */
export function decryptEncryptedFile(fileId: string, postId?: string): ThunkActionFunc<Promise<string | null>> {
    return async (dispatch, getState) => {
        const state = getState();

        // Check if already decrypted
        const existingUrl = getDecryptedFileUrl(state, fileId);
        if (existingUrl) {
            return existingUrl;
        }

        // Check if already decrypting
        const status = getFileDecryptionStatus(state, fileId);
        if (status === 'decrypting') {
            // Wait for existing decryption to complete
            return null;
        }

        // Get file info
        const fileInfo = getFile(state, fileId);
        if (!fileInfo) {
            console.error('[decryptEncryptedFile] File info not found:', fileId);
            dispatch(encryptedFileDecryptionFailed(fileId, 'File info not found'));
            return null;
        }

        // Get encryption metadata first - it's the most reliable indicator
        let metadata = getEncryptedFileMetadata(state, fileId);

        // If metadata not in state, try to get from post props
        if (!metadata && postId) {
            const post = getPost(state, postId);
            if (post?.props) {
                metadata = getMetadataFromProps(post.props as Record<string, unknown>, fileId) || undefined;
                if (metadata) {
                    dispatch(encryptedFileMetadataReceived(fileId, metadata));
                }
            }
        }

        // Check if file is actually encrypted using multiple indicators:
        // 1. MIME type is application/x-penc
        // 2. Has encryption metadata in Redux
        // 3. Filename matches encrypted pattern
        const isEncryptedByMime = isEncryptedFile(fileInfo);
        const hasEncryptionMetadata = metadata !== undefined && metadata !== null;
        const isEncryptedByName = Boolean(fileInfo?.name?.startsWith('encrypted_') && fileInfo?.name?.endsWith('.penc'));
        const isEncrypted = isEncryptedByMime || hasEncryptionMetadata || isEncryptedByName;

        if (!isEncrypted) {
            console.log('[decryptEncryptedFile] File is not encrypted:', fileId, {
                mime: fileInfo.mime_type,
                name: fileInfo.name,
                hasMetadata: hasEncryptionMetadata,
            });
            return null;
        }

        if (!metadata) {
            console.error('[decryptEncryptedFile] Encryption metadata not found:', fileId);
            dispatch(encryptedFileDecryptionFailed(fileId, 'Encryption metadata not found'));
            return null;
        }

        // Get private key and session ID
        const privateKey = await getCurrentPrivateKey();
        const sessionId = getSessionId();

        if (!privateKey || !sessionId) {
            console.error('[decryptEncryptedFile] No encryption keys available');
            dispatch(encryptedFileDecryptionFailed(fileId, 'No encryption keys available'));
            return null;
        }

        // Check if we have a key for this session
        if (!metadata.keys[sessionId]) {
            console.error('[decryptEncryptedFile] No key for current session:', sessionId);
            dispatch(encryptedFileDecryptionFailed(fileId, 'Cannot decrypt - no key for this session'));
            return null;
        }

        dispatch(encryptedFileDecryptionStarted(fileId));

        try {
            // Fetch and decrypt the file
            const fileUrl = Client4.getFileRoute(fileId);
            const {blob, blobUrl, originalInfo} = await fetchAndDecryptFile(fileUrl, metadata, privateKey, sessionId);

            // Store the decrypted URL
            dispatch(encryptedFileDecrypted(fileId, blobUrl));

            // Store the original file info (now available after decryption)
            dispatch(encryptedFileOriginalInfoReceived(fileId, originalInfo));

            // Generate thumbnail for images
            if (blob.type.startsWith('image/')) {
                const thumbnailUrl = await generateThumbnail(blob);
                if (thumbnailUrl) {
                    dispatch(encryptedFileThumbnailGenerated(fileId, thumbnailUrl));
                }
            }

            return blobUrl;
        } catch (error) {
            console.error('[decryptEncryptedFile] Decryption failed:', error);
            dispatch(encryptedFileDecryptionFailed(fileId, error instanceof Error ? error.message : 'Decryption failed'));
            return null;
        }
    };
}

/**
 * Cleans up decrypted files when a post is removed.
 */
export function cleanupEncryptedFilesForPost(postId: string): ThunkActionFunc<void> {
    return (dispatch, getState) => {
        const state = getState();
        const post = getPost(state, postId);

        if (!post?.metadata?.files) {
            return;
        }

        const fileIds = post.metadata.files.map((f) => f.id);
        if (fileIds.length > 0) {
            dispatch(encryptedFileCleanup(fileIds));
        }
    };
}
