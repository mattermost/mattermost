// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {combineReducers} from 'redux';
import {ActionTypes} from 'utils/constants.jsx';

const initialState = {
    blocked: false,
    onNavigationConfirmed: null,
    showNavigationPrompt: false
};

function navigationBlock(state = initialState, action) {
    switch (action.type) {
    case ActionTypes.SET_NAVIGATION_BLOCKED:
        return {...state, blocked: action.blocked};
    case ActionTypes.DEFER_NAVIGATION:
        return {
            ...state, 
            onNavigationConfirmed: action.onNavigationConfirmed,
            showNavigationPrompt: true
        };
    case ActionTypes.CANCEL_NAVIGATION:
        return {
            ...state, 
            onNavigationConfirmed: null,
            showNavigationPrompt: false
        };
    case ActionTypes.CONFIRM_NAVIGATION:
        return {
            ...state,
            blocked: false,
            onNavigationConfirmed: null,
            showNavigationPrompt: false
        };
    default:
        return state;
    }
}

export default combineReducers({
    navigationBlock
});
