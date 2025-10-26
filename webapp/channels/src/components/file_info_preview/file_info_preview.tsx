// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {FileInfo} from '@mattermost/types/files';

import * as Utils from 'utils/utils';

type Props = {
    fileInfo: FileInfo;
    fileUrl: string;
    canDownloadFiles: boolean;
};

const FileInfoPreview = ({
    fileInfo,
    fileUrl,
    canDownloadFiles,
}: Props) => {
    const intl = useIntl();

    // non-image files include a section providing details about the file
    const infoParts = [];

    if (fileInfo.extension !== '') {
        infoParts.push(
            intl.formatMessage({id: 'file_info_preview.type', defaultMessage: 'File type '}) +
        fileInfo.extension.toUpperCase(),
        );
    }

    if (fileInfo.size) {
        infoParts.push(
            intl.formatMessage({id: 'file_info_preview.size', defaultMessage: 'Size '}) +
        Utils.fileSizeToString(fileInfo.size),
        );
    }

    const infoString = infoParts.join(', ');

    // Using <a href> for file downloads triggers a full-page navigation, which closes the WebSocket connection.
    // To avoid this, the file is fetched and downloaded in memory instead.
    const handleDownload = async () => {
        try{
            const res = await fetch(fileUrl);
            if(!res.ok) {
                throw new Error(`Failed to download file: HTTP ${res.status}`);
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            
            const aTag = document.createElement("a");
            aTag.href = url;
            aTag.download = fileInfo.name || "download";
            
            document.body.appendChild(aTag);
            aTag.click();
            aTag.remove();

            URL.revokeObjectURL(url);
        } catch(err) {
            console.error(err);
        }
    };

    let preview = null;
    if (canDownloadFiles) {
        preview = (
            <div
                className='file-details__preview--clickable'
                onClick={handleDownload}
            >
                <span className='file-details__preview-helper'/>
                <img
                    alt={'file preview'}
                    src={Utils.getFileIconPath(fileInfo)}
                />
            </div>
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
};

export default React.memo(FileInfoPreview);
