// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import styled from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import BookmarksBarItem from './bookmarks_bar_item';
import BookmarksBarMenu from './bookmarks_bar_menu';
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
    const canDrag = canReorder && order.length > 1;

    // --- Overflow detection ---
    const {
        containerRef,
        registerItemRef,
        overflowStartIndex,
        visibleItems,
        overflowItems,
        pauseRecalc,
    } = useBookmarksOverflow(order);

    // --- DnD coordination ---
    const {
        isDragging,
        forceOverflowOpen,
        setForceOverflowOpen,
    } = useBookmarksDnd({
        order,
        visibleItems,
        onReorder: reorder,
    });

    // --- Keyboard reorder ---
    const {reorderState, getItemProps} = useKeyboardReorder({
        order,
        visibleItems,
        overflowItems,
        onReorder: reorder,
        getName: useCallback((id: string) => bookmarks[id]?.display_name ?? '', [bookmarks]),
        onOverflowOpenChange: setForceOverflowOpen,
        canReorder: canDrag,
    });

    // Pause overflow recalculation while dragging or keyboard reordering.
    // MUST be a single effect — two separate effects create a brief unpause
    // gap between them where calculateOverflow can fire and shift the split.
    useEffect(() => {
        pauseRecalc(isDragging || reorderState.isReordering);
    }, [isDragging, reorderState.isReordering, pauseRecalc]);

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
                {/* All bar items — hidden ones are measured but not visible */}
                {order.map((id, index) => {
                    const bookmark: ChannelBookmark | undefined = bookmarks[id];
                    if (!bookmark) {
                        return null;
                    }
                    const isHidden = index >= overflowStartIndex;
                    return (
                        <BookmarksBarItem
                            key={id}
                            id={id}
                            bookmark={bookmark}
                            disabled={!canDrag}
                            isDraggingGlobal={isDragging}
                            keyboardReorderProps={!isHidden && canDrag ? getItemProps(id) : undefined}
                            isKeyboardReordering={!isHidden && reorderState.isReordering && reorderState.itemId === id}
                            hidden={isHidden}
                            onMount={registerItemRef}
                        />
                    );
                })}

                <BookmarksBarMenu
                    channelId={channelId}
                    overflowItems={overflowItems}
                    bookmarks={bookmarks}
                    hasBookmarks={hasBookmarks}
                    limitReached={limitReached}
                    canUploadFiles={canUploadFiles}
                    canReorder={canDrag}
                    isDragging={isDragging}
                    canAdd={canAdd}
                    forceOpen={forceOverflowOpen}
                    onOpenChange={setForceOverflowOpen}
                    reorderState={reorderState}
                    getItemProps={canDrag ? getItemProps : undefined}
                />
            </BookmarksBarContent>
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
    min-width: 0;
    position: relative;
    padding-left: 2px;
`;
