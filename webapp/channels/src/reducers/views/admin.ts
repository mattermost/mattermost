// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {GenericAction} from 'mattermost-redux/types/actions';

const initialState = {
    blocked: false,
    onNavigationConfirmed: null,
    showNavigationPrompt: false,
};

function navigationBlock(state = initialState, action: GenericAction) {
    switch (action.type) {
    case ActionTypes.SET_NAVIGATION_BLOCKED:
        return {...state, blocked: action.blocked};
    case ActionTypes.DEFER_NAVIGATION:
        return {
            ...state,
            onNavigationConfirmed: action.onNavigationConfirmed,
            showNavigationPrompt: true,
        };
    case ActionTypes.CANCEL_NAVIGATION:
        return {
            ...state,
            onNavigationConfirmed: null,
            showNavigationPrompt: false,
        };
    case ActionTypes.CONFIRM_NAVIGATION:
        return {
            ...state,
            blocked: false,
            onNavigationConfirmed: null,
            showNavigationPrompt: false,
        };

    case UserTypes.LOGOUT_SUCCESS:
        return initialState;
    default:
        return state;
    }
}

export function needsLoggedInLimitReachedCheck(state = false, action: GenericAction) {
    switch (action.type) {
    case ActionTypes.NEEDS_LOGGED_IN_LIMIT_REACHED_CHECK:
        return action.data;
    default:
        return state;
    }
}

export default combineReducers({
    navigationBlock,
    needsLoggedInLimitReachedCheck,
});
