// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';
import type {Translations} from 'types/store/i18n';

function translations(state: Translations = {}, action: MMAction) {
    switch (action.type) {
    case ActionTypes.RECEIVED_TRANSLATIONS:
        return {
            ...state,
            [action.data.locale]: action.data.translations,
        };

    default:
        return state;
    }
}

export default combineReducers({
    translations,
});
