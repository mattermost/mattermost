// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ChannelHeader from 'components/channel_header/channel_header';
import ChannelInfoButton from 'components/channel_header/channel_info_button';
import Markdown from 'components/markdown';
import GuestTag from 'components/widgets/tag/guest_tag';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
import Constants, {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {ChannelType} from '@mattermost/types/channels';
import type {UserCustomStatus} from '@mattermost/types/users';
import type {ComponentProps} from 'react';

describe('components/ChannelHeader', () => {
    const baseProps: ComponentProps<typeof ChannelHeader> = {
        actions: {
            favoriteChannel: jest.fn(),
            unfavoriteChannel: jest.fn(),
            showPinnedPosts: jest.fn(),
            showChannelFiles: jest.fn(),
            closeRightHandSide: jest.fn(),
            openModal: jest.fn(),
            closeModal: jest.fn(),
            getCustomEmojisInText: jest.fn(),
            updateChannelNotifyProps: jest.fn(),
            goToLastViewedChannel: jest.fn(),
            showChannelMembers: jest.fn(),
        },
        announcementBarCount: 1,
        teamId: 'team_id',
        channel: TestHelper.getChannelMock({}),
        channelMember: TestHelper.getChannelMembershipMock({}),
        currentUser: TestHelper.getUserMock({}),
        teammateNameDisplaySetting: '',
        currentRelativeTeamUrl: '',
        isCustomStatusEnabled: false,
        isCustomStatusExpired: false,
        isFileAttachmentsEnabled: true,
        lastActivityTimestamp: 1632146562846,
        isLastActiveEnabled: true,
        timestampUnits: [
            'now',
            'minute',
            'hour',
        ],
        hideGuestTags: false,
    };

    const populatedProps = {
        ...baseProps,
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            team_id: 'team_id',
            name: 'Test',
            delete_at: 0,
        }),
        channelMember: TestHelper.getChannelMembershipMock({
            channel_id: 'channel_id',
            user_id: 'user_id',
        }),
        currentUser: TestHelper.getUserMock({
            id: 'user_id',
            bot_description: 'the bot description',
        }),
    };

    test('should render properly when empty', () => {
        const wrapper = shallowWithIntl(
            <ChannelHeader {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should render properly when populated', () => {
        const wrapper = shallowWithIntl(
            <ChannelHeader {...populatedProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should render properly when populated with channel props', () => {
        const props = {
            ...baseProps,
            channel: TestHelper.getChannelMock({
                id: 'channel_id',
                team_id: 'team_id',
                name: 'Test',
                header: 'See ~test',
                props: {
                    channel_mentions: {
                        test: {
                            display_name: 'Test',
                        },
                    },
                },
            }),
            channelMember: TestHelper.getChannelMembershipMock({
                channel_id: 'channel_id',
                user_id: 'user_id',
            }),
            currentUser: TestHelper.getUserMock({
                id: 'user_id',
            }),
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should render archived view', () => {
        const props = {
            ...populatedProps,
            channel: {...populatedProps.channel, delete_at: 1234},
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should render shared view', () => {
        const props = {
            ...populatedProps,
            channel: TestHelper.getChannelMock({
                ...populatedProps.channel,
                shared: true,
                type: Constants.OPEN_CHANNEL as ChannelType,
            }),
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should render correct menu when muted', () => {
        const props = {
            ...populatedProps,
            isMuted: true,
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should unmute the channel when mute icon is clicked', () => {
        const props = {
            ...populatedProps,
            isMuted: true,
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );

        wrapper.find('.channel-header__mute').simulate('click');
        wrapper.update();
        expect(props.actions.updateChannelNotifyProps).toHaveBeenCalledTimes(1);
        expect(props.actions.updateChannelNotifyProps).toHaveBeenCalledWith('user_id', 'channel_id', {mark_unread: 'all'});
    });

    test('should render active pinned posts', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.PIN,
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should render active channel files', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.CHANNEL_FILES,
            showChannelFilesButton: true,
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should render not active channel files', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.PIN,
            showChannelFilesButton: true,
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should render active flagged posts', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.FLAG,
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should render active mentions posts', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.MENTION,
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should render bot description', () => {
        const props = {
            ...populatedProps,
            channel: TestHelper.getChannelMock({
                header: 'not the bot description',
                type: Constants.DM_CHANNEL as ChannelType,
            }),
            dmUser: TestHelper.getUserMock({
                id: 'user_id',
                is_bot: true,
                bot_description: 'the bot description',
            }),
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper.containsMatchingElement(
            <Markdown
                message={props.currentUser.bot_description}
            />,
        )).toEqual(true);
    });

    test('should render the pinned icon with the pinned posts count', () => {
        const props = {
            ...populatedProps,
            pinnedPostsCount: 2,
        };
        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should render the guest tags on gms', () => {
        const props = {
            ...populatedProps,
            channel: TestHelper.getChannelMock({
                header: 'test',
                display_name: 'regular_user, guest_user',
                type: Constants.GM_CHANNEL as ChannelType,
            }),
            gmMembers: [
                TestHelper.getUserMock({
                    id: 'user_id',
                    username: 'regular_user',
                    roles: 'system_user',
                }),
                TestHelper.getUserMock({
                    id: 'guest_id',
                    username: 'guest_user',
                    roles: 'system_guest',
                }),
            ],
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper.containsMatchingElement(
            <GuestTag/>,
        )).toEqual(true);
    });

    test('should render properly when custom status is set', () => {
        const props = {
            ...populatedProps,
            channel: TestHelper.getChannelMock({
                header: 'not the bot description',
                type: Constants.DM_CHANNEL as ChannelType,
                status: 'offline',
            }),
            dmUser: TestHelper.getUserMock({
                id: 'user_id',
                is_bot: false,
            }),
            isCustomStatusEnabled: true,
            customStatus: {
                emoji: 'calender',
                text: 'In a meeting',
            } as UserCustomStatus,
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should render properly when custom status is expired', () => {
        const props = {
            ...populatedProps,
            channel: TestHelper.getChannelMock({
                header: 'not the bot description',
                type: Constants.DM_CHANNEL as ChannelType,
                status: 'offline',
            }),
            dmUser: TestHelper.getUserMock({
                id: 'user_id',
                is_bot: false,
            }),
            isCustomStatusEnabled: true,
            isCustomStatusExpired: true,
            customStatus: {
                emoji: 'calender',
                text: 'In a meeting',
            } as UserCustomStatus,
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should contain the channel info button', () => {
        const wrapper = shallowWithIntl(
            <ChannelHeader {...populatedProps}/>,
        );
        expect(wrapper.contains(
            <ChannelInfoButton channel={populatedProps.channel}/>,
        )).toEqual(true);
    });

    test('should match snapshot with last active display', () => {
        const props = {
            ...populatedProps,
            channel: TestHelper.getChannelMock({
                header: 'not the bot description',
                type: Constants.DM_CHANNEL as ChannelType,
                status: 'offline',
            }),
            dmUser: TestHelper.getUserMock({
                id: 'user_id',
                is_bot: false,
                props: {
                    show_last_active: 'true',
                },
            }),
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with no last active display because it is disabled', () => {
        const props = {
            ...populatedProps,
            isLastActiveEnabled: false,
            channel: TestHelper.getChannelMock({
                header: 'not the bot description',
                type: Constants.DM_CHANNEL as ChannelType,
                status: 'offline',
            }),
            dmUser: TestHelper.getUserMock({
                id: 'user_id',
                is_bot: false,
                props: {
                    show_last_active: 'false',
                },
            }),
        };

        const wrapper = shallowWithIntl(
            <ChannelHeader {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
