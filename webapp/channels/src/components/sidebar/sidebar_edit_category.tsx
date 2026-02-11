// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Draggable, Droppable} from 'react-beautiful-dnd';

import type {Channel} from '@mattermost/types/channels';
import type {ChannelSyncCategory} from '@mattermost/types/channel_sync';

type Props = {
    category: ChannelSyncCategory;
    categoryIndex: number;
    editorChannels: Channel[];
    userChannelIds: Set<string>;
    isUncategorized?: boolean;
};

const SidebarEditCategory: React.FC<Props> = ({
    category,
    categoryIndex,
    editorChannels,
    userChannelIds,
    isUncategorized,
}) => {
    const channelMap = new Map(editorChannels.map((ch) => [ch.id, ch]));

    return (
        <Draggable
            draggableId={`edit-cat-${category.id}`}
            index={categoryIndex}
            isDragDisabled={isUncategorized}
        >
            {(provided) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className='SidebarChannelGroup edit-mode-category'
                >
                    <div
                        className='SidebarChannelGroupHeader'
                        {...provided.dragHandleProps}
                    >
                        <span className='SidebarChannelGroupHeader_groupButton'>
                            {category.display_name}
                        </span>
                    </div>
                    <Droppable
                        droppableId={`edit-cat-${category.id}`}
                        type='EDIT_CHANNEL'
                    >
                        {(dropProvided) => (
                            <ul
                                ref={dropProvided.innerRef}
                                {...dropProvided.droppableProps}
                                className='NavGroupContent'
                            >
                                {category.channel_ids.map((channelId, index) => {
                                    const channel = channelMap.get(channelId);
                                    if (!channel) {
                                        return null;
                                    }
                                    const isJoined = userChannelIds.has(channelId);
                                    return (
                                        <SidebarEditChannelItem
                                            key={channelId}
                                            channel={channel}
                                            index={index}
                                            isJoined={isJoined}
                                        />
                                    );
                                })}
                                {dropProvided.placeholder}
                            </ul>
                        )}
                    </Droppable>
                </div>
            )}
        </Draggable>
    );
};

const SidebarEditChannelItem: React.FC<{
    channel: Channel;
    index: number;
    isJoined: boolean;
}> = ({channel, index, isJoined}) => {
    const icon = channel.type === 'O' ? 'icon-globe' : 'icon-lock-outline';

    return (
        <Draggable
            draggableId={`edit-ch-${channel.id}`}
            index={index}
        >
            {(provided) => (
                <li
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`SidebarChannel edit-mode-channel ${isJoined ? '' : 'not-joined'}`}
                >
                    <div className='SidebarLink'>
                        <i className={`icon ${icon}`}/>
                        <span className='SidebarChannelLinkLabel'>
                            {channel.display_name}
                        </span>
                        {!isJoined && (
                            <span className='edit-mode-not-joined-badge'>
                                {'Not joined'}
                            </span>
                        )}
                    </div>
                </li>
            )}
        </Draggable>
    );
};

export default SidebarEditCategory;
