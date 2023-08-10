// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes, Locations} from 'utils/constants';

import type {GenericAction} from 'mattermost-redux/types/actions';

function emojiPickerCustomPage(state = 0, action: GenericAction) {
    switch (action.type) {
    case ActionTypes.INCREMENT_EMOJI_PICKER_PAGE:
        return state + 1;
    case UserTypes.LOGOUT_SUCCESS:
        return 0;
    default:
        return state;
    }
}

function shortcutReactToLastPostEmittedFrom(state = '', action: GenericAction) {
    switch (action.type) {
    case ActionTypes.EMITTED_SHORTCUT_REACT_TO_LAST_POST:
        if (action.payload === Locations.CENTER) {
            return Locations.CENTER;
        } else if (action.payload === Locations.RHS_ROOT) {
            return Locations.RHS_ROOT;
        } else if (action.payload === Locations.NO_WHERE) {
            return '';
        }
        return state;

    case UserTypes.LOGOUT_SUCCESS:
        return '';
    default:
        return state;
    }
}

export default combineReducers({
    emojiPickerCustomPage,
    shortcutReactToLastPostEmittedFrom,
});
