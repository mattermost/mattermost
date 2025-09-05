// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {ContentFlaggingTypes} from 'mattermost-redux/action_types';

function settings(state = {}, action: MMReduxAction) {
    switch (action.type) {
    case ContentFlaggingTypes.RECEIVED_CONTENT_FLAGGING_CONFIG: {
        return {
            ...state,
            ...action.data,
        };
    }
    default:
        return state;
    }
}

export default combineReducers({
    settings,
});
