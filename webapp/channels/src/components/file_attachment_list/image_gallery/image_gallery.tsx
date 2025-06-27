// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {useIntl} from 'react-intl';

import {MenuDownIcon, MenuRightIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';

import ImageGalleryItem from './image_gallery_item';

import type {PropsFromRedux} from './index';

import './image_gallery.scss';

// Gallery configuration constants
export const GALLERY_CONFIG = {
    SMALL_IMAGE_THRESHOLD: 216,
    BREAKPOINTS: {
        MOBILE: 400,
        TABLET: 640,
    },
    ASPECT_RATIOS: {
        HORIZONTAL_THRESHOLD: 1.05,
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

    // Determine span based on aspect ratio
    // For vertical images: ratio < 1/threshold
    if (aspectRatio < 1 / GALLERY_CONFIG.ASPECT_RATIOS.HORIZONTAL_THRESHOLD) {
        return GALLERY_CONFIG.GRID_SPANS.VERTICAL;
    }

    // For horizontal images: ratio > threshold
    if (aspectRatio > GALLERY_CONFIG.ASPECT_RATIOS.HORIZONTAL_THRESHOLD) {
        return GALLERY_CONFIG.GRID_SPANS.HORIZONTAL;
    }

    // For square-ish images
    return GALLERY_CONFIG.GRID_SPANS.SQUARE;
};

type Props = PropsFromRedux & {
    fileInfos: FileInfo[];
    onToggleCollapse?: (collapsed: boolean) => void;
    isEmbedVisible?: boolean;
    postId: string;
};

const ImageGallery = (props: Props) => {
    const {
        fileInfos,
        handleImageClick,
        onToggleCollapse,
        isEmbedVisible = true,
        postId,
    } = props;

    // Use the allFilesForPost from props (either passed explicitly or from Redux)
    const allFilesForPost = props.allFilesForPost;

    const [isCollapsed, setIsCollapsed] = useState(!isEmbedVisible);
    const {formatMessage} = useIntl();

    const galleryRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [ariaLiveMessage, setAriaLiveMessage] = useState('');
    const imageCountId = 'image-gallery-count';

    // Track component mount status to prevent state updates after unmount
    const isMountedRef = useRef(true);

    // Ref to store ResizeObserver instance for proper cleanup
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const timeoutIdRef = useRef<NodeJS.Timeout>();
    const rafIdRef = useRef<number>();
    const lastProcessedWidthRef = useRef<number | null>(null);
    const debouncedResizeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        const THROTTLE_DELAY = 16; // ~60fps

        const handleResize = () => {
            if (galleryRef.current && isMountedRef.current) {
                // Use requestAnimationFrame to ensure measurement happens after layout
                rafIdRef.current = requestAnimationFrame(() => {
                    if (galleryRef.current && isMountedRef.current) {
                        const newWidth = galleryRef.current.offsetWidth;
                        updateWidth(newWidth);
                    }
                });
            }
        };

        const updateWidth = (width: number) => {
            // Prevent infinite loops by checking if we've already processed this width
            if (lastProcessedWidthRef.current === width) {
                return;
            }

            // Use requestAnimationFrame to break out of ResizeObserver callback timing
            rafIdRef.current = requestAnimationFrame(() => {
                if (!isMountedRef.current) {
                    return;
                }

                const significantChange = lastProcessedWidthRef.current === null || Math.abs(lastProcessedWidthRef.current - width) > 5;

                if (significantChange) {
                    // Immediate update for significant changes
                    lastProcessedWidthRef.current = width;
                    setContainerWidth(width);
                } else {
                    // Throttle minor changes
                    if (timeoutIdRef.current) {
                        clearTimeout(timeoutIdRef.current);
                    }
                    timeoutIdRef.current = setTimeout(() => {
                        if (isMountedRef.current && lastProcessedWidthRef.current !== width) {
                            lastProcessedWidthRef.current = width;
                            setContainerWidth(width);
                        }
                    }, THROTTLE_DELAY);
                }
            });
        };

        // Use ResizeObserver for more accurate container size detection
        if (galleryRef.current && 'ResizeObserver' in window) {
            resizeObserverRef.current = new ResizeObserver((entries) => {
                // Use try-catch to handle ResizeObserver loop errors gracefully
                try {
                    for (const entry of entries) {
                        if (isMountedRef.current) {
                            const newWidth = Math.floor(entry.contentRect.width);
                            updateWidth(newWidth);
                        }
                    }
                } catch {
                    // Silently handle ResizeObserver loop errors to prevent console spam
                    // This includes the common "ResizeObserver loop completed with undelivered notifications" error
                }
            });
            resizeObserverRef.current.observe(galleryRef.current);
        } else {
            // Fallback to window resize with debouncing
            const debouncedResize = () => {
                if (timeoutIdRef.current) {
                    clearTimeout(timeoutIdRef.current);
                }
                timeoutIdRef.current = setTimeout(handleResize, THROTTLE_DELAY);
            };

            // Store reference for cleanup
            debouncedResizeRef.current = debouncedResize;
            window.addEventListener('resize', debouncedResize);
        }

        // Initial measurement
        handleResize();
    }, []);

    // Consolidated cleanup effect - ensures proper cleanup in ALL scenarios
    useEffect(() => {
        return () => {
            // Mark component as unmounted first
            isMountedRef.current = false;

            // Clean up all timers and animations
            if (timeoutIdRef.current) {
                clearTimeout(timeoutIdRef.current);
            }
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
            }

            // Disconnect ResizeObserver to prevent memory leaks
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
                resizeObserverRef.current = null;
            }

            // Clean up window event listener if it was used as fallback
            if (debouncedResizeRef.current) {
                window.removeEventListener('resize', debouncedResizeRef.current);
                debouncedResizeRef.current = null;
            }
        };
    }, []);

    const toggleGallery = useCallback(() => {
        const newCollapsed = !isCollapsed;
        if (isMountedRef.current) {
            setIsCollapsed(newCollapsed);
            setAriaLiveMessage(newCollapsed ? 'Gallery collapsed' : 'Gallery expanded');
        }
        onToggleCollapse?.(newCollapsed);
    }, [isCollapsed, onToggleCollapse]);

    // Memoize expensive column span calculations
    const imageStylesMap = useMemo(() => {
        const stylesMap = new Map<string, {
            isSmall: boolean;
            itemStyle: React.CSSProperties | undefined;
        }>();

        fileInfos.forEach((fileInfo) => {
            const isSmall = isSmallImage(fileInfo);
            let itemStyle: React.CSSProperties | undefined;

            if (containerWidth === 0) {
                // Initial render - let CSS handle everything
                itemStyle = undefined;
            } else if (containerWidth <= GALLERY_CONFIG.BREAKPOINTS.MOBILE) {
                // Mobile breakpoint - explicitly clear any grid column to let CSS container query take over
                itemStyle = {gridColumn: 'unset'};
            } else {
                // Desktop breakpoint - apply JavaScript calculated spans
                itemStyle = {gridColumn: `span ${getColumnSpan(fileInfo, isSmall, containerWidth)}`};
            }

            stylesMap.set(fileInfo.id, {isSmall, itemStyle});
        });

        return stylesMap;
    }, [fileInfos, containerWidth]);

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
                    aria-expanded={!isCollapsed}
                    aria-describedby={imageCountId}
                >
                    {isCollapsed ? (
                        <>
                            <MenuRightIcon size={16}/>
                            <span id={imageCountId}>
                                {formatMessage(
                                    {id: 'image_gallery.show_images', defaultMessage: 'Show {count} images'},
                                    {count: fileInfos.length},
                                )}
                            </span>
                        </>
                    ) : (
                        <>
                            <MenuDownIcon size={16}/>
                            <span id={imageCountId}>
                                {formatMessage(
                                    {id: 'image_gallery.hide_images', defaultMessage: '{count} images'},
                                    {count: fileInfos.length},
                                )}
                            </span>
                        </>
                    )}
                </button>
            </div>
            <div
                className={classNames('image-gallery__body', {
                    collapsed: isCollapsed,
                })}
                role='list'
            >
                <div className='image-gallery__content'>
                    {fileInfos.map((fileInfo, idx) => {
                        const memoizedData = imageStylesMap.get(fileInfo.id);
                        if (!memoizedData) {
                            return null; // Safety fallback
                        }

                        const {isSmall, itemStyle} = memoizedData;

                        return (
                            <ImageGalleryItem
                                key={`${fileInfo.id}-${containerWidth > GALLERY_CONFIG.BREAKPOINTS.MOBILE ? 'desktop' : 'mobile'}`}
                                fileInfo={fileInfo}
                                allFilesForPost={allFilesForPost}
                                postId={postId}
                                handleImageClick={handleImageClick}
                                isSmall={isSmall}
                                itemStyle={itemStyle}
                                index={idx}
                                totalImages={fileInfos.length}
                            />
                        );
                    })}
                </div>
            </div>
            <div
                aria-live='polite'
                style={{position: 'absolute', left: '-9999px', height: '1px', width: '1px', overflow: 'hidden'}}
            >
                {ariaLiveMessage}
            </div>
        </div>
    );
};

export default ImageGallery;
