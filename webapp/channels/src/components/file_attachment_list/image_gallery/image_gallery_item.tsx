// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

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
    onClick?: () => void;
    compactDisplay?: boolean;
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
    onClick,
    compactDisplay,
}: Props) => {
    const {formatMessage} = useIntl();

    const handleActivate = () => {
        onClick?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation(); // Prevent bubbling to avoid focus moving to post input
            handleActivate();
        }
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Image clicks are handled by SingleImageView; activate when clicking the item chrome
        if (e.target === e.currentTarget) {
            handleActivate();
        }
    };

    const handleFocus = () => {
        onFocus?.();
    };

    const ariaLabel = formatMessage(
        {id: 'image_gallery.item_label', defaultMessage: 'Image {current} of {total}: {filename}. Press Enter or Space to open in image viewer.'},
        {current: index + 1, total: totalImages, filename: fileInfo.name || ''},
    );

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
            onClick={handleClick}
        >
            <SingleImageView
                fileInfo={fileInfo}
                fileInfos={allFilesForPost}
                postId={postId}
                isEmbedVisible={true}
                compactDisplay={compactDisplay}
                isInPermalink={false}
                disableActions={false}
                smallImageThreshold={GALLERY_CONFIG.SMALL_IMAGE_THRESHOLD}
                isGallery={true}
            />
        </div>
    );
};

export default ImageGalleryItem;
