// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import styled from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarksBarItem from './bookmarks_bar_item';
import BookmarksBarMenu from './bookmarks_bar_menu';
import BookmarkMeasureItem from './bookmarks_measure_item';
import {useBookmarksDnd, useBookmarksOverflow, useKeyboardReorder} from './hooks';
import {useChannelBookmarks, MAX_BOOKMARKS_PER_CHANNEL, useCanUploadFiles, useChannelBookmarkPermission} from './utils';

import './channel_bookmarks.scss';

type Props = {
    channelId: string;
};

function ChannelBookmarks({channelId}: Props) {
    const {order, bookmarks, reorder} = useChannelBookmarks(channelId);
    const canReorder = Boolean(useChannelBookmarkPermission(channelId, 'order'));
    const canAdd = Boolean(useChannelBookmarkPermission(channelId, 'add'));
    const canUploadFiles = useCanUploadFiles();
    const hasBookmarks = Boolean(order?.length);
    const limitReached = order.length >= MAX_BOOKMARKS_PER_CHANNEL;

    // --- Overflow detection ---
    const {
        containerRef,
        registerItemRef,
        visibleItems,
        overflowItems,
        pauseRecalc,
    } = useBookmarksOverflow(order);

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

    // Pause overflow recalculation while dragging
    useEffect(() => {
        pauseRecalc(isDragging);
    }, [isDragging, pauseRecalc]);

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

    // --- Keyboard reorder ---
    const {reorderState, getItemProps} = useKeyboardReorder({
        order,
        visibleItems,
        overflowItems,
        onReorder: reorder,
        getName: useCallback((id: string) => bookmarks[id]?.display_name ?? '', [bookmarks]),
        onOverflowOpenChange: setAutoOpenOverflow,
        canReorder,
    });

    // Pause overflow recalculation during keyboard reorder;
    // reset autoOpenOverflow when reorder ends
    useEffect(() => {
        pauseRecalc(reorderState.isReordering);
        if (!reorderState.isReordering) {
            setAutoOpenOverflow(false);
        }
    }, [reorderState.isReordering, pauseRecalc, setAutoOpenOverflow]);

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
            <BookmarksBarContent $hasOverflow={overflowItems.length > 0}>
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
                    return (
                        <BookmarksBarItem
                            key={id}
                            id={id}
                            bookmark={bookmark}
                            disabled={!canReorder}
                            isDraggingGlobal={isDragging}
                            keyboardReorderProps={canReorder ? getItemProps(id) : undefined}
                            isKeyboardReordering={reorderState.isReordering && reorderState.itemId === id}
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
                isDragging={isDragging}
                canAdd={canAdd}
                forceOpen={showDragOverlay || (reorderState.isReordering ? autoOpenOverflow : undefined)}
                reorderState={reorderState}
                getItemProps={canReorder ? getItemProps : undefined}
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

const BookmarksBarContent = styled.div<{$hasOverflow: boolean}>`
    display: flex;
    align-items: center;
    ${({$hasOverflow}) => $hasOverflow && 'flex: 1;'}
    min-width: 0;
    overflow: hidden;
    position: relative;
    padding-left: 2px;
`;
