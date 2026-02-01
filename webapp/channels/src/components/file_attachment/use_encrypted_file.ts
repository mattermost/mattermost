// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useCallback} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import type {FileInfo} from '@mattermost/types/files';

import {isEncryptedFile} from 'utils/encryption/file';

import {
    getDecryptedFileUrl,
    getDecryptedThumbnailUrl,
    getFileDecryptionStatus,
    getFileDecryptionError,
    getEncryptedFileMetadata,
    getDecryptedOriginalFileInfo,
} from 'selectors/views/encrypted_files';

import {decryptEncryptedFile} from 'actions/views/encryption';

import type {GlobalState} from 'types/store';

export interface UseEncryptedFileResult {
    /** Whether the file is encrypted */
    isEncrypted: boolean;

    /** The URL to use for the file (decrypted blob URL or original) */
    fileUrl: string | undefined;

    /** The URL to use for the thumbnail (decrypted blob URL or original) */
    thumbnailUrl: string | undefined;

    /** Current decryption status */
    status: 'pending' | 'idle' | 'decrypting' | 'decrypted' | 'failed' | undefined;

    /** Error message if decryption failed */
    error: string | undefined;

    /** Original file info with metadata for display */
    originalFileInfo: {
        name: string;
        type: string;
        size: number;
    } | undefined;

    /** Trigger decryption manually, returns blob URL and original info */
    decrypt: () => Promise<{blobUrl: string; originalInfo: {name: string; type: string; size: number}} | null>;
}

/**
 * Hook to handle encrypted file display.
 * Automatically detects if a file is encrypted and provides decrypted URLs.
 *
 * @param fileInfo - The file info from the post
 * @param postId - Optional post ID for fetching metadata from post props
 * @param autoDecrypt - Whether to automatically trigger decryption (default: false)
 * @returns Object with file URLs and decryption status
 */
export function useEncryptedFile(
    fileInfo: FileInfo | undefined,
    postId?: string,
    autoDecrypt: boolean = false,
): UseEncryptedFileResult {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dispatch = useDispatch<any>();

    const fileId = fileInfo?.id || '';

    // Get decryption state from Redux
    const decryptedUrl = useSelector((state: GlobalState) => getDecryptedFileUrl(state, fileId));
    const thumbnailUrl = useSelector((state: GlobalState) => getDecryptedThumbnailUrl(state, fileId));
    const status = useSelector((state: GlobalState) => getFileDecryptionStatus(state, fileId));
    const error = useSelector((state: GlobalState) => getFileDecryptionError(state, fileId));
    const metadata = useSelector((state: GlobalState) => getEncryptedFileMetadata(state, fileId));
    // Original file info is ONLY available after successful decryption
    const originalFileInfo = useSelector((state: GlobalState) => getDecryptedOriginalFileInfo(state, fileId));

    // Check if file is encrypted by:
    // 1. MIME type being encrypted type (application/x-penc)
    // 2. OR having encryption metadata in Redux (from post.props.encrypted_files)
    // 3. OR filename matching encrypted pattern (encrypted_*.penc)
    const isEncryptedByMime = isEncryptedFile(fileInfo);
    const hasEncryptionMetadata = metadata !== undefined && metadata !== null;
    const isEncryptedByName = Boolean(fileInfo?.name?.startsWith('encrypted_') && fileInfo?.name?.endsWith('.penc'));
    const isEncrypted = isEncryptedByMime || hasEncryptionMetadata || isEncryptedByName;

    // Manual decrypt function - returns blob URL and original info
    const decrypt = useCallback(async (): Promise<{blobUrl: string; originalInfo: {name: string; type: string; size: number}} | null> => {
        if (!fileId || !isEncrypted) {
            return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (dispatch as any)(decryptEncryptedFile(fileId, postId));
        return result as {blobUrl: string; originalInfo: {name: string; type: string; size: number}} | null;
    }, [dispatch, fileId, isEncrypted, postId]);

    // Auto-decrypt on mount if enabled
    useEffect(() => {
        if (autoDecrypt && isEncrypted && !decryptedUrl && status !== 'decrypting' && status !== 'failed') {
            decrypt();
        }
    }, [autoDecrypt, isEncrypted, decryptedUrl, status, decrypt]);

    // originalFileInfo is fetched from Redux where it's ONLY stored after successful decryption
    // This ensures users without decryption keys cannot see file metadata (name, type, size)
    // Before decryption, components should show a generic "Encrypted file" placeholder

    return {
        isEncrypted,
        fileUrl: decryptedUrl,
        thumbnailUrl,
        status,
        error,
        originalFileInfo,
        decrypt,
    };
}

/**
 * Simple hook to check if a file is encrypted.
 * Use this when you just need to know if a file is encrypted for styling purposes.
 */
export function useIsFileEncrypted(fileInfo: FileInfo | undefined): boolean {
    return isEncryptedFile(fileInfo);
}
