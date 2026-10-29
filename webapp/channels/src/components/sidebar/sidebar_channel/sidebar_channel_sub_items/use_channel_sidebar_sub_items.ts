// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useMemo, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useLocation} from 'react-router-dom';

import type {Channel} from '@mattermost/types/channels';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {setGlobalItem} from 'actions/storage';
import {areChannelSidebarSubItemsEqual, getChannelSidebarSubItems} from 'selectors/channel_sidebar_sub_items';
import type {ResolvedChannelSidebarSubItem} from 'selectors/channel_sidebar_sub_items';
import {getGlobalItem} from 'selectors/storage';

import {StoragePrefixes} from 'utils/constants';

import type {GlobalState} from 'types/store';

export function getChannelSidebarSubItemLink(teamName: string, channelName: string, subpath: string) {
    return `/${teamName}/channels/${channelName}/${subpath}`;
}

export function getChannelSidebarSubItemsId(channelId: string) {
    return `sidebarSubItems_${channelId}`;
}

/**
 * Returns the key of the item whose link is the longest prefix of the pathname, so that
 * `views/a` is not shadowed by a sibling `views/a/b` when the latter is the one being viewed.
 */
export function getActiveChannelSidebarSubItemKey(
    items: ResolvedChannelSidebarSubItem[],
    pathname: string,
    teamName: string,
    channelName: string,
): string | undefined {
    let activeKey: string | undefined;
    let activeLength = -1;
    for (const item of items) {
        const link = getChannelSidebarSubItemLink(teamName, channelName, item.subpath);
        if ((pathname === link || pathname.startsWith(link + '/')) && link.length > activeLength) {
            activeKey = item.key;
            activeLength = link.length;
        }
    }
    return activeKey;
}

export type ChannelSidebarSubItemsState = {
    items: ResolvedChannelSidebarSubItem[];
    activeKey?: string;

    isExpanded: boolean;
    controlsId: string;
    toggle: () => void;
};

export function useChannelSidebarSubItems(channel: Channel | undefined, teamName: string | undefined): ChannelSidebarSubItemsState {
    const dispatch = useDispatch();
    const {pathname} = useLocation();
    const items = useSelector((state: GlobalState) => getChannelSidebarSubItems(state, channel), areChannelSidebarSubItemsEqual);
    const userId = useSelector(getCurrentUserId);
    const teamId = useSelector(getCurrentTeamId);

    const channelId = channel?.id ?? '';
    const channelName = channel?.name ?? '';
    const storageKey = `${StoragePrefixes.CHANNEL_SIDEBAR_SUB_ITEMS_EXPANDED}${userId}_${teamId}_${channelId}`;
    const storedExpanded = useSelector((state: GlobalState) => getGlobalItem<boolean>(state, storageKey, false));

    const activeKey = useMemo(() => {
        if (!items.length || !teamName) {
            return undefined;
        }
        return getActiveChannelSidebarSubItemKey(items, pathname, teamName, channelName);
    }, [items, pathname, teamName, channelName]);

    const isExpanded = items.length > 0 && storedExpanded;

    // Read through a ref so the effect below only reacts to activeKey transitions: collapsing while an
    // item stays active must not re-expand until the user navigates to a (different) sub-item.
    const storedExpandedRef = useRef(storedExpanded);
    storedExpandedRef.current = storedExpanded;

    useEffect(() => {
        if (activeKey && !storedExpandedRef.current) {
            dispatch(setGlobalItem(storageKey, true));
        }
    }, [activeKey, storageKey, dispatch]);

    const toggle = useCallback(() => {
        dispatch(setGlobalItem(storageKey, !storedExpanded));
    }, [dispatch, storageKey, storedExpanded]);

    return {
        items,
        activeKey,
        isExpanded,
        controlsId: getChannelSidebarSubItemsId(channelId),
        toggle,
    };
}
