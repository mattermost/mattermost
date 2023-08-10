// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CustomStatusDuration} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';
import * as GeneralSelectors from 'mattermost-redux/selectors/entities/general';
import * as PreferenceSelectors from 'mattermost-redux/selectors/entities/preferences';
import * as UserSelectors from 'mattermost-redux/selectors/entities/users';

import {makeGetCustomStatus, getRecentCustomStatuses, isCustomStatusEnabled, showStatusDropdownPulsatingDot, showPostHeaderUpdateStatusButton} from 'selectors/views/custom_status';

import configureStore from 'store';
import {TestHelper} from 'utils/test_helper';
import {addTimeToTimestamp, TimeInformation} from 'utils/utils';

jest.mock('mattermost-redux/selectors/entities/users');
jest.mock('mattermost-redux/selectors/entities/general');
jest.mock('mattermost-redux/selectors/entities/preferences');

const customStatus = {
    emoji: 'speech_balloon',
    text: 'speaking',
    duration: CustomStatusDuration.DONT_CLEAR,
};

describe('getCustomStatus', () => {
    const user = TestHelper.getUserMock();
    const getCustomStatus = makeGetCustomStatus();

    it('should return undefined when current user has no custom status set', async () => {
        const store = await configureStore();
        (UserSelectors.getCurrentUser as jest.Mock).mockReturnValue(user);
        expect(getCustomStatus(store.getState())).toBeUndefined();
    });

    it('should return undefined when user with given id has no custom status set', async () => {
        const store = await configureStore();
        (UserSelectors.getUser as jest.Mock).mockReturnValue(user);
        expect(getCustomStatus(store.getState(), user.id)).toBeUndefined();
    });

    it('should return customStatus object when there is custom status set', async () => {
        const store = await configureStore();
        const newUser = {...user};
        newUser.props.customStatus = JSON.stringify(customStatus);
        (UserSelectors.getCurrentUser as jest.Mock).mockReturnValue(newUser);
        expect(getCustomStatus(store.getState())).toStrictEqual(customStatus);
    });
});

describe('getRecentCustomStatuses', () => {
    const preference = {
        myPreference: {
            value: JSON.stringify([]),
        },
    };

    it('should return empty arr if there are no recent custom statuses', async () => {
        const store = await configureStore();
        (PreferenceSelectors.get as jest.Mock).mockReturnValue(preference.myPreference.value);
        expect(getRecentCustomStatuses(store.getState())).toStrictEqual([]);
    });

    it('should return arr of custom statuses if there are recent custom statuses', async () => {
        const store = await configureStore();
        preference.myPreference.value = JSON.stringify([customStatus]);
        (PreferenceSelectors.get as jest.Mock).mockReturnValue(preference.myPreference.value);
        expect(getRecentCustomStatuses(store.getState())).toStrictEqual([customStatus]);
    });
});

describe('isCustomStatusEnabled', () => {
    const config = {
        EnableCustomUserStatuses: 'true',
    };

    it('should return false if EnableCustomUserStatuses is false in the config', async () => {
        const store = await configureStore();
        expect(isCustomStatusEnabled(store.getState())).toBeFalsy();
    });

    it('should return true if EnableCustomUserStatuses is true in the config', async () => {
        const store = await configureStore();
        (GeneralSelectors.getConfig as jest.Mock).mockReturnValue(config);
        expect(isCustomStatusEnabled(store.getState())).toBeTruthy();
    });
});

describe('showStatusDropdownPulsatingDot and showPostHeaderUpdateStatusButton', () => {
    const user = TestHelper.getUserMock();
    const preference = {
        myPreference: {
            value: '',
        },
    };

    it('should return true if user has not opened the custom status modal before', async () => {
        const store = await configureStore();
        (PreferenceSelectors.get as jest.Mock).mockReturnValue(preference.myPreference.value);
        expect(showStatusDropdownPulsatingDot(store.getState())).toBeTruthy();
    });

    it('should return false if user has opened the custom status modal before', async () => {
        const store = await configureStore();
        preference.myPreference.value = JSON.stringify({[Preferences.CUSTOM_STATUS_MODAL_VIEWED]: true});
        (PreferenceSelectors.get as jest.Mock).mockReturnValue(preference.myPreference.value);
        expect(showPostHeaderUpdateStatusButton(store.getState())).toBeFalsy();
    });

    it('should return false if user was created less than seven days before from today', async () => {
        const store = await configureStore();
        (PreferenceSelectors.get as jest.Mock).mockReturnValue(preference.myPreference.value);
        const todayTimestamp = new Date().getTime();

        // set the user create date to 6 days in the past from today
        const todayMinusSixDays = addTimeToTimestamp(todayTimestamp, TimeInformation.DAYS, 6, TimeInformation.PAST);
        const newUser = {...user, create_at: todayMinusSixDays};
        newUser.props.customStatus = JSON.stringify(customStatus);
        (UserSelectors.getCurrentUser as jest.Mock).mockReturnValue(newUser);
        expect(showStatusDropdownPulsatingDot(store.getState())).toBeFalsy();
    });

    it('should return true if user was created more than seven days before from today', async () => {
        const store = await configureStore();
        preference.myPreference.value = JSON.stringify({[Preferences.CUSTOM_STATUS_MODAL_VIEWED]: false});
        (PreferenceSelectors.get as jest.Mock).mockReturnValue(preference.myPreference.value);
        const todayTimestamp = new Date().getTime();

        // set the user create date to 8 days in the past from today
        const todayMinusEightDays = addTimeToTimestamp(todayTimestamp, TimeInformation.DAYS, 8, TimeInformation.PAST);
        const newUser = {...user, create_at: todayMinusEightDays};
        newUser.props.customStatus = JSON.stringify(customStatus);
        (UserSelectors.getCurrentUser as jest.Mock).mockReturnValue(newUser);
        expect(showStatusDropdownPulsatingDot(store.getState())).toBeTruthy();
    });
});
