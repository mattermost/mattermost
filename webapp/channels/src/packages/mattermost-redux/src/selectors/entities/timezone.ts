// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import timezones, {Timezone} from 'timezones.json';

import {getUser} from 'mattermost-redux/selectors/entities/users';

import {GlobalState} from '@mattermost/types/store';
import {UserProfile, UserTimezone} from '@mattermost/types/users';
import {createSelector} from 'reselect';

import {getUserCurrentTimezone, getTimezoneLabel as getTimezoneLabelUtil} from 'mattermost-redux/utils/timezone_utils';

export function getTimezoneForUserProfile(profile: UserProfile) {
    if (profile && profile.timezone) {
        return {
            ...profile.timezone,
            useAutomaticTimezone: profile.timezone.useAutomaticTimezone === 'true',
        };
    }

    return {
        useAutomaticTimezone: true,
        automaticTimezone: '',
        manualTimezone: '',
    };
}

export function isTimezoneEnabled(state: GlobalState) {
    const {config} = state.entities.general;
    return config.ExperimentalTimezone === 'true';
}

export const makeGetUserTimezone = () => createSelector(
    'makeGetUserTimezone',
    (state: GlobalState, userId: string) => getUser(state, userId),
    (user: UserProfile) => {
        return getTimezoneForUserProfile(user);
    },
);

export const getTimezoneLabel: (state: GlobalState, userId: UserProfile['id']) => string = createSelector(
    'getTimezoneLabel',
    () => timezones,
    makeGetUserTimezone(),
    (timezones: Timezone[], timezoneObject: UserTimezone) => {
        const timezone = getUserCurrentTimezone(timezoneObject);
        if (!timezone) {
            return '';
        }
        return getTimezoneLabelUtil(timezones, timezone);
    },
);
