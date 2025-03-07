// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ManageTeamsDropdown from 'components/admin_console/manage_teams_modal/manage_teams_dropdown';

describe('ManageTeamsDropdown', () => {
    const baseProps = {
        team: TestHelper.getTeamMock(),
        user: TestHelper.getUserMock({
            id: 'currentUserId',
            last_picture_update: 1234,
            email: 'currentUser@test.com',
            roles: 'system_user',
            username: 'currentUsername',
        }),
        teamMember: TestHelper.getTeamMembershipMock({
            team_id: 'teamid',
            scheme_user: true,
            scheme_guest: false,
            scheme_admin: false,
        }),
        onError: jest.fn(),
        onMemberChange: jest.fn(),
        updateTeamMemberSchemeRoles: jest.fn(),
        handleRemoveUserFromTeam: jest.fn(),
    };

    test('should show team member text when user is a team member', () => {
        renderWithContext(
            <ManageTeamsDropdown {...baseProps}/>,
        );

        // Check that the correct role is displayed
        expect(screen.getByText('Team Member')).toBeInTheDocument();
    });

    test('should show system admin text when user is a system admin', () => {
        const user = {
            ...baseProps.user,
            roles: 'system_admin',
        };

        const props = {
            ...baseProps,
            user,
        };

        renderWithContext(
            <ManageTeamsDropdown {...props}/>,
        );

        // Check that the correct role is displayed
        expect(screen.getByText('System Admin')).toBeInTheDocument();
    });

    test('should show team admin text when user is a team admin', () => {
        const user = {
            ...baseProps.user,
            roles: 'system_user',
        };

        const teamMember = {
            ...baseProps.teamMember,
            scheme_admin: true,
        };

        const props = {
            ...baseProps,
            user,
            teamMember,
        };

        renderWithContext(
            <ManageTeamsDropdown {...props}/>,
        );

        // Check that the correct role is displayed
        expect(screen.getByText('Team Admin')).toBeInTheDocument();
    });

    test('should show guest text when user is a guest', () => {
        const user = {
            ...baseProps.user,
            roles: 'system_guest',
        };

        const props = {
            ...baseProps,
            user,
            teamMember: baseProps.teamMember,
        };

        renderWithContext(
            <ManageTeamsDropdown {...props}/>,
        );

        // Check that the correct role is displayed
        expect(screen.getByText('Guest')).toBeInTheDocument();
    });
});
