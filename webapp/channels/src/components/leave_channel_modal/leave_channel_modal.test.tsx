// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import LeaveChannelModal from 'components/leave_channel_modal/leave_channel_modal';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

describe('components/LeaveChannelModal', () => {
    const channels = {
        'channel-1': {
            id: 'channel-1',
            name: 'test-channel-1',
            display_name: 'Test Channel 1',
            type: ('P' as ChannelType),
            team_id: 'team-1',
            header: '',
            purpose: '',
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            last_post_at: 0,
            last_root_post_at: 0,
        },
        'channel-2': {
            id: 'channel-2',
            name: 'test-channel-2',
            display_name: 'Test Channel 2',
            team_id: 'team-1',
            type: ('P' as ChannelType),
            header: '',
            purpose: '',
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            last_post_at: 0,
            last_root_post_at: 0,
        },
        'town-square': {
            id: 'town-square-id',
            name: 'town-square',
            display_name: 'Town Square',
            type: ('O' as ChannelType),
            team_id: 'team-1',
            header: '',
            purpose: '',
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            last_post_at: 0,
            last_root_post_at: 0,
        },
    };

    test('should match snapshot, init', () => {
        const props = {
            channel: channels['town-square'],
            onExited: jest.fn(),
            actions: {
                leaveChannel: jest.fn(),
            },
        };

        const {baseElement} = renderWithContext(
            <LeaveChannelModal {...props}/>,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should fail to leave channel', async () => {
        const props = {
            channel: channels['channel-1'],
            actions: {
                leaveChannel: jest.fn().mockImplementation(() => {
                    const error = {
                        message: 'error leaving channel',
                    };

                    return Promise.resolve({error});
                }),
            },
            onExited: jest.fn(),
            callback: jest.fn(),
        };
        renderWithContext(
            <LeaveChannelModal
                {...props}
            />,
        );

        // Click the confirm button
        await userEvent.click(screen.getByRole('button', {name: 'Yes, leave channel'}));

        await waitFor(() => {
            expect(props.actions.leaveChannel).toHaveBeenCalledTimes(1);
        });
        expect(props.callback).toHaveBeenCalledTimes(0);
    });

    test('should match snapshot for the policy enforced public channel variant', () => {
        const policyChannel = {
            ...channels['town-square'],
            display_name: 'Ask IT',
            policy_enforced: true,
        };

        const {baseElement} = renderWithContext(
            <LeaveChannelModal
                channel={policyChannel}
                currentUserId={'user-1'}
                isMuted={false}
                onExited={jest.fn()}
                actions={{
                    leaveChannel: jest.fn(),
                    muteChannel: jest.fn(),
                }}
            />,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should render policy variant for a policy enforced public channel and offer Mute instead', async () => {
        const policyChannel = {
            ...channels['town-square'],
            policy_enforced: true,
        };

        const muteChannel = jest.fn().mockResolvedValue({data: true});
        const leaveChannel = jest.fn().mockResolvedValue({data: true});

        renderWithContext(
            <LeaveChannelModal
                channel={policyChannel}
                currentUserId={'user-1'}
                isMuted={false}
                onExited={jest.fn()}
                actions={{
                    leaveChannel,
                    muteChannel,
                }}
            />,
        );

        expect(screen.getByText("You're part of this channel's membership policy. If you leave, you will not be automatically re-added.")).toBeInTheDocument();
        expect(screen.getByText('To stay a member without notifications, you can mute this channel instead.')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Mute instead'}));

        await waitFor(() => {
            expect(muteChannel).toHaveBeenCalledTimes(1);
        });
        expect(muteChannel).toHaveBeenCalledWith('user-1', policyChannel.id);
        expect(leaveChannel).not.toHaveBeenCalled();
    });

    test('should keep modal open when Mute instead fails', async () => {
        const policyChannel = {
            ...channels['town-square'],
            policy_enforced: true,
        };

        const muteChannel = jest.fn().mockResolvedValue({error: {message: 'mute failed'}});
        const leaveChannel = jest.fn().mockResolvedValue({data: true});
        const onExited = jest.fn();

        renderWithContext(
            <LeaveChannelModal
                channel={policyChannel}
                currentUserId={'user-1'}
                isMuted={false}
                onExited={onExited}
                actions={{
                    leaveChannel,
                    muteChannel,
                }}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Mute instead'}));

        await waitFor(() => {
            expect(muteChannel).toHaveBeenCalledTimes(1);
        });

        // Modal stays open on failure so the user can retry or choose to leave instead.
        expect(screen.getByRole('button', {name: 'Mute instead'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Leave channel'})).toBeInTheDocument();
        expect(onExited).not.toHaveBeenCalled();
    });

    test('should hide mute hint when channel is already muted', async () => {
        const policyChannel = {
            ...channels['town-square'],
            policy_enforced: true,
        };

        const muteChannel = jest.fn();
        const leaveChannel = jest.fn().mockResolvedValue({data: true});

        renderWithContext(
            <LeaveChannelModal
                channel={policyChannel}
                currentUserId={'user-1'}
                isMuted={true}
                onExited={jest.fn()}
                actions={{
                    leaveChannel,
                    muteChannel,
                }}
            />,
        );

        expect(screen.queryByText('To stay a member without notifications, you can mute this channel instead.')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Mute instead'})).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Leave channel'}));

        await waitFor(() => {
            expect(leaveChannel).toHaveBeenCalledTimes(1);
        });
        expect(muteChannel).not.toHaveBeenCalled();
    });
});
