// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ManageTeamsDropdown from 'components/admin_console/manage_teams_modal/manage_teams_dropdown';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

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

    test('should match snapshot for team member', () => {
        const {container} = renderWithContext(
            <ManageTeamsDropdown {...baseProps}/>,
        );

        expect(screen.getByText('Team Member')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for system admin', () => {
        const user = {
            ...baseProps.user,
            roles: 'system_admin',
        };

        const props = {
            ...baseProps,
            user,
        };

        const {container} = renderWithContext(
            <ManageTeamsDropdown {...props}/>,
        );

        expect(screen.getByText('System Admin')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for team admin', () => {
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

        const {container} = renderWithContext(
            <ManageTeamsDropdown {...props}/>,
        );

        expect(screen.getByText('Team Admin')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for guest', () => {
        const user = {
            ...baseProps.user,
            roles: 'system_guest',
        };

        const teamMember = {
            ...baseProps.teamMember,
        };

        const props = {
            ...baseProps,
            user,
            teamMember,
        };

        const {container} = renderWithContext(
            <ManageTeamsDropdown {...props}/>,
        );

        expect(screen.getByText('Guest')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
