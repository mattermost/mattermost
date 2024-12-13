// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelBookmark, ChannelBookmarkCreate, ChannelBookmarkPatch} from '@mattermost/types/channel_bookmarks';

import * as Actions from 'mattermost-redux/actions/channel_bookmarks';

import {getConnectionId} from 'selectors/general';

import type {ActionFuncAsync} from 'types/store';

export function deleteBookmark(channelId: string, id: string): ActionFuncAsync<boolean> {
    return (dispatch, getState) => {
        const state = getState();
        const connectionId = getConnectionId(state);
        return dispatch(Actions.deleteBookmark(channelId, id, connectionId));
    };
}

export function createBookmark(channelId: string, bookmark: ChannelBookmarkCreate): ActionFuncAsync<boolean> {
    return (dispatch, getState) => {
        const state = getState();
        const connectionId = getConnectionId(state);
        return dispatch(Actions.createBookmark(channelId, bookmark, connectionId));
    };
}

export function editBookmark(channelId: string, id: string, patch: ChannelBookmarkPatch): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        const state = getState();
        const connectionId = getConnectionId(state);
        return dispatch(Actions.editBookmark(channelId, id, patch, connectionId));
    };
}

export function reorderBookmark(channelId: string, id: string, newOrder: number): ActionFuncAsync<boolean> {
    return (dispatch, getState) => {
        const state = getState();
        const connectionId = getConnectionId(state);
        return dispatch(Actions.reorderBookmark(channelId, id, newOrder, connectionId));
    };
}

export function fetchChannelBookmarks(channelId: string): ActionFuncAsync<ChannelBookmark[]> {
    return Actions.fetchChannelBookmarks(channelId);
}
