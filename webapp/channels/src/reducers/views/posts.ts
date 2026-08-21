// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';
import {getSuppressOutOfChannelEphemeralKey} from 'utils/out_of_channel_mention_ephemeral';

import type {MMAction} from 'types/store';
import type {ViewsState} from 'types/store/views';

const editingPostDefaultState: ViewsState['posts']['editingPost'] = {
    show: false,
    postId: '',
    refocusId: '',
    isRHS: false,
};

function editingPost(state: ViewsState['posts']['editingPost'] = editingPostDefaultState, action: MMAction) {
    switch (action.type) {
    case ActionTypes.TOGGLE_EDITING_POST: {
        if (action.data.show) {
            return {
                ...state,
                ...action.data,
            };
        }

        return editingPostDefaultState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return editingPostDefaultState;
    default:
        return state;
    }
}

function menuActions(state: {[postId: string]: {[actionId: string]: {text: string; value: string}}} = {}, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SELECT_ATTACHMENT_MENU_ACTION: {
        const nextState = {...state};
        if (nextState[action.data.postId]) {
            nextState[action.data.postId] = {
                ...nextState[action.data.postId],
                ...action.data.actions,
            };
        } else {
            nextState[action.data.postId] = action.data.actions;
        }
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

const suppressOutOfChannelEphemeralDefaultState: ViewsState['posts']['suppressOutOfChannelEphemeral'] = {};

function pruneExpiredSuppressions(
    suppressions: ViewsState['posts']['suppressOutOfChannelEphemeral'],
    now = Date.now(),
): ViewsState['posts']['suppressOutOfChannelEphemeral'] {
    const nextState: ViewsState['posts']['suppressOutOfChannelEphemeral'] = {};

    for (const [key, entry] of Object.entries(suppressions)) {
        if (entry.expireAt > now) {
            nextState[key] = entry;
        }
    }

    return nextState;
}

function suppressOutOfChannelEphemeral(state: ViewsState['posts']['suppressOutOfChannelEphemeral'] = suppressOutOfChannelEphemeralDefaultState, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SUPPRESS_OUT_OF_CHANNEL_EPHEMERAL: {
        const {channelId, rootId, expireAt} = action.data;
        const key = getSuppressOutOfChannelEphemeralKey(channelId, rootId);
        const nextState = pruneExpiredSuppressions(state);

        nextState[key] = {expireAt};
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return suppressOutOfChannelEphemeralDefaultState;
    default:
        return state;
    }
}

export default combineReducers({
    editingPost,
    menuActions,
    suppressOutOfChannelEphemeral,
});
