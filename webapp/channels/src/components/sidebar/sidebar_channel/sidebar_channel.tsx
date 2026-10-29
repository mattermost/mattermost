// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Draggable} from '@hello-pangea/dnd';
import classNames from 'classnames';
import React, {useMemo, useState} from 'react';
import type {AnimationEvent, ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';

import Constants from 'utils/constants';

import SidebarBaseChannel from './sidebar_base_channel';
import SidebarChannelSubItems from './sidebar_channel_sub_items';
import {useChannelSidebarSubItems} from './sidebar_channel_sub_items/use_channel_sidebar_sub_items';
import SidebarDirectChannel from './sidebar_direct_channel';
import SidebarGroupChannel from './sidebar_group_channel';

import type {Props} from './index';

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
    const subItems = useChannelSidebarSubItems(channel, currentTeamName);
    const {isExpanded: subItemsExpanded, toggle: toggleSubItems, controlsId: subItemsId} = subItems;
    const hasSubItems = subItems.items.length > 0;
    const subItemsToggle = useMemo(() => (hasSubItems ? {
        isExpanded: subItemsExpanded,
        controlsId: subItemsId,
        onToggle: toggleSubItems,
    } : undefined), [hasSubItems, subItemsExpanded, subItemsId, toggleSubItems]);

    if (!channel) {
        return null;
    }

    if (!currentTeamName) {
        return null;
    }

    function isCollapsed() {
        return isCategoryDragged || (isCategoryCollapsed && !isUnread && !isCurrentChannel);
    }

    function setRef(refMethod?: (element: HTMLLIElement) => void) {
        return (ref: HTMLLIElement) => {
            setChannelRef(channel?.id || '', ref);
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

    const isSelectedDragging = Boolean(isChannelSelected && draggingState.state && draggingState.id !== channel.id);

    function renderSubItems(isDragging: boolean) {
        if (!show || !hasSubItems || !subItemsExpanded || isCollapsed() || isDragging || isSelectedDragging || !currentTeamName || !channel) {
            return null;
        }

        return (
            <SidebarChannelSubItems
                id={subItemsId}
                channel={channel}
                currentTeamName={currentTeamName}
                items={subItems.items}
                activeKey={subItems.activeKey}
            />
        );
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
                subItemsToggle={subItemsToggle}
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
                                hasSubItems,
                                hasActiveSubItem: Boolean(subItems.activeKey),
                                dragging: snapshot.isDragging,
                                selectedDragging: isSelectedDragging,
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
                            {renderSubItems(snapshot.isDragging)}
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
                hasSubItems,
                hasActiveSubItem: Boolean(subItems.activeKey),
            })}
            onAnimationStart={handleAnimationStart}
            onAnimationEnd={handleAnimationEnd}
            role='listitem'
        >
            {component}
            {renderSubItems(false)}
        </li>
    );
}

export default SidebarChannel;
