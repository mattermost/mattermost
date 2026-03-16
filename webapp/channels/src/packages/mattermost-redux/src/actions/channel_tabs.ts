// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelTab, ChannelTabCreate, ChannelTabPatch} from '@mattermost/types/channel_tabs';

import {ChannelTabTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getChannelTab} from 'mattermost-redux/selectors/entities/channel_tabs';
import type {ActionFuncAsync, DispatchFunc} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {forceLogoutIfNecessary} from './helpers';

export function deleteTab(channelId: string, id: string, connectionId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        const state = getState();
        const bookmark = getChannelTab(state, channelId, id);

        try {
            await Client4.deleteChannelTab(channelId, id, connectionId);

            dispatch({
                type: ChannelTabTypes.TAB_DELETED,
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

export function createTab(channelId: string, bookmark: ChannelTabCreate, connectionId: string): ActionFuncAsync<boolean> {
    return async (dispatch: DispatchFunc) => {
        try {
            const createdTab = await Client4.createChannelTab(channelId, bookmark, connectionId);

            dispatch({
                type: ChannelTabTypes.RECEIVED_TAB,
                data: createdTab,
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

export function editTab(channelId: string, id: string, patch: ChannelTabPatch, connectionId: string): ActionFuncAsync<boolean> {
    return async (dispatch: DispatchFunc) => {
        try {
            const {updated, deleted} = await Client4.updateChannelTab(channelId, id, patch, connectionId);

            if (updated) {
                dispatch({
                    type: ChannelTabTypes.RECEIVED_TAB,
                    data: updated,
                });
            }

            if (deleted) {
                dispatch({
                    type: ChannelTabTypes.TAB_DELETED,
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

export function reorderTab(channelId: string, id: string, newOrder: number, connectionId: string): ActionFuncAsync<boolean> {
    return async (dispatch: DispatchFunc) => {
        try {
            const bookmarks = await Client4.updateChannelTabSortOrder(channelId, id, newOrder, connectionId);

            dispatch({
                type: ChannelTabTypes.RECEIVED_TABS,
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

export function fetchChannelTabs(channelId: string): ActionFuncAsync<ChannelTab[]> {
    return async (dispatch, getState) => {
        let bookmarks;
        try {
            bookmarks = await Client4.getChannelTabs(channelId);

            dispatch({
                type: ChannelTabTypes.RECEIVED_TABS,
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
