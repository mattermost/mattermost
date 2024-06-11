// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PreferenceType} from '@mattermost/types/preferences';

import {PreferenceTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getMyPreferences as getMyPreferencesSelector, makeGetCategory} from 'mattermost-redux/selectors/entities/preferences';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFuncAsync, ThunkActionFunc} from 'mattermost-redux/types/actions';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {bindClientFunc} from './helpers';

import {Preferences} from '../constants';

export function deletePreferences(userId: string, preferences: PreferenceType[]): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const myPreferences = getMyPreferencesSelector(state);
        const currentPreferences = preferences.map((pref) => myPreferences[getPreferenceKey(pref.category, pref.name)]);

        (async function deletePreferencesWrapper() {
            try {
                dispatch({
                    type: PreferenceTypes.DELETED_PREFERENCES,
                    data: preferences,
                });

                await Client4.deletePreferences(userId, preferences);
            } catch {
                dispatch({
                    type: PreferenceTypes.RECEIVED_PREFERENCES,
                    data: currentPreferences,
                });
            }
        }());

        return {data: true};
    };
}

export function getMyPreferences() {
    return bindClientFunc({
        clientFunc: Client4.getMyPreferences,
        onSuccess: PreferenceTypes.RECEIVED_ALL_PREFERENCES,
    });
}

export function setActionsMenuInitialisationState(initializationState: Record<string, boolean>): ThunkActionFunc<void> {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const preference: PreferenceType = {
            user_id: currentUserId,
            category: Preferences.CATEGORY_ACTIONS_MENU,
            name: Preferences.NAME_ACTIONS_MENU_TUTORIAL_STATE,
            value: JSON.stringify(initializationState),
        };
        await dispatch(savePreferences(currentUserId, [preference]));
    };
}

export function setCustomStatusInitialisationState(initializationState: Record<string, boolean>): ThunkActionFunc<void> {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const preference: PreferenceType = {
            user_id: currentUserId,
            category: Preferences.CATEGORY_CUSTOM_STATUS,
            name: Preferences.NAME_CUSTOM_STATUS_TUTORIAL_STATE,
            value: JSON.stringify(initializationState),
        };
        await dispatch(savePreferences(currentUserId, [preference]));
    };
}

export function savePreferences(userId: string, preferences: PreferenceType[]): ActionFuncAsync {
    return async (dispatch) => {
        (async function savePreferencesWrapper() {
            try {
                dispatch({
                    type: PreferenceTypes.RECEIVED_PREFERENCES,
                    data: preferences,
                });

                await Client4.savePreferences(userId, preferences);
            } catch {
                dispatch({
                    type: PreferenceTypes.DELETED_PREFERENCES,
                    data: preferences,
                });
            }
        }());

        return {data: true};
    };
}

export function saveTheme(teamId: string, theme: Theme): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const preference: PreferenceType = {
            user_id: currentUserId,
            category: Preferences.CATEGORY_THEME,
            name: teamId || '',
            value: JSON.stringify(theme),
        };

        await dispatch(savePreferences(currentUserId, [preference]));
        return {data: true};
    };
}

export function deleteTeamSpecificThemes(): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();

        const themePreferences: PreferenceType[] = makeGetCategory()(state, Preferences.CATEGORY_THEME);
        const currentUserId = getCurrentUserId(state);

        const toDelete = themePreferences.filter((pref) => pref.name !== '');
        if (toDelete.length > 0) {
            await dispatch(deletePreferences(currentUserId, toDelete));
        }

        return {data: true};
    };
}
