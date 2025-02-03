// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import findKey from 'lodash/findKey';
import {combineReducers} from 'redux';

import {PostTypes, UserTypes} from 'mattermost-redux/action_types';

import {Threads, ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';
import type {ViewsState} from 'types/store/views';

export const selectedThreadIdInTeam = (state: ViewsState['threads']['selectedThreadIdInTeam'] = {}, action: MMAction) => {
    switch (action.type) {
    case PostTypes.POST_REMOVED: {
        const key = findKey(state, (id) => id === action.data.id);
        if (key) {
            return {
                ...state,
                [key]: '',
            };
        }
        return state;
    }
    case Threads.CHANGED_SELECTED_THREAD:
        return {
            ...state,
            [action.data.team_id]: action.data.thread_id,
        };

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
};

export const lastViewedAt = (state: ViewsState['threads']['lastViewedAt'] = {}, action: MMAction) => {
    switch (action.type) {
    case Threads.CHANGED_LAST_VIEWED_AT:
        return {
            ...state,
            [action.data.threadId]: action.data.lastViewedAt,
        };

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
};

export function manuallyUnread(state: ViewsState['threads']['manuallyUnread'] = {}, action: MMAction) {
    switch (action.type) {
    case Threads.CHANGED_LAST_VIEWED_AT:
        return {
            ...state,
            [action.data.threadId]: false,
        };
    case Threads.MANUALLY_UNREAD_THREAD:
        return {
            ...state,
            [action.data.threadId]: true,
        };

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export function toastStatus(state: ViewsState['threads']['toastStatus'] = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SELECT_POST:
        return false;
    case ActionTypes.UPDATE_THREAD_TOAST_STATUS:
        return action.data;

    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

export default combineReducers({
    selectedThreadIdInTeam,
    lastViewedAt,
    manuallyUnread,
    toastStatus,
});
