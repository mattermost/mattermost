// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelTab, ChannelTabCreate, ChannelTabPatch} from '@mattermost/types/channel_tabs';

import * as Actions from 'mattermost-redux/actions/channel_tabs';

import {getConnectionId} from 'selectors/general';

import type {ActionFuncAsync} from 'types/store';

export function deleteTab(channelId: string, id: string): ActionFuncAsync<boolean> {
    return (dispatch, getState) => {
        const state = getState();
        const connectionId = getConnectionId(state);
        return dispatch(Actions.deleteTab(channelId, id, connectionId));
    };
}

export function createTab(channelId: string, tab: ChannelTabCreate): ActionFuncAsync<boolean> {
    return (dispatch, getState) => {
        const state = getState();
        const connectionId = getConnectionId(state);
        return dispatch(Actions.createTab(channelId, tab, connectionId));
    };
}

export function editTab(channelId: string, id: string, patch: ChannelTabPatch): ActionFuncAsync<boolean> {
    return (dispatch, getState) => {
        const state = getState();
        const connectionId = getConnectionId(state);
        return dispatch(Actions.editTab(channelId, id, patch, connectionId));
    };
}

export function reorderTab(channelId: string, id: string, newOrder: number): ActionFuncAsync<boolean> {
    return (dispatch, getState) => {
        const state = getState();
        const connectionId = getConnectionId(state);
        return dispatch(Actions.reorderTab(channelId, id, newOrder, connectionId));
    };
}

export function fetchChannelTabs(channelId: string): ActionFuncAsync<ChannelTab[]> {
    return Actions.fetchChannelTabs(channelId);
}
