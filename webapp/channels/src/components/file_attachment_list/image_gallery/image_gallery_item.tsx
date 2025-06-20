// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {GALLERY_CONFIG} from './image_gallery';

import SingleImageView from '../../../components/single_image_view';

import './image_gallery_item.scss';

type Props = {
    fileInfo: FileInfo;
    allFilesForPost?: FileInfo[];
    postId: string;
    handleImageClick?: (startIndex: number, allFiles: FileInfo[]) => void;
    isSmall: boolean;
    itemStyle?: React.CSSProperties;
    index: number;
    totalImages: number;
};

const ImageGalleryItem = ({
    fileInfo,
    allFilesForPost,
    postId,
    handleImageClick,
    isSmall,
    itemStyle,
    index,
    totalImages,
}: Props) => {
    const handleClick = () => {
        const startIndex = allFilesForPost?.findIndex((f) => f.id === fileInfo.id) ?? -1;
        if (startIndex >= 0 && allFilesForPost) {
            handleImageClick?.(startIndex, allFilesForPost);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        }
    };

    return (
        <div
            key={fileInfo.id}
            className={classNames('image-gallery__item', {
                'image-gallery__item--small': isSmall,
            })}
            style={itemStyle}
            role='listitem'
            tabIndex={0}
            aria-label={`Image ${index + 1} of ${totalImages}`}
            onKeyDown={handleKeyDown}
        >
            <SingleImageView
                fileInfo={fileInfo}
                fileInfos={allFilesForPost}
                postId={postId}
                isEmbedVisible={true}
                compactDisplay={false}
                isInPermalink={false}
                disableActions={false}
                smallImageThreshold={GALLERY_CONFIG.SMALL_IMAGE_THRESHOLD}
                isGallery={true}
                handleImageClick={handleClick}
            />
        </div>
    );
};

export default ImageGalleryItem;
