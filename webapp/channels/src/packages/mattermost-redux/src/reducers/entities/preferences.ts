// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {PreferencesType, PreferenceType} from '@mattermost/types/preferences';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {PreferenceTypes, UserTypes} from 'mattermost-redux/action_types';

function getKey(preference: PreferenceType) {
    return `${preference.category}--${preference.name}`;
}

function setAllPreferences(preferences: PreferenceType[]): any {
    const nextState: any = {};

    if (preferences) {
        for (const preference of preferences) {
            nextState[getKey(preference)] = preference;
        }
    }

    return nextState;
}

function setAllUserPreferences(preferences: PreferenceType[]): {[key: string]: PreferencesType} {
    const nextState: {[key: string]: PreferencesType} = {};
    if (preferences.length === 0) {
        return nextState;
    }

    const userID = preferences[0].user_id;
    nextState[userID] = {};

    if (preferences) {
        for (const preference of preferences) {
            nextState[userID][getKey(preference)] = preference;
        }
    }

    return nextState;
}

function myPreferences(state: Record<string, PreferenceType> = {}, action: MMReduxAction) {
    switch (action.type) {
    case PreferenceTypes.RECEIVED_ALL_PREFERENCES:
        return setAllPreferences(action.data);

    case UserTypes.LOGIN: // Used by the mobile app
        return setAllPreferences(action.data.preferences);

    case PreferenceTypes.RECEIVED_PREFERENCES: {
        const nextState = {...state};

        if (action.data) {
            for (const preference of action.data) {
                nextState[getKey(preference)] = preference;
            }
        }

        return nextState;
    }
    case PreferenceTypes.DELETED_PREFERENCES: {
        const nextState = {...state};

        if (action.data) {
            for (const preference of action.data) {
                Reflect.deleteProperty(nextState, getKey(preference));
            }
        }

        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function userPreferences(state: Record<string, PreferencesType> = {}, action: MMReduxAction) {
    switch (action.type) {
    case PreferenceTypes.RECEIVED_USER_ALL_PREFERENCES:
        return setAllUserPreferences(action.data);

    case PreferenceTypes.RECEIVED_USER_PREFERENCES: {
        const nextState = {...state};

        const data = action.data as PreferenceType[];
        if (action.data && data.length > 0) {
            const userID = data[0].user_id;
            nextState[userID] = nextState[userID] ? {...nextState[userID]} : {};

            for (const preference of action.data) {
                nextState[preference.user_id][getKey(preference)] = preference;
            }
        }

        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({

    // object where the key is the category-name and has the corresponding value
    myPreferences,
    userPreferences,
});
