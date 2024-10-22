// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';

import type {ChannelMembership} from '@mattermost/types/channels';
import type {UserNotifyProps} from '@mattermost/types/users';

import ChannelNotificationsModal, {createChannelNotifyPropsFromSelectedSettings, getInitialValuesOfChannelNotifyProps, areDesktopAndMobileSettingsDifferent} from 'components/channel_notifications_modal/channel_notifications_modal';
import type {Props} from 'components/channel_notifications_modal/channel_notifications_modal';

import {renderWithContext} from 'tests/react_testing_utils';
import {DesktopSound, IgnoreChannelMentions, NotificationLevels} from 'utils/constants';
import {DesktopNotificationSounds, convertDesktopSoundNotifyPropFromUserToDesktop} from 'utils/notification_sounds';
import {TestHelper} from 'utils/test_helper';

describe('ChannelNotificationsModal', () => {
    const baseProps: Props = {
        onExited: jest.fn(),
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            display_name: 'channel_display_name',
        }),
        currentUser: TestHelper.getUserMock({
            id: 'current_user_id',
            notify_props: {
                desktop: NotificationLevels.ALL,
                desktop_threads: NotificationLevels.MENTION,
                desktop_sound: 'true',
                desktop_notification_sound: 'Bing',
                push: NotificationLevels.MENTION,
                push_threads: NotificationLevels.MENTION,
            } as UserNotifyProps,
        }),
        channelMember: {
            notify_props: {
                desktop: NotificationLevels.ALL,
                desktop_threads: NotificationLevels.ALL,
                desktop_sound: 'on',
                desktop_notification_sound: 'Bing',
                push: NotificationLevels.ALL,
                push_threads: NotificationLevels.ALL,
                mark_unread: NotificationLevels.ALL,
                ignore_channel_mentions: IgnoreChannelMentions.DEFAULT,
            },
        } as unknown as ChannelMembership,
        sendPushNotifications: true,
        actions: {
            updateChannelNotifyProps: jest.fn().mockImplementation(() => Promise.resolve({data: true})),
        },
        collapsedReplyThreads: true,
    };

    test('should not show other settings if channel is mute', async () => {
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        const muteChannel = screen.getByTestId('muteChannel');

        fireEvent.click(muteChannel);
        expect(muteChannel).toBeChecked();
        const AlertBanner = screen.queryByText('This channel is muted');
        expect(AlertBanner).toBeVisible();

        expect(screen.queryByText('Desktop Notifications')).toBeNull();

        expect(screen.queryByText('Mobile Notifications')).toBeNull();
        expect(screen.queryByText('Follow all threads in this channel')).not.toBeNull();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));

        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'default',
                    desktop_threads: 'all',
                    desktop_sound: 'default',
                    desktop_notification_sound: 'default',
                    push: 'all',
                    push_threads: 'all',
                    mark_unread: 'mention',
                    ignore_channel_mentions: 'off',
                    channel_auto_follow_threads: 'off',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should save correctly for \'Ignore mentions for @channel, @here and @all\'', async () => {
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...baseProps}/>,
        );
        const ignoreChannel = screen.getByTestId('ignoreMentions');
        fireEvent.click(ignoreChannel);
        expect(ignoreChannel).toBeChecked();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'default',
                    desktop_threads: 'all',
                    desktop_sound: 'default',
                    desktop_notification_sound: 'default',
                    push: 'all',
                    push_threads: 'all',
                    mark_unread: 'all',
                    ignore_channel_mentions: 'on',
                    channel_auto_follow_threads: 'off',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should check the options in the desktop notifications', async () => {
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        expect(screen.queryByText('Desktop Notifications')).toBeVisible();

        const AlllabelRadio: HTMLInputElement = screen.getByTestId(
            'desktopNotification-all',
        );
        fireEvent.click(AlllabelRadio);
        expect(AlllabelRadio.checked).toEqual(true);

        const MentionslabelRadio: HTMLInputElement = screen.getByTestId(
            'desktopNotification-mention',
        );
        fireEvent.click(MentionslabelRadio);
        expect(MentionslabelRadio.checked).toEqual(true);

        const NothinglabelRadio: HTMLInputElement = screen.getByTestId(
            'desktopNotification-none',
        );
        fireEvent.click(NothinglabelRadio);
        expect(NothinglabelRadio.checked).toEqual(true);

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'none',
                    channel_auto_follow_threads: 'off',
                    desktop_threads: 'all',
                    push_threads: 'all',
                    desktop_notification_sound: 'default',
                    desktop_sound: 'default',
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    push: 'none',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should disable message notification sound if option is unchecked', async () => {
        renderWithContext(<ChannelNotificationsModal {...baseProps}/>);

        // Since the default value is checked, we will uncheck the checkbox
        fireEvent.click(screen.getByTestId('desktopNotificationSoundsCheckbox'));
        expect(screen.getByTestId('desktopNotificationSoundsCheckbox')).not.toBeChecked();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() => {
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'default',
                    desktop_threads: 'all',
                    desktop_sound: 'off',
                    desktop_notification_sound: 'default',
                    push: 'all',
                    push_threads: 'all',
                    mark_unread: 'all',
                    ignore_channel_mentions: 'off',
                    channel_auto_follow_threads: 'off',
                },
            );
        });
    });

    test('should default to user desktop notification sound if reset to default is clicked', async () => {
        renderWithContext(<ChannelNotificationsModal {...baseProps}/>);

        // Since the default value is on, we will uncheck the checkbox
        fireEvent.click(screen.getByTestId('desktopNotificationSoundsCheckbox'));
        expect(screen.getByTestId('desktopNotificationSoundsCheckbox')).not.toBeChecked();

        // Reset to default button is clicked
        fireEvent.click(screen.getByTestId('resetToDefaultButton-desktop'));

        // Verify that the checkbox is checked to default to user desktop notification sound
        expect(screen.getByTestId('desktopNotificationSoundsCheckbox')).toBeChecked();
    });

    test('should save the options exactly same as Desktop for mobile if use same as desktop checkbox is checked', async () => {
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        expect(screen.queryByText('Desktop Notifications')).toBeVisible();

        const sameAsDesktop: HTMLInputElement = screen.getByTestId(
            'sameMobileSettingsDesktop',
        );
        expect(sameAsDesktop.checked).toEqual(true);

        expect(screen.queryByText('All new messages')).toBeNull();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'default',
                    desktop_threads: 'all',
                    desktop_sound: 'default',
                    desktop_notification_sound: 'default',
                    push: 'all',
                    push_threads: 'all',
                    mark_unread: 'all',
                    ignore_channel_mentions: 'off',
                    channel_auto_follow_threads: 'off',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should check the options in the mobile notifications', async () => {
        const props = {
            ...baseProps,
            channelMember: {
                notify_props: {
                    ...baseProps.channelMember?.notify_props,
                    push: NotificationLevels.MENTION,
                },
            } as unknown as ChannelMembership,
        };
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...props}/>,
        );

        fireEvent.click(screen.getByTestId('MobileNotification-all'));
        expect(screen.getByTestId('MobileNotification-all')).toBeChecked();

        fireEvent.click(screen.getByTestId('MobileNotification-mention'));
        expect(screen.getByTestId('MobileNotification-mention')).toBeChecked();

        fireEvent.click(screen.getByTestId('MobileNotification-none'));
        expect(screen.getByTestId('MobileNotification-none')).toBeChecked();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'default',
                    channel_auto_follow_threads: 'off',
                    desktop_threads: 'all',
                    push_threads: 'all',
                    desktop_notification_sound: 'default',
                    desktop_sound: 'default',
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    push: 'none',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should show not auto follow, desktop threads and mobile threads settings if collapsed reply threads is enabled', async () => {
        const props = {
            ...baseProps,
            collapsedReplyThreads: false,
        };
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...props}/>,
        );

        expect(screen.queryByText('Follow all threads in this channel')).toBeNull();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));

        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    channel_auto_follow_threads: 'off',
                    desktop: 'default',
                    desktop_notification_sound: 'default',
                    desktop_sound: 'default',
                    desktop_threads: 'all',
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    push: 'all',
                    push_threads: 'all',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });
});

