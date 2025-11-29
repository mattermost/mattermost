// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';

import AbstractList from './abstract_list';
import TeamRow from './team_row';
import type {TeamWithMembership} from './types';

describe('admin_console/system_user_detail/team_list/AbstractList', () => {
    const renderRow = vi.fn((item) => {
        return (
            <TeamRow
                key={item.id}
                team={item}
                onRowClick={vi.fn()}
                doRemoveUserFromTeam={vi.fn()}
                doMakeUserTeamAdmin={vi.fn()}
                doMakeUserTeamMember={vi.fn()}
            />
        );
    });

    const teamsWithMemberships = [
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
        data: [],
        onPageChangedCallback: vi.fn(),
        total: 0,
        headerLabels,
        renderRow,
        emptyList: {
            id: 'admin.team_settings.team_list.no_teams_found',
            defaultMessage: 'No teams found',
        },
        actions: {
            getTeamsData: vi.fn().mockResolvedValue(Promise.resolve([])),
            removeGroup: vi.fn(),
        },
    };

    test('should match snapshot if loading', async () => {
        const props = defaultProps;
        const {container} = renderWithContext(<AbstractList {...props}/>);
        await waitFor(() => {
            expect(container).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot no data', async () => {
        const props = defaultProps;
        const {container} = renderWithContext(<AbstractList {...props}/>);

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.queryByText('No teams found')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with teams data populated', async () => {
        const props = defaultProps;
        const {container} = renderWithContext(
            <AbstractList
                {...props}
                data={teamsWithMemberships}
                total={2}
            />,
        );

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.queryByText('Team 1')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with enough teams data to require paging', async () => {
        const props = defaultProps;
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
                {...props}
                data={moreTeams}
                total={30}
            />,
        );

        // Wait for loading to finish and check for first team
        await waitFor(() => {
            expect(screen.queryByText('Team 1')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when on second page of pagination', async () => {
        const props = defaultProps;
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
                {...props}
                data={moreTeams}
                total={30}
            />,
        );

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.queryByText('Team 1')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });
});
