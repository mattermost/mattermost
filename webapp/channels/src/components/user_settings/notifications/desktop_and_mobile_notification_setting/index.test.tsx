// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import Constants, {NotificationLevels} from 'utils/constants';

import type {SelectOption, Props} from './index';
import DesktopNotificationSettings, {
    shouldShowDesktopThreadsSection,
    shouldShowMobileThreadsSection,
    getValueOfSendMobileNotificationForSelect,
    getValueOfSendMobileNotificationWhenSelect,
    shouldShowTriggerMobileNotificationsSection,
} from './index';

const validNotificationLevels = Object.values(NotificationLevels);

jest.mock('components/user_settings/notifications/desktop_and_mobile_notification_setting/notification_permission_section_notice', () => () => <div/>);
jest.mock('components/user_settings/notifications/desktop_and_mobile_notification_setting/notification_permission_title_tag', () => () => <div/>);

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
        desktopActivity: NotificationLevels.DEFAULT,
        pushActivity: NotificationLevels.DEFAULT,
        pushStatus: Constants.UserStatuses.OFFLINE,
        desktopThreads: NotificationLevels.DEFAULT,
        pushThreads: NotificationLevels.DEFAULT,
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
        const props = {...baseProps, desktopActivity: NotificationLevels.ALL};
        renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(screen.queryByText('Notify me about replies to threads I\'m following')).toBeNull();
    });

    test('should not show desktop thread notification checkbox when desktop is none', () => {
        const props = {...baseProps, desktopActivity: NotificationLevels.NONE};
        renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(screen.queryByText('Notify me about replies to threads I\'m following')).toBeNull();
    });

    test('should show desktop thread notification checkbox when desktop is mention', () => {
        const props = {...baseProps, desktopActivity: NotificationLevels.MENTION};
        renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(screen.getByText('Notify me about replies to threads I\'m following')).toBeInTheDocument();
    });

    test('should show mobile notification when checkbox for use different mobile settings is checked', () => {
        const props = {...baseProps, desktopAndMobileSettingsDifferent: true};
        renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(screen.getByText('Send mobile notifications for:')).toBeInTheDocument();
    });

    test('should not show mobile notification when checkbox for use different mobile settings is not checked', () => {
        const props = {...baseProps, desktopAndMobileSettingsDifferent: false};
        renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(screen.queryByText('Send mobile notifications for:')).toBeNull();
    });

    test('should shown notify me about mobile threads when mobile setting is mention and desktop setting is anything', () => {
        const {rerender} = renderWithContext(
            <DesktopNotificationSettings
                {...baseProps}
                desktopAndMobileSettingsDifferent={true}
                pushActivity={NotificationLevels.MENTION}
                desktopActivity={NotificationLevels.NONE}
            />,
        );

        expect(screen.getByText('Notify me on mobile about replies to threads I\'m following')).toBeInTheDocument();

        rerender(
            <DesktopNotificationSettings
                {...baseProps}
                desktopAndMobileSettingsDifferent={true}
                pushActivity={NotificationLevels.MENTION}
                desktopActivity={NotificationLevels.ALL}
            />,
        );

        expect(screen.getByText('Notify me on mobile about replies to threads I\'m following')).toBeInTheDocument();
    });

    test('should not show notify me about mobile threads when mobile setting is anything other than mention', () => {
        const {rerender} = renderWithContext(
            <DesktopNotificationSettings
                {...baseProps}
                desktopAndMobileSettingsDifferent={true}
                pushActivity={NotificationLevels.NONE}
                desktopActivity={NotificationLevels.NONE}
            />,
        );

        expect(screen.queryByText('Notify me on mobile about replies to threads I\'m following')).toBeNull();

        rerender(
            <DesktopNotificationSettings
                {...baseProps}
                desktopAndMobileSettingsDifferent={true}
                pushActivity={NotificationLevels.ALL}
                desktopActivity={NotificationLevels.ALL}
            />,
        );

        expect(screen.queryByText('Notify me on mobile about replies to threads I\'m following')).toBeNull();
    });

    test('should show trigger mobile notifications section when desktop setting is mention', () => {
        const props = {...baseProps, desktopActivity: NotificationLevels.MENTION, desktopAndMobileSettingsDifferent: false};
        renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(screen.getByText('Trigger mobile notifications when I am:')).toBeInTheDocument();
    });

    test('should not show trigger mobile notifications section when desktop setting is none', () => {
        const props = {...baseProps, desktopActivity: NotificationLevels.NONE, desktopAndMobileSettingsDifferent: false};
        renderWithContext(
            <DesktopNotificationSettings {...props}/>,
        );

        expect(screen.queryByText('Trigger mobile notifications when I am:')).toBeNull();
    });
});

