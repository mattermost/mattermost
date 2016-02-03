// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';

import {defineMessages} from 'mm-intl';

const holders = defineMessages({
    type: {
        id: 'file_info_preview.type',
        defaultMessage: 'File type '
    },
    size: {
        id: 'file_info_preview.size',
        defaultMessage: 'Size '
    }
});

export default function FileInfoPreview({filename, fileUrl, fileInfo, formatMessage}) {
    // non-image files include a section providing details about the file
    const infoParts = [];

    if (fileInfo.extension !== '') {
        infoParts.push(formatMessage(holders.type) + fileInfo.extension.toUpperCase());
    }

    infoParts.push(formatMessage(holders.size) + Utils.fileSizeToString(fileInfo.size));

    const infoString = infoParts.join(', ');

    const name = decodeURIComponent(Utils.getFileName(filename));

    return (
        <div className='file-details__container'>
            <a
                className={'file-details__preview'}
                href={fileUrl}
                target='_blank'
            >
                <span className='file-details__preview-helper' />
                <img src={Utils.getPreviewImagePath(filename)}/>
            </a>
            <div className='file-details'>
                <div className='file-details__name'>{name}</div>
                <div className='file-details__info'>{infoString}</div>
            </div>
        </div>
    );
}
