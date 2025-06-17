// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useRef, useEffect} from 'react';
import {useIntl} from 'react-intl';

import {DownloadOutlineIcon, MenuDownIcon, MenuRightIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';

import SingleImageView from '../../../components/single_image_view';

import type {PropsFromRedux} from './index';

import './image_gallery.scss';

// Gallery configuration constants
const GALLERY_CONFIG = {
    SMALL_IMAGE_THRESHOLD: 216,
    BREAKPOINTS: {
        MOBILE: 400,
        TABLET: 640,
    },
    ASPECT_RATIOS: {
        HORIZONTAL_THRESHOLD: 1.2,
        SQUARE_TOLERANCE: 0.2,
    },
    GRID_SPANS: {
        SMALL: 2,
        VERTICAL: 3,
        SQUARE: 5,
        HORIZONTAL: 7,
    },
} as const;

// Utility functions for size calculations
const isSmallImage = (fileInfo: FileInfo): boolean => {
    const width = fileInfo.width || 0;
    const height = fileInfo.height || 0;
    return width < GALLERY_CONFIG.SMALL_IMAGE_THRESHOLD || height < GALLERY_CONFIG.SMALL_IMAGE_THRESHOLD;
};

/**
 * Determines the number of grid columns an image should span based on its dimensions and container width.
 *
 * @param fileInfo - Image metadata containing width and height
 * @param isSmall - Whether the image is considered small (< threshold)
 * @param containerWidth - Current width of the gallery container
 * @returns Number of grid columns to span (2-7)
 */
const getColumnSpan = (fileInfo: FileInfo, isSmall: boolean, containerWidth: number): number => {
    const {width = 1, height = 1} = fileInfo;
    const aspectRatio = width / height;

    // If width is less than the small image threshold, span 2 columns
    if (width < GALLERY_CONFIG.SMALL_IMAGE_THRESHOLD) {
        return GALLERY_CONFIG.GRID_SPANS.SMALL;
    }

    // Only for small vertical or small square images on large screens
    if (containerWidth > GALLERY_CONFIG.BREAKPOINTS.TABLET && isSmall) {
        const isVertical = aspectRatio < 1 / GALLERY_CONFIG.ASPECT_RATIOS.HORIZONTAL_THRESHOLD;
        const isSquare = Math.abs(aspectRatio - 1) < GALLERY_CONFIG.ASPECT_RATIOS.SQUARE_TOLERANCE;

        if (isVertical || isSquare) {
            return GALLERY_CONFIG.GRID_SPANS.SMALL;
        }
    }

    if (aspectRatio > GALLERY_CONFIG.ASPECT_RATIOS.HORIZONTAL_THRESHOLD) {
        return GALLERY_CONFIG.GRID_SPANS.HORIZONTAL;
    } else if (aspectRatio < 1 / GALLERY_CONFIG.ASPECT_RATIOS.HORIZONTAL_THRESHOLD) {
        return GALLERY_CONFIG.GRID_SPANS.VERTICAL;
    }

    return GALLERY_CONFIG.GRID_SPANS.SQUARE;
};

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

    const galleryRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const handleResize = () => {
            if (galleryRef.current) {
                setContainerWidth(galleryRef.current.offsetWidth);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleGallery = () => {
        const newCollapsed = !isCollapsed;
        setIsCollapsed(newCollapsed);
        onToggleCollapse?.(newCollapsed);
    };

    const handleDownloadAll = async () => {
        if (isDownloading || !canDownloadFiles) {
            return;
        }
        setIsDownloading(true);
        try {
            const downloadPromises = fileInfos.map((fileInfo) => {
                return new Promise<void>((resolve) => {
                    const link = document.createElement('a');
                    link.href = fileInfo.link || '';
                    link.download = fileInfo.name;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(resolve, 50);
                });
            });
            await Promise.all(downloadPromises);
            await new Promise((resolve) => setTimeout(resolve, 100));
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div
            className='image-gallery'
            data-testid='fileAttachmentList'
            ref={galleryRef}
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
                    const isSmall = isSmallImage(fileInfo);

                    // For mobile, let CSS handle the span. For others, use getColumnSpan.
                    const itemStyle = containerWidth < GALLERY_CONFIG.BREAKPOINTS.MOBILE ? undefined : {gridColumn: `span ${getColumnSpan(fileInfo, isSmall, containerWidth)}`};

                    return (
                        <div
                            key={fileInfo.id}
                            className={classNames('image-gallery__item', {
                                'image-gallery__item--small': isSmall,
                            })}
                            style={itemStyle}
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
