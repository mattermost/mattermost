// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';

import {Permissions} from 'mattermost-redux/constants';
import {getChannelBookmarks} from 'mattermost-redux/selectors/entities/channel_bookmarks';
import {getChannel, getMyChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {getFeatureFlagValue, getLicense} from 'mattermost-redux/selectors/entities/general';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {fetchChannelBookmarks} from 'actions/channel_bookmarks';

import Constants, {LicenseSkus} from 'utils/constants';

export const useIsChannelBookmarksEnabled = () => {
    return useSelector(getIsChannelBookmarksEnabled);
};

const {OPEN_CHANNEL, PRIVATE_CHANNEL} = Constants as {OPEN_CHANNEL: 'O'; PRIVATE_CHANNEL: 'P'};

type TAction = 'add' | 'edit' | 'delete' | 'order';
type TActionKey = `${TAction}${typeof OPEN_CHANNEL | typeof PRIVATE_CHANNEL}`;

const key = (a: TAction, c: typeof OPEN_CHANNEL | typeof PRIVATE_CHANNEL): TActionKey => {
    return `${a}${c}`;
};

export const BOOKMARK_PERMISSION = {

    // open channel
    [key('add', OPEN_CHANNEL)]: Permissions.ADD_BOOKMARK_PUBLIC_CHANNEL,
    [key('edit', OPEN_CHANNEL)]: Permissions.EDIT_BOOKMARK_PUBLIC_CHANNEL,
    [key('delete', OPEN_CHANNEL)]: Permissions.DELETE_BOOKMARK_PUBLIC_CHANNEL,
    [key('order', OPEN_CHANNEL)]: Permissions.ORDER_BOOKMARK_PUBLIC_CHANNEL,

    // private channel
    [key('add', PRIVATE_CHANNEL)]: Permissions.ADD_BOOKMARK_PRIVATE_CHANNEL,
    [key('edit', PRIVATE_CHANNEL)]: Permissions.EDIT_BOOKMARK_PRIVATE_CHANNEL,
    [key('delete', PRIVATE_CHANNEL)]: Permissions.DELETE_BOOKMARK_PRIVATE_CHANNEL,
    [key('order', PRIVATE_CHANNEL)]: Permissions.ORDER_BOOKMARK_PRIVATE_CHANNEL,
} as const;

export const useChannelBookmarkPermission = (channelId: string, action: TAction) => {
    return useSelector((state: GlobalState) => getHaveIChannelBookmarkPermission(state, channelId, action));
};

export const getHaveIChannelBookmarkPermission = (state: GlobalState, channelId: string, action: TAction) => {
    const channel: Channel | undefined = getChannel(state, channelId);

    if (!channel) {
        return false;
    }
    const {type} = channel;

    if (type === 'threads') {
        return false;
    }

    if (type === 'G' || type === 'D') {
        const myMembership = getMyChannelMember(state, channelId);
        return myMembership?.channel_id === channelId;
    }

    const permission = BOOKMARK_PERMISSION[key(action, type)];

    return channel && permission && haveIChannelPermission(state, channel.team_id, channelId, permission);
};

export const getIsChannelBookmarksEnabled = (state: GlobalState) => {
    const isEnabled = getFeatureFlagValue(state, 'ChannelBookmarks') === 'true';

    if (!isEnabled) {
        return false;
    }

    const license = getLicense(state);

    const isLicensed = license?.IsLicensed === 'true';

    // Channel Bookmarks is available for Professional & Enterprise, and is backward compatible with E20 & E10
    return (
        isLicensed &&
        (
            license.SkuShortName === LicenseSkus.Professional ||
            license.SkuShortName === LicenseSkus.Enterprise ||
            license.SkuShortName === LicenseSkus.E20 ||
            license.SkuShortName === LicenseSkus.E10
        )
    );
};

export const useChannelBookmarks = (channelId: string) => {
    const dispatch = useDispatch();
    const bookmarks = useSelector((state: GlobalState) => getChannelBookmarks(state, channelId));

    const order = useMemo(() => {
        return Object.keys(bookmarks).sort((a, b) => bookmarks[a].sort_order - bookmarks[b].sort_order);
    }, [bookmarks]);

    useEffect(() => {
        if (channelId) {
            dispatch(fetchChannelBookmarks(channelId));
        }
    }, [channelId]);

    return {
        bookmarks,
        order,
    };
};
