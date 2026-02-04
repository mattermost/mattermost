// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Tests for HideUpdateStatusButton feature flag
 *
 * When FeatureFlagHideUpdateStatusButton is enabled, the "Update your status"
 * button on posts is hidden, even if the user hasn't viewed the custom status modal.
 */

import {CustomStatusDuration} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';
import * as GeneralSelectors from 'mattermost-redux/selectors/entities/general';
import * as PreferenceSelectors from 'mattermost-redux/selectors/entities/preferences';
import * as UserSelectors from 'mattermost-redux/selectors/entities/users';

import {showPostHeaderUpdateStatusButton} from 'selectors/views/custom_status';
import configureStore from 'store';

import {TestHelper} from 'utils/test_helper';
import {addTimeToTimestamp, TimeInformation} from 'utils/utils';

jest.mock('mattermost-redux/selectors/entities/users', () => {
    const originalModule = jest.requireActual('mattermost-redux/selectors/entities/users');
    return {
        ...originalModule,
        getCurrentUser: jest.fn(),
        getUser: jest.fn(),
    };
});
jest.mock('mattermost-redux/selectors/entities/general');
jest.mock('mattermost-redux/selectors/entities/preferences');

const customStatus = {
    emoji: 'speech_balloon',
    text: 'speaking',
    duration: CustomStatusDuration.DONT_CLEAR,
};

describe('HideUpdateStatusButton feature flag', () => {
    const user = TestHelper.getUserMock();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return false when HideUpdateStatusButton feature flag is enabled', async () => {
        const store = await configureStore();
        const todayTimestamp = new Date().getTime();

        // Set up user created more than 7 days ago (would normally show button)
        const todayMinusEightDays = addTimeToTimestamp(todayTimestamp, TimeInformation.DAYS, 8, TimeInformation.PAST);
        const newUser = {...user, create_at: todayMinusEightDays};
        newUser.props.customStatus = JSON.stringify(customStatus);

        (UserSelectors.getCurrentUser as jest.Mock).mockReturnValue(newUser);
        // User has NOT viewed the modal (would normally show button)
        (PreferenceSelectors.get as jest.Mock).mockReturnValue(JSON.stringify({[Preferences.CUSTOM_STATUS_MODAL_VIEWED]: false}));

        // Enable the HideUpdateStatusButton feature flag
        (GeneralSelectors.getConfig as jest.Mock).mockReturnValue({
            FeatureFlagHideUpdateStatusButton: 'true',
        });

        expect(showPostHeaderUpdateStatusButton(store.getState())).toBe(false);
    });

    it('should return true when HideUpdateStatusButton feature flag is disabled and conditions are met', async () => {
        const store = await configureStore();
        const todayTimestamp = new Date().getTime();

        // Set up user created more than 7 days ago
        const todayMinusEightDays = addTimeToTimestamp(todayTimestamp, TimeInformation.DAYS, 8, TimeInformation.PAST);
        const newUser = {...user, create_at: todayMinusEightDays};
        newUser.props.customStatus = JSON.stringify(customStatus);

        (UserSelectors.getCurrentUser as jest.Mock).mockReturnValue(newUser);
        (PreferenceSelectors.get as jest.Mock).mockReturnValue(JSON.stringify({[Preferences.CUSTOM_STATUS_MODAL_VIEWED]: false}));

        // Disable the HideUpdateStatusButton feature flag (or don't set it)
        (GeneralSelectors.getConfig as jest.Mock).mockReturnValue({
            FeatureFlagHideUpdateStatusButton: 'false',
        });

        expect(showPostHeaderUpdateStatusButton(store.getState())).toBe(true);
    });

    it('should still hide button when feature flag is off but modal was already viewed', async () => {
        const store = await configureStore();
        const todayTimestamp = new Date().getTime();

        const todayMinusEightDays = addTimeToTimestamp(todayTimestamp, TimeInformation.DAYS, 8, TimeInformation.PAST);
        const newUser = {...user, create_at: todayMinusEightDays};
        newUser.props.customStatus = JSON.stringify(customStatus);

        (UserSelectors.getCurrentUser as jest.Mock).mockReturnValue(newUser);
        // User has already viewed the modal
        (PreferenceSelectors.get as jest.Mock).mockReturnValue(JSON.stringify({[Preferences.CUSTOM_STATUS_MODAL_VIEWED]: true}));

        // Feature flag is off
        (GeneralSelectors.getConfig as jest.Mock).mockReturnValue({
            FeatureFlagHideUpdateStatusButton: 'false',
        });

        expect(showPostHeaderUpdateStatusButton(store.getState())).toBe(false);
    });

    it('should hide button when feature flag is enabled regardless of modal view state', async () => {
        const store = await configureStore();
        const todayTimestamp = new Date().getTime();

        const todayMinusEightDays = addTimeToTimestamp(todayTimestamp, TimeInformation.DAYS, 8, TimeInformation.PAST);
        const newUser = {...user, create_at: todayMinusEightDays};
        newUser.props.customStatus = JSON.stringify(customStatus);

        (UserSelectors.getCurrentUser as jest.Mock).mockReturnValue(newUser);
        // User has NOT viewed the modal (would normally show button)
        (PreferenceSelectors.get as jest.Mock).mockReturnValue(JSON.stringify({[Preferences.CUSTOM_STATUS_MODAL_VIEWED]: false}));

        // But feature flag is on
        (GeneralSelectors.getConfig as jest.Mock).mockReturnValue({
            FeatureFlagHideUpdateStatusButton: 'true',
        });

        expect(showPostHeaderUpdateStatusButton(store.getState())).toBe(false);
    });

    it('should hide button when feature flag is enabled even for new users', async () => {
        const store = await configureStore();
        const todayTimestamp = new Date().getTime();

        // User created recently (less than 7 days)
        const todayMinusTwoDays = addTimeToTimestamp(todayTimestamp, TimeInformation.DAYS, 2, TimeInformation.PAST);
        const newUser = {...user, create_at: todayMinusTwoDays};
        newUser.props.customStatus = JSON.stringify(customStatus);

        (UserSelectors.getCurrentUser as jest.Mock).mockReturnValue(newUser);
        (PreferenceSelectors.get as jest.Mock).mockReturnValue('');

        // Feature flag is on
        (GeneralSelectors.getConfig as jest.Mock).mockReturnValue({
            FeatureFlagHideUpdateStatusButton: 'true',
        });

        // Should still be hidden because feature flag takes precedence
        expect(showPostHeaderUpdateStatusButton(store.getState())).toBe(false);
    });
});
