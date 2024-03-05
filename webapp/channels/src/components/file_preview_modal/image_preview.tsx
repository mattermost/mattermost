// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {TransformWrapper, TransformComponent} from 'react-zoom-pan-pinch';

import type {FileInfo} from '@mattermost/types/files';

import {getFilePreviewUrl, getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import './image_preview.scss';

interface Props {
    fileInfo: FileInfo;
    canDownloadFiles: boolean;
}

export default function ImagePreview({fileInfo, canDownloadFiles}: Props) {
    const isExternalFile = !fileInfo.id;

    let fileUrl: string | undefined;
    let previewUrl: string | undefined;
    if (isExternalFile) {
        fileUrl = fileInfo.link;
        previewUrl = fileInfo.link;
    } else {
        fileUrl = getFileDownloadUrl(fileInfo.id);
        previewUrl = fileInfo.has_preview_image ? getFilePreviewUrl(fileInfo.id) : fileUrl;
    }

    if (!canDownloadFiles) {
        return <img src={previewUrl}/>;
    }

    return (
        <a
            className='image_preview'
            href='#'
        >
            <TransformWrapper>
                {({zoomIn, zoomOut, resetTransform}) => (
                    <>
                        <div className='image_preview_zoom_actions__actions'>
                            <button
                                onClick={() => zoomIn()}
                                className='image_preview_zoom_actions__action-item'
                            >
                                <i className='icon icon-plus'/>
                            </button>
                            <button
                                onClick={() => zoomOut()}
                                className='image_preview_zoom_actions__action-item'
                            >
                                <i className='icon icon-minus'/>
                            </button>
                            <button
                                onClick={() => resetTransform()}
                                className='image_preview_zoom_actions__action-item'
                            >
                                <i className='icon icon-refresh'/>
                            </button>
                        </div>
                        <TransformComponent>
                            <img
                                className='image_preview__image'
                                loading='lazy'
                                data-testid='imagePreview'
                                alt={'preview url image'}
                                src={previewUrl}
                            />
                        </TransformComponent>
                    </>
                )}
            </TransformWrapper>
        </a>
    );
}
