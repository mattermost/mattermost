// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PreferenceType} from '@mattermost/types/preferences';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {savePreferences} from './preferences';

import {Preferences} from '../constants';

export function setNewChannelWithBoardPreference(initializationState: Record<string, boolean>): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const preference: PreferenceType = {
            user_id: currentUserId,
            category: Preferences.APP_BAR,
            name: Preferences.NEW_CHANNEL_WITH_BOARD_TOUR_SHOWED,
            value: JSON.stringify(initializationState),
        };
        await dispatch(savePreferences(currentUserId, [preference]));
        return {data: true};
    };
}
