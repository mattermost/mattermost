// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {getFileUrl} from 'mattermost-redux/utils/file_utils';

import AudioVideoPreview from 'components/audio_video_preview';
import FileInfoPreview from 'components/file_info_preview';
import LoadingImagePreview from 'components/loading_image_preview';
import {useEncryptedFile} from 'components/file_attachment/use_encrypted_file';

import {getFileTypeFromMime} from 'utils/file_utils';

import ImagePreview from './image_preview';

interface Props {
    fileInfo: FileInfo;
    canDownloadFiles: boolean;
    postId?: string;
    isMobileView: boolean;
}

/**
 * Resolves the actual file type of an encrypted file after decryption
 * and renders the appropriate preview component.
 *
 * Encrypted files have mime_type='application/x-penc' and extension='penc',
 * so the normal extension-based routing can't determine the real type.
 * This component decrypts first, then routes to the correct viewer.
 */
export default function EncryptedFilePreview({fileInfo, canDownloadFiles, postId, isMobileView}: Props) {
    const {
        fileUrl: decryptedFileUrl,
        originalFileInfo,
        status: decryptionStatus,
    } = useEncryptedFile(fileInfo, postId, true);

    // Show "Encrypted file" if decryption failed, or loading spinner while decrypting
    if (!originalFileInfo) {
        if (decryptionStatus === 'failed') {
            return (
                <div
                    className='file-preview-modal__content'
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '100px',
                        color: 'rgba(var(--center-channel-color-rgb), 0.56)',
                        fontSize: '14px',
                    }}
                >
                    {'Encrypted file'}
                </div>
            );
        }
        return (
            <LoadingImagePreview
                loading={'Loading'}
                progress={decryptionStatus === 'decrypting' ? 50 : 0}
            />
        );
    }

    // Once decrypted, determine actual file type from the original MIME type
    const actualType = getFileTypeFromMime(originalFileInfo.type);

    if (actualType === 'video' || actualType === 'audio') {
        return (
            <AudioVideoPreview
                fileInfo={fileInfo}
                fileUrl={getFileUrl(fileInfo.id)}
                isMobileView={isMobileView}
                postId={postId}
            />
        );
    }

    if (actualType === 'image') {
        return (
            <ImagePreview
                fileInfo={fileInfo}
                canDownloadFiles={canDownloadFiles}
                postId={postId}
            />
        );
    }

    // Fallback for other encrypted file types (PDF, docs, etc.)
    return (
        <FileInfoPreview
            fileInfo={fileInfo}
            fileUrl={decryptedFileUrl || getFileUrl(fileInfo.id)}
        />
    );
}
