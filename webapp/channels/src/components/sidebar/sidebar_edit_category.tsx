// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useDispatch} from 'react-redux';
import {Draggable, Droppable} from 'react-beautiful-dnd';

import type {Channel} from '@mattermost/types/channels';
import type {ChannelSyncCategory} from '@mattermost/types/channel_sync';

import {renameCategoryInCanonicalLayout, removeCategoryFromCanonicalLayout} from 'actions/views/channel_sync';

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
    const dispatch = useDispatch();
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(category.display_name);

    const channelMap = new Map(editorChannels.map((ch) => [ch.id, ch]));

    const handleRenameSubmit = useCallback(() => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== category.display_name) {
            dispatch(renameCategoryInCanonicalLayout(category.id, trimmed));
        }
        setIsRenaming(false);
    }, [dispatch, renameValue, category.id, category.display_name]);

    const handleDelete = useCallback(() => {
        dispatch(removeCategoryFromCanonicalLayout(category.id));
    }, [dispatch, category.id]);

    const categoryContent = (dragHandleProps?: Record<string, unknown>) => (
        <div className='SidebarChannelGroup edit-mode-category'>
            <div
                className='SidebarChannelGroupHeader'
                {...dragHandleProps}
            >
                {!isUncategorized && (
                    <i className='icon icon-drag-vertical edit-mode-drag-handle'/>
                )}
                {isRenaming ? (
                    <input
                        autoFocus={true}
                        className='edit-mode-rename-input'
                        type='text'
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleRenameSubmit();
                            } else if (e.key === 'Escape') {
                                setIsRenaming(false);
                                setRenameValue(category.display_name);
                            }
                        }}
                        onBlur={handleRenameSubmit}
                    />
                ) : (
                    <>
                        <span className='SidebarChannelGroupHeader_groupButton'>
                            {category.display_name}
                        </span>
                        {!isUncategorized && (
                            <span className='edit-mode-category-actions'>
                                <button
                                    className='edit-mode-category-action'
                                    title='Rename'
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setRenameValue(category.display_name);
                                        setIsRenaming(true);
                                    }}
                                >
                                    <i className='icon icon-pencil-outline'/>
                                </button>
                                <button
                                    className='edit-mode-category-action destructive'
                                    title='Delete'
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete();
                                    }}
                                >
                                    <i className='icon icon-trash-can-outline'/>
                                </button>
                            </span>
                        )}
                    </>
                )}
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
    );

    if (isUncategorized) {
        return categoryContent();
    }

    return (
        <Draggable
            draggableId={`edit-cat-${category.id}`}
            index={categoryIndex}
        >
            {(provided) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                >
                    {categoryContent(provided.dragHandleProps as Record<string, unknown>)}
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
