// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {GlobalState} from '@mattermost/types/store';

import {Permissions} from 'mattermost-redux/constants';
import {getChannelBookmarks} from 'mattermost-redux/selectors/entities/channel_bookmarks';
import {getChannel, getMyChannelMember} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getFeatureFlagValue, getLicense} from 'mattermost-redux/selectors/entities/general';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {insertWithoutDuplicates} from 'mattermost-redux/utils/array_utils';

import {fetchChannelBookmarks, reorderBookmark} from 'actions/channel_bookmarks';
import {loadCustomEmojisIfNeeded} from 'actions/emoji_actions';

import Constants from 'utils/constants';
import {trimmedEmojiName} from 'utils/emoji_utils';
import {canUploadFiles, isPublicLinksEnabled} from 'utils/file_utils';

export const MAX_BOOKMARKS_PER_CHANNEL = 50;

const {OPEN_CHANNEL, PRIVATE_CHANNEL, GM_CHANNEL, DM_CHANNEL} = Constants as {OPEN_CHANNEL: 'O'; PRIVATE_CHANNEL: 'P'; GM_CHANNEL: 'G'; DM_CHANNEL: 'D'};

type TAction = 'add' | 'edit' | 'delete' | 'order';
type TActionKey = `${TAction}${typeof OPEN_CHANNEL | typeof PRIVATE_CHANNEL}`;

const key = (a: TAction, c: typeof OPEN_CHANNEL | typeof PRIVATE_CHANNEL): TActionKey => {
    return `${a}${c}`;
};

const BOOKMARK_PERMISSION = {

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

    if (channel.delete_at !== 0) {
        return false;
    }

    const {type} = channel;

    if (type === 'threads') {
        return false;
    }

    if (type === GM_CHANNEL || type === DM_CHANNEL) {
        const myMembership = getMyChannelMember(state, channelId);
        return myMembership?.channel_id === channelId;
    }

    const permission = BOOKMARK_PERMISSION[key(action, type)];

    return channel && permission && haveIChannelPermission(state, channel.team_id, channelId, permission);
};

export const useCanUploadFiles = () => {
    return useSelector((state: GlobalState) => canUploadFiles(getConfig(state)));
};

export const useCanGetPublicLink = () => {
    return useSelector((state: GlobalState) => isPublicLinksEnabled(getConfig(state)));
};

export const useCanGetLinkPreviews = () => {
    return useSelector((state: GlobalState) => getConfig(state).EnableLinkPreviews === 'true');
};

export const getIsChannelBookmarksEnabled = (state: GlobalState) => {
    const isEnabled = getFeatureFlagValue(state, 'ChannelBookmarks') === 'true';

    if (!isEnabled) {
        return false;
    }

    const license = getLicense(state);

    return license?.IsLicensed === 'true';
};

export const useChannelBookmarks = (channelId: string) => {
    const dispatch = useDispatch();
    const bookmarks = useSelector((state: GlobalState) => getChannelBookmarks(state, channelId));

    const order = useMemo(() => {
        return Object.keys(bookmarks).sort((a, b) => bookmarks[a].sort_order - bookmarks[b].sort_order);
    }, [bookmarks]);
    const [tempOrder, setTempOrder] = useState<typeof order>();

    useEffect(() => {
        if (tempOrder) {
            setTempOrder(undefined);
        }
    }, [order]);

    useEffect(() => {
        if (channelId) {
            dispatch(fetchChannelBookmarks(channelId));
        }
    }, [channelId]);

    useEffect(() => {
        const emojis = Object.values(bookmarks).reduce<string[]>((result, {emoji}) => {
            if (emoji) {
                result.push(trimmedEmojiName(emoji));
            }

            return result;
        }, []);

        if (emojis.length) {
            dispatch(loadCustomEmojisIfNeeded(emojis));
        }
    }, [bookmarks]);

    const reorder = async (id: string, prevOrder: number, nextOrder: number) => {
        setTempOrder(insertWithoutDuplicates(order, id, nextOrder));
        const {error} = await dispatch(reorderBookmark(channelId, id, nextOrder));

        if (error) {
            setTempOrder(undefined);
        }
    };

    return {
        bookmarks,
        order: tempOrder ?? order,
        reorder,
    } as const;
};

