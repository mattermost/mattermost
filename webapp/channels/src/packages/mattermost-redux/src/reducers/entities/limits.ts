// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import {LimitsTypes} from 'mattermost-redux/action_types';

function serverLimits(state = {}, action: AnyAction) {
    switch (action.type) {
    case LimitsTypes.RECIEVED_APP_LIMITS: {
        const serverLimits = action.data;
        return {
            ...state,
            ...serverLimits,
        };
    }
    default:
        return state;
    }
}

export default combineReducers({
    serverLimits,
});
