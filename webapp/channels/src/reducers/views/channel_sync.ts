// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {ChannelCategory} from '@mattermost/types/channel_categories';
import type {Channel} from '@mattermost/types/channels';
import type {ChannelSyncLayout, ChannelSyncUserState} from '@mattermost/types/channel_sync';

import {ChannelCategoryTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

function syncStateByTeam(state: Record<string, ChannelSyncUserState> = {}, action: {type: string; data: ChannelSyncUserState | ChannelCategory}) {
    switch (action.type) {
    case ActionTypes.CHANNEL_SYNC_RECEIVED_STATE:
        return {
            ...state,
            [(action.data as ChannelSyncUserState).team_id]: action.data as ChannelSyncUserState,
        };
    case ChannelCategoryTypes.RECEIVED_CATEGORY: {
        // When a personal category is updated (e.g., collapsed), reflect it in the sync state
        const category = action.data as ChannelCategory;
        const teamState = state[category.team_id];
        if (!teamState?.categories) {
            return state;
        }
        let changed = false;
        const updatedCategories = teamState.categories.map((cat) => {
            if (cat.id === category.id) {
                changed = true;
                return {...cat, collapsed: category.collapsed, muted: category.muted};
            }
            return cat;
        });
        if (!changed) {
            return state;
        }
        return {
            ...state,
            [category.team_id]: {
                ...teamState,
                categories: updatedCategories,
            },
        };
    }
    default:
        return state;
    }
}

function layoutByTeam(state: Record<string, ChannelSyncLayout> = {}, action: {type: string; data: ChannelSyncLayout}) {
    switch (action.type) {
    case ActionTypes.CHANNEL_SYNC_RECEIVED_LAYOUT:
        return {
            ...state,
            [action.data.team_id]: action.data,
        };
    default:
        return state;
    }
}

function shouldSyncByTeam(state: Record<string, boolean> = {}, action: {type: string; data: {teamId: string; shouldSync: boolean}}) {
    switch (action.type) {
    case ActionTypes.CHANNEL_SYNC_SET_SHOULD_SYNC:
        return {
            ...state,
            [action.data.teamId]: action.data.shouldSync,
        };
    default:
        return state;
    }
}

function editMode(state = false, action: {type: string; data: boolean}) {
    switch (action.type) {
    case ActionTypes.CHANNEL_SYNC_SET_EDIT_MODE:
        return action.data;
    default:
        return state;
    }
}

function editorChannelsByTeam(state: Record<string, Channel[]> = {}, action: {type: string; data: {teamId: string; channels: Channel[]}}) {
    switch (action.type) {
    case ActionTypes.CHANNEL_SYNC_RECEIVED_EDITOR_CHANNELS:
        return {
            ...state,
            [action.data.teamId]: action.data.channels,
        };
    default:
        return state;
    }
}

export default combineReducers({
    syncStateByTeam,
    layoutByTeam,
    shouldSyncByTeam,
    editMode,
    editorChannelsByTeam,
});
