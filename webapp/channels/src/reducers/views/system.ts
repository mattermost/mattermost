// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

function websocketConnectionErrorCount(state = 0, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.INCREMENT_WS_ERROR_COUNT: {
        return state + 1;
    }
    case ActionTypes.RESET_WS_ERROR_COUNT: {
        return 0;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return 0;
    default:
        return state;
    }
}

export default combineReducers({
    websocketConnectionErrorCount,
});
