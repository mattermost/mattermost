// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';

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

export default combineReducers({

    // object that stores global draft keys indicating whether the draft came from a WebSocket event.
    remotes,

});