describe('shouldShowDesktopThreadsSection', () => {
    test('should not show when collapsed threads are not enabled', () => {
        expect(shouldShowDesktopThreadsSection(false, 'hello' as any)).toBe(false);
    });

    test('should not show when desktop setting is either none or all', () => {
        expect(shouldShowDesktopThreadsSection(true, NotificationLevels.NONE)).toBe(false);
        expect(shouldShowDesktopThreadsSection(true, NotificationLevels.ALL)).toBe(false);
    });

    test('should show when desktop setting is mention', () => {
        expect(shouldShowDesktopThreadsSection(true, NotificationLevels.MENTION)).toBe(true);
        expect(shouldShowDesktopThreadsSection(true, NotificationLevels.DEFAULT)).toBe(true);
    });

    test('should show by default when desktop setting is undefined', () => {
        expect(shouldShowDesktopThreadsSection(true, undefined as any)).toBe(true);
    });
});

describe('shouldShowMobileThreadsSection', () => {
    test('should return false if sendPushNotifications is false', () => {
        const result = shouldShowMobileThreadsSection(false, true, true, 'any' as any);
        expect(result).toBe(false);
    });

    test('should return false if isCollapsedThreadsEnabled is false', () => {
        const result = shouldShowMobileThreadsSection(true, false, true, 'any' as any);
        expect(result).toBe(false);
    });

    test('should return false if desktop and mobile settings are same', () => {
        const result = shouldShowMobileThreadsSection(true, true, false, 'any' as any);
        expect(result).toBe(false);
    });

    test('should return false if pushActivity is all', () => {
        const result = shouldShowMobileThreadsSection(true, true, true, NotificationLevels.ALL);
        expect(result).toBe(false);
    });

    test('should return false if pushActivity is none', () => {
        const result = shouldShowMobileThreadsSection(true, true, true, NotificationLevels.NONE);
        expect(result).toBe(false);
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
    test('should not show when push notifications are off', () => {
        expect(shouldShowTriggerMobileNotificationsSection(false, NotificationLevels.ALL, NotificationLevels.ALL, true)).toBe(false);
    });

    test('should show if either of desktop or mobile settings are not defined', () => {
        expect(shouldShowTriggerMobileNotificationsSection(true, undefined as any, NotificationLevels.ALL, true)).toBe(true);
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.ALL, undefined as any, true)).toBe(true);
    });

    test('should show if desktop is either mention or all for same mobile setting', () => {
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.MENTION, NotificationLevels.MENTION, false)).toBe(true);
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.ALL, NotificationLevels.ALL, false)).toBe(true);
    });

    test('should not show if desktop is none for same mobile setting', () => {
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.NONE, NotificationLevels.NONE, false)).toBe(false);
    });

    test('should show for any desktop setting if mobile setting is mention', () => {
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.ALL, NotificationLevels.MENTION, true)).toBe(true);
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.MENTION, NotificationLevels.MENTION, true)).toBe(true);
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.NONE, NotificationLevels.MENTION, true)).toBe(true);
    });

    test('should not show for any desktop setting if mobile setting is none', () => {
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.ALL, NotificationLevels.NONE, true)).toBe(false);
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.MENTION, NotificationLevels.NONE, true)).toBe(false);
        expect(shouldShowTriggerMobileNotificationsSection(true, NotificationLevels.NONE, NotificationLevels.NONE, true)).toBe(false);
    });
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
