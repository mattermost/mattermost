// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AnyTeamPermissionGate from './any_team_permission_gate';

describe('components/permissions_gates', () => {
    const state = {
        entities: {
            channels: {
                myMembers: {
                    channel_id: {channel_id: 'channel_id', roles: 'channel_role'},
                },
            },
            teams: {
                teams: {
                    team_id: {id: 'team_id', delete_at: 0},
                    team_id2: {id: 'team_id2', delete_at: 0},
                },
                myMembers: {
                    team_id: {team_id: 'team_id', roles: 'team_role'},
                    team_id2: {team_id: 'team_id2', roles: 'team_role2'},
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
                    team_role2: {permissions: ['other_permission']},
                    channel_role: {permissions: ['test_channel_permission']},
                },
            },
        },
    };
    const CONTENT = 'The content inside the permission gate';

    describe('TeamPermissionGate', () => {
        test('should show content when user have permission', () => {
            renderWithContext(
                <AnyTeamPermissionGate permissions={['test_team_permission']}>
                    <p>{CONTENT}</p>
                </AnyTeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).toBeInTheDocument();
        });
        test('should show content when user have the permission in other team', () => {
            renderWithContext(
                <AnyTeamPermissionGate permissions={['other_permission']}>
                    <p>{CONTENT}</p>
                </AnyTeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).toBeInTheDocument();
        });
        test('should show content when user have at least one of the permissions', () => {
            renderWithContext(
                <AnyTeamPermissionGate permissions={['test_team_permission', 'not_existing_permission']}>
                    <p>{CONTENT}</p>
                </AnyTeamPermissionGate>,
                state,
            );
        });
        test('should NOT show content when user have permission and use invert', () => {
            renderWithContext(
                <AnyTeamPermissionGate
                    permissions={['test_team_permission']}
                    invert={true}
                >
                    <p>{CONTENT}</p>
                </AnyTeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();
        });
        test('should show content when user not have permission and use invert', () => {
            renderWithContext(
                <AnyTeamPermissionGate
                    permissions={['invalid_permission']}
                    invert={true}
                >
                    <p>{CONTENT}</p>
                </AnyTeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).toBeInTheDocument();
        });
        test('should NOT show content when user have the permission in other team and use invert', () => {
            renderWithContext(
                <AnyTeamPermissionGate
                    permissions={['other_permission']}
                    invert={true}
                >
                    <p>{CONTENT}</p>
                </AnyTeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();
        });
        test('should NOT show content when user doesn\'t have permission', () => {
            renderWithContext(
                <AnyTeamPermissionGate
                    permissions={['invalid_permission']}
                >
                    <p>{CONTENT}</p>
                </AnyTeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();
        });
        test('should show content when user have permission system wide', () => {
            renderWithContext(
                <AnyTeamPermissionGate
                    permissions={['test_system_permission']}
                >
                    <p>{CONTENT}</p>
                </AnyTeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).toBeInTheDocument();
        });
    });
});
