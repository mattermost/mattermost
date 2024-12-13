// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';

function announcementBarState(state = {announcementBarCount: 0}, action: MMAction) {
    switch (action.type) {
    case ActionTypes.TRACK_ANNOUNCEMENT_BAR:
        return {
            ...state,
            announcementBarCount: state.announcementBarCount + 1,
        };

    case ActionTypes.DISMISS_ANNOUNCEMENT_BAR:
        return {
            ...state,
            announcementBarCount: Math.max(state.announcementBarCount - 1, 0),
        };

    case UserTypes.LOGOUT_SUCCESS:
        return {
            announcementBarCount: 0,
        };
    default:
        return state;
    }
}

export default combineReducers({
    announcementBarState,
});
