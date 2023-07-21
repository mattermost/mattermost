// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelMembership, ChannelNotifyProps} from '@mattermost/types/channels';
import {UserNotifyProps} from '@mattermost/types/users';
import {shallow} from 'enzyme';
import React, {ComponentProps} from 'react';

import ChannelNotificationsModal from 'components/channel_notifications_modal/channel_notifications_modal';

import {ChannelAutoFollowThreads, DesktopSound, IgnoreChannelMentions, NotificationLevels, NotificationSections} from 'utils/constants';
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
            updateChannelNotifyProps: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <ChannelNotificationsModal {...baseProps}/>,
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

        expect(wrapper.state('desktopNotifyLevel')).toEqual(NotificationLevels.ALL);
        expect(wrapper.state('desktopSound')).toEqual(DesktopSound.ON);
        expect(wrapper.state('desktopNotifySound')).toEqual('Bing');
        expect(wrapper.state('markUnreadNotifyLevel')).toEqual(NotificationLevels.ALL);
        expect(wrapper.state('pushNotifyLevel')).toEqual(NotificationLevels.ALL);
        expect(wrapper.state('ignoreChannelMentions')).toEqual(IgnoreChannelMentions.OFF);
        expect(wrapper.state('channelAutoFollowThreads')).toEqual(ChannelAutoFollowThreads.OFF);
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

        expect(wrapper.state('ignoreChannelMentions')).toEqual(IgnoreChannelMentions.OFF);
    });

    test('should provide correct default when currentUser channel notify props is false', () => {
        const currentUser = TestHelper.getUserMock({
            id: 'current_user_id',
            notify_props: {
                desktop: NotificationLevels.ALL,
                desktop_threads: NotificationLevels.ALL,
                channel: 'false',
            } as UserNotifyProps,
        });
        const props = {...baseProps, currentUser};
        const wrapper = shallow(
            <ChannelNotificationsModal {...props}/>,
        );

        expect(wrapper.state('ignoreChannelMentions')).toEqual(IgnoreChannelMentions.ON);
    });

    test('should provide correct value for ignoreChannelMentions when channelMember channel-wide mentions are off and false on the currentUser', () => {
        const currentUser = TestHelper.getUserMock({
            id: 'current_user_id',
            notify_props: {
                desktop: NotificationLevels.ALL,
                desktop_threads: NotificationLevels.ALL,
                channel: 'false',
            } as UserNotifyProps,
        });
        const channelMember = TestHelper.getChannelMembershipMock({
            notify_props: {
                ignore_channel_mentions: IgnoreChannelMentions.OFF,
            },
        });
        const props = {...baseProps, channelMember, currentUser};
        const wrapper = shallow(
            <ChannelNotificationsModal {...props}/>,
        );

        expect(wrapper.state('ignoreChannelMentions')).toEqual(IgnoreChannelMentions.OFF);
    });

    test('should provide correct value for ignoreChannelMentions when channelMember channel-wide mentions are on but false on currentUser', () => {
        const currentUser = TestHelper.getUserMock({
            id: 'current_user_id',
            notify_props: {
                desktop: NotificationLevels.ALL,
                channel: 'true',
            } as UserNotifyProps,
        });
        const channelMember = TestHelper.getChannelMembershipMock({
            notify_props: {
                ignore_channel_mentions: IgnoreChannelMentions.ON,
            },
        });
        const props = {...baseProps, channelMember, currentUser};
        const wrapper = shallow(
            <ChannelNotificationsModal {...props}/>,
        );

        expect(wrapper.state('ignoreChannelMentions')).toEqual(IgnoreChannelMentions.ON);
    });

    test('should provide correct value for ignoreChannelMentions when channel is muted', () => {
        const currentUser = TestHelper.getUserMock({
            id: 'current_user_id',
            notify_props: {
                desktop: NotificationLevels.ALL,
                channel: 'true',
            } as UserNotifyProps,
        });
        const channelMember = TestHelper.getChannelMembershipMock({
            notify_props: {
                mark_unread: NotificationLevels.MENTION,
                ignore_channel_mentions: IgnoreChannelMentions.DEFAULT,
            },
        });
        const props = {...baseProps, channelMember, currentUser};
        const wrapper = shallow(
            <ChannelNotificationsModal {...props}/>,
        );

        expect(wrapper.state('ignoreChannelMentions')).toEqual(IgnoreChannelMentions.ON);
    });

    test('should call onExited and match state on handleOnHide', () => {
        const wrapper = shallow<ChannelNotificationsModal>(
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
        expect(wrapper.state('pushNotifyLevel')).toEqual(NotificationLevels.ALL);
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

        wrapper.instance().updateSection(NotificationSections.NONE);

        expect(wrapper.state('desktopNotifyLevel')).toEqual(baseProps.channelMember?.notify_props.desktop);
    });

    test('should match state on handleSubmitDesktopNotification', () => {
        const wrapper = shallow<ChannelNotificationsModal>(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        const instance = wrapper.instance();
        instance.handleUpdateChannelNotifyProps = jest.fn();
        instance.updateSection = jest.fn();

        wrapper.setState({desktopNotifyLevel: NotificationLevels.MENTION});
        instance.handleSubmitDesktopNotification();
        expect(instance.handleUpdateChannelNotifyProps).toHaveBeenCalledTimes(1);

        wrapper.setState({desktopNotifyLevel: NotificationLevels.ALL});
        instance.handleSubmitDesktopNotification();
        expect(instance.updateSection).toHaveBeenCalledTimes(1);
        expect(instance.updateSection).toBeCalledWith('');
    });

    test('should match state on handleUpdateDesktopNotifyLevel', () => {
        const wrapper = shallow<ChannelNotificationsModal>(
            <ChannelNotificationsModal {...baseProps}/>,
        );

        wrapper.setState({desktopNotifyLevel: NotificationLevels.ALL});
        wrapper.instance().handleUpdateDesktopNotifyLevel(NotificationLevels.MENTION);
        expect(wrapper.state('desktopNotifyLevel')).toEqual(NotificationLevels.MENTION);
    });

    test('should match state on handleSubmitMarkUnreadLevel', () => {
        const channelMember = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: NotificationLevels.NONE,
                mark_unread: NotificationLevels.ALL,
            },
        });
        const props = {...baseProps, channelMember};
        const wrapper = shallow<ChannelNotificationsModal>(
            <ChannelNotificationsModal {...props}/>,
        );

        const instance = wrapper.instance();
        instance.handleUpdateChannelNotifyProps = jest.fn();
        instance.updateSection = jest.fn();

        wrapper.setState({markUnreadNotifyLevel: NotificationLevels.MENTION});
        instance.handleSubmitMarkUnreadLevel();
        expect(instance.handleUpdateChannelNotifyProps).toHaveBeenCalledTimes(1);

        wrapper.setState({markUnreadNotifyLevel: NotificationLevels.ALL});
        instance.handleSubmitMarkUnreadLevel();
        expect(instance.updateSection).toHaveBeenCalledTimes(1);
        expect(instance.updateSection).toBeCalledWith('');
    });

    test('should match state on handleUpdateMarkUnreadLevel', () => {
        const channelMember = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: NotificationLevels.NONE,
                mark_unread: NotificationLevels.ALL,
            },
        });
        const props = {...baseProps, channelMember};
        const wrapper = shallow<ChannelNotificationsModal>(
            <ChannelNotificationsModal {...props}/>,
        );

        wrapper.setState({markUnreadNotifyLevel: NotificationLevels.ALL});
        wrapper.instance().handleUpdateMarkUnreadLevel(NotificationLevels.MENTION);
        expect(wrapper.state('markUnreadNotifyLevel')).toEqual(NotificationLevels.MENTION);
    });

    test('should match state on handleSubmitPushNotificationLevel', () => {
        const channelMember = {
            notify_props: {
                desktop: NotificationLevels.NONE,
                mark_unread: NotificationLevels.MENTION,
                push: NotificationLevels.ALL,
                push_threads: NotificationLevels.ALL,
            },
        } as unknown as ChannelMembership;
        const props = {...baseProps, channelMember};
        const wrapper = shallow<ChannelNotificationsModal>(
            <ChannelNotificationsModal {...props}/>,
        );

        const instance = wrapper.instance();
        instance.handleUpdateChannelNotifyProps = jest.fn();
        instance.updateSection = jest.fn();

        wrapper.setState({pushNotifyLevel: NotificationLevels.DEFAULT});
        instance.handleSubmitPushNotificationLevel();
        expect(instance.handleUpdateChannelNotifyProps).toHaveBeenCalledTimes(1);

        wrapper.setState({pushNotifyLevel: NotificationLevels.ALL});
        instance.handleSubmitPushNotificationLevel();
        expect(instance.updateSection).toHaveBeenCalledTimes(1);
        expect(instance.updateSection).toBeCalledWith('');
    });

    test('should match state on handleUpdatePushNotificationLevel', () => {
        const channelMember = TestHelper.getChannelMembershipMock({
            notify_props: {
                desktop: NotificationLevels.NONE,
                mark_unread: NotificationLevels.MENTION,
                push: NotificationLevels.ALL,
            },
        });
        const props = {...baseProps, channelMember};
        const wrapper = shallow<ChannelNotificationsModal>(
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
        expect(wrapper.state('channelAutoFollowThreads')).toEqual(ChannelAutoFollowThreads.OFF);

        wrapper.instance().resetStateFromNotifyProps(currentUserNotifyProps, {...channelMemberNotifyProps, desktop: NotificationLevels.ALL});
        expect(wrapper.state('desktopNotifyLevel')).toEqual(NotificationLevels.ALL);

        wrapper.instance().resetStateFromNotifyProps(currentUserNotifyProps, {...channelMemberNotifyProps, mark_unread: NotificationLevels.ALL});
        expect(wrapper.state('markUnreadNotifyLevel')).toEqual(NotificationLevels.ALL);

        wrapper.instance().resetStateFromNotifyProps(currentUserNotifyProps, {...channelMemberNotifyProps, push: NotificationLevels.NONE});
        expect(wrapper.state('pushNotifyLevel')).toEqual(NotificationLevels.NONE);
    });
});
