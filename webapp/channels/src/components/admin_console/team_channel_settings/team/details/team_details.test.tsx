// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamDetails from './team_details';

jest.mock('./team_members/index', () => {
    return () => <div>{'TeamMembers'}</div>;
});

jest.mock('./team_profile', () => ({
    TeamProfile: () => <div>{'TeamProfile'}</div>,
}));

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: jest.fn()}),
}));

describe('admin_console/team_channel_settings/team/TeamDetails', () => {
    const groups = [TestHelper.getGroupMock({
        id: '123',
        display_name: 'DN',
        member_count: 3,
    })];
    const allGroups = {
        123: groups[0],
    };
    const testTeam = TestHelper.getTeamMock({
        id: '123',
        allow_open_invite: false,
        allowed_domains: '',
        group_constrained: false,
        display_name: 'team',
        delete_at: 0,
    });

    const baseProps = {
        groups,
        totalGroups: groups.length,
        team: testTeam,
        teamID: testTeam.id,
        allGroups,
        actions: {
            getTeam: jest.fn().mockResolvedValue([]),
            linkGroupSyncable: jest.fn(),
            patchTeam: jest.fn(),
            setNavigationBlocked: jest.fn(),
            unlinkGroupSyncable: jest.fn(),
            getGroups: jest.fn().mockResolvedValue([]),
            membersMinusGroupMembers: jest.fn(),
            patchGroupSyncable: jest.fn(),
            addUserToTeam: jest.fn(),
            removeUserFromTeam: jest.fn(),
            updateTeamMemberSchemeRoles: jest.fn(),
            deleteTeam: jest.fn(),
            unarchiveTeam: jest.fn(),
            getTeamAccessControlPolicy: jest.fn().mockResolvedValue({data: {policy: null, enforced: false}}),
            getAccessControlPolicy: jest.fn().mockResolvedValue({data: null}),
            assignTeamToAccessControlPolicy: jest.fn().mockResolvedValue({data: {status: 'OK'}}),
            unassignTeamsFromAccessControlPolicy: jest.fn().mockResolvedValue({data: {status: 'OK'}}),
            searchPolicies: jest.fn().mockResolvedValue({data: {policies: [], total: 0}}),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <TeamDetails
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with isLocalArchived true', () => {
        const props = {
            ...baseProps,
            team: {
                ...baseProps.team,
                delete_at: 16465313,
            },
        };
        const {container} = renderWithContext(
            <TeamDetails
                {...props}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('does not render the ABAC toggle when ABAC is unsupported', () => {
        renderWithContext(<TeamDetails {...baseProps}/>);
        expect(screen.queryByText('Manage membership with attribute based membership policies')).not.toBeInTheDocument();
        expect(baseProps.actions.getTeamAccessControlPolicy).not.toHaveBeenCalled();
    });

    test('renders the ABAC toggle and fetches the policy when ABAC is supported', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({data: {policy: null, enforced: false}});
        const props = {
            ...baseProps,
            abacSupported: true,
            actions: {...baseProps.actions, getTeamAccessControlPolicy},
        };
        renderWithContext(<TeamDetails {...props}/>);

        expect(screen.getByText('Manage membership with attribute based membership policies')).toBeInTheDocument();
        await waitFor(() => {
            expect(getTeamAccessControlPolicy).toHaveBeenCalledWith('123');
        });
    });

    test('shows the group-sync notice and disables the toggle for a group-synced team', () => {
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, group_constrained: true},
        };
        renderWithContext(<TeamDetails {...props}/>);

        expect(screen.getByText(/Group synced teams cannot use a membership policy/)).toBeInTheDocument();
        expect(screen.getByTestId('policy-enforce-toggle-button')).toBeDisabled();
    });

    test('renders the assigned parent policy and section when policy is enforced', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: []}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: []},
        });
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {...baseProps.actions, getTeamAccessControlPolicy, getAccessControlPolicy},
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Engineering Policy')).toBeInTheDocument();
        });
        expect(getAccessControlPolicy).toHaveBeenCalledWith('parent1');
    });

    test('shows the blank state with a manage-policies link when no policy is assigned but enforced', async () => {
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy: jest.fn().mockResolvedValue({data: {policy: null, enforced: true}}),
            },
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByText(/No membership policy assigned/)).toBeInTheDocument();
        });
    });

    test('removing the policy and disabling the toggle unassigns it on save', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: []}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: []},
        });
        const unassignTeamsFromAccessControlPolicy = jest.fn().mockResolvedValue({data: {status: 'OK'}});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy,
                getAccessControlPolicy,
                unassignTeamsFromAccessControlPolicy,
                patchTeam: jest.fn().mockResolvedValue({data: {}}),
            },
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Engineering Policy')).toBeInTheDocument();
        });

        // Remove the parent policy, then disable ABAC (now allowed since the list is empty).
        await userEvent.click(screen.getByLabelText('Remove policy'));
        await userEvent.click(screen.getByTestId('policy-enforce-toggle-button'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(unassignTeamsFromAccessControlPolicy).toHaveBeenCalledWith('parent1', ['123']);
        });
    });

    test('surfaces a policy action error on save instead of silently succeeding', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: []}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: []},
        });

        // The thunk resolves with {error} rather than throwing — the handler must
        // inspect the result, render the error, and not navigate away as success.
        const unassignTeamsFromAccessControlPolicy = jest.fn().mockResolvedValue({error: {message: 'policy update failed'}});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy,
                getAccessControlPolicy,
                unassignTeamsFromAccessControlPolicy,
                patchTeam: jest.fn().mockResolvedValue({data: {}}),
            },
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Engineering Policy')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByLabelText('Remove policy'));
        await userEvent.click(screen.getByTestId('policy-enforce-toggle-button'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText('policy update failed')).toBeInTheDocument();
        });
    });

    test('does not re-assign an already-assigned policy on save', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: []}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: []},
        });
        const assignTeamToAccessControlPolicy = jest.fn().mockResolvedValue({data: {status: 'OK'}});
        const unassignTeamsFromAccessControlPolicy = jest.fn().mockResolvedValue({data: {status: 'OK'}});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy,
                getAccessControlPolicy,
                assignTeamToAccessControlPolicy,
                unassignTeamsFromAccessControlPolicy,
                patchTeam: jest.fn().mockResolvedValue({data: {}}),
            },
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Engineering Policy')).toBeInTheDocument();
        });

        // Removing the only policy disables the toggle, which lets us save without
        // re-touching the already-assigned parent1. The assign action must never
        // fire for a policy that was already on the server when the page loaded.
        await userEvent.click(screen.getByLabelText('Remove policy'));
        await userEvent.click(screen.getByTestId('policy-enforce-toggle-button'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(unassignTeamsFromAccessControlPolicy).toHaveBeenCalledWith('parent1', ['123']);
        });
        expect(assignTeamToAccessControlPolicy).not.toHaveBeenCalled();
    });
});
