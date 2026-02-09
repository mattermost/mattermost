// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {getFilePreviewUrl, getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import LoadingImagePreview from 'components/loading_image_preview';
import {useEncryptedFile} from 'components/file_attachment/use_encrypted_file';

import {FileTypes} from 'utils/constants';
import {getFileType} from 'utils/utils';

import './image_preview.scss';

interface Props {
    fileInfo: FileInfo;
    canDownloadFiles: boolean;
    postId?: string;
}

export default function ImagePreview({fileInfo, canDownloadFiles, postId}: Props) {
    const isExternalFile = !fileInfo.id;

    // Check if file is encrypted and get decrypted URLs (mattermost-extended)
    const {
        isEncrypted,
        fileUrl: decryptedFileUrl,
        status: decryptionStatus,
    } = useEncryptedFile(fileInfo, postId, true); // autoDecrypt=true

    let fileUrl;
    let previewUrl;

    if (isEncrypted) {
        // For encrypted files, use decrypted blob URLs
        fileUrl = decryptedFileUrl || '';
        previewUrl = decryptedFileUrl || '';
    } else if (isExternalFile) {
        fileUrl = fileInfo.link;
        previewUrl = fileInfo.link;
    } else {
        fileUrl = getFileDownloadUrl(fileInfo.id);
        previewUrl = fileInfo.has_preview_image ? getFilePreviewUrl(fileInfo.id) : fileUrl;
    }

    // Show loading state while decrypting, or "Encrypted file" if decryption failed
    if (isEncrypted && !decryptedFileUrl) {
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

    if (!canDownloadFiles) {
        return <img src={previewUrl}/>;
    }

    let conditionalSVGStyleAttribute;
    if (getFileType(fileInfo.extension) === FileTypes.SVG) {
        conditionalSVGStyleAttribute = {
            width: fileInfo.width,
            height: 'auto',
        };
    }

    return (
        <a
            className='image_preview'
            href='#'
        >
            <img
                className='image_preview__image'
                loading='lazy'
                data-testid='imagePreview'
                alt={'preview url image'}
                src={previewUrl}
                style={conditionalSVGStyleAttribute}
            />
        </a>
    );
}
