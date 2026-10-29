// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {shallowEqual, useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {setGlobalItem} from 'actions/storage';
import type {ResolvedChannelSidebarSubItem} from 'selectors/channel_sidebar_sub_items';
import {getGlobalItem} from 'selectors/storage';

import type {GlobalState} from 'types/store';

import {getChannelSidebarSubItemExpandedKey} from './use_channel_sidebar_sub_items';

export type ChannelSidebarSubItemExpansion = {
    isExpanded: (itemKey: string) => boolean;
    toggle: (itemKey: string) => void;
    expand: (itemKey: string) => void;
};

/**
 * Persisted expanded state of the items that have children, per user, team, channel and item. Only
 * re-renders when the expanded state of one of the channel's own items changes.
 */
export function useChannelSidebarSubItemExpansion(channel: Channel, items: ResolvedChannelSidebarSubItem[]): ChannelSidebarSubItemExpansion {
    const dispatch = useDispatch();
    const userId = useSelector(getCurrentUserId);
    const teamId = useSelector(getCurrentTeamId);
    const channelId = channel.id;

    const expandedByKey = useSelector((state: GlobalState) => {
        const expanded: Record<string, boolean> = {};
        for (const item of items) {
            if (item.hasChildren) {
                expanded[item.key] = getGlobalItem<boolean>(state, getChannelSidebarSubItemExpandedKey(userId, teamId, channelId, item.key), false) === true;
            }
        }
        return expanded;
    }, shallowEqual);

    const isExpanded = useCallback((itemKey: string) => expandedByKey[itemKey] === true, [expandedByKey]);

    const toggle = useCallback((itemKey: string) => {
        dispatch(setGlobalItem(getChannelSidebarSubItemExpandedKey(userId, teamId, channelId, itemKey), expandedByKey[itemKey] !== true));
    }, [dispatch, userId, teamId, channelId, expandedByKey]);

    const expand = useCallback((itemKey: string) => {
        dispatch(setGlobalItem(getChannelSidebarSubItemExpandedKey(userId, teamId, channelId, itemKey), true));
    }, [dispatch, userId, teamId, channelId]);

    return {isExpanded, toggle, expand};
}
