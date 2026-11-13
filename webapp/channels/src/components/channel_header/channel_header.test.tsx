// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {boardChannelsState} from 'utils/channel_kind_test_utils';
import {RHSStates} from 'utils/constants';
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
        canSearchFiles: true,
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

        isChannelAutotranslated: false,
        hasPendingJoinRequests: false,
        channelKind: 'channel' as const,
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

    test('should unmute the channel when mute icon is clicked', () => {
        const props = {
            ...populatedProps,
            isChannelMuted: true,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );

        const muteButton = container.querySelector('.channel-header__mute');
        expect(muteButton).not.toBeNull();
        (muteButton as HTMLElement).click();
        expect(props.actions.updateChannelNotifyProps).toHaveBeenCalledTimes(1);
        expect(props.actions.updateChannelNotifyProps).toHaveBeenCalledWith('user_id', 'channel_id', {mark_unread: 'all'});
    });

    test('should render active pinned posts', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.PIN,
            pinnedPostsCount: 2,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container.querySelector('#channelHeaderPinButton')).toHaveAttribute('data-active', 'true');
        expect(container.querySelector('#channelHeaderFilesButton')).not.toHaveAttribute('data-active');
        expect(container.querySelector('#member_rhs')).not.toHaveAttribute('data-active');
    });

    test('should render active channel files', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.CHANNEL_FILES,
            showChannelFilesButton: true,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container.querySelector('#channelHeaderFilesButton')).toHaveAttribute('data-active', 'true');
        expect(container.querySelector('#member_rhs')).not.toHaveAttribute('data-active');
    });

    test('should render not active channel files', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.PIN,
            showChannelFilesButton: true,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container.querySelector('#channelHeaderFilesButton')).not.toHaveAttribute('data-active');
    });

    test('should render active channel members', () => {
        const props = {
            ...populatedProps,
            rhsState: RHSStates.CHANNEL_MEMBERS,
        };

        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(container.querySelector('#member_rhs')).toHaveAttribute('data-active', 'true');
        expect(container.querySelector('#channelHeaderFilesButton')).not.toHaveAttribute('data-active');
    });

    test('should not render the channel files button when file search is disabled', () => {
        const props = {
            ...populatedProps,
            canSearchFiles: false,
        };

        renderWithContext(
            <ChannelHeader {...props}/>,
        );
        expect(document.getElementById('channelHeaderFilesButton')).not.toBeInTheDocument();
    });

    test('should contain the channel info button', () => {
        const {container} = renderWithContext(
            <ChannelHeader {...populatedProps}/>,
        );

        // ChannelInfoButton renders a button with channel-info class
        const channelInfoButton = container.querySelector('.channel-header__info');
        expect(channelInfoButton).not.toBeNull();
    });

    test('should call a board a board', () => {
        const props = {
            ...populatedProps,
            hasGuests: true,
            channelKind: 'board' as const,
        };

        const boardState = boardChannelsState('channel_id');
        const {container} = renderWithContext(
            <ChannelHeader {...props}/>,
            {plugins: {components: {CallButton: [], ...boardState.plugins?.components}}},
        );

        expect(screen.getByText('Board has guests')).toBeInTheDocument();
        expect(screen.queryByText('Channel has guests')).not.toBeInTheDocument();
        expect(container.querySelector('[aria-label="board header region"]')).not.toBeNull();
        expect(container.querySelector('[aria-label="channel header region"]')).toBeNull();
    });
});
