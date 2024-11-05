// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import TeamPermissionGate from './team_permission_gate';

describe('components/permissions_gates', () => {
    const state = {
        entities: {
            channels: {
                myMembers: {
                    channel_id: {channel_id: 'channel_id', roles: 'channel_role'},
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
    const CONTENT = 'The content inside the permission gate';

    describe('TeamPermissionGate', () => {
        test('should show content when user have permission', () => {
            renderWithContext(
                <TeamPermissionGate
                    teamId={'team_id'}
                    permissions={['test_team_permission']}
                >
                    <p>{CONTENT}</p>
                </TeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).toBeInTheDocument();
        });
        test('should show content when user have at least on of the permissions', () => {
            renderWithContext(
                <TeamPermissionGate
                    teamId={'team_id'}
                    permissions={['test_team_permission', 'not_existing_permission']}
                >
                    <p>{CONTENT}</p>
                </TeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).toBeInTheDocument();
        });
        test('should NOT show content when user have permission and use invert', () => {
            renderWithContext(
                <TeamPermissionGate
                    teamId={'team_id'}
                    permissions={['test_team_permission']}
                    invert={true}
                >
                    <p>{CONTENT}</p>
                </TeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();
        });
        test('should show content when user not have permission and use invert', () => {
            renderWithContext(
                <TeamPermissionGate
                    teamId={'team_id'}
                    permissions={['invalid_permission']}
                    invert={true}
                >
                    <p>{CONTENT}</p>
                </TeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).toBeInTheDocument();
        });
        test('should NOT show content when user haven\'t permission', () => {
            renderWithContext(
                <TeamPermissionGate
                    teamId={'team_id'}
                    permissions={['invalid_permission']}
                >
                    <p>{CONTENT}</p>
                </TeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();
        });
        test('should NOT show content when the team doesn\'t exists', () => {
            renderWithContext(
                <TeamPermissionGate
                    teamId={'invalid_id'}
                    permissions={['test_team_permission']}
                >
                    <p>{CONTENT}</p>
                </TeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).not.toBeInTheDocument();
        });
        test('should show content when user have permission system wide', () => {
            renderWithContext(
                <TeamPermissionGate
                    teamId={'team_id'}
                    permissions={['test_system_permission']}
                >
                    <p>{CONTENT}</p>
                </TeamPermissionGate>,
                state,
            );

            expect(screen.queryByText(CONTENT)).toBeInTheDocument();
        });
    });
});
