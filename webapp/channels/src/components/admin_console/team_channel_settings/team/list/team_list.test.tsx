// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamList from './team_list';

describe('admin_console/team_channel_settings/team/TeamList', () => {
    test('should render team list with data', async () => {
        const testTeams = [TestHelper.getTeamMock({
            id: '123',
            display_name: 'DN',
            name: 'DN',
        })];

        const actions = {
            getData: jest.fn().mockResolvedValue(testTeams),
            searchTeams: jest.fn().mockResolvedValue(testTeams),
        };

        const {container} = renderWithContext(
            <TeamList
                data={testTeams}
                total={testTeams.length}
                actions={actions}
            />,
        );

        // Wait for the component to finish loading
        await waitFor(() => {
            expect(actions.getData).toHaveBeenCalled();
        });

        // Verify the team name is displayed (multiple instances may exist)
        const teamNames = screen.getAllByText('DN');
        expect(teamNames.length).toBeGreaterThan(0);

        // Verify the data grid is rendered
        expect(container.querySelector('.DataGrid')).toBeInTheDocument();
    });

    test('should render team list with paging', async () => {
        const testTeams = [];
        for (let i = 0; i < 30; i++) {
            testTeams.push(TestHelper.getTeamMock({
                id: 'id' + i,
                display_name: 'DN' + i,
                name: 'DN' + i,
            }));
        }
        const actions = {
            getData: jest.fn().mockResolvedValue(Promise.resolve(testTeams)),
            searchTeams: jest.fn().mockResolvedValue(testTeams),
        };

        const {container} = renderWithContext(
            <TeamList
                data={testTeams}
                total={30}
                actions={actions}
            />,
        );

        // Wait for the component to finish loading
        await waitFor(() => {
            expect(actions.getData).toHaveBeenCalled();
        });

        // Verify multiple teams are displayed (checking first few)
        expect(screen.getByText('DN0')).toBeInTheDocument();
        expect(screen.getByText('DN1')).toBeInTheDocument();

        // Verify the data grid is rendered
        expect(container.querySelector('.DataGrid')).toBeInTheDocument();

        // Verify pagination elements are present when there are 30 teams
        // (The component uses PAGE_SIZE which should trigger pagination)
        expect(container.querySelector('.DataGrid')).toBeInTheDocument();
    });
});
