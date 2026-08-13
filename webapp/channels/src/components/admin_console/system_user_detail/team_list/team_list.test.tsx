// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import React from 'react';
import {defineMessage} from 'react-intl';

import {renderWithContext} from 'tests/react_testing_utils';

import TeamList from './team_list';

jest.mock('./team_row', () => {
    return (props: {team: {id: string; display_name: string}}) => (
        <div data-testid={`team-row-${props.team.id}`}>{props.team.display_name}</div>
    );
});

jest.mock('components/widgets/team_icon/team_icon', () => {
    return () => <div data-testid='team-icon'/>;
});

jest.mock('./team_list_dropdown', () => {
    return () => <div data-testid='team-list-dropdown'/>;
});

jest.mock('utils/utils', () => ({
    imageURLForTeam: () => '',
}));

describe('admin_console/system_user_detail/team_list/TeamList', () => {
    const defaultProps = {
        userId: '1234',
        locale: 'en',
        emptyList: defineMessage({
            id: 'emptyListTextId',
            defaultMessage: 'No teams found',
        }),
        actions: {
            getTeamsData: jest.fn().mockResolvedValue({data: []}),
            getTeamMembersForUser: jest.fn().mockResolvedValue({data: []}),
            removeUserFromTeam: jest.fn(),
            updateTeamMemberSchemeRoles: jest.fn(),
        },
        userDetailCallback: jest.fn(),
        refreshTeams: false,
    };

    test('should match snapshot when no teams are found', async () => {
        const {container} = renderWithContext(<TeamList {...defaultProps}/>);

        await waitFor(() => {
            expect(container.querySelector('.AbstractList__loading')).not.toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with teams populated', async () => {
        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                getTeamsData: jest.fn().mockResolvedValue({
                    data: [
                        {id: 'id1', display_name: 'Team 1', description: 'Team 1 description'},
                        {id: 'id2', display_name: 'Team 2', description: 'The 2 description'},
                    ],
                }),
                getTeamMembersForUser: jest.fn().mockResolvedValue({
                    data: [
                        {team_id: 'id1'},
                        {team_id: 'id2'},
                    ],
                }),
            },
        };

        const {container} = renderWithContext(<TeamList {...props}/>);

        await waitFor(() => {
            expect(container.querySelector('.AbstractList__loading')).not.toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });
});
