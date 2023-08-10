// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';
import {Draggable} from 'react-beautiful-dnd';
import {FormattedMessage} from 'react-intl';

import Constants from 'utils/constants';

import SidebarBaseChannel from './sidebar_base_channel';
import SidebarDirectChannel from './sidebar_direct_channel';
import SidebarGroupChannel from './sidebar_group_channel';

import type {Props} from './index';
import type {AnimationEvent, ReactNode} from 'react';

function SidebarChannel({
    isCategoryCollapsed,
    isCategoryDragged,
    isUnread,
    isCurrentChannel,
    setChannelRef,
    channel,
    currentTeamName,
    isDraggable,
    isChannelSelected,
    draggingState,
    multiSelectedChannelIds,
    channelIndex,
    isAutoSortedCategory,
    autoSortedCategoryIds,
}: Props) {
    const [show, setShow] = useState(true);

    function isCollapsed() {
        return isCategoryDragged || (isCategoryCollapsed && !isUnread && !isCurrentChannel);
    }

    function setRef(refMethod?: (element: HTMLLIElement) => void) {
        return (ref: HTMLLIElement) => {
            setChannelRef(channel.id, ref);
            refMethod?.(ref);
        };
    }

    function handleAnimationStart(event: AnimationEvent) {
        if (event && event.animationName === 'toOpaqueAnimation' && !isCollapsed()) {
            setShow(true);
        }
    }

    function handleAnimationEnd(event: AnimationEvent) {
        if (event && event.animationName === 'toTransparentAnimation' && isCollapsed()) {
            setShow(false);
        }
    }

    let component: ReactNode;
    if (!show) {
        component = null;
    } else if (channel.type === Constants.DM_CHANNEL) {
        component = (
            <SidebarDirectChannel
                channel={channel}
                currentTeamName={currentTeamName}
            />
        );
    } else if (channel.type === Constants.GM_CHANNEL) {
        component = (
            <SidebarGroupChannel
                channel={channel}
                currentTeamName={currentTeamName}
            />
        );
    } else {
        component = (
            <SidebarBaseChannel
                channel={channel}
                currentTeamName={currentTeamName}
            />
        );
    }

    if (isDraggable) {
        let selectedCount: React.ReactNode;
        if (isChannelSelected && draggingState.state && draggingState.id === channel.id && multiSelectedChannelIds.length > 1) {
            selectedCount = show ? (
                <div className='SidebarChannel__selectedCount'>
                    <FormattedMessage
                        id='sidebar_left.sidebar_channel.selectedCount'
                        defaultMessage='{count} selected'
                        values={{count: multiSelectedChannelIds.length}}
                    />
                </div>
            ) : null;
        }

        return (
            <Draggable
                draggableId={channel.id}
                index={channelIndex}
            >
                {(provided, snapshot) => {
                    return (
                        <li
                            draggable='false'
                            ref={setRef(provided.innerRef)}
                            className={classNames('SidebarChannel', {
                                collapsed: isCollapsed(),
                                expanded: !isCollapsed(),
                                unread: isUnread,
                                active: isCurrentChannel,
                                dragging: snapshot.isDragging,
                                selectedDragging: isChannelSelected && draggingState.state && draggingState.id !== channel.id,
                                fadeOnDrop: snapshot.isDropAnimating && snapshot.draggingOver && autoSortedCategoryIds.has(snapshot.draggingOver),
                                noFloat: isAutoSortedCategory && !snapshot.isDragging,
                            })}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onAnimationStart={handleAnimationStart}
                            onAnimationEnd={handleAnimationEnd}
                            role='listitem'
                            tabIndex={-1}
                        >
                            {component}
                            {selectedCount}
                        </li>
                    );
                }}
            </Draggable>
        );
    }

    return (
        <li
            ref={setRef()}
            className={classNames('SidebarChannel', {
                collapsed: isCollapsed(),
                expanded: !isCollapsed(),
                unread: isUnread,
                active: isCurrentChannel,
            })}
            onAnimationStart={handleAnimationStart}
            onAnimationEnd={handleAnimationEnd}
            role='listitem'
        >
            {component}
        </li>
    );
}

export default SidebarChannel;
