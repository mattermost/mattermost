// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {announce} from '@atlaskit/pragmatic-drag-and-drop-live-region';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarksBarItem from './bookmarks_bar_item';
import BookmarksBarMenu from './bookmarks_bar_menu';
import BookmarkMeasureItem from './bookmarks_measure_item';
import {useBookmarksDnd} from './hooks';
import {useChannelBookmarks, MAX_BOOKMARKS_PER_CHANNEL, useCanUploadFiles, useChannelBookmarkPermission} from './utils';

import './channel_bookmarks.scss';

// Space to reserve for the menu button
const MENU_BUTTON_WIDTH = 80;

// Debounce delay for overflow recalculation
const OVERFLOW_DEBOUNCE_MS = 100;

type Props = {
    channelId: string;
};

function ChannelBookmarks({channelId}: Props) {
    const {formatMessage} = useIntl();
    const {order, bookmarks, reorder} = useChannelBookmarks(channelId);
    const canReorder = Boolean(useChannelBookmarkPermission(channelId, 'order'));
    const canAdd = Boolean(useChannelBookmarkPermission(channelId, 'add'));
    const canUploadFiles = useCanUploadFiles();
    const hasBookmarks = Boolean(order?.length);
    const limitReached = order.length >= MAX_BOOKMARKS_PER_CHANNEL;

    // --- Overflow detection ---
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
    const isDraggingRef = useRef(false);
    const pendingRecalcRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

    const [overflowStartIndex, setOverflowStartIndex] = useState<number>(order.length);

    const registerItemRef = useCallback((id: string, element: HTMLElement | null) => {
        if (element) {
            itemRefs.current.set(id, element);
        } else {
            itemRefs.current.delete(id);
        }
    }, []);

    const calculateOverflow = useCallback(() => {
        const container = containerRef.current;
        if (!container || order.length === 0) {
            setOverflowStartIndex(order.length);
            return;
        }

        const containerWidth = container.getBoundingClientRect().width;
        const availableWidth = containerWidth - MENU_BUTTON_WIDTH - 16; // 16px padding

        let usedWidth = 0;
        let newOverflowIndex = order.length;

        for (let i = 0; i < order.length; i++) {
            const itemEl = itemRefs.current.get(order[i]);
            if (!itemEl) {
                continue;
            }

            const itemWidth = itemEl.getBoundingClientRect().width + 4; // 4px gap
            if (usedWidth + itemWidth > availableWidth) {
                newOverflowIndex = Math.max(1, i); // Always show at least 1
                break;
            }
            usedWidth += itemWidth;
        }

        setOverflowStartIndex(newOverflowIndex);
    }, [order]);

    const debouncedCalculateOverflow = useCallback(() => {
        if (isDraggingRef.current) {
            pendingRecalcRef.current = true;
            return;
        }

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(calculateOverflow, OVERFLOW_DEBOUNCE_MS);
    }, [calculateOverflow]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return undefined;
        }

        const timeoutId = setTimeout(calculateOverflow, 0);

        const resizeObserver = new ResizeObserver(() => {
            debouncedCalculateOverflow();
        });
        resizeObserver.observe(container);

        return () => {
            clearTimeout(timeoutId);
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            resizeObserver.disconnect();
        };
    }, [calculateOverflow, debouncedCalculateOverflow, order]);

    const visibleItems = useMemo(() => order.slice(0, overflowStartIndex), [order, overflowStartIndex]);
    const overflowItems = useMemo(() => order.slice(overflowStartIndex), [order, overflowStartIndex]);

    // --- DnD coordination ---
    const {
        isDragging,
        autoOpenOverflow,
        setAutoOpenOverflow,
    } = useBookmarksDnd({
        order,
        visibleItems,
        overflowItems,
        onReorder: reorder,
    });

    // Track whether the drag overlay should be visible. Stays true briefly
    // after drop so the user sees the reorder result.
    const [showDragOverlay, setShowDragOverlay] = useState(false);
    const postDropTimerRef = useRef<ReturnType<typeof setTimeout>>();

    // Sync isDraggingRef for debounced overflow calc
    useEffect(() => {
        isDraggingRef.current = isDragging;
        if (!isDragging && pendingRecalcRef.current) {
            pendingRecalcRef.current = false;
            calculateOverflow();
        }
    }, [isDragging, calculateOverflow]);

    // Show drag overlay when auto-open triggers, hide after post-drop delay
    useEffect(() => {
        if (isDragging && autoOpenOverflow) {
            setShowDragOverlay(true);
        } else if (!isDragging && showDragOverlay) {
            // Drag ended — hold overlay briefly, then close
            postDropTimerRef.current = setTimeout(() => {
                setShowDragOverlay(false);
                setAutoOpenOverflow(false);
            }, 400);
        }

        return () => {
            if (postDropTimerRef.current) {
                clearTimeout(postDropTimerRef.current);
            }
        };
    }, [isDragging, autoOpenOverflow, showDragOverlay, setAutoOpenOverflow]);

    const handleOverflowOpenChange = useCallback(() => {
        // Normal menu toggle — no interaction with drag overlay
    }, []);

    // Keyboard movement handler — moves a bookmark by one position
    const handleKeyboardMove = useCallback((id: string, direction: -1 | 1) => {
        const currentIndex = order.indexOf(id);
        if (currentIndex === -1) {
            return;
        }
        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= order.length) {
            return;
        }
        const bookmarkName = bookmarks[id]?.display_name ?? '';
        reorder(id, currentIndex, newIndex);
        announce(
            formatMessage(
                {id: 'channel_bookmarks.moved', defaultMessage: '{name} moved to position {position} of {total}'},
                {name: bookmarkName, position: newIndex + 1, total: order.length},
            ),
        );
    }, [order, bookmarks, reorder, formatMessage]);

    // --- Render ---
    if (!hasBookmarks) {
        return null;
    }

    return (
        <Container
            ref={containerRef}
            data-testid='channel-bookmarks-container'
            className='channel-bookmarks-container'
        >
            <BookmarksBarContent>
                {/* Hidden measure components for ALL items */}
                {order.map((id) => {
                    const bookmark = bookmarks[id];
                    if (!bookmark) {
                        return null;
                    }
                    return (
                        <BookmarkMeasureItem
                            key={`measure-${id}`}
                            id={id}
                            bookmark={bookmark}
                            onMount={registerItemRef}
                        />
                    );
                })}

                {/* Visible bar items with pragmatic-dnd */}
                {visibleItems.map((id) => {
                    const bookmark: ChannelBookmark | undefined = bookmarks[id];
                    if (!bookmark) {
                        return null;
                    }
                    const orderIndex = order.indexOf(id);
                    return (
                        <BookmarksBarItem
                            key={id}
                            id={id}
                            bookmark={bookmark}
                            disabled={!canReorder}
                            isDraggingGlobal={isDragging}
                            onMoveLeft={canReorder && orderIndex > 0 ? () => handleKeyboardMove(id, -1) : undefined}
                            onMoveRight={canReorder && orderIndex < order.length - 1 ? () => handleKeyboardMove(id, 1) : undefined}
                        />
                    );
                })}
            </BookmarksBarContent>

            <BookmarksBarMenu
                channelId={channelId}
                overflowItems={overflowItems}
                bookmarks={bookmarks}
                hasBookmarks={hasBookmarks}
                limitReached={limitReached}
                canUploadFiles={canUploadFiles}
                canReorder={canReorder}
                canAdd={canAdd}
                isDragging={isDragging}
                forceOpen={showDragOverlay || undefined}
                onOpenChange={handleOverflowOpenChange}
                order={order}
                onKeyboardMove={canReorder ? handleKeyboardMove : undefined}
            />
        </Container>
    );
}

export default ChannelBookmarks;

const Container = styled.div`
    display: flex;
    padding: 0 6px;
    padding-right: 0;
    min-height: 38px;
    align-items: center;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    max-width: 100vw;
    gap: 2px;
`;

const BookmarksBarContent = styled.div`
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    position: relative;
`;
