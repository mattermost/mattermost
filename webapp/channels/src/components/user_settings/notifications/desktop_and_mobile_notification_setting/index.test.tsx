// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import Constants, {NotificationLevels} from 'utils/constants';

import type {SelectOption, Props} from './index';
import DesktopNotificationSettings, {
    getValueOfSendMobileNotificationForSelect,
    getValueOfSendMobileNotificationWhenSelect,
    shouldShowTriggerMobileNotificationsSection,
} from './index';

const validNotificationLevels = Object.values(NotificationLevels);

describe('DesktopNotificationSettings', () => {
    const baseProps: Props = {
        active: true,
        updateSection: jest.fn(),
        onSubmit: jest.fn(),
        onCancel: jest.fn(),
        saving: false,
        error: '',
        setParentState: jest.fn(),
        areAllSectionsInactive: false,
        isCollapsedThreadsEnabled: true,
        desktopActivity: NotificationLevels.MENTION,
        pushActivity: NotificationLevels.MENTION,
        pushStatus: Constants.UserStatuses.OFFLINE,
        desktopThreads: NotificationLevels.ALL,
        pushThreads: NotificationLevels.ALL,
        sendPushNotifications: true,
        desktopAndMobileSettingsDifferent: false,
    };

    test('should match snapshot, on max setting', () => {
        const {container} = renderWithContext(
            <DesktopNotificationSettings {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on min setting', () => {
        const props = {...baseProps, active: false};
        const {container} = renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should not show desktop thread notification checkbox when collapsed threads are not enabled', () => {
        const props = {...baseProps, isCollapsedThreadsEnabled: false};
        const {container} = renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(screen.queryByText('Notify me about replies to threads I\'m following')).toBeNull();
        expect(container).toMatchSnapshot();
    });

    test('should not show desktop thread notification checkbox when desktop is all', () => {
        const props = {...baseProps, desktopThreads: NotificationLevels.ALL};
        renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(screen.queryByText('Notify me about replies to threads I\'m following')).toBeNull();
    });

    test('should not show desktop thread notification checkbox when desktop is none', () => {
        const props = {...baseProps, desktopThreads: NotificationLevels.NONE};
        renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(screen.queryByText('Notify me about replies to threads I\'m following')).toBeNull();
    });

    test('should show desktop thread notification checkbox when desktop is mention', () => {
        const props = {...baseProps, desktopThreads: NotificationLevels.MENTION};
        renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(screen.getByText('Notify me about replies to threads I\'m following')).toBeInTheDocument();
    });

    test('should show mobile notification when checkbox for use different mobile settings is checked', () => {
        const props = {...baseProps, desktopAndMobileSettingsDifferent: true};
        const {container} = renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(screen.getByText('Send mobile notifications for:')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});

describe('getValueOfSendMobileNotificationForSelect', () => {
    test('should return the middle option when input is undefined', () => {
        expect(getValueOfSendMobileNotificationForSelect(undefined as any)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationForSelect(undefined as any) as SelectOption;
        expect(result.value).toBe(NotificationLevels.MENTION);
    });

    test('should return the middle option when input is not a valid option', () => {
        expect(getValueOfSendMobileNotificationForSelect('invalid' as any)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationForSelect('invalid' as any) as SelectOption;
        expect(result.value).toBe(NotificationLevels.MENTION);
    });

    test('should return the same option when input is a valid option', () => {
        validNotificationLevels.
            filter((level) => level !== NotificationLevels.DEFAULT).
            forEach((level) => {
                expect(getValueOfSendMobileNotificationForSelect(level)).not.toBeUndefined();

                const result = getValueOfSendMobileNotificationForSelect(level) as SelectOption;
                expect(result.value).toBe(level);
            });
    });
});

describe('shouldShowTriggerMobileNotificationsSection', () => {
    // test('', () => {
    //     expect(shouldShowTriggerMobileNotificationsSection(false, 'invalid' as any, 'invalid' as any, true)).toBe(false);
    // });
});

describe('getValueOfSendMobileNotificationWhenSelect', () => {
    test('When input is undefined it should return the last option', () => {
        expect(getValueOfSendMobileNotificationWhenSelect(undefined)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationWhenSelect(undefined) as SelectOption;
        expect(result.value).toBe(Constants.UserStatuses.OFFLINE);
    });

    test('when input is defined but is not a valid option it should return the last option', () => {
        // We are purposely testing with an invalid value hence the 'any'
        expect(getValueOfSendMobileNotificationWhenSelect('invalid' as any)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationWhenSelect('invalid' as any) as SelectOption;
        expect(result.value).toBe(Constants.UserStatuses.OFFLINE);
    });

    test('When input is a valid option it should return the same option', () => {
        expect(getValueOfSendMobileNotificationWhenSelect(Constants.UserStatuses.ONLINE)).not.toBeUndefined();

        const result = getValueOfSendMobileNotificationWhenSelect(Constants.UserStatuses.ONLINE) as SelectOption;
        expect(result.value).toBe(Constants.UserStatuses.ONLINE);

        expect(getValueOfSendMobileNotificationWhenSelect(Constants.UserStatuses.AWAY)).not.toBeUndefined();

        const result2 = getValueOfSendMobileNotificationWhenSelect(Constants.UserStatuses.AWAY) as SelectOption;
        expect(result2.value).toBe(Constants.UserStatuses.AWAY);
    });
});

describe('shouldShowTriggerMobileNotificationsSection', () => {
    test('should return false when collapsed threads are not enabled', () => {
        expect(shouldShowTriggerMobileNotificationsSection(false, 'hello' as any)).toBe(false);
    });

    test('should return true when desktop setting is invalid', () => {
        expect(shouldShowTriggerMobileNotificationsSection(true, 'nothing' as any)).toBe(true);
    });

    test('should return true when desktop setting is for mentions', () => {
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.MENTION)).toBe(true);
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.DEFAULT)).toBe(true);
    });

    test('should return false when desktop setting is not for mentions', () => {
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.NONE)).toBe(false);
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.ALL)).toBe(false);
    });
});