describe('createChannelNotifyPropsFromSelectedSettings', () => {
    test('should return passed in mark_unread, ignore_channel_mentions, channel_auto_follow_threads', () => {
        const userNotifyProps = TestHelper.getUserMock().notify_props;
        const savedChannelNotifyProps = TestHelper.getChannelMembershipMock({
            notify_props: {
                mark_unread: 'all',
                ignore_channel_mentions: 'off',
                channel_auto_follow_threads: 'off',
            },
        }).notify_props;

        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(userNotifyProps, savedChannelNotifyProps, true);
        expect(channelNotifyProps.mark_unread).toEqual('all');
        expect(channelNotifyProps.ignore_channel_mentions).toEqual('off');
        expect(channelNotifyProps.channel_auto_follow_threads).toEqual('off');
    });

    test('should return default if channel\'s desktop is same as user\'s desktop value', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop: 'all',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: 'all',
            },
        }).notify_props;

        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true);
        expect(channelNotifyProps1.desktop).toEqual('default');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {
                desktop: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: 'mention',
            },
        }).notify_props;

        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true);
        expect(channelNotifyProps2.desktop).toEqual('default');
    });

    test('should return desktop value if channel\'s desktop is different from user\'s desktop value', () => {
        const userNotifyProps = TestHelper.getUserMock({
            notify_props: {
                desktop: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: 'all',
            },
        }).notify_props;

        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(userNotifyProps, savedChannelNotifyProps, true);
        expect(channelNotifyProps.desktop).toEqual('all');
    });

    test('should return correct desktop_threads when user\'s desktop_threads is defined', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop_threads: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: 'mention',
            },
        }).notify_props;
        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true);
        expect(channelNotifyProps1.desktop_threads).toEqual('default');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {
                desktop_threads: 'all',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: 'mention',
            },
        }).notify_props;
        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true);
        expect(channelNotifyProps2.desktop_threads).toEqual('mention');
    });

    test('should return correct desktop_threads when user\'s desktop_threads is not defined', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: 'mention',
            },
        }).notify_props;
        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true);
        expect(channelNotifyProps1.desktop_threads).toEqual('default');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: 'default',
            },
        }).notify_props;
        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true);
        expect(channelNotifyProps2.desktop_threads).toEqual('default');

        const userNotifyProps3 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps3 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: 'none',
            },
        }).notify_props;
        const channelNotifyProps3 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps3, savedChannelNotifyProps3, true);
        expect(channelNotifyProps3.desktop_threads).toEqual('none');

        const userNotifyProps4 = TestHelper.getUserMock({
            notify_props: {
                desktop_threads: '' as any,
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps4 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: 'none',
            },
        }).notify_props;
        const channelNotifyProps4 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps4, savedChannelNotifyProps4, true);
        expect(channelNotifyProps4.desktop_threads).toEqual('none');
    });

    test('should return correct desktop_sound value', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop_sound: 'true',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_sound: 'on',
            },
        }).notify_props;
        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true);
        expect(channelNotifyProps1.desktop_sound).toEqual('default');

        const userNotifyProps2 = {
            desktop_sound: 'false',
        } as UserNotifyProps;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_sound: 'off',
            },
        }).notify_props;
        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true);
        expect(channelNotifyProps2.desktop_sound).toEqual('default');

        const userNotifyProps3 = {
            desktop_sound: '' as any,
        } as UserNotifyProps;
        const savedChannelNotifyProps3 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_sound: 'on',
            },
        }).notify_props;
        const channelNotifyProps3 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps3, savedChannelNotifyProps3, true);
        expect(channelNotifyProps3.desktop_sound).toEqual('default');

        const userNotifyProps4 = {
            desktop_sound: '' as any,
        } as UserNotifyProps;
        const savedChannelNotifyProps4 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_sound: 'off',
            },
        }).notify_props;
        const channelNotifyProps4 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps4, savedChannelNotifyProps4, true);
        expect(channelNotifyProps4.desktop_sound).toEqual('off');

        const userNotifyProps5 = {} as UserNotifyProps;
        const savedChannelNotifyProps5 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_sound: 'off',
            },
        }).notify_props;
        const channelNotifyProps5 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps5, savedChannelNotifyProps5, true);
        expect(channelNotifyProps5.desktop_sound).toEqual('off');
    });

    test('should return correct desktop_notification_sound when user\'s desktop_notification_sound is defined', () => {
        const userNotifyProps = TestHelper.getUserMock({
            notify_props: {
                desktop_notification_sound: 'Bing',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_notification_sound: 'Bing',
            },
        }).notify_props;
        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(userNotifyProps, savedChannelNotifyProps, true);
        expect(channelNotifyProps.desktop_notification_sound).toEqual('default');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {
                desktop_notification_sound: 'Crackle',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_notification_sound: 'Bing',
            },
        }).notify_props;
        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true);
        expect(channelNotifyProps2.desktop_notification_sound).toEqual('Bing');
    });

    test('should return correct desktop_notification_sound when user\'s desktop_notification_sound is not defined', () => {
        const userNotifyProps = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_notification_sound: 'Bing',
            },
        }).notify_props;
        const channelNotifyProps = createChannelNotifyPropsFromSelectedSettings(userNotifyProps, savedChannelNotifyProps, true);
        expect(channelNotifyProps.desktop_notification_sound).toEqual('default');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_notification_sound: 'default',
            },
        }).notify_props;
        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true);
        expect(channelNotifyProps2.desktop_notification_sound).toEqual('default');

        const userNotifyProps3 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps3 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_notification_sound: 'Crackle',
            },
        }).notify_props;
        const channelNotifyProps3 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps3, savedChannelNotifyProps3, true);
        expect(channelNotifyProps3.desktop_notification_sound).toEqual('Crackle');
    });

    test('should return correct push value', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                push: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                push: 'all',
            },
        }).notify_props;
        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true);
        expect(channelNotifyProps1.push).toEqual('all');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {
                push: 'all',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                push: 'all',
            },
        }).notify_props;
        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true);
        expect(channelNotifyProps2.push).toEqual('default');
    });

    test('should return correct push value when desktop and mobile settings are the same', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop: 'all',
                push: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: 'all',
                push: 'all',
            },
        }).notify_props;
        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, false);
        expect(channelNotifyProps1.push).toEqual('all');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {
                desktop: 'all',
                push: 'all',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: 'mention',
                push: 'all',
            },
        }).notify_props;
        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, false);
        expect(channelNotifyProps2.push).toEqual('mention');
    });

    test('should return correct push_threads value', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                push: 'mention',
                push_threads: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                push: 'all',
                push_threads: 'all',
            },
        }).notify_props;
        const channelNotifyProps1 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps1, savedChannelNotifyProps1, true);
        expect(channelNotifyProps1.push).toEqual('all');
        expect(channelNotifyProps1.push_threads).toEqual('all');

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {
                push: 'mention',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                push: 'all',
                push_threads: 'all',
            },
        }).notify_props;
        const channelNotifyProps2 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps2, savedChannelNotifyProps2, true);
        expect(channelNotifyProps2.push).toEqual('all');
        expect(channelNotifyProps2.push_threads).toEqual('all');

        const userNotifyProps3 = TestHelper.getUserMock({
            notify_props: {
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps3 = TestHelper.getChannelMembershipMock({
            notify_props: {
                push: 'all',
                push_threads: 'all',
            },
        }).notify_props;
        const channelNotifyProps3 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps3, savedChannelNotifyProps3, true);
        expect(channelNotifyProps3.push).toEqual('all');
        expect(channelNotifyProps3.push_threads).toEqual('all');

        const userNotifyProps4 = TestHelper.getUserMock({
            notify_props: {
                desktop_threads: 'all',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps4 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: 'mention',
                push_threads: 'none',
            },
        }).notify_props;
        const channelNotifyProps4 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps4, savedChannelNotifyProps4, false);
        expect(channelNotifyProps4.push_threads).toEqual('mention');

        const userNotifyProps5 = TestHelper.getUserMock({
            notify_props: {
                desktop_threads: 'none',
            } as UserNotifyProps,
        }).notify_props;
        const savedChannelNotifyProps5 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: 'all',
                push_threads: 'none',
            },
        }).notify_props;
        const channelNotifyProps5 = createChannelNotifyPropsFromSelectedSettings(userNotifyProps5, savedChannelNotifyProps5, false);
        expect(channelNotifyProps5.push_threads).toEqual('all');
    });
});

