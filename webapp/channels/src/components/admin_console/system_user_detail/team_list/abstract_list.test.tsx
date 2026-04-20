// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import AbstractList from './abstract_list';
import type {TeamWithMembership} from './types';

jest.mock('./team_row', () => {
    return function MockTeamRow(props: {team: TeamWithMembership}) {
        return <div data-testid={`team-row-${props.team.id}`}>{props.team.display_name}</div>;
    };
});

jest.mock('./team_list_dropdown', () => {
    return function MockTeamListDropdown() {
        return <div data-testid='team-list-dropdown'/>;
    };
});

jest.mock('utils/utils', () => ({
    imageURLForTeam: jest.fn(() => ''),
    localizeMessage: jest.fn((id: string, defaultMessage: string) => defaultMessage),
}));

describe('admin_console/system_user_detail/team_list/AbstractList', () => {
    const renderRow = jest.fn((item: TeamWithMembership) => {
        const MockTeamRow = require('./team_row');
        return (
            <MockTeamRow
                key={item.id}
                team={item}
                doRemoveUserFromTeam={jest.fn()}
                doMakeUserTeamAdmin={jest.fn()}
                doMakeUserTeamMember={jest.fn()}
            />
        );
    });

    const teamsWithMemberships: TeamWithMembership[] = [
        {
            id: 'id1',
            display_name: 'Team 1',
            description: 'Team 1 description',
        } as TeamWithMembership,
        {
            id: 'id2',
            display_name: 'Team 2',
            description: 'The 2 description',
        } as TeamWithMembership,
    ];

    const headerLabels = [
        {
            label: {
                id: 'admin.team_settings.team_list.header.name',
                defaultMessage: 'Name',
            },
            style: {
                flexGrow: 1,
                minWidth: '284px',
                marginLeft: '16px',
            },
        },
        {
            label: {
                id: 'admin.systemUserDetail.teamList.header.type',
                defaultMessage: 'Type',
            },
            style: {
                width: '150px',
            },
        },
        {
            label: {
                id: 'admin.systemUserDetail.teamList.header.role',
                defaultMessage: 'Role',
            },
            style: {
                width: '150px',
            },
        },
        {
            style: {
                width: '150px',
            },
        },
    ];

    const defaultProps = {
        userId: '1234',
        data: [] as TeamWithMembership[],
        onPageChangedCallback: jest.fn(),
        total: 0,
        headerLabels,
        renderRow,
        emptyList: {
            id: 'admin.team_settings.team_list.no_teams_found',
            defaultMessage: 'No teams found',
        },
        actions: {
            getTeamsData: jest.fn().mockResolvedValue([]),
            removeGroup: jest.fn(),
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        defaultProps.actions.getTeamsData = jest.fn().mockResolvedValue([]);
    });

    test('should match snapshot if loading', () => {
        // Use a never-resolving promise so loading remains true
        defaultProps.actions.getTeamsData = jest.fn(() => new Promise(() => {}));

        const {container} = renderWithContext(
            <AbstractList {...defaultProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot no data', async () => {
        const {container} = renderWithContext(
            <AbstractList {...defaultProps}/>,
        );

        await waitFor(() => {
            expect(container.querySelector('.AbstractList__loading')).not.toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with teams data populated', async () => {
        const {container} = renderWithContext(
            <AbstractList
                {...defaultProps}
                data={teamsWithMemberships}
                total={2}
            />,
        );

        await waitFor(() => {
            expect(container.querySelector('.AbstractList__loading')).not.toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with enough teams data to require paging', async () => {
        const moreTeams: TeamWithMembership[] = [...teamsWithMemberships];
        for (let i = 3; i <= 30; i++) {
            moreTeams.push({
                id: 'id' + i,
                display_name: 'Team ' + i,
                description: 'Team ' + i + ' description',
            } as TeamWithMembership);
        }

        const {container} = renderWithContext(
            <AbstractList
                {...defaultProps}
                data={moreTeams}
                total={30}
            />,
        );

        await waitFor(() => {
            expect(container.querySelector('.AbstractList__loading')).not.toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when on second page of pagination', async () => {
        const moreTeams: TeamWithMembership[] = [...teamsWithMemberships];
        for (let i = 3; i <= 30; i++) {
            moreTeams.push({
                id: 'id' + i,
                display_name: 'Team ' + i,
                description: 'Team ' + i + ' description',
            } as TeamWithMembership);
        }

        const {container} = renderWithContext(
            <AbstractList
                {...defaultProps}
                data={moreTeams}
                total={30}
            />,
        );

        await waitFor(() => {
            expect(container.querySelector('.AbstractList__loading')).not.toBeInTheDocument();
        });

        // Click next page button to go to page 1
        const nextButton = container.querySelector('button.next');
        expect(nextButton).toBeInTheDocument();
        await userEvent.click(nextButton!);

        // Wait for loading to finish again after page change
        await waitFor(() => {
            expect(container.querySelector('.AbstractList__loading')).not.toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });
});
