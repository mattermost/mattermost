// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';
import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';
import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {ActionTypes} from 'utils/constants';

import type {ChannelSyncLayout} from '@mattermost/types/channel_sync';
import type {ActionFuncAsync} from 'types/store';

export function fetchChannelSyncState(teamId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        try {
            const state = await Client4.getChannelSyncState(teamId);
            dispatch({
                type: ActionTypes.CHANNEL_SYNC_RECEIVED_STATE,
                data: state,
            });
            dispatch({
                type: ActionTypes.CHANNEL_SYNC_SET_SHOULD_SYNC,
                data: {teamId, shouldSync: state.should_sync},
            });

            // Fetch channel data for Quick Join items not already in the store
            if (state.should_sync) {
                const reduxState = getState();
                const quickJoinIds: string[] = [];
                for (const cat of state.categories) {
                    if (cat.quick_join) {
                        for (const chId of cat.quick_join) {
                            if (!getChannel(reduxState, chId)) {
                                quickJoinIds.push(chId);
                            }
                        }
                    }
                }
                for (const chId of quickJoinIds) {
                    dispatch(fetchChannel(chId));
                }
            }

            return {data: state};
        } catch (error) {
            dispatch({
                type: ActionTypes.CHANNEL_SYNC_SET_SHOULD_SYNC,
                data: {teamId, shouldSync: false},
            });
            return {error};
        }
    };
}

export function fetchChannelSyncLayout(teamId: string): ActionFuncAsync {
    return async (dispatch) => {
        try {
            const layout = await Client4.getChannelSyncLayout(teamId);
            dispatch({
                type: ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT,
                data: layout,
            });
            return {data: layout};
        } catch (error) {
            return {error};
        }
    };
}

export function saveChannelSyncLayout(teamId: string, layout: ChannelSyncLayout): ActionFuncAsync {
    return async (dispatch) => {
        const saved = await Client4.saveChannelSyncLayout(teamId, layout);
        dispatch({
            type: ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT,
            data: saved,
        });
        return {data: saved};
    };
}

export function setLayoutEditMode(enabled: boolean) {
    return {
        type: ActionTypes.CHANNEL_SYNC_SET_EDIT_MODE,
        data: enabled,
    };
}

export function dismissQuickJoinChannel(teamId: string, channelId: string): ActionFuncAsync {
    return async (dispatch) => {
        await Client4.dismissQuickJoinChannel(teamId, channelId);
        dispatch(fetchChannelSyncState(teamId));
        return {data: true};
    };
}

export function handleChannelSyncUpdated(teamId: string): ActionFuncAsync {
    return async (dispatch) => {
        dispatch(fetchChannelSyncState(teamId));
        dispatch(fetchMyCategories(teamId));
        return {data: true};
    };
}
