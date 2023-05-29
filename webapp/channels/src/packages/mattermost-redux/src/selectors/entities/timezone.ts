// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import timezones from 'timezones.json';

import {GlobalState} from '@mattermost/types/store';
import {UserProfile} from '@mattermost/types/users';
import {createSelector} from 'reselect';

import {getTimezoneLabel, getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import {getCurrentUser} from './common';

function getTimezoneForUserProfile(profile: UserProfile) {
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

export const getCurrentTimezoneFull = createSelector(
    'getCurrentTimezoneFull',
    getCurrentUser,
    (currentUser) => {
        return getTimezoneForUserProfile(currentUser);
    },
);

export const getCurrentTimezone = createSelector(
    'getCurrentTimezone',
    getCurrentTimezoneFull,
    (timezoneFull) => {
        return getUserCurrentTimezone(timezoneFull);
    },
);

export const getCurrentTimezoneLabel = createSelector(
    'getCurrentTimezoneLabel',
    getCurrentTimezone,
    (timezone) => {
        if (!timezone) {
            return '';
        }

        return getTimezoneLabel(timezones, timezone);
    },
);
