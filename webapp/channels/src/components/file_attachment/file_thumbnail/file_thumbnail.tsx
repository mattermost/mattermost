// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getFileThumbnailUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import Constants, {FileTypes} from 'utils/constants';
import {
    getFileType,
    getIconClassName,
    isGIFImage,
} from 'utils/utils';

import type {FileInfo} from '@mattermost/types/files';

type Props = {
    enableSVGs: boolean;
    fileInfo: FileInfo;
}

export default class FileThumbnail extends React.PureComponent<Props> {
    render() {
        const {fileInfo} = this.props;
        const type = getFileType(fileInfo.extension);

        let thumbnail;
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
        } else if (fileInfo.extension === FileTypes.SVG && this.props.enableSVGs) {
            thumbnail = (
                <img
                    alt={'file thumbnail image'}
                    className='post-image normal'
                    src={getFileUrl(fileInfo.id)}
                />
            );
        } else {
            thumbnail = <div className={'file-icon ' + getIconClassName(type)}/>;
        }

        return thumbnail;
    }
}
