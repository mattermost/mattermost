// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    MeasuringStrategy,
} from '@dnd-kit/core';
import type {DragEndEvent, DragStartEvent} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import styled from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarkItemContent from './bookmark_item_content';
import BookmarksBarMenu from './bookmarks_bar_menu';
import BookmarksSortableItem from './bookmarks_sortable_item';
import {useChannelBookmarks, MAX_BOOKMARKS_PER_CHANNEL, useCanUploadFiles, useChannelBookmarkPermission} from './utils';

import './channel_bookmarks.scss';

// Space to reserve for the menu button
const MENU_BUTTON_WIDTH = 80;

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

    const [overflowStartIndex, setOverflowStartIndex] = useState<number>(order.length);
    const [isDragging, setIsDragging] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);

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

    // Recalculate overflow on mount, resize, and order changes
    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return undefined;
        }

        // Calculate after items have rendered
        const timeoutId = setTimeout(calculateOverflow, 0);

        const resizeObserver = new ResizeObserver(() => {
            calculateOverflow();
        });
        resizeObserver.observe(container);

        return () => {
            clearTimeout(timeoutId);
            resizeObserver.disconnect();
        };
    }, [calculateOverflow, order]);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setIsDragging(true);
        setActiveId(String(event.active.id));
    }, []);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        setIsDragging(false);
        setActiveId(null);

        const {active, over} = event;
        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = order.indexOf(String(active.id));
        const newIndex = order.indexOf(String(over.id));

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            await reorder(String(active.id), oldIndex, newIndex);
        }
    }, [order, reorder]);

    const handleDragCancel = useCallback(() => {
        setIsDragging(false);
        setActiveId(null);
    }, []);

    // Items in overflow menu
    const overflowItems = order.slice(overflowStartIndex);

    // Get active bookmark for drag overlay
    const activeBookmark: ChannelBookmark | null = activeId ? bookmarks[activeId] : null;

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
                    <SortableContext
                        items={order}
                        strategy={horizontalListSortingStrategy}
                        id='bar'
                    >
                        {order.map((id, index) => {
                            const bookmark = bookmarks[id];
                            if (!bookmark) {
                                return null;
                            }

                            const isOverflow = index >= overflowStartIndex;

                            return (
                                <BookmarksSortableItem
                                    key={id}
                                    id={id}
                                    bookmark={bookmark}
                                    disabled={!canReorder}
                                    onMount={registerItemRef}
                                    hidden={isOverflow}
                                    isDragging={isDragging}
                                />
                            );
                        })}
                    </SortableContext>
                </BookmarksBarContent>

                <BookmarksBarMenu
                    channelId={channelId}
                    overflowItems={overflowItems}
                    bookmarks={bookmarks}
                    hasBookmarks={hasBookmarks}
                    limitReached={limitReached}
                    canUploadFiles={canUploadFiles}
                    canReorder={canReorder}
                    isDragging={isDragging}
                />
            </Container>

            <DragOverlay>
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
`;

const DragOverlayItem = styled.div`
    background: var(--center-channel-bg);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0.95;
`;
