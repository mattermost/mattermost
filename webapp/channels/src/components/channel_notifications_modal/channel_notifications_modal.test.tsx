// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps} from 'react';
import {shallow} from 'enzyme';

import {IgnoreChannelMentions, NotificationLevels, NotificationSections} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelNotificationsModal from 'components/channel_notifications_modal/channel_notifications_modal';
import {renderWithIntl} from 'tests/react_testing_utils';

import {UserNotifyProps} from '@mattermost/types/users';
import {ChannelMembership, ChannelNotifyProps} from '@mattermost/types/channels';

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
                desktop_sound: DesktopSound.ON,
                desktop_notification_sound: 'Bing',
                mark_unread: NotificationLevels.ALL,
                push: NotificationLevels.DEFAULT,
                ignore_channel_mentions: IgnoreChannelMentions.DEFAULT,
                channel_auto_follow_threads: ChannelAutoFollowThreads.OFF,
                desktop_threads: NotificationLevels.ALL,
                push_threads: NotificationLevels.DEFAULT,
            },
        } as unknown as ChannelMembership,
        currentUser: TestHelper.getUserMock({
            id: 'current_user_id',
            notify_props: {
                desktop: NotificationLevels.ALL,
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
        const wrapper = renderWithIntl(
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
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for GMs', () => {
        const wrapper = shallow(
            <ChannelNotificationsModal
                {...{
                    ...baseProps,
                    channel: TestHelper.getChannelMock({
                        id: 'channel_id',
                        display_name: 'channel_display_name',
                        type: 'G',
                    }),
                    channelMember: {
                        notify_props: {
                            ...baseProps.channelMember!.notify_props,
                            desktop: NotificationLevels.MENTION,
                            push: NotificationLevels.MENTION,
                        },
                    } as unknown as ChannelMembership,
                    currentUser: TestHelper.getUserMock({
                        id: 'current_user_id',
                        notify_props: {
                            desktop: NotificationLevels.MENTION,
                            desktop_threads: NotificationLevels.ALL,
                        } as UserNotifyProps,
                    }),
                }}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should provide default notify props when missing', () => {
        const wrapper = shallow(
            <ChannelNotificationsModal
                {...baseProps}
                channelMember={{notify_props: {}} as ChannelMembership}
            />,
        );

        expect(wrapper.state('desktopNotifyLevel')).toEqual(NotificationLevels.DEFAULT);
        expect(wrapper.state('markUnreadNotifyLevel')).toEqual(NotificationLevels.ALL);
        expect(wrapper.state('pushNotifyLevel')).toEqual(NotificationLevels.DEFAULT);
        expect(wrapper.state('ignoreChannelMentions')).toEqual(IgnoreChannelMentions.OFF);
    });

    test('should provide correct default when currentUser channel notify props is true', () => {
        const currentUser = TestHelper.getUserMock({
            id: 'current_user_id',
            notify_props: {
                desktop: NotificationLevels.ALL,
                desktop_threads: NotificationLevels.ALL,
                channel: 'true',
            } as UserNotifyProps,
        });
        const props = {...baseProps, currentUser};
        const wrapper = shallow(
            <ChannelNotificationsModal {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should check the options in the desktop notifications', async () => {
        const wrapper = renderWithIntl(
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
                },
            ),
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should save the options exactly same as Desktop for mobile if use same as desktop checkbox is checked', async () => {
        const wrapper = renderWithIntl(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        wrapper.setState({activeSection: NotificationSections.DESKTOP, desktopNotifyLevel: NotificationLevels.NONE});
        wrapper.instance().handleExit();
        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
        expect(wrapper.state('activeSection')).toEqual(NotificationSections.NONE);
        expect(wrapper.state('desktopNotifyLevel')).toEqual(NotificationLevels.ALL);

        wrapper.setState({activeSection: NotificationSections.MARK_UNREAD, markUnreadNotifyLevel: NotificationLevels.MENTION});
        wrapper.instance().handleExit();
        expect(baseProps.onExited).toHaveBeenCalledTimes(2);
        expect(wrapper.state('activeSection')).toEqual(NotificationSections.NONE);
        expect(wrapper.state('markUnreadNotifyLevel')).toEqual(NotificationLevels.ALL);

        wrapper.setState({activeSection: NotificationSections.PUSH, pushNotifyLevel: NotificationLevels.NONE});
        wrapper.instance().handleExit();
        expect(baseProps.onExited).toHaveBeenCalledTimes(3);
        expect(wrapper.state('activeSection')).toEqual(NotificationSections.NONE);
        expect(wrapper.state('pushNotifyLevel')).toEqual(NotificationLevels.DEFAULT);
    });

    test('should match state on updateSection', () => {
        const wrapper = shallow<ChannelNotificationsModal>(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        wrapper.setState({activeSection: NotificationSections.NONE});
        wrapper.instance().updateSection(NotificationSections.DESKTOP);
        expect(wrapper.state('activeSection')).toEqual(NotificationSections.DESKTOP);
    });

    test('should reset state when collapsing a section', () => {
        const wrapper = shallow<ChannelNotificationsModal>(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        wrapper.instance().updateSection(NotificationSections.DESKTOP);
        wrapper.instance().handleUpdateDesktopNotifyLevel(NotificationLevels.NONE);

        expect(wrapper.state('desktopNotifyLevel')).toEqual(NotificationLevels.NONE);

        wrapper.instance().updateSection('');

        expect(wrapper.state('desktopNotifyLevel')).toEqual(baseProps.channelMember?.notify_props.desktop);
    });

    test('should match state on handleSubmitDesktopNotifyLevel', () => {
        const wrapper = shallow<ChannelNotificationsModal>(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        const instance = wrapper.instance();
        instance.handleUpdateChannelNotifyProps = jest.fn();
        instance.updateSection = jest.fn();

        wrapper.setState({desktopNotifyLevel: NotificationLevels.DEFAULT});
        instance.handleSubmitDesktopNotifyLevel();
        expect(instance.handleUpdateChannelNotifyProps).toHaveBeenCalledTimes(1);

        wrapper.setState({desktopNotifyLevel: NotificationLevels.ALL});
        instance.handleSubmitDesktopNotifyLevel();
        expect(instance.updateSection).toHaveBeenCalledTimes(1);
        expect(instance.updateSection).toBeCalledWith('');
    });

    test('should match state on handleUpdateDesktopNotifyLevel', () => {
        const wrapper = shallow<ChannelNotificationsModal>(
            <ChannelNotificationsModal {...baseProps}/>,
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
        const wrapper = renderWithIntl(
            <ChannelNotificationsModal {...props}/>,
        );

        wrapper.setState({pushNotifyLevel: NotificationLevels.ALL});
        wrapper.instance().handleUpdatePushNotificationLevel(NotificationLevels.MENTION);
        expect(wrapper.state('pushNotifyLevel')).toEqual(NotificationLevels.MENTION);
    });

    test('should match state on resetStateFromNotifyProps', () => {
        const channelMemberNotifyProps: Partial<ChannelNotifyProps> = {
            desktop: NotificationLevels.NONE,
            mark_unread: NotificationLevels.MENTION,
            push: NotificationLevels.ALL,
        };
        const currentUserNotifyProps = {
            channel: 'false',
        } as UserNotifyProps;
        const wrapper = shallow<ChannelNotificationsModal>(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        wrapper.instance().resetStateFromNotifyProps(currentUserNotifyProps, channelMemberNotifyProps);
        expect(wrapper.state('desktopNotifyLevel')).toEqual(NotificationLevels.NONE);
        expect(wrapper.state('markUnreadNotifyLevel')).toEqual(NotificationLevels.MENTION);
        expect(wrapper.state('pushNotifyLevel')).toEqual(NotificationLevels.ALL);
        expect(wrapper.state('ignoreChannelMentions')).toEqual(IgnoreChannelMentions.ON);

        wrapper.instance().resetStateFromNotifyProps(currentUserNotifyProps, {...channelMemberNotifyProps, desktop: NotificationLevels.ALL});
        expect(wrapper.state('desktopNotifyLevel')).toEqual(NotificationLevels.ALL);

        wrapper.instance().resetStateFromNotifyProps(currentUserNotifyProps, {...channelMemberNotifyProps, mark_unread: NotificationLevels.ALL});
        expect(wrapper.state('markUnreadNotifyLevel')).toEqual(NotificationLevels.ALL);

        wrapper.instance().resetStateFromNotifyProps(currentUserNotifyProps, {...channelMemberNotifyProps, push: NotificationLevels.NONE});
        expect(wrapper.state('pushNotifyLevel')).toEqual(NotificationLevels.NONE);
    });
});

