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
    isSmall: boolean;
    itemStyle?: React.CSSProperties;
    index: number;
    totalImages: number;
    isFocused?: boolean;
    onFocus?: () => void;
    onMouseDown?: () => void;
};

const ImageGalleryItem = ({
    fileInfo,
    allFilesForPost,
    postId,
    isSmall,
    itemStyle,
    index,
    totalImages,
    isFocused,
    onFocus,
    onMouseDown,
}: Props) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();

            // The SingleImageView will handle the click behavior
        }
    };

    const handleFocus = () => {
        onFocus?.();
    };

    // Generate comprehensive aria-label for screen readers
    const ariaLabel = `Image ${index + 1} of ${totalImages}${fileInfo.name ? `: ${fileInfo.name}` : ''}${fileInfo.extension ? ` (${fileInfo.extension.toUpperCase()})` : ''}. Press Enter or Space to open in image viewer.`;

    return (
        <div
            key={fileInfo.id}
            className={classNames('image-gallery__item', {
                'image-gallery__item--small': isSmall,
                'image-gallery__item--focused': isFocused,
            })}
            data-testid='image-gallery__item'
            style={itemStyle}
            role='listitem'
            tabIndex={0}
            aria-label={ariaLabel}
            aria-current={isFocused ? 'true' : undefined}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onMouseDown={onMouseDown}
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
            />
        </div>
    );
};

export default ImageGalleryItem;
