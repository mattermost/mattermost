// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useState, useEffect, useCallback} from 'react';

import type {FileInfo} from '@mattermost/types/files';

import FileInfoPreview from 'components/file_info_preview';
import LoadingImagePreview from 'components/loading_image_preview';
import {useEncryptedFile} from 'components/file_attachment/use_encrypted_file';

import Constants from 'utils/constants';

type Props = {
    fileInfo: FileInfo;
    fileUrl: string;
    isMobileView: boolean;
    postId?: string;
}

export default function AudioVideoPreview({fileInfo, fileUrl, isMobileView, postId}: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const sourceRef = useRef<HTMLSourceElement>(null);
    const [canPlay, setCanPlay] = useState(true);

    // Check if file is encrypted and get decrypted URL
    const {
        isEncrypted,
        fileUrl: decryptedFileUrl,
        status: decryptionStatus,
    } = useEncryptedFile(fileInfo, postId, true); // autoDecrypt=true

    // Determine the actual URL to use for playback
    const effectiveUrl = isEncrypted ? (decryptedFileUrl || '') : fileUrl;

    const handleLoadError = useCallback(() => {
        setCanPlay(false);
    }, []);

    // Reset canPlay when the URL changes (e.g. after decryption completes)
    useEffect(() => {
        if (effectiveUrl) {
            setCanPlay(true);
        }
    }, [effectiveUrl]);

    // Attach error listener to source element
    useEffect(() => {
        const source = sourceRef.current;
        if (source) {
            source.addEventListener('error', handleLoadError, {once: true});
            return () => {
                source.removeEventListener('error', handleLoadError);
            };
        }
        return undefined;
    }, [handleLoadError, effectiveUrl]);

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

    if (!canPlay) {
        return (
            <FileInfoPreview
                fileInfo={fileInfo}
                fileUrl={effectiveUrl}
            />
        );
    }

    let width = Constants.WEB_VIDEO_WIDTH;
    let height = Constants.WEB_VIDEO_HEIGHT;
    if (isMobileView) {
        width = Constants.MOBILE_VIDEO_WIDTH;
        height = Constants.MOBILE_VIDEO_HEIGHT;
    }

    // Use a key that changes when the URL changes so React creates a fresh video element
    return (
        <video
            key={effectiveUrl || fileInfo.id}
            ref={videoRef}
            data-setup='{}'
            controls={true}
            width={width}
            height={height}
        >
            <source
                ref={sourceRef}
                src={effectiveUrl}
            />
        </video>
    );
}
