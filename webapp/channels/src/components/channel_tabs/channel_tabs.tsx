// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {DragDropContext, Draggable, Droppable} from 'react-beautiful-dnd';
import styled from 'styled-components';

import type {ChannelTab} from '@mattermost/types/channel_tabs';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import TabsMenu from './channel_tabs_menu';
import TabItem from './tab_item';
import {useChannelTabs, MAX_TABS_PER_CHANNEL, useCanUploadFiles, useChannelTabPermission} from './utils';

import './channel_tabs.scss';

type Props = {
    channelId: string;
};

function ChannelTabs({
    channelId,
}: Props) {
    const {order, tabs, reorder} = useChannelTabs(channelId);
    const canReorder = useChannelTabPermission(channelId, 'order');
    const canUploadFiles = useCanUploadFiles();
    const hasTabs = Boolean(order?.length);
    const limitReached = order.length >= MAX_TABS_PER_CHANNEL;

    if (!hasTabs) {
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
                droppableId='channel-tabs'
                direction='horizontal'
            >
                {(drop, snap) => {
                    return (
                        <Container
                            ref={drop.innerRef}
                            data-testid='channel-tabs-container'
                            className='channel-tabs-container'
                            {...drop.droppableProps}
                        >
                            {order.map(makeItemRenderer(tabs, snap.isDraggingOver, !canReorder))}
                            {drop.placeholder}
                            <TabsMenu
                                channelId={channelId}
                                hasTabs={hasTabs}
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

const makeItemRenderer = (tabs: IDMappedObjects<ChannelTab>, disableInteractions: boolean, disableDrag: boolean) => (id: string, index: number) => {
    return (
        <Draggable
            key={id}
            draggableId={id}
            index={index}
            isDragDisabled={disableDrag}
        >
            {(drag, snap) => {
                return (
                    <TabItem
                        key={id}
                        drag={drag}
                        isDragging={snap.isDragging}
                        disableInteractions={snap.isDragging || disableInteractions}
                        tab={tabs[id]}
                    />
                );
            }}
        </Draggable>
    );
};

export default ChannelTabs;

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
