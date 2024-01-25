// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelBookmarkCreate, ChannelBookmarkPatch} from '@mattermost/types/channel_bookmarks';

import * as ChannelBookmarkActions from 'mattermost-redux/actions/channel_bookmarks';
import type {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

import {getConnectionId} from 'selectors/general';

import type {GlobalState} from 'types/store';

export function deleteBookmark(channelId: string, id: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
        const connectionId = getConnectionId(state);
        return dispatch(ChannelBookmarkActions.deleteBookmark(channelId, id, connectionId));
    };
}

export function createBookmark(channelId: string, bookmark: ChannelBookmarkCreate) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
        const connectionId = getConnectionId(state);
        return dispatch(ChannelBookmarkActions.createBookmark(channelId, bookmark, connectionId));
    };
}

export function editBookmark(channelId: string, id: string, patch: ChannelBookmarkPatch) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
        const connectionId = getConnectionId(state);
        return dispatch(ChannelBookmarkActions.editBookmark(channelId, id, patch, connectionId));
    };
}

export function fetchChannelBookmarks(channelId: string) {
    return ChannelBookmarkActions.fetchChannelBookmarks(channelId);
}
