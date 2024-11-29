// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {getFilePreviewUrl, getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import {FileTypes} from 'utils/constants';
import {getFileType} from 'utils/utils';

import './image_preview.scss';

interface Props {
    fileInfo: FileInfo;
    canDownloadFiles: boolean;
}

export default function ImagePreview({fileInfo, canDownloadFiles}: Props) {
    const isExternalFile = !fileInfo.id;

    let fileUrl;
    let previewUrl;
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
