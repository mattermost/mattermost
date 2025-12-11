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

vi.mock('mattermost-redux/selectors/entities/users', async () => {
    const originalModule = await vi.importActual('mattermost-redux/selectors/entities/users');
    return {
        ...originalModule,
        getCurrentUser: vi.fn(),
        getUser: vi.fn(),
    };
});
vi.mock('mattermost-redux/selectors/entities/general');
vi.mock('mattermost-redux/selectors/entities/preferences');

const customStatus = {
    emoji: 'speech_balloon',
    text: 'speaking',
    duration: CustomStatusDuration.DONT_CLEAR,
};

describe('getCustomStatus', () => {
    const user = TestHelper.getUserMock();
    const getCustomStatus = makeGetCustomStatus();

    test('should return undefined when current user has no custom status set', async () => {
        const store = await configureStore();
        vi.mocked(UserSelectors.getCurrentUser).mockReturnValue(user);
        expect(getCustomStatus(store.getState())).toBeUndefined();
    });

    test('should return undefined when user with given id has no custom status set', async () => {
        const store = await configureStore();
        vi.mocked(UserSelectors.getUser).mockReturnValue(user);
        expect(getCustomStatus(store.getState(), user.id)).toBeUndefined();
    });

    test('should return undefined when user with invalid json for custom status set', async () => {
        const store = await configureStore();
        const newUser = {...user};
        newUser.props.customStatus = 'not a JSON string';

        vi.mocked(UserSelectors.getUser).mockReturnValue(user);
        expect(getCustomStatus(store.getState(), user.id)).toBeUndefined();
    });

    test('should return customStatus object when there is custom status set', async () => {
        const store = await configureStore();
        const newUser = {...user};
        newUser.props.customStatus = JSON.stringify(customStatus);
        vi.mocked(UserSelectors.getCurrentUser).mockReturnValue(newUser);
        expect(getCustomStatus(store.getState())).toStrictEqual(customStatus);
    });
});

describe('getRecentCustomStatuses', () => {
    const preference = {
        myPreference: {
            value: JSON.stringify([]),
        },
    };

    test('should return empty arr if there are no recent custom statuses', async () => {
        const store = await configureStore();
        vi.mocked(PreferenceSelectors.get).mockReturnValue(preference.myPreference.value);
        expect(getRecentCustomStatuses(store.getState())).toStrictEqual([]);
    });

    test('should return arr of custom statuses if there are recent custom statuses', async () => {
        const store = await configureStore();
        preference.myPreference.value = JSON.stringify([customStatus]);
        vi.mocked(PreferenceSelectors.get).mockReturnValue(preference.myPreference.value);
        expect(getRecentCustomStatuses(store.getState())).toStrictEqual([customStatus]);
    });
});

describe('isCustomStatusEnabled', () => {
    const config = {
        EnableCustomUserStatuses: 'true',
    };

    test('should return false if EnableCustomUserStatuses is false in the config', async () => {
        const store = await configureStore();
        expect(isCustomStatusEnabled(store.getState())).toBeFalsy();
    });

    test('should return true if EnableCustomUserStatuses is true in the config', async () => {
        const store = await configureStore();
        vi.mocked(GeneralSelectors.getConfig).mockReturnValue(config);
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

    test('should return true if user has not opened the custom status modal before', async () => {
        const store = await configureStore();
        vi.mocked(PreferenceSelectors.get).mockReturnValue(preference.myPreference.value);
        expect(showStatusDropdownPulsatingDot(store.getState())).toBeTruthy();
    });

    test('should return false if user has opened the custom status modal before', async () => {
        const store = await configureStore();
        preference.myPreference.value = JSON.stringify({[Preferences.CUSTOM_STATUS_MODAL_VIEWED]: true});
        vi.mocked(PreferenceSelectors.get).mockReturnValue(preference.myPreference.value);
        expect(showPostHeaderUpdateStatusButton(store.getState())).toBeFalsy();
    });

    test('should return false if user was created less than seven days before from today', async () => {
        const store = await configureStore();
        vi.mocked(PreferenceSelectors.get).mockReturnValue(preference.myPreference.value);
        const todayTimestamp = new Date().getTime();

        // set the user create date to 6 days in the past from today
        const todayMinusSixDays = addTimeToTimestamp(todayTimestamp, TimeInformation.DAYS, 6, TimeInformation.PAST);
        const newUser = {...user, create_at: todayMinusSixDays};
        newUser.props.customStatus = JSON.stringify(customStatus);
        vi.mocked(UserSelectors.getCurrentUser).mockReturnValue(newUser);
        expect(showStatusDropdownPulsatingDot(store.getState())).toBeFalsy();
    });

    test('should return true if user was created more than seven days before from today', async () => {
        const store = await configureStore();
        preference.myPreference.value = JSON.stringify({[Preferences.CUSTOM_STATUS_MODAL_VIEWED]: false});
        vi.mocked(PreferenceSelectors.get).mockReturnValue(preference.myPreference.value);
        const todayTimestamp = new Date().getTime();

        // set the user create date to 8 days in the past from today
        const todayMinusEightDays = addTimeToTimestamp(todayTimestamp, TimeInformation.DAYS, 8, TimeInformation.PAST);
        const newUser = {...user, create_at: todayMinusEightDays};
        newUser.props.customStatus = JSON.stringify(customStatus);
        vi.mocked(UserSelectors.getCurrentUser).mockReturnValue(newUser);
        expect(showStatusDropdownPulsatingDot(store.getState())).toBeTruthy();
    });
});
