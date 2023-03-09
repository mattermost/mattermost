// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils';
import {FileInfo} from '@mattermost/types/files';

type Props = {
    fileInfo: FileInfo;
    fileUrl: string;
    canDownloadFiles: boolean;
};

export default class FileInfoPreview extends React.PureComponent<Props> {
    render() {
        const fileInfo = this.props.fileInfo;
        const fileUrl = this.props.fileUrl;

        // non-image files include a section providing details about the file
        const infoParts = [];

        if (fileInfo.extension !== '') {
            infoParts.push(Utils.localizeMessage('file_info_preview.type', 'File type ') + fileInfo.extension.toUpperCase());
        }

        if (fileInfo.size) {
            infoParts.push(Utils.localizeMessage('file_info_preview.size', 'Size ') + Utils.fileSizeToString(fileInfo.size));
        }

        const infoString = infoParts.join(', ');

        let preview = null;
        if (this.props.canDownloadFiles) {
            preview = (
                <a
                    className='file-details__preview'
                    href={fileUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    <span className='file-details__preview-helper'/>
                    <img
                        alt={'file preview'}
                        src={Utils.getFileIconPath(fileInfo)}
                    />
                </a>
            );
        } else {
            preview = (
                <span className='file-details__preview'>
                    <span className='file-details__preview-helper'/>
                    <img
                        alt={'file preview'}
                        src={Utils.getFileIconPath(fileInfo)}
                    />
                </span>
            );
        }

        return (
            <div className='file-details__container'>
                {preview}
                <div className='file-details'>
                    <div className='file-details__name'>{fileInfo.name}</div>
                    <div className='file-details__info'>{infoString}</div>
                </div>
            </div>
        );
    }
}
