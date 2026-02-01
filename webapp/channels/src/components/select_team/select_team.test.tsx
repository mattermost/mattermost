// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {CloudUsage} from '@mattermost/types/cloud';
import type {Team} from '@mattermost/types/teams';

import {emitUserLoggedOutEvent} from 'actions/global_actions';

import SelectTeam, {TEAMS_PER_PAGE} from 'components/select_team/select_team';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

jest.mock('actions/global_actions', () => ({
    emitUserLoggedOutEvent: jest.fn(),
}));

jest.mock('utils/policy_roles_adapter', () => ({
    mappingValueFromRoles: jest.fn(),
}));

describe('components/select_team/SelectTeam', () => {
    const baseProps = {
        currentUserRoles: 'system_admin',
        currentUserId: 'test',
        isMemberOfTeam: true,
        listableTeams: [
            {id: 'team_id_1', delete_at: 0, name: 'team-a', display_name: 'Team A', allow_open_invite: true} as Team,
            {id: 'team_id_2', delete_at: 0, name: 'b-team', display_name: 'B Team', allow_open_invite: true} as Team,
        ],
        siteName: 'Mattermost',
        canCreateTeams: false,
        canManageSystem: true,
        canJoinPublicTeams: true,
        canJoinPrivateTeams: false,
        history: {push: jest.fn()},
        actions: {
            getTeams: jest.fn().mockResolvedValue({}),
            loadRolesIfNeeded: jest.fn(),
            addUserToTeam: jest.fn().mockResolvedValue({data: true}),
        },
        totalTeamsCount: 15,
        isCloud: false,
        isFreeTrial: false,
        usageDeltas: {
            teams: {
                active: Number.MAX_VALUE,
            },
        } as CloudUsage,
    };

    test('should match snapshot', () => {
        const props = {...baseProps};
        const {container} = renderWithContext(<SelectTeam {...props}/>);
        expect(container).toMatchSnapshot();

        // on componentDidMount
        expect(props.actions.getTeams).toHaveBeenCalledTimes(1);
        expect(props.actions.getTeams).toHaveBeenCalledWith(0, TEAMS_PER_PAGE, true);
        expect(props.actions.loadRolesIfNeeded).toHaveBeenCalledWith(baseProps.currentUserRoles.split(' '));
    });

    test('should match snapshot, on loading', async () => {
        const addUserToTeam = jest.fn().mockImplementation(() => new Promise(() => {})); // Never resolves to keep loading state
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                addUserToTeam,
            },
        };
        const {container} = renderWithContext(<SelectTeam {...props}/>);

        // Click on a team to trigger loading state
        await userEvent.click(screen.getByText('Team A'));

        await waitFor(() => {
            expect(screen.getByText('Loading')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on error', async () => {
        const addUserToTeam = jest.fn().mockResolvedValue({error: {message: 'error message'}});
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                addUserToTeam,
            },
        };
        const {container} = renderWithContext(<SelectTeam {...props}/>);

        // Click on a team to trigger error state
        await userEvent.click(screen.getByText('Team A'));

        await waitFor(() => {
            expect(screen.getByText('error message')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on no joinable team but can create team', () => {
        const props = {...baseProps, listableTeams: []};
        const {container} = renderWithContext(<SelectTeam {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on no joinable team and is not system admin nor can create team', () => {
        const props = {...baseProps, listableTeams: [], currentUserRoles: '', canManageSystem: false, canCreateTeams: false};
        const {container} = renderWithContext(<SelectTeam {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on no joinable team and user is guest', () => {
        const props = {...baseProps, listableTeams: [], currentUserRoles: '', currentUserIsGuest: true, canManageSystem: false, canCreateTeams: false};
        const {container} = renderWithContext(<SelectTeam {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match state and call addUserToTeam on team click', async () => {
        const addUserToTeam = jest.fn().mockResolvedValue({data: true});
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                addUserToTeam,
            },
        };
        renderWithContext(<SelectTeam {...props}/>);

        // Click on the first team
        await userEvent.click(screen.getByText('Team A'));

        await waitFor(() => {
            expect(addUserToTeam).toHaveBeenCalledTimes(1);
        });
        expect(addUserToTeam).toHaveBeenCalledWith('team_id_1', 'test');
    });

    test('should call emitUserLoggedOutEvent on logout', async () => {
        const props = {...baseProps, isMemberOfTeam: false};
        renderWithContext(<SelectTeam {...props}/>);

        // Click the logout link (shown when user is not a member of a team)
        await userEvent.click(screen.getByRole('link', {name: /logout/i}));

        expect(emitUserLoggedOutEvent).toHaveBeenCalledTimes(1);
        expect(emitUserLoggedOutEvent).toHaveBeenCalledWith('/login');
    });

    test('should match clear error on click to back link', async () => {
        const addUserToTeam = jest.fn().mockResolvedValue({error: {message: 'error message'}});
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                addUserToTeam,
            },
        };
        renderWithContext(<SelectTeam {...props}/>);

        // Trigger error by clicking a team
        await userEvent.click(screen.getByText('Team A'));

        await waitFor(() => {
            expect(screen.getByText('error message')).toBeInTheDocument();
        });

        // Click the back link to clear error
        await userEvent.click(screen.getByRole('link', {name: /back/i}));

        await waitFor(() => {
            expect(screen.queryByText('error message')).not.toBeInTheDocument();
        });
    });

    test('should match snapshot, on create team restricted', () => {
        const props = {
            ...baseProps,
            isCloud: true,
            isFreeTrial: false,
            usageDeltas: {
                teams: {
                    active: 0,
                },
            } as CloudUsage,
        };

        const {container} = renderWithContext(<SelectTeam {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should filter out group-constrained teams from joinable teams list', () => {
        const props = {
            ...baseProps,
            listableTeams: [
                {id: 'team_id_1', delete_at: 0, name: 'team-a', display_name: 'Team A', allow_open_invite: true, group_constrained: false} as Team,
                {id: 'team_id_2', delete_at: 0, name: 'team-b', display_name: 'Team B', allow_open_invite: true, group_constrained: true} as Team,
                {id: 'team_id_3', delete_at: 0, name: 'team-c', display_name: 'Team C', allow_open_invite: true, group_constrained: false} as Team,
                {id: 'team_id_4', delete_at: 0, name: 'team-d', display_name: 'Team D', allow_open_invite: true} as Team, // undefined group_constrained
            ],
        };

        renderWithContext(<SelectTeam {...props}/>);

        // Should show teams that are not group-constrained (false, undefined, null)
        expect(screen.getByText('Team A')).toBeInTheDocument(); // group_constrained: false
        expect(screen.getByText('Team C')).toBeInTheDocument(); // group_constrained: false
        expect(screen.getByText('Team D')).toBeInTheDocument(); // group_constrained: undefined
        expect(screen.queryByText('Team B')).not.toBeInTheDocument(); // group_constrained: true
    });
});
