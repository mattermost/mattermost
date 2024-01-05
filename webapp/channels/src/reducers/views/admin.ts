// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';

import {ActionTypes} from 'utils/constants';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

const navigationBlockInitialState = {
    blocked: false,
    onNavigationConfirmed: null,
    showNavigationPrompt: false,
};

function navigationBlock(state = navigationBlockInitialState, action: GenericAction) {
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
        return navigationBlockInitialState;
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

const adminConsoleUserManagementTablePropertiesInitialState: AdminConsoleUserManagementTableProperties = {
    sortColumn: '',
    sortIsDescending: false,
    pageSize: 0,
};

export function adminConsoleUserManagement(state = adminConsoleUserManagementTablePropertiesInitialState, action: GenericAction) {
    switch (action.type) {
    case ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_SORT_COLUMN:
        return {
            ...state,
            sortColumn: action.data,
        };
    case ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_SORT_ORDER:
        return {
            ...state,
            sortIsDescending: action.data,
        };
    case ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_PAGE_SIZE:
        return {
            ...state,
            pageSize: action.data,
        };
    case ActionTypes.CLEAR_ADMIN_CONSOLE_USER_MANAGEMENT_TABLE_PROPERTIES:
        return adminConsoleUserManagementTablePropertiesInitialState;
    default:
        return state;
    }
}

export default combineReducers({
    navigationBlock,
    needsLoggedInLimitReachedCheck,
    adminConsoleUserManagement,
});
