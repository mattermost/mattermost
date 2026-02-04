// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import classNames from 'classnames';

import type {FileInfo} from '@mattermost/types/files';

import {getFileDownloadUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import FilePreviewModal from 'components/file_preview_modal';

import {ModalIdentifiers} from 'utils/constants';

import type {PropsFromRedux} from './index';

import './video_player.scss';

export interface Props extends PropsFromRedux {
    fileInfo: FileInfo;
    postId: string;
    index?: number;
    maxHeight?: number;
    maxWidth?: number;
    compactDisplay?: boolean;
}

export default function VideoPlayer(props: Props) {
    const {fileInfo, postId, compactDisplay, defaultMaxHeight, defaultMaxWidth} = props;

    // Early return MUST be before hooks, but we need to handle this case carefully
    // React hooks cannot be conditionally called, so we use safe defaults
    const maxHeight = props.maxHeight ?? defaultMaxHeight ?? 350;
    const maxWidth = props.maxWidth ?? defaultMaxWidth ?? 480;
    const [hasError, setHasError] = useState(false);

    const handleClick = useCallback((e: React.MouseEvent) => {
        // Don't open modal on click - let native video controls handle play/pause
        // The video element's controls attribute handles all interaction
        e.stopPropagation();
    }, []);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (!fileInfo) {
            return;
        }
        props.actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                fileInfos: [fileInfo],
                postId,
                startIndex: 0,
            },
        });
    }, [fileInfo, postId, props.actions]);

    const handleError = useCallback(() => {
        setHasError(true);
    }, []);

    const handleDownload = useCallback(() => {
        if (!fileInfo?.id) {
            return;
        }
        const downloadUrl = getFileDownloadUrl(fileInfo.id);
        window.open(downloadUrl, '_blank');
    }, [fileInfo?.id]);

    if (!fileInfo) {
        return null;
    }

    const fileUrl = getFileUrl(fileInfo.id);
    const mimeType = fileInfo.mime_type || 'video/mp4';
    const filename = fileInfo.name || 'video';

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
                <span className='video-player-caption'>{filename}</span>
            </div>
        );
    }

    return (
        <div
            className={classNames('video-player-container', {'compact-display': compactDisplay})}
            style={containerStyle}
        >
            <video
                className='video-player'
                controls={true}
                preload='metadata'
                style={videoStyle}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onError={handleError}
            >
                <source
                    src={fileUrl}
                    type={mimeType}
                />
                <a
                    href={fileUrl}
                    download={filename}
                >
                    {`Download ${filename}`}
                </a>
            </video>
            <span className='video-player-caption'>{filename}</span>
        </div>
    );
}
