// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PreferenceType} from '@mattermost/types/preferences';

import {PreferenceTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getMyPreferences as getMyPreferencesSelector, makeGetCategory, Theme} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {GetStateFunc, DispatchFunc, ActionFunc} from 'mattermost-redux/types/actions';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {Preferences} from '../constants';

import {getChannelAndMyMember, getMyChannelMember} from './channels';
import {bindClientFunc} from './helpers';
import {getProfilesByIds, getProfilesInChannel} from './users';

export function deletePreferences(userId: string, preferences: PreferenceType[]): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function getMyPreferences(): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getMyPreferences,
        onSuccess: PreferenceTypes.RECEIVED_ALL_PREFERENCES,
    });
}

export function makeDirectChannelVisibleIfNecessary(otherUserId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const myPreferences = getMyPreferencesSelector(state);
        const currentUserId = getCurrentUserId(state);

        let preference = myPreferences[getPreferenceKey(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, otherUserId)];

        if (!preference || preference.value === 'false') {
            preference = {
                user_id: currentUserId,
                category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW,
                name: otherUserId,
                value: 'true',
            };
            getProfilesByIds([otherUserId])(dispatch, getState);
            savePreferences(currentUserId, [preference])(dispatch);
        }

        return {data: true};
    };
}

export function makeGroupMessageVisibleIfNecessary(channelId: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const myPreferences = getMyPreferencesSelector(state);
        const currentUserId = getCurrentUserId(state);
        const {channels} = state.entities.channels;

        let preference = myPreferences[getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, channelId)];

        if (!preference || preference.value === 'false') {
            preference = {
                user_id: currentUserId,
                category: Preferences.CATEGORY_GROUP_CHANNEL_SHOW,
                name: channelId,
                value: 'true',
            };

            if (channels[channelId]) {
                getMyChannelMember(channelId)(dispatch, getState);
            } else {
                getChannelAndMyMember(channelId)(dispatch, getState);
            }

            getProfilesInChannel(channelId, 0)(dispatch, getState);
            savePreferences(currentUserId, [preference])(dispatch);
        }

        return {data: true};
    };
}

export function setActionsMenuInitialisationState(initializationState: Record<string, boolean>) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function setCustomStatusInitialisationState(initializationState: Record<string, boolean>) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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

export function savePreferences(userId: string, preferences: PreferenceType[]) {
    return async (dispatch: DispatchFunc) => {
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

export function saveTheme(teamId: string, theme: Theme): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);
        const preference: PreferenceType = {
            user_id: currentUserId,
            category: Preferences.CATEGORY_THEME,
            name: teamId || '',
            value: JSON.stringify(theme),
        };

        await savePreferences(currentUserId, [preference])(dispatch);
        return {data: true};
    };
}

export function deleteTeamSpecificThemes(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();

        const themePreferences: PreferenceType[] = makeGetCategory()(state, Preferences.CATEGORY_THEME);
        const currentUserId = getCurrentUserId(state);

        const toDelete = themePreferences.filter((pref) => pref.name !== '');
        if (toDelete.length > 0) {
            await deletePreferences(currentUserId, toDelete)(dispatch, getState);
        }

        return {data: true};
    };
}
