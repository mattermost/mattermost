// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragOverlay,
    MeasuringStrategy,
} from '@dnd-kit/core';
import type {DragOverEvent} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarkItemContent from './bookmark_item_content';
import BookmarksBarMenu from './bookmarks_bar_menu';
import BookmarkMeasureItem from './bookmarks_measure_item';
import BookmarksSortableItem from './bookmarks_sortable_item';
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
    const {order, bookmarks, reorder} = useChannelBookmarks(channelId);
    const canReorder = Boolean(useChannelBookmarkPermission(channelId, 'order'));
    const canUploadFiles = useCanUploadFiles();
    const hasBookmarks = Boolean(order?.length);
    const limitReached = order.length >= MAX_BOOKMARKS_PER_CHANNEL;

    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
    const isDraggingRef = useRef(false);
    const pendingRecalcRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

    const [overflowStartIndex, setOverflowStartIndex] = useState<number>(order.length);

    // Register item element for measurement
    const registerItemRef = useCallback((id: string, element: HTMLElement | null) => {
        if (element) {
            itemRefs.current.set(id, element);
        } else {
            itemRefs.current.delete(id);
        }
    }, []);

    // Calculate which items overflow
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

    // Debounced version that skips while dragging
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

    // Recalculate overflow on mount, resize, and order changes
    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return undefined;
        }

        // Calculate after items have rendered
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

    // Visible and overflow item lists
    const visibleItems = useMemo(() => order.slice(0, overflowStartIndex), [order, overflowStartIndex]);
    const overflowItems = useMemo(() => order.slice(overflowStartIndex), [order, overflowStartIndex]);

    // DnD sensors — MouseSensor + TouchSensor for better cross-device handling
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    // Wire up the bookmarks DnD hook
    const {
        dragState,
        handleDragStart: hookDragStart,
        handleDragOver: hookDragOver,
        handleDragEnd: hookDragEnd,
        handleDragCancel: hookDragCancel,
        getLocalOrder,
    } = useBookmarksDnd({
        visibleItems,
        overflowItems,
        onReorder: reorder,
    });

    // Overflow menu auto-open state (controlled by drag proximity)
    const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);

    const handleDragStart = useCallback((...args: Parameters<typeof hookDragStart>) => {
        isDraggingRef.current = true;
        hookDragStart(...args);
    }, [hookDragStart]);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        hookDragOver(event);

        // Auto-open overflow menu when dragging near it
        if (event.over?.id === 'overflow-drop-zone') {
            setOverflowMenuOpen(true);
        }
    }, [hookDragOver]);

    const handleDragEnd = useCallback(async (...args: Parameters<typeof hookDragEnd>) => {
        isDraggingRef.current = false;

        // Don't force-close the overflow menu here — when isDragging goes false,
        // forceOpen reverts to undefined (uncontrolled) and the menu's own anchor
        // state keeps it open. The user closes it normally (click outside / escape),
        // which fires onToggle(false) → setOverflowMenuOpen(false).

        await hookDragEnd(...args);

        // Flush any pending recalculation from resizes that happened during drag
        if (pendingRecalcRef.current) {
            pendingRecalcRef.current = false;
            calculateOverflow();
        }
    }, [hookDragEnd, calculateOverflow]);

    const handleDragCancel = useCallback(() => {
        isDraggingRef.current = false;
        setOverflowMenuOpen(false);

        hookDragCancel();

        // Flush any pending recalculation
        if (pendingRecalcRef.current) {
            pendingRecalcRef.current = false;
            calculateOverflow();
        }
    }, [hookDragCancel, calculateOverflow]);

    const handleOverflowOpenChange = useCallback((open: boolean) => {
        setOverflowMenuOpen(open);
    }, []);

    const isDragging = dragState.activeId !== null;

    // Get active bookmark for drag overlay
    const activeBookmark: ChannelBookmark | null = dragState.activeId ? bookmarks[String(dragState.activeId)] : null;

    // During drag, use the hook's optimistic order for both containers
    const localOrder = getLocalOrder();
    const barRenderOrder = isDragging ? localOrder.visible : visibleItems;
    const overflowRenderOrder = isDragging ? localOrder.overflow : overflowItems;

    // Show empty state with just add button if no bookmarks
    if (!hasBookmarks) {
        return (
            <Container
                ref={containerRef}
                data-testid='channel-bookmarks-container'
                className='channel-bookmarks-container'
            >
                <BookmarksBarMenu
                    channelId={channelId}
                    overflowItems={[]}
                    bookmarks={bookmarks}
                    hasBookmarks={false}
                    limitReached={limitReached}
                    canUploadFiles={canUploadFiles}
                    canReorder={canReorder}
                    isDragging={false}
                />
            </Container>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            measuring={{
                droppable: {
                    strategy: MeasuringStrategy.Always,
                },
            }}
        >
            <Container
                ref={containerRef}
                data-testid='channel-bookmarks-container'
                className='channel-bookmarks-container'
            >
                <BookmarksBarContent>
                    {/* Hidden measure components for ALL items — always present regardless
                        of visible/overflow split, so calculateOverflow has consistent refs. */}
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

                    {/* During drag, SortableContext uses the optimistic order so dnd-kit
                        manages transforms/transitions for cross-container items properly. */}
                    <SortableContext
                        items={barRenderOrder}
                        strategy={horizontalListSortingStrategy}
                        id='bar'
                    >
                        {barRenderOrder.map((id) => {
                            const bookmark = bookmarks[id];
                            if (!bookmark) {
                                return null;
                            }

                            return (
                                <BookmarksSortableItem
                                    key={id}
                                    id={id}
                                    bookmark={bookmark}
                                    disabled={!canReorder}
                                    isDragging={isDragging}
                                />
                            );
                        })}
                    </SortableContext>
                </BookmarksBarContent>

                <BookmarksBarMenu
                    channelId={channelId}
                    overflowItems={overflowRenderOrder}
                    bookmarks={bookmarks}
                    hasBookmarks={hasBookmarks}
                    limitReached={limitReached}
                    canUploadFiles={canUploadFiles}
                    canReorder={canReorder}
                    isDragging={isDragging}
                    forceOpen={isDragging ? overflowMenuOpen : undefined}
                    onOpenChange={handleOverflowOpenChange}
                />
            </Container>

            <DragOverlay zIndex={1400}>
                {activeBookmark ? (
                    <DragOverlayItem>
                        <BookmarkItemContent
                            bookmark={activeBookmark}
                            disableInteractions={true}
                        />
                    </DragOverlayItem>
                ) : null}
            </DragOverlay>
        </DndContext>
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
    gap: 4px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    position: relative;
`;

const DragOverlayItem = styled.div`
    background: var(--center-channel-bg);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0.95;
`;
