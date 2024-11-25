// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelBookmark, ChannelBookmarkCreate, ChannelBookmarkPatch} from '@mattermost/types/channel_bookmarks';

import {ChannelBookmarkTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getChannelBookmark} from 'mattermost-redux/selectors/entities/channel_bookmarks';
import type {ActionFuncAsync, DispatchFunc} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {forceLogoutIfNecessary} from './helpers';

export function deleteBookmark(channelId: string, id: string, connectionId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        const state = getState();
        const bookmark = getChannelBookmark(state, channelId, id);

        try {
            await Client4.deleteChannelBookmark(channelId, id, connectionId);

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

export function createBookmark(channelId: string, bookmark: ChannelBookmarkCreate, connectionId: string): ActionFuncAsync<boolean> {
    return async (dispatch: DispatchFunc) => {
        try {
            const createdBookmark = await Client4.createChannelBookmark(channelId, bookmark, connectionId);

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

export function editBookmark(channelId: string, id: string, patch: ChannelBookmarkPatch, connectionId: string): ActionFuncAsync<boolean> {
    return async (dispatch: DispatchFunc) => {
        try {
            const {updated, deleted} = await Client4.updateChannelBookmark(channelId, id, patch, connectionId);

            if (updated) {
                dispatch({
                    type: ChannelBookmarkTypes.RECEIVED_BOOKMARK,
                    data: updated,
                });
            }

            if (deleted) {
                dispatch({
                    type: ChannelBookmarkTypes.BOOKMARK_DELETED,
                    data: deleted,
                });
            }
        } catch (error) {
            return {
                data: false,
                error,
            };
        }

        return {data: true};
    };
}

export function reorderBookmark(channelId: string, id: string, newOrder: number, connectionId: string): ActionFuncAsync<boolean> {
    return async (dispatch: DispatchFunc) => {
        try {
            const bookmarks = await Client4.updateChannelBookmarkSortOrder(channelId, id, newOrder, connectionId);

            dispatch({
                type: ChannelBookmarkTypes.RECEIVED_BOOKMARKS,
                data: {channelId, bookmarks},
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

export function fetchChannelBookmarks(channelId: string): ActionFuncAsync<ChannelBookmark[]> {
    return async (dispatch, getState) => {
        let bookmarks;
        try {
            bookmarks = await Client4.getChannelBookmarks(channelId);

            dispatch({
                type: ChannelBookmarkTypes.RECEIVED_BOOKMARKS,
                data: {channelId, bookmarks},
            });
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {data: bookmarks};
    };
}
