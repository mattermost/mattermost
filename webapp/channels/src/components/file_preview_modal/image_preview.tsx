// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {getFilePreviewUrl, getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import './image_preview.scss';

interface Props {
    fileInfo: FileInfo;
}

export default function ImagePreview({fileInfo}: Props) {

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
                src={fileInfo.link}
            />
        </a>
    );
}
