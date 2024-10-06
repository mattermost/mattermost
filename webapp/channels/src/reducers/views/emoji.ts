// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes, Locations} from 'utils/constants';

function emojiPickerCustomPage(state = 0, action: AnyAction) {
    switch (action.type) {
    case ActionTypes.INCREMENT_EMOJI_PICKER_PAGE:
        return state + 1;
    case UserTypes.LOGOUT_SUCCESS:
        return 0;
    default:
        return state;
    }
}

function shortcutReactToLastPostEmittedFrom(state = '', action: AnyAction) {
    switch (action.type) {
    case ActionTypes.EMITTED_SHORTCUT_REACT_TO_LAST_POST:
        if (action.payload === Locations.CENTER) {
            return Locations.CENTER;
        } else if (action.payload === Locations.RHS_ROOT) {
            return Locations.RHS_ROOT;
        }
        return '';

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
