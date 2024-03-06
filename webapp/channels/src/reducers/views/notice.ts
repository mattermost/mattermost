// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

function hasBeenDismissed(state: Record<string, boolean> = {}, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.DISMISS_NOTICE:
        return {...state, [action.data]: true};
    case ActionTypes.SHOW_NOTICE:
        return {...state, [action.data]: false};

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    hasBeenDismissed,
});