describe('getInitialValuesOfChannelNotifyProps', () => {
    test('should return correct value for desktop', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop: 'all',
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: 'default',
            },
        }).notify_props;
        const desktop = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, channelMemberNotifyProps1.desktop, userNotifyProps1.desktop);
        expect(desktop).toEqual(NotificationLevels.ALL);

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {
                desktop: NotificationLevels.ALL,
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: NotificationLevels.MENTION,
            },
        }).notify_props;
        const desktop2 = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, channelMemberNotifyProps2.desktop, userNotifyProps2.desktop);
        expect(desktop2).toEqual(NotificationLevels.MENTION);

        const userNotifyProps3 = TestHelper.getUserMock({
            notify_props: {
                desktop: NotificationLevels.ALL,
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps3 = TestHelper.getChannelMembershipMock({
            notify_props: {},
        }).notify_props;
        const desktop3 = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, channelMemberNotifyProps3.desktop, userNotifyProps3.desktop);
        expect(desktop3).toEqual(NotificationLevels.ALL);

        const userNotifyProps4 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps4 = TestHelper.getChannelMembershipMock({
            notify_props: {},
        }).notify_props;
        const desktop4 = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, channelMemberNotifyProps4.desktop, userNotifyProps4.desktop);
        expect(desktop4).toEqual(NotificationLevels.ALL);
    });

    test('should return correct value for desktop_threads', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop_threads: NotificationLevels.ALL,
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: NotificationLevels.DEFAULT,
            },
        }).notify_props;
        const desktopThreads = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, channelMemberNotifyProps1.desktop_threads, userNotifyProps1.desktop_threads);
        expect(desktopThreads).toEqual(NotificationLevels.ALL);

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_threads: NotificationLevels.MENTION,
            },
        }).notify_props;
        const desktopThreads2 = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, channelMemberNotifyProps2.desktop_threads, userNotifyProps2.desktop_threads);
        expect(desktopThreads2).toEqual(NotificationLevels.MENTION);

        const userNotifyProps3 = TestHelper.getUserMock({
            notify_props: {
                desktop_threads: NotificationLevels.ALL,
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps3 = TestHelper.getChannelMembershipMock({
            notify_props: {},
        }).notify_props;
        const desktopThreads3 = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, channelMemberNotifyProps3.desktop_threads, userNotifyProps3.desktop_threads);
        expect(desktopThreads3).toEqual(NotificationLevels.ALL);

        const userNotifyProps4 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps4 = TestHelper.getChannelMembershipMock({
            notify_props: {},
        }).notify_props;
        const desktopThreads4 = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, channelMemberNotifyProps4.desktop_threads, userNotifyProps4.desktop_threads);
        expect(desktopThreads4).toEqual(NotificationLevels.ALL);
    });

    test('should return correct value for desktop_sound', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop_sound: 'false',
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_sound: DesktopSound.DEFAULT,
            },
        }).notify_props;
        const desktopSound = getInitialValuesOfChannelNotifyProps(DesktopSound.ON, channelMemberNotifyProps1?.desktop_sound, convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyProps1?.desktop_sound));
        expect(desktopSound).toEqual(DesktopSound.OFF);

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {
                desktop_sound: 'false',
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_sound: DesktopSound.OFF,
            },
        }).notify_props;
        const desktopSound2 = getInitialValuesOfChannelNotifyProps(DesktopSound.ON, channelMemberNotifyProps2?.desktop_sound, convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyProps2?.desktop_sound));
        expect(desktopSound2).toEqual(DesktopSound.OFF);

        const userNotifyProps3 = TestHelper.getUserMock({
            notify_props: {
                desktop_sound: 'false',
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps3 = TestHelper.getChannelMembershipMock({
            notify_props: {},
        }).notify_props;
        const desktopSound3 = getInitialValuesOfChannelNotifyProps(DesktopSound.ON, channelMemberNotifyProps3?.desktop_sound, convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyProps3?.desktop_sound));
        expect(desktopSound3).toEqual(DesktopSound.OFF);

        const userNotifyProps4 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps4 = TestHelper.getChannelMembershipMock({
            notify_props: {},
        }).notify_props;
        const desktopSound4 = getInitialValuesOfChannelNotifyProps(DesktopSound.ON, channelMemberNotifyProps4?.desktop_sound, convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyProps4?.desktop_sound));
        expect(desktopSound4).toEqual(DesktopSound.ON);
    });

    test('should return correct value for desktop_notification_sound', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                desktop_notification_sound: DesktopNotificationSounds.BING,
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_notification_sound: DesktopNotificationSounds.DEFAULT,
            },
        }).notify_props;
        const desktopNotificationSound = getInitialValuesOfChannelNotifyProps(DesktopNotificationSounds.BING, channelMemberNotifyProps1?.desktop_notification_sound, userNotifyProps1?.desktop_notification_sound);
        expect(desktopNotificationSound).toEqual(DesktopNotificationSounds.BING);

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {
                desktop_notification_sound: DesktopNotificationSounds.CRACKLE,
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop_notification_sound: DesktopNotificationSounds.BING,
            },
        }).notify_props;
        const desktopNotificationSound2 = getInitialValuesOfChannelNotifyProps(DesktopNotificationSounds.BING, channelMemberNotifyProps2?.desktop_notification_sound, userNotifyProps2?.desktop_notification_sound);
        expect(desktopNotificationSound2).toEqual(DesktopNotificationSounds.BING);

        const userNotifyProps3 = TestHelper.getUserMock({
            notify_props: {
                desktop_notification_sound: DesktopNotificationSounds.CRACKLE,
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps3 = TestHelper.getChannelMembershipMock({
            notify_props: {},
        }).notify_props;
        const desktopNotificationSound3 = getInitialValuesOfChannelNotifyProps(DesktopNotificationSounds.BING, channelMemberNotifyProps3?.desktop_notification_sound, userNotifyProps3?.desktop_notification_sound);
        expect(desktopNotificationSound3).toEqual(DesktopNotificationSounds.CRACKLE);

        const userNotifyProps4 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps4 = TestHelper.getChannelMembershipMock({
            notify_props: {},
        }).notify_props;
        const desktopNotificationSound4 = getInitialValuesOfChannelNotifyProps(DesktopNotificationSounds.BING, channelMemberNotifyProps4?.desktop_notification_sound, userNotifyProps4?.desktop_notification_sound);
        expect(desktopNotificationSound4).toEqual(DesktopNotificationSounds.BING);
    });

    test('should return correct value for push', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                push: NotificationLevels.ALL,
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                push: NotificationLevels.DEFAULT,
            },
        }).notify_props;
        const push = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, channelMemberNotifyProps1.push, userNotifyProps1.push);
        expect(push).toEqual(NotificationLevels.ALL);

        const userNotifyProps2 = TestHelper.getUserMock({
            notify_props: {} as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps2 = TestHelper.getChannelMembershipMock({
            notify_props: {},
        }).notify_props;
        const push2 = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, channelMemberNotifyProps2.push, userNotifyProps2.push);
        expect(push2).toEqual(NotificationLevels.ALL);
    });

    test('should return correct value for push_threads', () => {
        const userNotifyProps1 = TestHelper.getUserMock({
            notify_props: {
                push_threads: NotificationLevels.ALL,
            } as UserNotifyProps,
        }).notify_props;
        const channelMemberNotifyProps1 = TestHelper.getChannelMembershipMock({
            notify_props: {
                push_threads: NotificationLevels.DEFAULT,
            },
        }).notify_props;
        const pushThreads = getInitialValuesOfChannelNotifyProps(NotificationLevels.ALL, channelMemberNotifyProps1.push_threads, userNotifyProps1.push_threads);
        expect(pushThreads).toEqual(NotificationLevels.ALL);
    });
});

describe('areDesktopAndMobileSettingsDifferent', () => {
    test('should return correct value for collapsed threads', () => {
        expect(areDesktopAndMobileSettingsDifferent(true, NotificationLevels.ALL, NotificationLevels.ALL, NotificationLevels.DEFAULT, NotificationLevels.DEFAULT)).toEqual(true);

        expect(areDesktopAndMobileSettingsDifferent(true, NotificationLevels.ALL, NotificationLevels.ALL, NotificationLevels.ALL, NotificationLevels.ALL)).toEqual(false);

        expect(areDesktopAndMobileSettingsDifferent(true, NotificationLevels.ALL, NotificationLevels.ALL)).toEqual(true);

        expect(areDesktopAndMobileSettingsDifferent(true, NotificationLevels.ALL, NotificationLevels.ALL, NotificationLevels.ALL)).toEqual(true);

        expect(areDesktopAndMobileSettingsDifferent(true, NotificationLevels.MENTION, NotificationLevels.ALL, NotificationLevels.MENTION, NotificationLevels.ALL)).toEqual(false);

        expect(areDesktopAndMobileSettingsDifferent(true, NotificationLevels.DEFAULT, NotificationLevels.DEFAULT)).toEqual(true);
    });
});
