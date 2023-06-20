// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionFunc, DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {PreferenceType} from '@mattermost/types/preferences';

import {Preferences} from '../constants';

import {OnboardingTaskCategory, OnboardingTaskList} from 'components/onboarding_tasks';

import {savePreferences} from './preferences';

export function setNewChannelWithBoardPreference(initializationState: Record<string, boolean>): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function setAutoShowLinkedBoardPreference(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const preference: PreferenceType = {
            category: OnboardingTaskCategory,
            user_id: currentUserId,
            name: OnboardingTaskList.ONBOARDING_LINKED_BOARD_AUTO_SHOWN,
            value: 'true',
        };
        await dispatch(savePreferences(currentUserId, [preference]));
        return {data: true};
    };
}
