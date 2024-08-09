// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent, waitFor} from '@testing-library/react';
import type {ComponentProps} from 'react';
import React from 'react';

import type {ChannelMembership} from '@mattermost/types/channels';
import type {UserNotifyProps} from '@mattermost/types/users';

import ChannelNotificationsModal from 'components/channel_notifications_modal/channel_notifications_modal';

import {renderWithContext} from 'tests/react_testing_utils';
import {IgnoreChannelMentions, NotificationLevels} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

describe('components/channel_notifications_modal/ChannelNotificationsModal', () => {
    const baseProps: ComponentProps<typeof ChannelNotificationsModal> = {
        onExited: jest.fn(),
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            display_name: 'channel_display_name',
        }),
        channelMember: {
            notify_props: {
                desktop: NotificationLevels.ALL,
                desktop_sound: 'on',
                desktop_notification_sound: 'Bing',
                mark_unread: NotificationLevels.ALL,
                push: NotificationLevels.DEFAULT,
                ignore_channel_mentions: IgnoreChannelMentions.DEFAULT,
                desktop_threads: NotificationLevels.ALL,
                push_threads: NotificationLevels.DEFAULT,
            },
        } as unknown as ChannelMembership,
        currentUser: TestHelper.getUserMock({
            id: 'current_user_id',
            notify_props: {
                desktop: NotificationLevels.ALL,
                desktop_sound: 'true',
                desktop_notification_sound: 'Bing',
                desktop_threads: NotificationLevels.ALL,
            } as UserNotifyProps,
        }),
        sendPushNotifications: true,
        actions: {
            updateChannelNotifyProps: jest.fn().mockImplementation(() => Promise.resolve({data: true})),
        },
        collapsedReplyThreads: false,
    };

    it('should not show other settings if channel is mute', async () => {
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
        expect(screen.queryByText('Follow all threads in this channel')).toBeNull();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));

        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: baseProps.channelMember?.notify_props.desktop,
                    ignore_channel_mentions: 'off',
                    mark_unread: 'mention',
                    push: 'all',
                    desktop_sound: 'on',
                    desktop_notification_sound: 'Bing',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should Ignore mentions for @channel, @here and @all', async () => {
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
                    desktop: 'all',
                    ignore_channel_mentions: 'on',
                    mark_unread:
                        baseProps.channelMember?.notify_props.mark_unread,
                    push: 'all',
                    desktop_sound: 'on',
                    desktop_notification_sound: 'Bing',
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
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    push: 'all',
                    desktop_sound: 'on',
                    desktop_notification_sound: 'Bing',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should disable message notification sound if option is unchecked', async () => {
        renderWithContext(<ChannelNotificationsModal {...baseProps}/>);

        // Since the default value is on, we will uncheck the checkbox
        fireEvent.click(screen.getByTestId('desktopNotificationSoundsCheckbox'));
        expect(screen.getByTestId('desktopNotificationSoundsCheckbox')).not.toBeChecked();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() => {
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'all',
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    push: 'all',
                    desktop_sound: 'off',
                    desktop_notification_sound: 'Bing',
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
        fireEvent.click(sameAsDesktop);
        expect(sameAsDesktop.checked).toEqual(true);

        expect(screen.queryByText('All new messages')).toBeNull();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'all',
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    push: 'all',
                    desktop_sound: 'on',
                    desktop_notification_sound: 'Bing',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should check the options in the mobile notifications', async () => {
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        const AlllabelRadio: HTMLInputElement = screen.getByTestId(
            'MobileNotification-all',
        );
        fireEvent.click(AlllabelRadio);
        expect(AlllabelRadio.checked).toEqual(true);

        const MentionslabelRadio: HTMLInputElement = screen.getByTestId(
            'MobileNotification-mention',
        );
        fireEvent.click(MentionslabelRadio);
        expect(MentionslabelRadio.checked).toEqual(true);

        const NothinglabelRadio: HTMLInputElement = screen.getByTestId(
            'MobileNotification-none',
        );
        fireEvent.click(NothinglabelRadio);
        expect(NothinglabelRadio.checked).toEqual(true);

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));
        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: 'all',
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    push: 'none',
                    desktop_sound: 'on',
                    desktop_notification_sound: 'Bing',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    it('should show auto follow, desktop threads and mobile threads settings if collapsed reply threads is enabled', async () => {
        const props = {
            ...baseProps,
            collapsedReplyThreads: true,
        };
        const wrapper = renderWithContext(
            <ChannelNotificationsModal {...props}/>,
        );

        expect(screen.queryByText('Follow all threads in this channel')).toBeVisible();

        fireEvent.click(screen.getByRole('button', {name: /Save/i}));

        await waitFor(() =>
            expect(baseProps.actions.updateChannelNotifyProps).toHaveBeenCalledWith(
                'current_user_id',
                'channel_id',
                {
                    desktop: baseProps.channelMember?.notify_props.desktop,
                    ignore_channel_mentions: 'off',
                    mark_unread: 'all',
                    channel_auto_follow_threads: 'off',
                    push: 'all',
                    push_threads: 'default',
                    desktop_threads: 'all',
                    desktop_sound: 'on',
                    desktop_notification_sound: 'Bing',
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });
});
