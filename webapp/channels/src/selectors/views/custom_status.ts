// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';

import type {UserCustomStatus} from '@mattermost/types/users';
import {CustomStatusDuration} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUser, getUser} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';
import {getCurrentMomentForTimezone} from 'utils/timezone';
import {isDateWithinDaysRange, TimeInformation} from 'utils/utils';

export function makeGetCustomStatus(): (state: GlobalState, userID?: string) => UserCustomStatus {
    return createSelector(
        'makeGetCustomStatus',
        (state: GlobalState, userID?: string) => (userID ? getUser(state, userID) : getCurrentUser(state)),
        (user) => {
            const userProps = user?.props || {};
            return userProps.customStatus ? JSON.parse(userProps.customStatus) : undefined;
        },
    );
}

export function isCustomStatusExpired(state: GlobalState, customStatus?: UserCustomStatus) {
    if (!customStatus) {
        return true;
    }

    if (customStatus.duration === CustomStatusDuration.DONT_CLEAR) {
        return false;
    }

    const expiryTime = moment(customStatus.expires_at);
    const timezone = getCurrentTimezone(state);
    const currentTime = getCurrentMomentForTimezone(timezone);
    return currentTime.isSameOrAfter(expiryTime);
}

export const getRecentCustomStatuses = createSelector(
    'getRecentCustomStatuses',
    (state: GlobalState) => get(state, Preferences.CATEGORY_CUSTOM_STATUS, Preferences.NAME_RECENT_CUSTOM_STATUSES),
    (value) => {
        return value ? JSON.parse(value) : [];
    },
);

export function isCustomStatusEnabled(state: GlobalState) {
    const config = getConfig(state);
    return config && config.EnableCustomUserStatuses === 'true';
}

function showCustomStatusPulsatingDotAndPostHeader(state: GlobalState) {
    // only show this for users after the first seven days
    const currentUser = getCurrentUser(state);
    const hasUserCreationMoreThanSevenDays = isDateWithinDaysRange(currentUser?.create_at, 7, TimeInformation.FUTURE);
    const customStatusTutorialState = get(state, Preferences.CATEGORY_CUSTOM_STATUS, Preferences.NAME_CUSTOM_STATUS_TUTORIAL_STATE);
    const modalAlreadyViewed = customStatusTutorialState && JSON.parse(customStatusTutorialState)[Preferences.CUSTOM_STATUS_MODAL_VIEWED];
    return !modalAlreadyViewed && hasUserCreationMoreThanSevenDays;
}

export function showStatusDropdownPulsatingDot(state: GlobalState) {
    return showCustomStatusPulsatingDotAndPostHeader(state);
}

export function showPostHeaderUpdateStatusButton(state: GlobalState) {
    return showCustomStatusPulsatingDotAndPostHeader(state);
}
