// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelMembership} from '@mattermost/types/channels';
import type {UserNotifyProps} from '@mattermost/types/users';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {NotificationLevels, DesktopSound} from 'utils/constants';
import {notificationSoundKeys, convertDesktopSoundNotifyPropFromUserToDesktop} from 'utils/notification_sounds';
import {TestHelper} from 'utils/test_helper';

import ResetToDefaultButton, {SectionName} from './index';
import type {Props} from './index';

describe('ResetToDefaultButton', () => {
    const defaultProps: Props = {
        sectionName: SectionName.Desktop,
        userNotifyProps: TestHelper.getUserMock().notify_props,
        userSelectedChannelNotifyProps: TestHelper.getChannelMembershipMock({}).notify_props,
        onClick: jest.fn(),
    };

    test('should not show if section name is not valid', () => {
        // Mock console.error to suppress PropTypes warning
        const originalError = console.error;
        console.error = jest.fn();

        const props = {
            ...defaultProps,
            sectionName: 'invalidSectionName' as any,
        };

        const {container} = renderWithContext(<ResetToDefaultButton {...props}/>);
        expect(container).toBeEmptyDOMElement();

        console.error = originalError;
    });

    test('should render if section name is valid', () => {
        const {container} = renderWithContext(<ResetToDefaultButton {...defaultProps}/>);
        expect(container).not.toBeEmptyDOMElement();
        expect(container).toMatchSnapshot();
    });

    test('should not show if desktop notifications are same as default user notification settings', () => {
        const props = {
            ...defaultProps,
            userNotifyProps: {
                ...defaultProps.userNotifyProps,
                desktop: NotificationLevels.ALL,
                desktop_threads: NotificationLevels.ALL,
                desktop_sound: 'true' as UserNotifyProps['desktop_sound'],
                desktop_notification_sound: notificationSoundKeys[0] as UserNotifyProps['desktop_notification_sound'],
            },
            userSelectedChannelNotifyProps: {
                ...defaultProps.userSelectedChannelNotifyProps,
                desktop: NotificationLevels.ALL,
                desktop_threads: NotificationLevels.ALL,
                desktop_sound: DesktopSound.ON,
                desktop_notification_sound: notificationSoundKeys[0] as ChannelMembership['notify_props']['desktop_notification_sound'],
            },
        };

        const {container} = renderWithContext(<ResetToDefaultButton {...props}/>);
        expect(container).toBeEmptyDOMElement();
    });

    test('should show if desktop notifications are not same as user notification settings', () => {
        const props1 = {
            ...defaultProps,
            userNotifyProps: {
                ...defaultProps.userNotifyProps,
                desktop: NotificationLevels.ALL,
                desktop_threads: NotificationLevels.ALL,
                desktop_sound: 'true' as UserNotifyProps['desktop_sound'],
                desktop_notification_sound: notificationSoundKeys[0] as UserNotifyProps['desktop_notification_sound'],
            },
            userSelectedChannelNotifyProps: {
                ...defaultProps.userSelectedChannelNotifyProps,
                desktop: NotificationLevels.MENTION,
                desktop_threads: NotificationLevels.ALL,
                desktop_sound: DesktopSound.ON,
            },
        };

        const {rerender} = renderWithContext(<ResetToDefaultButton {...props1}/>);
        expect(screen.getByText('Reset to default')).toBeInTheDocument();

        const props2 = {
            ...props1,
            userSelectedChannelNotifyProps: {
                ...defaultProps.userSelectedChannelNotifyProps,
                desktop: NotificationLevels.ALL,
                desktop_sound: DesktopSound.OFF,
                desktop_notification_sound: notificationSoundKeys[0] as UserNotifyProps['desktop_notification_sound'],
            },
        };

        rerender(<ResetToDefaultButton {...props2}/>);
        expect(screen.getByText('Reset to default')).toBeInTheDocument();
    });

    test('should not show if mobile notifications are same as default user notification settings', () => {
        const props = {
            ...defaultProps,
            sectionName: SectionName.Mobile,
            userNotifyProps: {
                ...defaultProps.userNotifyProps,
                push: NotificationLevels.ALL,
                push_threads: NotificationLevels.ALL,
            },
            userSelectedChannelNotifyProps: {
                ...defaultProps.userSelectedChannelNotifyProps,
                push: NotificationLevels.ALL,
                push_threads: NotificationLevels.ALL,
            },
        };

        const {container} = renderWithContext(<ResetToDefaultButton {...props}/>);
        expect(container).toBeEmptyDOMElement();
    });

    test('should show if mobile notifications are not same as user notification settings', () => {
        const props = {
            ...defaultProps,
            sectionName: SectionName.Mobile,
            userNotifyProps: {
                ...defaultProps.userNotifyProps,
                push: NotificationLevels.ALL,
                push_threads: NotificationLevels.ALL,
            },
            userSelectedChannelNotifyProps: {
                ...defaultProps.userSelectedChannelNotifyProps,
                push: NotificationLevels.MENTION,
                push_threads: NotificationLevels.ALL,
            },
        };

        const {rerender} = renderWithContext(<ResetToDefaultButton {...props}/>);
        expect(screen.getByText('Reset to default')).toBeInTheDocument();

        const props2 = {
            ...defaultProps,
            userSelectedChannelNotifyProps: {
                ...defaultProps.userSelectedChannelNotifyProps,
                push: NotificationLevels.ALL,
                push_threads: NotificationLevels.MENTION,
            },
        };

        rerender(<ResetToDefaultButton {...props2}/>);
        expect(screen.getByText('Reset to default')).toBeInTheDocument();
    });
});

describe('convertDesktopSoundNotifyPropFromUserToDesktop', () => {
    test('should return ON if user desktop sound is true', () => {
        const desktopSound = convertDesktopSoundNotifyPropFromUserToDesktop('true');
        expect(desktopSound).toBe(DesktopSound.ON);
    });

    test('should return ON if user desktop sound is not present', () => {
        const desktopSound = convertDesktopSoundNotifyPropFromUserToDesktop();
        expect(desktopSound).toBe(DesktopSound.ON);
    });

    test('should return OFF if user desktop sound is false', () => {
        const desktopSound = convertDesktopSoundNotifyPropFromUserToDesktop('false');
        expect(desktopSound).toBe(DesktopSound.OFF);
    });
});
