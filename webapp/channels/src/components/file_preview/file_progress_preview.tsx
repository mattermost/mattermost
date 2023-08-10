// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {ProgressBar} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import FilenameOverlay from 'components/file_attachment/filename_overlay';

import {getFileTypeFromMime} from 'utils/file_utils';
import * as Utils from 'utils/utils';

import type {FilePreviewInfo} from './file_preview';

type Props = {
    handleRemove: (id: string) => void;
    clientId: string;
    fileInfo: FilePreviewInfo;
}

export default class FileProgressPreview extends React.PureComponent<Props> {
    handleRemove = () => {
        this.props.handleRemove(this.props.clientId);
    };

    render() {
        let percent = 0;
        let fileNameComponent;
        let previewImage;
        let progressBar;
        const {fileInfo, clientId} = this.props;

        if (fileInfo) {
            percent = fileInfo.percent ? fileInfo.percent : 0;
            const percentTxt = ` (${percent.toFixed(0)}%)`;
            const fileType = getFileTypeFromMime(fileInfo.type || '');
            previewImage = <div className={'file-icon ' + Utils.getIconClassName(fileType)}/>;

            fileNameComponent = (
                <React.Fragment>
                    <FilenameOverlay
                        fileInfo={fileInfo}
                        compactDisplay={false}
                        canDownload={false}
                    />
                    <span className='post-image__uploadingTxt'>
                        {percent === 100 ? (
                            <FormattedMessage
                                id='create_post.fileProcessing'
                                defaultMessage='Processing...'
                            />
                        ) : (
                            <React.Fragment>
                                <FormattedMessage
                                    id='admin.plugin.uploading'
                                    defaultMessage='Uploading...'
                                />
                                <span>{percentTxt}</span>
                            </React.Fragment>
                        )}
                    </span>
                </React.Fragment>
            );

            if (percent) {
                progressBar = (
                    <ProgressBar
                        className='post-image__progressBar'
                        now={percent}
                        active={percent === 100}
                    />
                );
            }
        }

        return (
            <div
                ref={clientId}
                key={clientId}
                className='file-preview post-image__column'
                data-client-id={clientId}
            >
                <div className='post-image__thumbnail'>
                    {previewImage}
                </div>
                <div className='post-image__details'>
                    <div className='post-image__detail_wrapper'>
                        <div className='post-image__detail'>
                            {fileNameComponent}
                        </div>
                    </div>
                    <div>
                        <a
                            className='file-preview__remove'
                            onClick={this.handleRemove}
                        >
                            <i className='icon icon-close'/>
                        </a>
                    </div>
                    {progressBar}
                </div>
            </div>
        );
    }
}
