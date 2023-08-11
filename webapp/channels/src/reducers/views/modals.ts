// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {GeneralTypes, UserTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';

import type {ViewsState} from 'types/store/views';
import {ActionTypes} from 'utils/constants';

export function modalState(state: ViewsState['modals']['modalState'] = {}, action: GenericAction) {
    switch (action.type) {
    case ActionTypes.MODAL_OPEN:
        return {
            ...state,
            [action.modalId]: {
                open: true,
                dialogProps: action.dialogProps,
                dialogType: action.dialogType,
            },
        };
    case ActionTypes.MODAL_CLOSE: {
        const newState = Object.assign({}, state);
        Reflect.deleteProperty(newState, action.modalId);
        return newState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export function showLaunchingWorkspace(state = false, action: GenericAction) {
    switch (action.type) {
    case GeneralTypes.SHOW_LAUNCHING_WORKSPACE:
        return action.open;
    default:
        return state;
    }
}

export default combineReducers({
    modalState,
    showLaunchingWorkspace,
});
