// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';

const defaultState = {
    post: {},
    show: false,
};

function editingPost(state = defaultState, action: MMAction) {
    switch (action.type) {
    case ActionTypes.TOGGLE_EDITING_POST:
        return {
            ...state,
            ...action.data,
        };

    case UserTypes.LOGOUT_SUCCESS:
        return defaultState;
    default:
        return state;
    }
}

function menuActions(state: {[postId: string]: {[actionId: string]: {text: string; value: string}}} = {}, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SELECT_ATTACHMENT_MENU_ACTION: {
        const nextState = {...state};
        if (nextState[action.data.postId]) {
            nextState[action.data.postId] = {
                ...nextState[action.data.postId],
                ...action.data.actions,
            };
        } else {
            nextState[action.data.postId] = action.data.actions;
        }
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    editingPost,
    menuActions,
});
