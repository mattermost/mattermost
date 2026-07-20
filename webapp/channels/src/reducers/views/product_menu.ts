// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';

export function switcherOpen(state = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SET_PRODUCT_SWITCHER_OPEN:
        return action.open;
    default:
        return state;
    }
}

export default combineReducers({
    switcherOpen,
});
