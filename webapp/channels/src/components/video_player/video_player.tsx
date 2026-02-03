// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef, useState} from 'react';
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
    compactDisplay?: boolean;
    handleImageClick?: (index: number) => void;
}

export default function VideoPlayer(props: Props) {
    // Use maxHeight prop if provided, otherwise use defaultMaxHeight from config
    const {fileInfo, postId, index = 0, compactDisplay, defaultMaxHeight} = props;
    const maxHeight = props.maxHeight ?? defaultMaxHeight ?? 350;
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasError, setHasError] = useState(false);

    const handleClick = useCallback((e: React.MouseEvent) => {
        // Don't prevent default - allow native video controls to work
        if (props.handleImageClick) {
            e.preventDefault();
            props.handleImageClick(index);
        }
    }, [props.handleImageClick, index]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
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
        const downloadUrl = getFileDownloadUrl(fileInfo.id);
        window.open(downloadUrl, '_blank');
    }, [fileInfo.id]);

    if (!fileInfo) {
        return null;
    }

    const fileUrl = getFileUrl(fileInfo.id);
    const mimeType = fileInfo.mime_type || 'video/mp4';
    const filename = fileInfo.name || 'video';

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
            <div className={classNames('video-player-container', {'compact-display': compactDisplay})}>
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
        <div className={classNames('video-player-container', {'compact-display': compactDisplay})}>
            <video
                ref={videoRef}
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
