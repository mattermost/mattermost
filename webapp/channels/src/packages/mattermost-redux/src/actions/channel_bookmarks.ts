// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelBookmarkCreate, ChannelBookmarkPatch} from '@mattermost/types/channel_bookmarks';

import {ChannelBookmarkTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getChannelBookmark} from 'mattermost-redux/selectors/entities/channel_bookmarks';
import type {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

export function deleteBookmark(channelId: string, id: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const bookmark = getChannelBookmark(state, channelId, id);

        try {
            await Client4.deleteChannelBookmark(channelId, id);

            dispatch({
                type: ChannelBookmarkTypes.BOOKMARK_DELETED,
                data: bookmark,
            });
        } catch (error) {
            return {
                data: false,
                error,
            };
        }

        return {data: true};
    };
}

export function createBookmark(channelId: string, bookmark: ChannelBookmarkCreate) {
    return async (dispatch: DispatchFunc) => {
        try {
            const createdBookmark = await Client4.createChannelBookmark(channelId, bookmark);

            dispatch({
                type: ChannelBookmarkTypes.RECEIVED_BOOKMARK,
                data: createdBookmark,
            });
        } catch (error) {
            return {
                data: false,
                error,
            };
        }

        return {data: true};
    };
}

export function editBookmark(channelId: string, id: string, patch: ChannelBookmarkPatch) {
    return async (dispatch: DispatchFunc) => {
        try {
            const {updated: bookmark} = await Client4.updateChannelBookmark(channelId, id, patch);

            dispatch({
                type: ChannelBookmarkTypes.RECEIVED_BOOKMARK,
                data: bookmark,
            });
        } catch (error) {
            return {
                data: false,
                error,
            };
        }

        return {data: true};
    };
}
