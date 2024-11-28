// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {DragDropContext, Draggable, Droppable} from 'react-beautiful-dnd';
import styled from 'styled-components';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import BookmarkItem from './bookmark_item';
import BookmarksMenu from './channel_bookmarks_menu';
import {useChannelBookmarks, MAX_BOOKMARKS_PER_CHANNEL, useCanUploadFiles, useChannelBookmarkPermission} from './utils';

import './channel_bookmarks.scss';

type Props = {
    channelId: string;
};

function ChannelBookmarks({
    channelId,
}: Props) {
    const {order, bookmarks, reorder} = useChannelBookmarks(channelId);
    const canReorder = useChannelBookmarkPermission(channelId, 'order');
    const canUploadFiles = useCanUploadFiles();
    const hasBookmarks = Boolean(order?.length);
    const limitReached = order.length >= MAX_BOOKMARKS_PER_CHANNEL;

    if (!hasBookmarks) {
        return null;
    }

    const handleOnDragEnd: ComponentProps<typeof DragDropContext>['onDragEnd'] = ({source, destination, draggableId}) => {
        if (destination) {
            reorder(draggableId, source.index, destination.index);
        }
    };

    return (
        <DragDropContext
            onDragEnd={handleOnDragEnd}
        >
            <Droppable
                droppableId='channel-bookmarks'
                direction='horizontal'
            >
                {(drop, snap) => {
                    return (
                        <Container
                            ref={drop.innerRef}
                            data-testid='channel-bookmarks-container'
                            {...drop.droppableProps}
                        >
                            {order.map(makeItemRenderer(bookmarks, snap.isDraggingOver, !canReorder))}
                            {drop.placeholder}
                            <BookmarksMenu
                                channelId={channelId}
                                hasBookmarks={hasBookmarks}
                                limitReached={limitReached}
                                canUploadFiles={canUploadFiles}
                            />
                        </Container>
                    );
                }}
            </Droppable>
        </DragDropContext>
    );
}

const makeItemRenderer = (bookmarks: IDMappedObjects<ChannelBookmark>, disableInteractions: boolean, disableDrag: boolean) => (id: string, index: number) => {
    return (
        <Draggable
            key={id}
            draggableId={id}
            index={index}
            isDragDisabled={disableDrag}
        >
            {(drag, snap) => {
                return (
                    <BookmarkItem
                        key={id}
                        drag={drag}
                        isDragging={snap.isDragging}
                        disableInteractions={snap.isDragging || disableInteractions}
                        bookmark={bookmarks[id]}
                    />
                );
            }}
        </Draggable>
    );
};

export default ChannelBookmarks;

const Container = styled.div`
    display: flex;
    padding: 0 6px;
    padding-right: 0;
    min-height: 38px;
    align-items: center;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    overflow-x: auto;
    max-width: 100vw;
`;
