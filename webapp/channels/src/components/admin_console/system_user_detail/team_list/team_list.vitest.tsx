// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team, TeamMembership} from '@mattermost/types/teams';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamList from './team_list';

describe('admin_console/system_user_detail/team_list/TeamList', () => {
    const defaultProps = {
        userId: '1234',
        locale: 'en',
        emptyListTextId: 'emptyListTextId',
        emptyListTextDefaultMessage: 'No teams found',
        actions: {
            getTeamsData: () => Promise.resolve({data: [] as Team[]}),
            getTeamMembersForUser: () => Promise.resolve({data: []}),
            removeUserFromTeam: vi.fn(),
            updateTeamMemberSchemeRoles: vi.fn(),
        },
        userDetailCallback: vi.fn(),
        refreshTeams: false,
    };

    test('should match snapshot when no teams are found', async () => {
        const props = defaultProps;
        const {container} = renderWithContext(<TeamList {...props}/>);

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.queryByText('No teams found')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with teams populated', async () => {
        const teamsWithMemberships: Team[] = [
            TestHelper.getTeamMock({
                id: 'id1',
                display_name: 'Team 1',
                description: 'Team 1 description',
            }),
            TestHelper.getTeamMock({
                id: 'id2',
                display_name: 'Team 2',
                description: 'The 2 description',
            }),
        ];

        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                getTeamsData: () => Promise.resolve({data: teamsWithMemberships}),
                getTeamMembersForUser: () => Promise.resolve({
                    data: [
                        TestHelper.getTeamMembershipMock({team_id: 'id1', user_id: '1234', roles: 'team_user', scheme_admin: false, scheme_user: true}),
                        TestHelper.getTeamMembershipMock({team_id: 'id2', user_id: '1234', roles: 'team_user', scheme_admin: false, scheme_user: true}),
                    ] as TeamMembership[],
                }),
            },
        };

        const {container} = renderWithContext(
            <TeamList
                {...props}
            />,
        );

        // Wait for loading to finish and teams to be displayed
        await waitFor(() => {
            expect(screen.queryByText('Team 1')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });
});
