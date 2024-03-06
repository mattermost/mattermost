// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {type IntlShape} from 'react-intl';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {NotificationLevels} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import UserSettingsNotifications, {areDesktopAndMobileSettingsDifferent} from './user_settings_notifications';

const validNotificationLevels = Object.values(NotificationLevels);

describe('components/user_settings/display/UserSettingsDisplay', () => {
    const defaultProps = {
        user: TestHelper.getUserMock({id: 'user_id'}),
        updateSection: jest.fn(),
        activeSection: '',
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        updateMe: jest.fn(() => Promise.resolve({})),
        isCollapsedThreadsEnabled: true,
        sendPushNotifications: false,
        enableAutoResponder: false,
        isCallsRingingEnabled: true,
        intl: {} as IntlShape,
        isEnterpriseOrCloudOrSKUStarterFree: false,
        isEnterpriseReady: true,
    };

    test('should match snapshot', () => {
        const wrapper = renderWithContext(
            <UserSettingsNotifications {...defaultProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when its a starter free', () => {
        const props = {...defaultProps, isEnterpriseOrCloudOrSKUStarterFree: true};

        const wrapper = renderWithContext(
            <UserSettingsNotifications {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when its team edition', () => {
        const props = {...defaultProps, isEnterpriseReady: false};

        const wrapper = renderWithContext(
            <UserSettingsNotifications {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should show reply notifications section when CRT off', () => {
        const props = {...defaultProps, isCollapsedThreadsEnabled: false};

        renderWithContext(<UserSettingsNotifications {...props}/>);

        expect(screen.getByText('Reply notifications')).toBeInTheDocument();
    });
});

describe('areDesktopAndMobileSettingsDifferent', () => {
    test('should return true when desktop and push notification levels are different', () => {
        validNotificationLevels.forEach((desktopLevel) => {
            validNotificationLevels.forEach((mobileLevel) => {
                if (desktopLevel !== mobileLevel) {
                    expect(areDesktopAndMobileSettingsDifferent(desktopLevel, mobileLevel)).toBe(true);
                }
            });
        });
    });

    test('should return false when desktop and push notification levels are the same', () => {
        validNotificationLevels.forEach((level) => {
            expect(areDesktopAndMobileSettingsDifferent(level, level)).toBe(false);
        });
    });

    test('should return true when desktop or push notification levels are undefined', () => {
        expect(areDesktopAndMobileSettingsDifferent(undefined as any, undefined as any)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, undefined as any)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent('hello' as any, NotificationLevels.ALL)).toBe(true);
    });
});
