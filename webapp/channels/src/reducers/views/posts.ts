// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction, Action} from 'redux';
import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {ViewsState} from 'types/store/views';

const editingPostDefaultState: ViewsState['posts']['editingPost'] = {
    show: false,
    postId: '',
    refocusId: '',
    isRHS: false,
};

type EditingPostAction = Action<
    typeof ActionTypes.TOGGLE_EDITING_POST | typeof UserTypes.LOGOUT_SUCCESS
> & { data: ViewsState['posts']['editingPost'] };

function editingPost(state: ViewsState['posts']['editingPost'] = editingPostDefaultState, action: EditingPostAction) {
    switch (action.type) {
    case ActionTypes.TOGGLE_EDITING_POST: {
        if (action.data.show) {
            return {
                ...state,
                ...action.data,
            };
        }

        return editingPostDefaultState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return editingPostDefaultState;
    default:
        return state;
    }
}

function menuActions(state: {[postId: string]: {[actionId: string]: {text: string; value: string}}} = {}, action: AnyAction) {
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
