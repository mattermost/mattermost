// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {getFileThumbnailUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import Constants, {FileTypes} from 'utils/constants';
import {
    getFileType,
    getIconClassName,
    isGIFImage,
} from 'utils/utils';

type Props = {
    enableSVGs: boolean;
    fileInfo: FileInfo;
}

const FileThumbnail = ({
    fileInfo,
    enableSVGs,
}: Props) => {
    const type = getFileType(fileInfo.extension);

    if (type === FileTypes.IMAGE) {
        let className = 'post-image';

        if (fileInfo.width < Constants.THUMBNAIL_WIDTH && fileInfo.height < Constants.THUMBNAIL_HEIGHT) {
            className += ' small';
        } else {
            className += ' normal';
        }

        let thumbnailUrl = getFileThumbnailUrl(fileInfo.id);
        if (isGIFImage(fileInfo.extension) && !fileInfo.has_preview_image) {
            thumbnailUrl = getFileUrl(fileInfo.id);
        }

        return (
            <div
                className={className}
                style={{
                    backgroundImage: `url(${thumbnailUrl})`,
                    backgroundSize: 'cover',
                }}
            />
        );
    } else if (fileInfo.extension === FileTypes.SVG && enableSVGs) {
        return (
            <img
                alt={'file thumbnail image'}
                className='post-image normal'
                src={getFileUrl(fileInfo.id)}
            />
        );
    }

    return <div className={'file-icon ' + getIconClassName(type)}/>;
};

export default memo(FileThumbnail);
