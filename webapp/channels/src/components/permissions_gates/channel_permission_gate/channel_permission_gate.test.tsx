// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {General} from 'mattermost-redux/constants';

import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/permissions_gates', () => {
    const state = {
        entities: {
            channels: {
                channels: {
                    channel_id: TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id'}),
                    direct_channel_id: TestHelper.getChannelMock({id: 'direct_channel_id', type: General.DM_CHANNEL}),
                },
                myMembers: {
                    channel_id: TestHelper.getChannelMembershipMock({channel_id: 'channel_id', roles: 'channel_role'}),
                    direct_channel_id: TestHelper.getChannelMembershipMock({channel_id: 'direct_channel_id', roles: 'channel_role'}),
                },
                roles: {
                    channel_id: new Set(['channel_role']),
                    direct_channel_id: new Set(['channel_role']),
                },
            },
            teams: {
                myMembers: {
                    team_id: {team_id: 'team_id', roles: 'team_role'},
                },
            },
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: {
                        id: 'user_id',
                        roles: 'system_role',
                    },
                },
            },
            roles: {
                roles: {
                    system_role: {permissions: ['test_system_permission']},
                    team_role: {permissions: ['test_team_permission']},
                    channel_role: {permissions: ['test_channel_permission']},
                },
            },
        },
    };

    describe('ChannelPermissionGate', () => {
        test('should render children when user has permission', () => {
            renderWithContext(
                <ChannelPermissionGate
                    channelId={'channel_id'}
                    permissions={['test_channel_permission']}
                >
                    <p>{'Valid permission (shown)'}</p>
                </ChannelPermissionGate>,
                state,
            );

            expect(screen.queryByText('Valid permission (shown)')).toBeInTheDocument();
        });

        test('should render children when user has at least one of the permissions', () => {
            renderWithContext(
                <TeamPermissionGate
                    teamId={'team_id'}
                    permissions={['test_team_permission', 'not_existing_permission']}
                >
                    <p>{'Valid permission (shown)'}</p>
                </TeamPermissionGate>,
                state,
            );

            expect(screen.queryByText('Valid permission (shown)')).toBeInTheDocument();
        });
        test('should not render children when user has permission and invert is true', () => {
            renderWithContext(
                <ChannelPermissionGate
                    channelId={'channel_id'}
                    permissions={['test_channel_permission']}
                    invert={true}
                >
                    <p>{'Valid permission but inverted (not shown)'}</p>
                </ChannelPermissionGate>,
                state,
            );

            expect(screen.queryByText('Valid permission but inverted (not shown)')).not.toBeInTheDocument();
        });
        test('should render children when user does not have permission and invert is true', () => {
            renderWithContext(
                <ChannelPermissionGate
                    channelId={'channel_id'}
                    permissions={['invalid_permission']}
                    invert={true}
                >
                    <p>{'Invalid permission but inverted (shown)'}</p>
                </ChannelPermissionGate>,
                state,
            );

            expect(screen.queryByText('Invalid permission but inverted (shown)')).toBeInTheDocument();
        });
        test('should not render children when user doesn\'t have permission', () => {
            renderWithContext(
                <ChannelPermissionGate
                    channelId={'channel_id'}
                    permissions={['invalid_permission']}
                >
                    <p>{'Invalid permission (not shown)'}</p>
                </ChannelPermissionGate>,
                state,
            );

            expect(screen.queryByText('Invalid permission (not shown)')).not.toBeInTheDocument();
        });
        test('should not render children when the channel doesn\'t exists', () => {
            renderWithContext(
                <ChannelPermissionGate
                    channelId={'invalid_id'}
                    permissions={['test_channel_permission']}
                >
                    <p>{'Valid permission invalid channel (not shown)'}</p>
                </ChannelPermissionGate>,
                state,
            );

            expect(screen.queryByText('Valid permission invalid channel (not shown)')).not.toBeInTheDocument();
        });
        test('should render children when user has permission team-wide', () => {
            renderWithContext(
                <ChannelPermissionGate
                    channelId={'channel_id'}
                    permissions={['test_team_permission']}
                >
                    <p>{'Valid permission (shown)'}</p>
                </ChannelPermissionGate>,
                state,
            );

            expect(screen.queryByText('Valid permission (shown)')).toBeInTheDocument();
        });
        test('should render children when user has permission system-wide', () => {
            renderWithContext(
                <ChannelPermissionGate
                    channelId={'channel_id'}
                    permissions={['test_system_permission']}
                >
                    <p>{'Valid permission (shown)'}</p>
                </ChannelPermissionGate>,
                state,
            );

            expect(screen.queryByText('Valid permission (shown)')).toBeInTheDocument();
        });

        test('should render children when user has permissions in DM/GM', () => {
            renderWithContext(
                <ChannelPermissionGate
                    channelId={'direct_channel_id'}
                    permissions={['test_channel_permission']}
                >
                    <p>{'Valid permission (shown)'}</p>
                </ChannelPermissionGate>,
                state,
            );

            expect(screen.queryByText('Valid permission (shown)')).toBeInTheDocument();
        });

        test('should not render children when user does not have permissions in DM/GM', () => {
            renderWithContext(
                <ChannelPermissionGate
                    channelId={'direct_channel_id'}
                    permissions={['invalid_permission']}
                >
                    <p>{'Invalid permission (not shown)'}</p>
                </ChannelPermissionGate>,
                state,
            );

            expect(screen.queryByText('Invalid permission (not shown)')).not.toBeInTheDocument();
        });
    });
});
