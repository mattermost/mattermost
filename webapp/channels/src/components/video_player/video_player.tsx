// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import classNames from 'classnames';

import type {FileInfo} from '@mattermost/types/files';

import {getFileDownloadUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import FilePreviewModal from 'components/file_preview_modal';
import {useEncryptedFile} from 'components/file_attachment/use_encrypted_file';

import {ModalIdentifiers} from 'utils/constants';
import {getFileExtensionFromType} from 'utils/file_utils';

import type {PropsFromRedux} from './index';

import './video_player.scss';

export interface Props extends PropsFromRedux {
    fileInfo: FileInfo;
    postId: string;
    index?: number;
    maxHeight?: number;
    maxWidth?: number;
    compactDisplay?: boolean;
    isSpoilered?: boolean;
}

export default function VideoPlayer(props: Props) {
    const {fileInfo, postId, compactDisplay, defaultMaxHeight, defaultMaxWidth} = props;

    const maxHeight = props.maxHeight ?? defaultMaxHeight ?? 350;
    const maxWidth = props.maxWidth ?? defaultMaxWidth ?? 480;
    const [hasError, setHasError] = useState(false);
    const [spoilerRevealed, setSpoilerRevealed] = useState(false);
    const showSpoilerOverlay = props.isSpoilered && !spoilerRevealed;

    // Handle encrypted video files
    const {
        isEncrypted,
        fileUrl: decryptedFileUrl,
        originalFileInfo,
        status: decryptionStatus,
    } = useEncryptedFile(fileInfo, postId, true);

    // Resolve display info for encrypted files
    const displayInfo = useMemo(() => {
        if (isEncrypted && originalFileInfo) {
            return {
                url: decryptedFileUrl || '',
                mimeType: originalFileInfo.type,
                filename: originalFileInfo.name,
            };
        }
        return {
            url: fileInfo ? getFileUrl(fileInfo.id) : '',
            mimeType: fileInfo?.mime_type || 'video/mp4',
            filename: fileInfo?.name || 'video',
        };
    }, [fileInfo, isEncrypted, decryptedFileUrl, originalFileInfo]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        // Don't open modal on click - let native video controls handle play/pause
        e.stopPropagation();
    }, []);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (!fileInfo) {
            return;
        }

        // For encrypted files, pass resolved file info to modal
        const modalFileInfo = isEncrypted && originalFileInfo ? {
            ...fileInfo,
            name: originalFileInfo.name,
            extension: originalFileInfo.name.split('.').pop() || getFileExtensionFromType(originalFileInfo.type),
            mime_type: originalFileInfo.type,
            size: originalFileInfo.size,
        } : fileInfo;

        props.actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                fileInfos: [modalFileInfo],
                postId,
                startIndex: 0,
            },
        });
    }, [fileInfo, postId, props.actions, isEncrypted, originalFileInfo]);

    const handleError = useCallback(() => {
        setHasError(true);
    }, []);

    const handleDownload = useCallback(() => {
        if (isEncrypted && decryptedFileUrl && originalFileInfo) {
            // Download decrypted file
            const link = document.createElement('a');
            link.href = decryptedFileUrl;
            link.download = originalFileInfo.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
        if (!fileInfo?.id) {
            return;
        }
        const downloadUrl = getFileDownloadUrl(fileInfo.id);
        window.open(downloadUrl, '_blank');
    }, [fileInfo?.id, isEncrypted, decryptedFileUrl, originalFileInfo]);

    if (!fileInfo) {
        return null;
    }

    // Show loading/failed state while encrypted file is being decrypted
    const isDecryptionFailed = isEncrypted && decryptionStatus === 'failed';
    if (isEncrypted && !decryptedFileUrl) {
        const placeholderText = isDecryptionFailed ? 'Encrypted file' : 'Loading...';
        const containerStyle: React.CSSProperties = {
            maxWidth: `${maxWidth}px`,
        };
        return (
            <div
                className={classNames('video-player-container', {'compact-display': compactDisplay})}
                style={containerStyle}
            >
                <div
                    className='video-player'
                    style={{
                        maxHeight: `${maxHeight}px`,
                        maxWidth: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '100px',
                        background: 'rgba(var(--center-channel-color-rgb), 0.04)',
                        borderRadius: '4px',
                    }}
                >
                    <span style={{color: 'rgba(var(--center-channel-color-rgb), 0.56)', fontSize: '14px'}}>
                        {placeholderText}
                    </span>
                </div>
                <span className='video-player-caption'>{placeholderText}</span>
            </div>
        );
    }

    // Container style with max width
    const containerStyle: React.CSSProperties = {
        maxWidth: `${maxWidth}px`,
    };

    // Calculate aspect ratio if dimensions are available
    let videoStyle: React.CSSProperties = {
        maxHeight: `${maxHeight}px`,
        maxWidth: '100%',
    };

    if (fileInfo.width && fileInfo.height) {
        const aspectRatio = fileInfo.width / fileInfo.height;
        videoStyle = {
            ...videoStyle,
            aspectRatio: `${aspectRatio}`,
        };
    }

    if (hasError) {
        return (
            <div
                className={classNames('video-player-container', {'compact-display': compactDisplay})}
                style={containerStyle}
            >
                <div className='video-player-error'>
                    <span className='video-player-error__text'>{'Unable to load video'}</span>
                    <button
                        className='video-player-error__download'
                        onClick={handleDownload}
                    >
                        {'Download'}
                    </button>
                </div>
                <span className='video-player-caption'>{displayInfo.filename}</span>
            </div>
        );
    }

    return (
        <div
            className={classNames('video-player-container', {'compact-display': compactDisplay})}
            style={containerStyle}
        >
            <div
                className={classNames('video-player-spoiler-wrapper', {
                    'video-player-spoiler-wrapper--blurred': showSpoilerOverlay,
                })}
                onClick={showSpoilerOverlay ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSpoilerRevealed(true);
                } : undefined}
            >
                <video
                    key={displayInfo.url}
                    className='video-player'
                    controls={!showSpoilerOverlay}
                    preload='metadata'
                    style={{
                        ...videoStyle,
                        ...(showSpoilerOverlay ? {pointerEvents: 'none' as const} : {}),
                    }}
                    onClick={showSpoilerOverlay ? undefined : handleClick}
                    onDoubleClick={showSpoilerOverlay ? undefined : handleDoubleClick}
                    onError={handleError}
                >
                    <source
                        src={displayInfo.url}
                        type={displayInfo.mimeType}
                    />
                    <a
                        href={displayInfo.url}
                        download={displayInfo.filename}
                    >
                        {`Download ${displayInfo.filename}`}
                    </a>
                </video>
                {showSpoilerOverlay && (
                    <div className='spoiler-overlay'>
                        <span className='spoiler-overlay__text'>{'SPOILER'}</span>
                    </div>
                )}
            </div>
            <span className='video-player-caption'>{displayInfo.filename}</span>
        </div>
    );
}
