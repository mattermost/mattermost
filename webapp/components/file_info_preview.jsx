// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

export default class FileInfoPreview extends React.Component {
    shouldComponentUpdate(nextProps) {
        if (nextProps.fileUrl !== this.props.fileUrl) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.fileInfo, this.props.fileInfo)) {
            return true;
        }

        return false;
    }

    render() {
        const fileInfo = this.props.fileInfo;
        const fileUrl = this.props.fileUrl;

        // non-image files include a section providing details about the file
        const infoParts = [];

        if (fileInfo.extension !== '') {
            infoParts.push(Utils.localizeMessage('file_info_preview.type', 'File type ') + fileInfo.extension.toUpperCase());
        }

        infoParts.push(Utils.localizeMessage('file_info_preview.size', 'Size ') + Utils.fileSizeToString(fileInfo.size));

        const infoString = infoParts.join(', ');

        return (
            <div className='file-details__container'>
                <a
                    className={'file-details__preview'}
                    to={fileUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    <span className='file-details__preview-helper'/>
                    <img src={Utils.getFileIconPath(fileInfo)}/>
                </a>
                <div className='file-details'>
                    <div className='file-details__name'>{fileInfo.name}</div>
                    <div className='file-details__info'>{infoString}</div>
                </div>
            </div>
        );
    }
}

FileInfoPreview.propTypes = {
    fileInfo: React.PropTypes.object.isRequired,
    fileUrl: React.PropTypes.string.isRequired
};
