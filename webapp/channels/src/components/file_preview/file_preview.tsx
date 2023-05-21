// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';

import {getFileThumbnailUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';
import {FilePreviewInfo} from '@mattermost/types/files';

import FilenameOverlay from 'components/file_attachment/filename_overlay';
import Constants, {FileTypes} from 'utils/constants';
import * as Utils from 'utils/utils';

import FileProgressPreview from './file_progress_preview';

type Props = {
    enableSVGs: boolean;
    onRemove?: (id: string) => void;
    fileInfos: FilePreviewInfo[];
    uploadsProgressPercent?: {[clientID: string]: FilePreviewInfo | undefined};
}

export default class FilePreview extends React.PureComponent<Props> {
    static defaultProps = {
        fileInfos: [],
        uploadsProgressPercent: {},
    };

    handleRemove = (id: string) => {
        this.props.onRemove?.(id);
    };

    render() {
        const previews: ReactNode[] = [];

        const fileInfoClientIds = this.props.fileInfos.map((f) => f.clientId);
        this.props.fileInfos.forEach((info) => {
            const type = Utils.getFileType(info.extension);

            let className = 'file-preview post-image__column';
            let previewImage;
            if (type === FileTypes.SVG && this.props.enableSVGs) {
                previewImage = (
                    <img
                        alt={'file preview'}
                        className='post-image normal'
                        src={getFileUrl(info.id)}
                    />
                );
            } else if (type === FileTypes.IMAGE) {
                let imageClassName = 'post-image';

                if ((info.width && info.width < Constants.THUMBNAIL_WIDTH) && (info.height && info.height < Constants.THUMBNAIL_HEIGHT)) {
                    imageClassName += ' small';
                } else {
                    imageClassName += ' normal';
                }

                let thumbnailUrl = getFileThumbnailUrl(info.id);
                if (Utils.isGIFImage(info.extension) && !info.has_preview_image) {
                    thumbnailUrl = getFileUrl(info.id);
                }

                previewImage = (
                    <div
                        className={imageClassName}
                        style={{
                            backgroundImage: `url(${thumbnailUrl})`,
                            backgroundSize: 'cover',
                        }}
                    />
                );
            } else {
                className += ' custom-file';
                previewImage = <div className={'file-icon ' + Utils.getIconClassName(type)}/>;
            }

            previews.push(
                <div
                    key={info.id}
                    className={className}
                >
                    <div className='post-image__thumbnail'>
                        {previewImage}
                    </div>
                    <div className='post-image__details'>
                        <div className='post-image__detail_wrapper'>
                            <div className='post-image__detail'>
                                <FilenameOverlay
                                    fileInfo={info}
                                    compactDisplay={false}
                                    canDownload={false}
                                />
                                {info.extension && <span className='post-image__type'>{info.extension.toUpperCase()}</span>}
                                <span className='post-image__size'>{Utils.fileSizeToString(info.size)}</span>
                            </div>
                        </div>
                        <div>
                            {Boolean(this.props.onRemove) && (
                                <a
                                    className='file-preview__remove'
                                    onClick={this.handleRemove.bind(this, info.id)}
                                >
                                    <i className='icon icon-close'/>
                                </a>
                            )}
                        </div>
                    </div>
                </div>,
            );
        });

        const uploadsProgressPercent = this.props.uploadsProgressPercent;
        if (uploadsProgressPercent) {
            Object.values(uploadsProgressPercent).
                filter((filePreviewInfo): filePreviewInfo is FilePreviewInfo => filePreviewInfo !== undefined && !fileInfoClientIds.includes(filePreviewInfo.clientId)).
                forEach((fileInfo) => {
                    if (fileInfo) {
                        previews.push(
                            <FileProgressPreview
                                key={fileInfo.clientId}
                                clientId={fileInfo.clientId}
                                fileInfo={fileInfo}
                                handleRemove={this.handleRemove}
                            />,
                        );
                    }
                });
        }

        return (
            <div className='file-preview__container'>
                {previews}
            </div>
        );
    }
}
