// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {LockOutlineIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';

import {getFilePreviewUrl, getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

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
        decrypt,
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

    // Show encrypted placeholder while decrypting
    if (isEncrypted && !decryptedFileUrl) {
        return (
            <div
                className='image_preview image_preview--encrypted'
                onClick={decrypt}
                role='button'
                tabIndex={0}
            >
                <div className='image_preview__encrypted-placeholder'>
                    <LockOutlineIcon
                        size={64}
                        color={'rgba(var(--encrypted-color), 1)'}
                    />
                    <span className='image_preview__encrypted-text'>
                        {decryptionStatus === 'decrypting' ? 'Decrypting...' : 'Encrypted file'}
                    </span>
                    {decryptionStatus === 'failed' && (
                        <span className='image_preview__encrypted-error'>
                            Click to retry
                        </span>
                    )}
                </div>
            </div>
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
