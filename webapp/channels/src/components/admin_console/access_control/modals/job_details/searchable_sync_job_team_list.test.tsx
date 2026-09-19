// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {createIntl} from 'react-intl';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SearchableSyncJobTeamList from './searchable_sync_job_team_list';
import type {TeamSyncResults} from './searchable_sync_job_team_list';

const intl = createIntl({locale: 'en', defaultLocale: 'en', messages: {}});

const teams = [
    TestHelper.getTeamMock({id: 'team1', display_name: 'Engineering', name: 'engineering'}),
    TestHelper.getTeamMock({id: 'team2', display_name: 'Marketing', name: 'marketing'}),
];

const syncResults: TeamSyncResults = {
    team1: {MembersAdded: ['u1', 'u2'], MembersRemoved: ['u3'], MassRemovalWarning: false},
    team2: {MembersAdded: [], MembersRemoved: ['u4', 'u5', 'u6', 'u7', 'u8', 'u9'], MassRemovalWarning: true},
};

const baseProps = {
    teams,
    teamsPerPage: 10,
    nextPage: jest.fn(),
    isSearch: false,
    search: jest.fn(),
    onViewDetails: jest.fn(),
    noResultsText: <span>{'No results'}</span>,
    syncResults,
    intl,
};

describe('SearchableSyncJobTeamList', () => {
    test('renders team rows with added/removed summary', () => {
        renderWithContext(<SearchableSyncJobTeamList {...baseProps}/>);

        expect(screen.getByTestId('TeamRow-engineering')).toBeInTheDocument();
        expect(screen.getByTestId('TeamRow-marketing')).toBeInTheDocument();
        expect(screen.getByTestId('TeamRow-engineering')).toHaveTextContent('+2 / -1');
        expect(screen.getByTestId('TeamRow-marketing')).toHaveTextContent('+0 / -6');
    });

    test('shows mass-removal warning indicator only on rows with MassRemovalWarning true', () => {
        renderWithContext(<SearchableSyncJobTeamList {...baseProps}/>);

        const marketingRow = screen.getByTestId('TeamRow-marketing');
        expect(marketingRow.querySelector('.mass-removal-warning')).toBeInTheDocument();

        const engineeringRow = screen.getByTestId('TeamRow-engineering');
        expect(engineeringRow.querySelector('.mass-removal-warning')).not.toBeInTheDocument();
    });

    test('calls onViewDetails with correct team id when row clicked', async () => {
        const onViewDetails = jest.fn();
        renderWithContext(
            <SearchableSyncJobTeamList
                {...baseProps}
                onViewDetails={onViewDetails}
            />,
        );

        await userEvent.click(screen.getByTestId('TeamRow-engineering'));

        expect(onViewDetails).toHaveBeenCalledWith('team1', 'Engineering', syncResults.team1);
    });

    test('shows empty state with search icon when no teams match', () => {
        renderWithContext(
            <SearchableSyncJobTeamList
                {...baseProps}
                teams={[]}
            />,
        );

        expect(screen.getByText('No results')).toBeInTheDocument();
    });
});
