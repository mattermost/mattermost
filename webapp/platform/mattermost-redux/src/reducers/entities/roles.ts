// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {Role} from '@mattermost/types/roles';

import {RoleTypes, UserTypes} from 'mattermost-redux/action_types';

function pending(state: Set<string> = new Set(), action: AnyAction) {
    switch (action.type) {
    case RoleTypes.SET_PENDING_ROLES:
        return action.data;
    case UserTypes.LOGOUT_SUCCESS:
        return new Set();
    default:
        return state;
    }
}

function roles(state: Record<string, Role> = {}, action: AnyAction) {
    switch (action.type) {
    case RoleTypes.RECEIVED_ROLES: {
        if (action.data) {
            const nextState = {...state};
            for (const role of action.data) {
                nextState[role.name] = role;
            }
            return nextState;
        }

        return state;
    }
    case RoleTypes.ROLE_DELETED: {
        if (action.data) {
            const nextState = {...state};
            Reflect.deleteProperty(nextState, action.data.name);
            return nextState;
        }

        return state;
    }
    case RoleTypes.RECEIVED_ROLE: {
        if (action.data) {
            const nextState = {...state};
            nextState[action.data.name] = action.data;
            return nextState;
        }

        return state;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({

    // object where the key is the category-name and has the corresponding value
    roles,
    pending,
});
