// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {GenericAction} from 'mattermost-redux/types/actions';

function keyError(state: string | null = null, action: GenericAction): string | null {
    switch (action.type) {
    case ActionTypes.ENCRYPTION_KEY_ERROR:
        return action.error;
    case ActionTypes.ENCRYPTION_KEY_ERROR_CLEAR:
    case UserTypes.LOGOUT_SUCCESS:
        return null;
    default:
        return state;
    }
}

export default combineReducers({
    keyError,
});
