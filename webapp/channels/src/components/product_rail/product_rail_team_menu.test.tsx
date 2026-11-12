// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ProductRailTeamMenu from './product_rail_team_menu';

const mockSavePreferences = jest.fn((...args: unknown[]) => ({type: 'MOCK_SAVE_PREFERENCES', args}));
jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: (...args: unknown[]) => mockSavePreferences(...args),
}));

const user = TestHelper.getUserMock({id: 'user1'});
const teamA = TestHelper.getTeamMock({id: 'teamA', name: 'alpha', display_name: 'Alpha'});
const teamB = TestHelper.getTeamMock({id: 'teamB', name: 'bravo', display_name: 'Bravo'});
const teamC = TestHelper.getTeamMock({id: 'teamC', name: 'charlie', display_name: 'Charlie'});

function getState(teams = [teamA, teamB, teamC]): DeepPartial<GlobalState> {
    return {
        entities: {
            teams: {
                currentTeamId: teamA.id,
                teams: Object.fromEntries(teams.map((team) => [team.id, team])),
                myMembers: Object.fromEntries(teams.map((team) => [team.id, TestHelper.getTeamMembershipMock({team_id: team.id, user_id: user.id})])),
            },
            users: {
                currentUserId: user.id,
                profiles: {[user.id]: user},
            },
        },
    };
}

describe('ProductRailTeamMenu', () => {
    test('should show the current team with a card for each of up to two other teams', () => {
        const {container, unmount} = renderWithContext(<ProductRailTeamMenu/>, getState());

        expect(screen.getByRole('button', {name: 'Switch teams'})).toHaveTextContent('Al');
        expect(container.querySelectorAll('.ProductRail__teamStackCard')).toHaveLength(2);

        unmount();
        const {container: twoTeams} = renderWithContext(<ProductRailTeamMenu/>, getState([teamA, teamB]));

        expect(twoTeams.querySelectorAll('.ProductRail__teamStackCard')).toHaveLength(1);
    });

    test('should list every team and mark the current one', async () => {
        renderWithContext(<ProductRailTeamMenu/>, getState());

        await userEvent.click(screen.getByRole('button', {name: 'Switch teams'}));

        expect(screen.getByRole('menuitem', {name: /Alpha/})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /Bravo/})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /Charlie/})).toBeInTheDocument();
    });

    test('should bring the team sidebar back', async () => {
        renderWithContext(<ProductRailTeamMenu/>, getState());

        await userEvent.click(screen.getByRole('button', {name: 'Switch teams'}));
        await userEvent.click(screen.getByRole('menuitem', {name: 'Show team sidebar'}));

        // Menu items run their click handler once the menu has finished closing.
        await waitFor(() => {
            expect(mockSavePreferences).toHaveBeenCalledWith(user.id, [expect.objectContaining({
                category: 'sidebar_settings',
                name: 'hide_team_sidebar',
                value: 'false',
            })]);
        });
    });
});
