// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';
import type {PendingQuote} from 'types/store/views';

function remotes(state: Record<string, boolean> = {}, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SET_DRAFT_SOURCE:
        return {
            ...state,
            [action.data.key]: action.data.isRemote,
        };
    default:
        return state;
    }
}

function pendingQuote(state: PendingQuote | null = null, action: MMAction) {
    switch (action.type) {
    case ActionTypes.QUOTE_TEXT_IN_DRAFT:
        return action.data;
    case ActionTypes.CLEAR_PENDING_QUOTE:
    case UserTypes.LOGOUT_SUCCESS:
        return null;
    default:
        return state;
    }
}

export default combineReducers({

    // object that stores global draft keys indicating whether the draft came from a WebSocket event.
    remotes,

    // text quoted from a post that is waiting to be inserted by the matching message box.
    pendingQuote,

});
