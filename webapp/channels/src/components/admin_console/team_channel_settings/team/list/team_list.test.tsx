// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {PAGE_SIZE} from 'components/admin_console/team_channel_settings/abstract_list';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
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

        renderWithContext(
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

        // Verify the team name is displayed
        const teamDisplayNames = screen.getAllByTestId('team-display-name');
        expect(teamDisplayNames).toHaveLength(1);
        expect(teamDisplayNames[0]).toHaveTextContent('DN');
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

        renderWithContext(
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

        // Verify pagination is working - only first page of teams should be displayed
        const teamDisplayNames = screen.getAllByTestId('team-display-name');
        expect(teamDisplayNames).toHaveLength(PAGE_SIZE); // Should show exactly 10 teams (first page)

        // Verify first few teams from the first page are rendered correctly
        expect(teamDisplayNames[0]).toHaveTextContent('DN0');
        expect(teamDisplayNames[1]).toHaveTextContent('DN1');
        expect(teamDisplayNames[9]).toHaveTextContent('DN9'); // Last item on first page
    });

    test('should handle search functionality', async () => {
        const testTeams = [
            TestHelper.getTeamMock({id: '1', display_name: 'Team Alpha', name: 'alpha'}),
            TestHelper.getTeamMock({id: '2', display_name: 'Team Beta', name: 'beta'}),
        ];

        const searchResults = [
            TestHelper.getTeamMock({id: '1', display_name: 'Team Alpha', name: 'alpha'}),
        ];

        const actions = {
            getData: jest.fn().mockResolvedValue(testTeams),
            searchTeams: jest.fn().mockResolvedValue({data: {teams: searchResults, total_count: 1}}),
        };

        renderWithContext(
            <TeamList
                data={testTeams}
                total={testTeams.length}
                actions={actions}
            />,
        );

        // Wait for initial load
        await waitFor(() => {
            expect(actions.getData).toHaveBeenCalled();
        });

        // Find and use the search input
        const searchInput = screen.getByPlaceholderText(/search/i);
        expect(searchInput).toBeInTheDocument();

        // Type search query
        await userEvent.type(searchInput, 'Alpha');

        // Wait for search to be called
        await waitFor(() => {
            expect(actions.searchTeams).toHaveBeenCalledWith(
                'Alpha',
                expect.objectContaining({page: 0, per_page: PAGE_SIZE}),
            );
        });
    });

    test('should handle pagination next button', async () => {
        const testTeams = [];
        for (let i = 0; i < 30; i++) {
            testTeams.push(TestHelper.getTeamMock({
                id: 'id' + i,
                display_name: 'DN' + i,
                name: 'DN' + i,
            }));
        }

        const actions = {
            getData: jest.fn().mockResolvedValue(testTeams),
            searchTeams: jest.fn().mockResolvedValue(testTeams),
        };

        renderWithContext(
            <TeamList
                data={testTeams}
                total={30}
                actions={actions}
            />,
        );

        // Wait for initial load
        await waitFor(() => {
            expect(actions.getData).toHaveBeenCalled();
        });

        // Find and click next button
        const nextButton = screen.getByRole('button', {name: /next/i});
        expect(nextButton).toBeInTheDocument();

        await userEvent.click(nextButton);

        // getData should be called with page 1
        await waitFor(() => {
            expect(actions.getData).toHaveBeenCalledWith(1, PAGE_SIZE);
        });
    });

    test('should handle pagination previous button', async () => {
        const testTeams = [];
        for (let i = 0; i < 30; i++) {
            testTeams.push(TestHelper.getTeamMock({
                id: 'id' + i,
                display_name: 'DN' + i,
                name: 'DN' + i,
            }));
        }

        const actions = {
            getData: jest.fn().mockResolvedValue(testTeams),
            searchTeams: jest.fn().mockResolvedValue(testTeams),
        };

        const {rerender} = renderWithContext(
            <TeamList
                data={testTeams}
                total={30}
                actions={actions}
            />,
        );

        // Wait for initial load
        await waitFor(() => {
            expect(actions.getData).toHaveBeenCalled();
        });

        // Click next to go to page 2
        const nextButton = screen.getByRole('button', {name: /next/i});
        await userEvent.click(nextButton);

        await waitFor(() => {
            expect(actions.getData).toHaveBeenCalledWith(1, PAGE_SIZE);
        });

        // Rerender with new data (simulating page 2)
        rerender(
            <TeamList
                data={testTeams.slice(PAGE_SIZE, PAGE_SIZE * 2)}
                total={30}
                actions={actions}
            />,
        );

        // Now click previous button
        const previousButton = screen.getByRole('button', {name: /previous/i});
        expect(previousButton).toBeInTheDocument();

        await userEvent.click(previousButton);

        // Component should navigate back to page 1
        // (Note: Previous page logic just updates state, doesn't call getData again)
    });

    test('should display team management information', async () => {
        const testTeams = [
            TestHelper.getTeamMock({
                id: '1',
                display_name: 'Open Team',
                name: 'open',
                allow_open_invite: true,
            }),
            TestHelper.getTeamMock({
                id: '2',
                display_name: 'Invite Only Team',
                name: 'invite',
                allow_open_invite: false,
            }),
        ];

        const actions = {
            getData: jest.fn().mockResolvedValue(testTeams),
            searchTeams: jest.fn().mockResolvedValue(testTeams),
        };

        renderWithContext(
            <TeamList
                data={testTeams}
                total={testTeams.length}
                actions={actions}
            />,
        );

        // Wait for teams to load
        await waitFor(() => {
            expect(actions.getData).toHaveBeenCalled();
        });

        // Verify management type is displayed using testid
        const openManagement = screen.getByTestId('openManagement');
        const inviteManagement = screen.getByTestId('inviteManagement');

        expect(openManagement).toBeInTheDocument();
        expect(openManagement).toHaveTextContent('Anyone Can Join');
        expect(inviteManagement).toBeInTheDocument();
        expect(inviteManagement).toHaveTextContent('Invite Only');
    });

    test('should display edit links for teams', async () => {
        const testTeams = [
            TestHelper.getTeamMock({
                id: '123',
                display_name: 'Test Team',
                name: 'test',
            }),
        ];

        const actions = {
            getData: jest.fn().mockResolvedValue(testTeams),
            searchTeams: jest.fn().mockResolvedValue(testTeams),
        };

        renderWithContext(
            <TeamList
                data={testTeams}
                total={testTeams.length}
                actions={actions}
            />,
        );

        // Wait for teams to load
        await waitFor(() => {
            expect(actions.getData).toHaveBeenCalled();
        });

        // Verify edit link is present
        const editLink = screen.getByRole('link', {name: /edit/i});
        expect(editLink).toBeInTheDocument();
        expect(editLink).toHaveAttribute('href', '/admin_console/user_management/teams/123');
    });
});
