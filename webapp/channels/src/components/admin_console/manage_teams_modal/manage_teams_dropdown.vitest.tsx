// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ManageTeamsDropdown from './manage_teams_dropdown';

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
        onError: vi.fn(),
        onMemberChange: vi.fn(),
        updateTeamMemberSchemeRoles: vi.fn(),
        handleRemoveUserFromTeam: vi.fn(),
    };

    test('should match snapshot for team member', () => {
        const {baseElement} = renderWithContext(
            <ManageTeamsDropdown {...baseProps}/>,
        );

        expect(baseElement).toMatchSnapshot();
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

        const {baseElement} = renderWithContext(
            <ManageTeamsDropdown {...props}/>,
        );

        expect(baseElement).toMatchSnapshot();
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

        const {baseElement} = renderWithContext(
            <ManageTeamsDropdown {...props}/>,
        );

        expect(baseElement).toMatchSnapshot();
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

        const {baseElement} = renderWithContext(
            <ManageTeamsDropdown {...props}/>,
        );

        expect(baseElement).toMatchSnapshot();
    });
});
