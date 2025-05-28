// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {CursorPaginationDirection} from '@mattermost/types/reports';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';
import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

const navigationBlockInitialState = {
    blocked: false,
    onNavigationConfirmed: null,
    showNavigationPrompt: false,
};

function navigationBlock(state = navigationBlockInitialState, action: MMAction) {
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

export function needsLoggedInLimitReachedCheck(state = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.NEEDS_LOGGED_IN_LIMIT_REACHED_CHECK:
        return action.data;
    default:
        return state;
    }
}

export const adminConsoleUserManagementTablePropertiesInitialState: AdminConsoleUserManagementTableProperties = {
    sortColumn: '',
    sortIsDescending: false,
    pageSize: 0,
    pageIndex: 0,
    cursorDirection: CursorPaginationDirection.next,
    cursorUserId: '',
    cursorColumnValue: '',
    columnVisibility: {},
    searchTerm: '',
    filterTeam: '',
    filterTeamLabel: '',
    filterStatus: '',
    filterRole: '',
};

export function adminConsoleUserManagementTableProperties(state = adminConsoleUserManagementTablePropertiesInitialState, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SET_ADMIN_CONSOLE_USER_MANAGEMENT_TABLE_PROPERTIES: {
        return {...state, ...action.data};
    }
    case ActionTypes.CLEAR_ADMIN_CONSOLE_USER_MANAGEMENT_TABLE_PROPERTIES:
        return adminConsoleUserManagementTablePropertiesInitialState;
    default:
        return state;
    }
}

export default combineReducers({
    navigationBlock,
    needsLoggedInLimitReachedCheck,
    adminConsoleUserManagementTableProperties,
});
