// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import ManageTeamsDropdown from 'components/admin_console/manage_teams_modal/manage_teams_dropdown';

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
        const wrapper = shallow(
            <ManageTeamsDropdown {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
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

        const wrapper = shallow(
            <ManageTeamsDropdown {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
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

        const wrapper = shallow(
            <ManageTeamsDropdown {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
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

        const wrapper = shallow(
            <ManageTeamsDropdown {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
