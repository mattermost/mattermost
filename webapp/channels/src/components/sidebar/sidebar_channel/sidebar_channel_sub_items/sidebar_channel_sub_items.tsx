// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {mark} from 'actions/telemetry_actions';
import {clearChannelSelection} from 'actions/views/channel_sidebar';
import {closeRightHandSide} from 'actions/views/rhs';
import {getChannelSidebarSubItemAncestorKeys} from 'selectors/channel_sidebar_sub_items';
import type {ResolvedChannelSidebarSubItem} from 'selectors/channel_sidebar_sub_items';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';
import {Mark} from 'utils/performance_telemetry';

import SidebarChannelSubItem from './sidebar_channel_sub_item';
import {useChannelSidebarSubItemDragAndDrop} from './use_channel_sidebar_sub_item_drag_and_drop';
import {useChannelSidebarSubItemExpansion} from './use_channel_sidebar_sub_item_expansion';
import {getChannelSidebarSubItemChildrenId} from './use_channel_sidebar_sub_items';

type Props = {
    id: string;
    channel: Channel;
    currentTeamName: string;
    items: ResolvedChannelSidebarSubItem[];
    activeKey?: string;
};

export default function SidebarChannelSubItems({id, channel, currentTeamName, items, activeKey}: Props) {
    const dispatch = useDispatch();
    const rhsState = useSelector(getRhsState);
    const rhsOpen = useSelector(getIsRhsOpen);
    const expansion = useChannelSidebarSubItemExpansion(channel, items);
    const {draggingKey, dropTarget, handlers: dragHandlers} = useChannelSidebarSubItemDragAndDrop(channel, items, expansion);

    const childrenByParent = useMemo(() => {
        const byParent = new Map<string | undefined, ResolvedChannelSidebarSubItem[]>();
        for (const item of items) {
            const siblings = byParent.get(item.parentKey);
            if (siblings) {
                siblings.push(item);
            } else {
                byParent.set(item.parentKey, [item]);
            }
        }
        return byParent;
    }, [items]);

    const activeAncestorKeys = useMemo(() => {
        return new Set(activeKey ? getChannelSidebarSubItemAncestorKeys(items, activeKey) : []);
    }, [items, activeKey]);

    const handleClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
        if (event.defaultPrevented || event.button !== 0) {
            return;
        }

        mark(Mark.ChannelLinkClicked);
        dispatch(clearChannelSelection());

        if (rhsOpen && rhsState === RHSStates.EDIT_HISTORY) {
            dispatch(closeRightHandSide());
        }
    }, [dispatch, rhsOpen, rhsState]);

    const renderList = (parentKey: string | undefined, listId: string, className?: string) => {
        const siblings = childrenByParent.get(parentKey);
        if (!siblings?.length) {
            return null;
        }

        return (
            <ul
                id={listId}
                role='list'
                className={className ?? 'SidebarChannelSubItems SidebarChannelSubItems--nested'}
            >
                {siblings.map((item) => {
                    const isExpanded = item.hasChildren && expansion.isExpanded(item.key);
                    return (
                        <SidebarChannelSubItem
                            key={item.key}
                            channel={channel}
                            currentTeamName={currentTeamName}
                            item={item}
                            isActive={item.key === activeKey}
                            isExpanded={isExpanded}
                            containsActive={item.hasChildren && !isExpanded && activeAncestorKeys.has(item.key)}
                            onToggle={expansion.toggle}
                            onLinkClick={handleClick}
                            dragHandlers={dragHandlers}
                            isDragging={item.key === draggingKey}
                            dropPosition={dropTarget?.key === item.key ? dropTarget.position : undefined}
                        >
                            {isExpanded && renderList(item.key, getChannelSidebarSubItemChildrenId(channel.id, item.key))}
                        </SidebarChannelSubItem>
                    );
                })}
            </ul>
        );
    };

    return renderList(undefined, id, 'SidebarChannelSubItems');
}
