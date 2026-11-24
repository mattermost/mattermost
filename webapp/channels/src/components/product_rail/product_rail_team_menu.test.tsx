// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ProductRailTeamMenu from './product_rail_team_menu';

// Which teams have unread messages and mentions, as [unread team ids, mentions by team, urgent by team].
let mockTeamsUnreadStatuses: [Set<string>, Map<string, number>, Map<string, boolean>] = [new Set(), new Map(), new Map()];
jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/channels'),
    getTeamsUnreadStatuses: () => mockTeamsUnreadStatuses,
}));

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

    test('should open the teams on hover', async () => {
        renderWithContext(<ProductRailTeamMenu/>, getState());

        await userEvent.hover(screen.getByRole('button', {name: 'Switch teams'}));

        expect(await screen.findByRole('menuitem', {name: /Bravo/})).toBeInTheDocument();
    });

    test('should list every team and mark the current one', async () => {
        renderWithContext(<ProductRailTeamMenu/>, getState());

        await userEvent.click(screen.getByRole('button', {name: 'Switch teams'}));

        expect(screen.getByRole('menuitem', {name: /Alpha/})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /Bravo/})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: /Charlie/})).toBeInTheDocument();
    });

    test('should leave bringing the team sidebar back to the rail\'s own button', async () => {
        renderWithContext(<ProductRailTeamMenu/>, getState());

        await userEvent.click(screen.getByRole('button', {name: 'Switch teams'}));

        expect(screen.getByRole('menuitem', {name: /Bravo/})).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', {name: 'Show team sidebar'})).not.toBeInTheDocument();
    });

    describe('team activity', () => {
        afterEach(() => {
            mockTeamsUnreadStatuses = [new Set(), new Map(), new Map()];
        });

        test('should count other teams\' mentions on the button, and mark each team\'s in the menu', async () => {
            mockTeamsUnreadStatuses = [new Set(['teamA', 'teamB', 'teamC']), new Map([['teamA', 7], ['teamB', 3], ['teamC', 2]]), new Map()];
            renderWithContext(<ProductRailTeamMenu/>, getState());

            // The current team's own mentions are left out, and the count is part of the button's name.
            const button = screen.getByRole('button', {name: 'Switch teams, 5 mentions in other teams'});
            expect(button).toHaveTextContent('5');

            await userEvent.click(button);

            expect(screen.getByRole('menuitem', {name: /Bravo/})).toHaveTextContent('3');
            expect(screen.getByRole('menuitem', {name: /Charlie/})).toHaveTextContent('2');
            expect(screen.getByRole('menuitem', {name: /Alpha/})).not.toHaveTextContent('7');
        });

        test('should show a dot for other teams\' unread messages without mentions', () => {
            mockTeamsUnreadStatuses = [new Set(['teamB']), new Map(), new Map()];
            const {container} = renderWithContext(<ProductRailTeamMenu/>, getState());

            expect(screen.getByRole('button', {name: 'Switch teams, unread messages in other teams'})).toBeInTheDocument();
            expect(container.querySelector('.ProductRail__teamStack .ProductRail__dot')).toBeInTheDocument();
            expect(container.querySelector('.ProductRail__teamStack .ProductRail__badge')).not.toBeInTheDocument();
        });
    });
});
