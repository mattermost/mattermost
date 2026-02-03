// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import classNames from 'classnames';

import type {FileInfo} from '@mattermost/types/files';

import {getFilePreviewUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';

import FilePreviewModal from 'components/file_preview_modal';
import SizeAwareImage from 'components/size_aware_image';

import {ModalIdentifiers} from 'utils/constants';

import type {PropsFromRedux} from './index';

import './multi_image_view.scss';

export interface Props extends PropsFromRedux {
    fileInfos: FileInfo[];
    postId: string;
    compactDisplay?: boolean;
    isInPermalink?: boolean;
}

export default function MultiImageView(props: Props) {
    const {fileInfos, postId, compactDisplay, isInPermalink} = props;
    const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

    const handleImageClick = useCallback((index: number) => {
        props.actions.openModal({
            modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
            dialogType: FilePreviewModal,
            dialogProps: {
                fileInfos,
                postId,
                startIndex: index,
            },
        });
    }, [fileInfos, postId, props.actions]);

    const handleImageLoaded = useCallback((fileId: string) => {
        setLoadedImages((prev) => ({
            ...prev,
            [fileId]: true,
        }));
    }, []);

    if (!fileInfos || fileInfos.length === 0) {
        return null;
    }

    return (
        <div
            className={classNames('multi-image-view', {
                'compact-display': compactDisplay,
                'is-permalink': isInPermalink,
            })}
            data-testid='multiImageView'
        >
            {fileInfos.map((fileInfo, index) => {
                if (!fileInfo || fileInfo.archived) {
                    return null;
                }

                const {has_preview_image: hasPreviewImage, id} = fileInfo;
                const fileUrl = getFileUrl(id);
                const previewUrl = hasPreviewImage ? getFilePreviewUrl(id) : fileUrl;

                const dimensions = {
                    width: fileInfo.width || 0,
                    height: fileInfo.height || 0,
                };

                const isLoaded = loadedImages[id];

                return (
                    <div
                        key={id}
                        className={classNames('multi-image-view__item', {
                            'multi-image-view__item--loaded': isLoaded,
                        })}
                    >
                        <SizeAwareImage
                            onClick={() => handleImageClick(index)}
                            className={classNames('multi-image-view__image', {
                                'compact-display': compactDisplay,
                                'is-permalink': isInPermalink,
                            })}
                            src={previewUrl}
                            dimensions={dimensions}
                            fileInfo={fileInfo}
                            fileURL={fileUrl}
                            onImageLoaded={() => handleImageLoaded(id)}
                            showLoader={true}
                            handleSmallImageContainer={true}
                            maxHeight={props.maxImageHeight || undefined}
                            maxWidth={props.maxImageWidth || undefined}
                        />
                    </div>
                );
            })}
        </div>
    );
}
