// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {type IntlShape} from 'react-intl';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {NotificationLevels} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import UserSettingsNotifications, {areDesktopAndMobileSettingsDifferent} from './user_settings_notifications';

jest.mock('components/user_settings/notifications/desktop_and_mobile_notification_setting/notification_permission_section_notice', () => () => <div/>);
jest.mock('components/user_settings/notifications/desktop_and_mobile_notification_setting/notification_permission_title_tag', () => () => <div/>);

describe('components/user_settings/display/UserSettingsDisplay', () => {
    const defaultProps = {
        user: TestHelper.getUserMock({id: 'user_id'}),
        updateSection: jest.fn(),
        activeSection: '',
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        updateMe: jest.fn(() => Promise.resolve({})),
        patchUser: jest.fn(() => Promise.resolve({})),
        isCollapsedThreadsEnabled: true,
        sendPushNotifications: false,
        enableAutoResponder: false,
        isCallsRingingEnabled: false,
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
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, NotificationLevels.MENTION, NotificationLevels.ALL, NotificationLevels.NONE, true)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, NotificationLevels.NONE, NotificationLevels.ALL, NotificationLevels.MENTION, true)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, NotificationLevels.NONE, NotificationLevels.MENTION, NotificationLevels.NONE, true)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, NotificationLevels.MENTION, NotificationLevels.NONE, NotificationLevels.NONE, true)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, NotificationLevels.NONE, NotificationLevels.NONE, NotificationLevels.NONE, true)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, NotificationLevels.MENTION, NotificationLevels.ALL, NotificationLevels.MENTION, true)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, NotificationLevels.NONE, NotificationLevels.ALL, NotificationLevels.NONE, true)).toBe(true);
    });

    test('should return false when desktop and push notification levels are the same', () => {
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, NotificationLevels.ALL, NotificationLevels.ALL, NotificationLevels.ALL, true)).toBe(false);
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.MENTION, NotificationLevels.MENTION, NotificationLevels.MENTION, NotificationLevels.MENTION, false)).toBe(false);
    });

    test('should return true any of desktop or push settings are undefined', () => {
        expect(areDesktopAndMobileSettingsDifferent(undefined as any, NotificationLevels.ALL, NotificationLevels.ALL, NotificationLevels.ALL, true)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, undefined as any, NotificationLevels.ALL, NotificationLevels.ALL, true)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, NotificationLevels.ALL, undefined as any, NotificationLevels.ALL, true)).toBe(true);
        expect(areDesktopAndMobileSettingsDifferent(NotificationLevels.ALL, NotificationLevels.ALL, NotificationLevels.ALL, undefined as any, true)).toBe(true);
    });
});
