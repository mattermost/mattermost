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
    NORMAL_ROW_HEIGHT: 216,
    COMPACT_ROW_HEIGHT: 144,
    COLUMN_WIDTH: 50,
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
        MIN: 2,
        MAX: 6,
    },
} as const;

// Utility functions for size calculations
const isSmallImage = (fileInfo: FileInfo): boolean => {
    const width = fileInfo.width || 0;
    const height = fileInfo.height || 0;
    return width < GALLERY_CONFIG.SMALL_IMAGE_THRESHOLD || height < GALLERY_CONFIG.SMALL_IMAGE_THRESHOLD;
};

/**
 * Determines the number of grid columns an image should span based on its dimensions, container width, and display mode.
 * Uses aspect-ratio-aware calculation: ideal width = rowHeight * aspectRatio; span = round(idealWidth / 50), clamped 2-6.
 *
 * @param fileInfo - Image metadata containing width and height
 * @param isSmall - Whether the image is considered small (< threshold)
 * @param containerWidth - Current width of the gallery container
 * @param compactDisplay - Whether compact message display mode is active (shorter row height)
 * @returns Number of grid columns to span (2-6)
 */
const getColumnSpan = (fileInfo: FileInfo, isSmall: boolean, containerWidth: number, compactDisplay?: boolean): number => {
    const {width = 1, height = 1} = fileInfo;
    const aspectRatio = width / height;
    const rowHeight = compactDisplay ? GALLERY_CONFIG.COMPACT_ROW_HEIGHT : GALLERY_CONFIG.NORMAL_ROW_HEIGHT;
    const smallThreshold = compactDisplay ? GALLERY_CONFIG.COMPACT_ROW_HEIGHT : GALLERY_CONFIG.SMALL_IMAGE_THRESHOLD;

    // Small images (intrinsic dimensions below threshold): span 2
    if (width < smallThreshold) {
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

    // Aspect-ratio-aware span: ideal width = rowHeight * aspectRatio; span = round(idealWidth / columnWidth)
    const idealWidth = rowHeight * aspectRatio;
    const span = Math.round(idealWidth / GALLERY_CONFIG.COLUMN_WIDTH);
    return Math.max(GALLERY_CONFIG.GRID_SPANS.MIN, Math.min(GALLERY_CONFIG.GRID_SPANS.MAX, span));
};

type Props = PropsFromRedux & {
    fileInfos: FileInfo[];
    onToggleCollapse?: (collapsed: boolean) => void;
    isEmbedVisible?: boolean;
    postId: string;
    compactDisplay?: boolean;
};

const ImageGallery = (props: Props) => {
    const {
        fileInfos,
        onToggleCollapse,
        isEmbedVisible = true,
        postId,
        compactDisplay,
    } = props;

    // Use the allFilesForPost from props (either passed explicitly or from Redux)
    const allFilesForPost = props.allFilesForPost;

    const [isCollapsed, setIsCollapsed] = useState(!isEmbedVisible);
    const {formatMessage} = useIntl();

    const galleryRef = useRef<HTMLDivElement>(null);
    const toggleButtonRef = useRef<HTMLButtonElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [ariaLiveMessage, setAriaLiveMessage] = useState('');
    const [focusedItemIndex, setFocusedItemIndex] = useState<number>(-1);
    const [isKeyboardNavigation, setIsKeyboardNavigation] = useState<boolean>(false);
    const imageCountId = 'image-gallery-count';
    const galleryBodyId = `image-gallery-body-${postId}`;
    const galleryDescriptionId = `image-gallery-description-${postId}`;

    // Track component mount status to prevent state updates after unmount
    const isMountedRef = useRef(true);

    // Ref to store ResizeObserver instance for proper cleanup
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const timeoutIdRef = useRef<NodeJS.Timeout>();
    const rafIdRef = useRef<number>();
    const lastProcessedWidthRef = useRef<number | null>(null);
    const debouncedResizeRef = useRef<(() => void) | null>(null);
    const pendingWidthRef = useRef<number | null>(null);
    const applyPendingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const isRhsTransitioning = () => document.getElementById('root')?.classList.contains('rhs-transitioning') ?? false;

    useEffect(() => {
        const THROTTLE_DELAY = 16; // ~60fps
        const RHS_TRANSITION_END_MS = 350;

        const applyPendingWidth = () => {
            if (pendingWidthRef.current !== null && isMountedRef.current) {
                const width = pendingWidthRef.current;
                pendingWidthRef.current = null;
                lastProcessedWidthRef.current = width;
                setContainerWidth(width);
            }
        };

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
            // During RHS expand/collapse transition, defer layout updates until transition ends
            if (isRhsTransitioning()) {
                pendingWidthRef.current = width;
                if (!applyPendingTimeoutRef.current) {
                    applyPendingTimeoutRef.current = setTimeout(() => {
                        applyPendingTimeoutRef.current = undefined;
                        applyPendingWidth();
                    }, RHS_TRANSITION_END_MS);
                }
                return;
            }

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
            if (applyPendingTimeoutRef.current) {
                clearTimeout(applyPendingTimeoutRef.current);
                applyPendingTimeoutRef.current = undefined;
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

    // Keyboard navigation and focus management
    const focusImageItem = useCallback((index: number, fromKeyboard = false) => {
        const galleryContent = galleryRef.current?.querySelector('.image-gallery__content');
        const items = galleryContent?.querySelectorAll('[role="listitem"]');
        const targetItem = items?.[index] as HTMLElement;

        if (targetItem) {
            targetItem.focus();
            setFocusedItemIndex(index);

            // Only set keyboard navigation flag for actual keyboard navigation
            if (fromKeyboard) {
                setIsKeyboardNavigation(true);

                // Announce to screen readers only during keyboard navigation
                const fileInfo = fileInfos[index];
                if (fileInfo) {
                    setAriaLiveMessage(
                        formatMessage(
                            {
                                id: 'image_gallery.focus_image',
                                defaultMessage: 'Focused on image {current} of {total}: {filename}',
                            },
                            {
                                current: index + 1,
                                total: fileInfos.length,
                                filename: fileInfo.name || 'Image',
                            },
                        ),
                    );
                }
            } else {
                // Programmatic focus (e.g., from modal return) - don't show enhanced focus
                setIsKeyboardNavigation(false);
            }
        }
    }, [fileInfos, formatMessage]);

    const handleKeyNavigation = useCallback((event: React.KeyboardEvent) => {
        if (isCollapsed) {
            return;
        }

        const currentIndex = focusedItemIndex;
        let newIndex = currentIndex;

        switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
            event.preventDefault();
            newIndex = currentIndex < fileInfos.length - 1 ? currentIndex + 1 : 0; // Wrap to first
            break;
        case 'ArrowLeft':
        case 'ArrowUp':
            event.preventDefault();
            newIndex = currentIndex > 0 ? currentIndex - 1 : fileInfos.length - 1; // Wrap to last
            break;
        case 'Home':
            event.preventDefault();
            newIndex = 0;
            break;
        case 'End':
            event.preventDefault();
            newIndex = fileInfos.length - 1;
            break;
        default:
            return;
        }

        focusImageItem(newIndex, true);
    }, [isCollapsed, focusedItemIndex, fileInfos.length, focusImageItem]);

    const toggleGallery = useCallback(() => {
        const newCollapsed = !isCollapsed;
        if (isMountedRef.current) {
            setIsCollapsed(newCollapsed);

            // Improved screen reader announcements
            const announcement = newCollapsed ? formatMessage(
                {id: 'image_gallery.collapsed', defaultMessage: 'Image gallery collapsed. {count} images hidden.'},
                {count: fileInfos.length},
            ) : formatMessage(
                {id: 'image_gallery.expanded', defaultMessage: 'Image gallery expanded. {count} images visible. Use arrow keys to navigate between images.'},
                {count: fileInfos.length},
            );

            setAriaLiveMessage(announcement);

            // Focus management
            if (newCollapsed) {
                // When collapsing, return focus to toggle button
                setFocusedItemIndex(-1);
                setTimeout(() => {
                    if (isMountedRef.current && toggleButtonRef.current) {
                        toggleButtonRef.current.focus();
                    }
                }, 100);
            } else {
                // When expanding, focus first image after a short delay (programmatic focus)
                setTimeout(() => {
                    if (isMountedRef.current && fileInfos.length > 0) {
                        focusImageItem(0, false); // false = not from keyboard
                    }
                }, 100);
            }
        }
        onToggleCollapse?.(newCollapsed);
    }, [isCollapsed, onToggleCollapse, fileInfos.length, formatMessage, focusImageItem]);

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
                itemStyle = {gridColumn: `span ${getColumnSpan(fileInfo, isSmall, containerWidth, compactDisplay)}`};
            }

            stylesMap.set(fileInfo.id, {isSmall, itemStyle});
        });

        return stylesMap;
    }, [fileInfos, containerWidth, compactDisplay]);

    return (
        <div
            className={classNames('image-gallery', {'image-gallery--compact': compactDisplay})}
            data-testid='fileAttachmentList'
            ref={galleryRef}
        >
            <div className='image-gallery__header'>
                <button
                    ref={toggleButtonRef}
                    className='image-gallery__toggle'
                    data-testid='image-gallery__toggle'
                    onClick={toggleGallery}
                    aria-expanded={!isCollapsed}
                    aria-describedby={`${imageCountId} ${galleryDescriptionId}`}
                    aria-controls={galleryBodyId}
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
                <div
                    id={galleryDescriptionId}
                    className='sr-only'
                >
                    {formatMessage(
                        {
                            id: 'image_gallery.instructions',
                            defaultMessage: 'Use arrow keys to navigate between images, Enter or Space to open image viewer',
                        },
                    )}
                </div>
            </div>
            <div
                id={galleryBodyId}
                className={classNames('image-gallery__body', {
                    collapsed: isCollapsed,
                })}
                data-testid='image-gallery__body'
                role='application'
                aria-label={formatMessage(
                    {id: 'image_gallery.list_label', defaultMessage: 'Image gallery with {count} images'},
                    {count: fileInfos.length},
                )}
                onKeyDown={handleKeyNavigation}
                tabIndex={isCollapsed ? -1 : 0}
            >
                <div
                    className='image-gallery__content'
                    role='list'
                >
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
                                isSmall={isSmall}
                                itemStyle={itemStyle}
                                index={idx}
                                totalImages={fileInfos.length}
                                isFocused={focusedItemIndex === idx && isKeyboardNavigation}
                                onFocus={() => setFocusedItemIndex(idx)}
                                onMouseDown={() => setIsKeyboardNavigation(false)}
                                compactDisplay={compactDisplay}
                            />
                        );
                    })}
                </div>
            </div>
            <div
                aria-live='polite'
                aria-atomic='true'
                className='sr-only'
            >
                {ariaLiveMessage}
            </div>
        </div>
    );
};

export default ImageGallery;
