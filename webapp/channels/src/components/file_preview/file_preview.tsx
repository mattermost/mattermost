// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ReactNode} from 'react';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {FileInfo} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import {getFileThumbnailUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import FilenameOverlay from 'components/file_attachment/filename_overlay';
import FilePreviewModal from 'components/file_preview_modal';

import Constants, {FileTypes, ModalIdentifiers} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {ModalData} from 'types/actions';

import FileProgressPreview from './file_progress_preview';

type UploadInfo = {
    name: string;
    percent?: number;
    type?: string;
};
export type FilePreviewInfo = FileInfo & UploadInfo;

type Props = {
    enableSVGs: boolean;
    onRemove?: (id: string) => void;
    fileInfos: FilePreviewInfo[];
    uploadsInProgress?: string[];
    uploadsProgressPercent?: {[clientID: string]: FilePreviewInfo};
    compactMode?: boolean;
    disabledRemoveTooltip?: string;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
    };
};

export default class FilePreview extends React.PureComponent<Props> {
    static defaultProps = {
        fileInfos: [],
        uploadsInProgress: [],
        uploadsProgressPercent: {},
    };

    handleRemove = (id: string) => {
        this.props.onRemove?.(id);
    };

    /**
     * Opens the standard file preview modal for a draft attachment.
     *
     * @param e - Mouse event from the thumbnail link (default prevented; does not bubble).
     * @param startIndex - Index of the clicked file in {@link Props.fileInfos} for modal navigation.
     */
    handleThumbnailPreviewClick = (e: React.MouseEvent<HTMLElement>, startIndex: number) => {
        e.preventDefault();
        e.stopPropagation();

        const fileInfo = this.props.fileInfos[startIndex];
        if (!fileInfo || fileInfo.archived || fileInfo.delete_at > 0) {
            return;
        }

        if ('blur' in e.target) {
            (e.target as HTMLElement).blur();
        }

        this.props.actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                post: {user_id: fileInfo.user_id, channel_id: fileInfo.channel_id} as Post,
                fileInfos: this.props.fileInfos,
                startIndex,
            },
        });
    };

    render() {
        const previews: ReactNode[] = [];

        this.props.fileInfos.forEach((info, index) => {
            const type = Utils.getFileType(info.extension);

            let className = 'file-preview post-image__column';
            let previewImage;
            const canOpenPreviewModal = !info.archived && info.delete_at === 0;

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

            if (this.props.compactMode) {
                className += ' compact';
            }

            const thumbnailLabel = `${Utils.localizeMessage({id: 'file_attachment.thumbnail', defaultMessage: 'file thumbnail'})} ${info.name}`.toLowerCase();

            let thumbnailWrap: ReactNode;
            if (canOpenPreviewModal) {
                thumbnailWrap = (
                    <a
                        aria-label={thumbnailLabel}
                        className='post-image__thumbnail'
                        href='#'
                        onClick={(e) => this.handleThumbnailPreviewClick(e, index)}
                    >
                        {previewImage}
                    </a>
                );
            } else {
                thumbnailWrap = (
                    <div className='post-image__thumbnail'>
                        {previewImage}
                    </div>
                );
            }

            previews.push(
                <div
                    key={info.id}
                    className={className}
                    data-testid='file-preview-item'
                >
                    {thumbnailWrap}
                    <div
                        className='post-image__details'
                        data-testid='post-image-details'
                    >
                        <div className='post-image__detail_wrapper'>
                            <div
                                className={classNames('post-image__detail', {
                                    compact: this.props.compactMode,
                                })}
                            >
                                <FilenameOverlay
                                    fileInfo={info}
                                    compactDisplay={this.props.compactMode}
                                    canDownload={false}
                                />
                                {info.extension && (
                                    <span className='post-image__type'>
                                        {info.extension.toUpperCase()}
                                    </span>
                                )}
                                <span className='post-image__size'>
                                    {Utils.fileSizeToString(info.size)}
                                </span>
                            </div>
                        </div>
                        <div>
                            {this.props.onRemove && (
                                <a
                                    className={classNames('file-preview__remove', {compact: this.props.compactMode})}
                                    data-testid='file-preview-remove'
                                    onClick={this.handleRemove.bind(this, info.id)}
                                >
                                    <i className='icon icon-close'/>
                                </a>
                            )}

                            {!this.props.onRemove && this.props.disabledRemoveTooltip && (
                                <WithTooltip
                                    title={this.props.disabledRemoveTooltip}
                                    isVertical={true}
                                >
                                    <span
                                        className={classNames('file-preview__remove file-preview__remove--disabled', {compact: this.props.compactMode})}
                                    >
                                        <i className='icon icon-close'/>
                                    </span>
                                </WithTooltip>
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
            <div
                className={classNames('file-preview__container', {compact: this.props.compactMode})}
                data-testid='file-preview-container'
            >
                {previews}
            </div>
        );
    }
}
