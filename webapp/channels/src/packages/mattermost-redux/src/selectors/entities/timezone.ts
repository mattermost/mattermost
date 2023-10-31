// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import timezones from 'timezones.json';

import type {UserProfile} from '@mattermost/types/users';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
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
