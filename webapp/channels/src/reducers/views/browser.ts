// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {ActionTypes, WindowSizes} from 'utils/constants';

import type {GenericAction} from 'mattermost-redux/types/actions';

function focused(state = true, action: GenericAction) {
    switch (action.type) {
    case ActionTypes.BROWSER_CHANGE_FOCUS:
        return action.focus;
    default:
        return state;
    }
}

function windowSize(state = WindowSizes.DESKTOP_VIEW, action: GenericAction) {
    switch (action.type) {
    case ActionTypes.BROWSER_WINDOW_RESIZED:
        return action.data;
    default:
        return state;
    }
}

export default combineReducers({
    focused,
    windowSize,
});
