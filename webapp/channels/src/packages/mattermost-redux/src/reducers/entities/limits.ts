// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {LimitsTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';

function usersLimits(state = {}, action: GenericAction) {
    switch (action.type) {
    case LimitsTypes.RECIEVED_USERS_LIMITS: {
        const usersLimits = action.data;
        return {
            ...state,
            ...usersLimits,
        };
    }
    default:
        return state;
    }
}

export default combineReducers({
    usersLimits,
});
