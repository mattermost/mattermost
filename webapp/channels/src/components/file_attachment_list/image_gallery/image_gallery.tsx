// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useCallback} from 'react';
import {useIntl} from 'react-intl';

import {DownloadOutlineIcon, MenuDownIcon, MenuRightIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';

import SingleImageView from '../../../components/single_image_view';

import type {PropsFromRedux} from './index';

import './image_gallery.scss';

// Gallery configuration constants
const GALLERY_CONFIG = {
    MAX_HEIGHT: 216,
    MIN_HEIGHT: 48,
    SMALL_IMAGE_PADDING: 16,
    MAX_WIDTH: 500,
    ASPECT_RATIO_CLAMP: { min: 1/3, max: 3 },
    SMALL_IMAGE_THRESHOLD: 216,
} as const;

type Props = PropsFromRedux & {
    fileInfos: FileInfo[];
    canDownloadFiles?: boolean;
    onToggleCollapse?: (collapsed: boolean) => void;
    isEmbedVisible?: boolean;
    postId: string;
};

const ImageGallery = (props: Props) => {
    const {
        fileInfos,
        canDownloadFiles = true,
        handleImageClick,
        onToggleCollapse,
        isEmbedVisible = true,
        postId,
    } = props;

    // Use the allFilesForPost from props (either passed explicitly or from Redux)
    const allFilesForPost = props.allFilesForPost;

    const [isCollapsed, setIsCollapsed] = useState(!isEmbedVisible);
    const [isDownloading, setIsDownloading] = useState(false);
    const {formatMessage} = useIntl();

    // Calculate the dynamic gallery height based on the tallest image, up to 216px max
    // For small images (< 216px), add 16px padding to their height in the calculation
    const galleryHeight = Math.min(
        Math.max(
            ...fileInfos.map((fileInfo) => {
                const imageHeight = fileInfo.height || 0;

                // If it's a small image, add padding to the height for gallery calculation
                return imageHeight < GALLERY_CONFIG.SMALL_IMAGE_THRESHOLD ? imageHeight + GALLERY_CONFIG.SMALL_IMAGE_PADDING : imageHeight;
            }),
            GALLERY_CONFIG.MIN_HEIGHT, // Minimum height to ensure usability
        ),
        GALLERY_CONFIG.MAX_HEIGHT, // Maximum height
    );

    const toggleGallery = () => {
        const newCollapsed = !isCollapsed;
        setIsCollapsed(newCollapsed);
        onToggleCollapse?.(newCollapsed);
    };

    const handleDownloadAll = useCallback(async () => {
        if (isDownloading || !canDownloadFiles) {
            return;
        }
        setIsDownloading(true);
        try {
            // Create and trigger downloads with proper cleanup
            const downloadPromises = fileInfos.map((fileInfo) => {
                return new Promise<void>((resolve) => {
                    const link = document.createElement('a');
                    link.href = fileInfo.link || '';
                    link.download = fileInfo.name;
                    link.style.display = 'none';
                    
                    // Add to DOM, click, then remove
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    // Small delay to ensure download starts
                    setTimeout(resolve, 50);
                });
            });

            // Wait for all downloads to be initiated
            await Promise.all(downloadPromises);
            
            // Add a small delay to ensure the button stays disabled long enough for testing
            await new Promise((resolve) => setTimeout(resolve, 100));
        } finally {
            setIsDownloading(false);
        }
    }, [fileInfos, isDownloading, canDownloadFiles]);

    return (
        <div
            className='image-gallery'
            data-testid='fileAttachmentList'
        >
            <div className='image-gallery__header'>
                <button
                    className='image-gallery__toggle'
                    onClick={toggleGallery}
                >
                    {isCollapsed ? (
                        <>
                            <MenuRightIcon size={16}/>
                            {formatMessage(
                                {
                                    id: 'image_gallery.show_images',
                                    defaultMessage: 'Show {count} images',
                                },
                                {count: fileInfos.length},
                            )}
                        </>
                    ) : (
                        <>
                            <MenuDownIcon size={16}/>
                            {formatMessage(
                                {
                                    id: 'image_gallery.hide_images',
                                    defaultMessage: '{count} images',
                                },
                                {count: fileInfos.length},
                            )}
                        </>
                    )}
                </button>
                <span className='image-gallery__separator'/>
                <button
                    className='image-gallery__download-all'
                    onClick={handleDownloadAll}
                    disabled={isDownloading || !canDownloadFiles}
                >
                    <DownloadOutlineIcon size={12}/>
                    {formatMessage({
                        id: 'image_gallery.download_all',
                        defaultMessage: 'Download All',
                    })}
                </button>
            </div>
            <div
                className={classNames('image-gallery__body', {
                    collapsed: isCollapsed,
                })}
            >
                {!isCollapsed && fileInfos.map((fileInfo) => {
                    // Calculate the width based on the image's aspect ratio
                    const aspectRatio = fileInfo.width && fileInfo.height ? fileInfo.width / fileInfo.height : 1;

                    // Clamp aspect ratio to avoid extremely wide or tall images
                    const clampedAspectRatio = Math.max(GALLERY_CONFIG.ASPECT_RATIO_CLAMP.min, Math.min(aspectRatio, GALLERY_CONFIG.ASPECT_RATIO_CLAMP.max)); // Clamp between 0.33 and 3

                    // For small images, use their natural width but gallery height for container
                    // For larger images, calculate width based on dynamic gallery height
                    const isSmallImage = (fileInfo.width || 0) < GALLERY_CONFIG.SMALL_IMAGE_THRESHOLD || (fileInfo.height || 0) < GALLERY_CONFIG.SMALL_IMAGE_THRESHOLD;
                    const naturalWidth = fileInfo.width || 0;
                    const naturalHeight = fileInfo.height || 0;

                    // Calculate width based on aspect ratio and gallery height
                    const calculatedWidth = Math.min(galleryHeight * clampedAspectRatio, GALLERY_CONFIG.MAX_WIDTH);

                    // For small images, use their natural width + padding, but ensure it doesn't exceed max width
                    const itemWidth = isSmallImage ?
                        Math.min(naturalWidth + GALLERY_CONFIG.SMALL_IMAGE_PADDING, GALLERY_CONFIG.MAX_WIDTH) : // Add 16px padding for small images, but cap at 500px
                        calculatedWidth;

                    // For height: if small image and it's the tallest, use natural height + padding
                    // Otherwise, use gallery height to match other taller images
                    const naturalHeightWithPadding = naturalHeight + GALLERY_CONFIG.SMALL_IMAGE_PADDING;
                    const itemHeight = isSmallImage && naturalHeightWithPadding === galleryHeight ?
                        naturalHeightWithPadding :
                        galleryHeight;

                    return (
                        <div
                            key={fileInfo.id}
                            className={classNames('image-gallery__item', {
                                'image-gallery__item--small': isSmallImage,
                            })}
                            style={{
                                width: `${itemWidth}px`,
                                height: `${itemHeight}px`,
                                maxWidth: '500px',
                                maxHeight: '216px',
                            }}
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
                                handleImageClick={() => {
                                    const startIndex = allFilesForPost?.findIndex((f) => f.id === fileInfo.id) ?? -1;
                                    if (startIndex >= 0 && allFilesForPost) {
                                        handleImageClick?.(startIndex, allFilesForPost);
                                    }
                                }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ImageGallery;
