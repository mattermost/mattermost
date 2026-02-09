// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {getFileThumbnailUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import FilenameOverlay from 'components/file_attachment/filename_overlay';

import Constants, {FileTypes} from 'utils/constants';
import {isEncryptedFile} from 'utils/encryption/file';
import * as Utils from 'utils/utils';

import FileProgressPreview from './file_progress_preview';

type UploadInfo = {
    name: string;
    percent?: number;
    type?: string;
}
export type FilePreviewInfo = FileInfo & UploadInfo;

type Props = {
    enableSVGs: boolean;
    onRemove?: (id: string) => void;
    onToggleSpoiler?: (id: string) => void;
    spoilerFileIds?: string[];
    fileInfos: FilePreviewInfo[];
    uploadsInProgress?: string[];
    uploadsProgressPercent?: {[clientID: string]: FilePreviewInfo};
}

export default class FilePreview extends React.PureComponent<Props> {
    static defaultProps = {
        fileInfos: [],
        uploadsInProgress: [],
        uploadsProgressPercent: {},
    };

    handleRemove = (id: string) => {
        this.props.onRemove?.(id);
    };

    render() {
        const previews: ReactNode[] = [];

        this.props.fileInfos.forEach((info) => {
            const type = Utils.getFileType(info.extension);
            const isEncrypted = isEncryptedFile(info);
            const isSpoilered = this.props.spoilerFileIds?.includes(info.id) ?? false;

            let className = 'file-preview post-image__column';
            if (isEncrypted) {
                className += ' file-preview--encrypted';
            }
            if (isSpoilered) {
                className += ' file-preview--spoilered';
            }
            let previewImage;

            // For encrypted files, always show lock icon (server can't generate thumbnails for encrypted content)
            if (isEncrypted) {
                className += ' custom-file';
                previewImage = <div className='file-icon file-icon--encrypted icon-lock-outline'/>;
            } else if (type === FileTypes.SVG && this.props.enableSVGs) {
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
                            {Boolean(this.props.onToggleSpoiler) && (
                                <a
                                    className='file-preview__spoiler-toggle'
                                    onClick={() => this.props.onToggleSpoiler?.(info.id)}
                                    title={isSpoilered ? 'Remove spoiler' : 'Mark as spoiler'}
                                >
                                    <i className={isSpoilered ? 'icon icon-eye-off-outline' : 'icon icon-eye-outline'}/>
                                </a>
                            )}
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

        if (this.props.uploadsInProgress && this.props.uploadsProgressPercent) {
            const uploadsProgressPercent = this.props.uploadsProgressPercent;
            this.props.uploadsInProgress.forEach((clientId) => {
                const fileInfo = uploadsProgressPercent[clientId];
                if (fileInfo) {
                    previews.push(
                        <FileProgressPreview
                            key={clientId}
                            clientId={clientId}
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
