// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {UserCustomStatus} from '@mattermost/types/users';

import {renderWithContext} from 'tests/react_testing_utils';
import Constants, {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelHeader from './channel_header';

describe('components/ChannelHeader', () => {
    const baseProps = {
        actions: {
            showPinnedPosts: jest.fn(),
            showChannelFiles: jest.fn(),
            closeRightHandSide: jest.fn(),
            getCustomEmojisInText: jest.fn(),
            updateChannelNotifyProps: jest.fn(),
            showChannelMembers: jest.fn(),
            fetchChannelRemotes: jest.fn(),
        },
        team: TestHelper.getTeamMock({id: 'team_id'}),
        channel: TestHelper.getChannelMock({}),
        channelMember: TestHelper.getChannelMembershipMock({}),
        currentUser: TestHelper.getUserMock({}),
        isCustomStatusEnabled: false,
        isCustomStatusExpired: false,
        isFileAttachmentsEnabled: true,
        lastActivityTimestamp: 1632146562846,
        isLastActiveEnabled: true,
        memberCount: 2,
        dmUser: undefined,
        gmMembers: undefined,
        rhsState: RHSStates.CHANNEL_INFO,
        isChannelMuted: false,
        hasGuests: false,
        pinnedPostsCount: 0,
        customStatus: undefined,
        timestampUnits: [
            'now',
            'minute',
            'hour',
        ],
        hideGuestTags: false,
        remoteNames: [],
        sharedChannelsPluginsEnabled: false,
        isChannelAutotranslated: false,
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

    test('should render properly when empty', async () => {
        const {container} = await renderWithContext(
            <ChannelHeader {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render properly when populated', async () => {
        const {container} = await renderWithContext(
            <ChannelHeader {...populatedProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render properly when populated with channel props', async () => {
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

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render archived view', async () => {
        const props = {
            ...populatedProps,
            channel: {...populatedProps.channel, delete_at: 1234},
        };

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render shared view', async () => {
        const props = {
            ...populatedProps,
            channel: TestHelper.getChannelMock({
                ...populatedProps.channel,
                shared: true,
                type: Constants.OPEN_CHANNEL as ChannelType,
            }),
        };

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render correct menu when muted', async () => {
        const props = {
            ...populatedProps,
            isChannelMuted: true,
        };

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should unmute the channel when mute icon is clicked', async () => {
        const props = {
            ...populatedProps,
            isChannelMuted: true,
        };

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );

        const muteButton = container.querySelector('.channel-header__mute');
        expect(muteButton).not.toBeNull();
        (muteButton as HTMLElement).click();
        expect(props.actions.updateChannelNotifyProps).toHaveBeenCalledTimes(1);
        expect(props.actions.updateChannelNotifyProps).toHaveBeenCalledWith('user_id', 'channel_id', {mark_unread: 'all'});
    });

    test('should render active pinned posts', async () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.PIN,
        };

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render active channel files', async () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.CHANNEL_FILES,
            showChannelFilesButton: true,
        };

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render not active channel files', async () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.PIN,
            showChannelFilesButton: true,
        };

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render active flagged posts', async () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.FLAG,
        };

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render active mentions posts', async () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.MENTION,
        };

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render the pinned icon with the pinned posts count', async () => {
        const props = {
            ...populatedProps,
            pinnedPostsCount: 2,
        };
        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render properly when custom status is set', async () => {
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

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should render properly when custom status is expired', async () => {
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

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should contain the channel info button', async () => {
        const {container} = await renderWithContext(
            <ChannelHeader {...populatedProps}/>,
        );

        // ChannelInfoButton renders a button with channel-info class
        const channelInfoButton = container.querySelector('.channel-header__info');
        expect(channelInfoButton).not.toBeNull();
    });

    test('should match snapshot with last active display', async () => {
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

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with no last active display because it is disabled', async () => {
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

        const {container} = await renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });
});
