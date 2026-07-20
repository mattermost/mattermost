// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamDetails from './team_details';

jest.mock('./team_members/index', () => {
    return () => <div>{'TeamMembers'}</div>;
});

// Lightweight stand-in that mirrors the real TeamProfile's name/description
// editing contract. The real component pulls in cloud usage hooks that are not
// relevant here and is exercised directly in team_profile.test.tsx; this fake
// lets us drive TeamDetails' own save/validation logic through real state.
jest.mock('./team_profile', () => ({
    TeamProfile: (props: {name: string; description: string; nameError?: React.ReactNode; onNameChange: (v: string) => void; onDescriptionChange: (v: string) => void; onToggleArchive?: () => void; isArchived?: boolean}) => (
        <div>
            <input
                aria-label='Team Name'
                value={props.name}
                onChange={(e) => props.onNameChange(e.target.value)}
            />
            <textarea
                aria-label='Team Description'
                value={props.description}
                onChange={(e) => props.onDescriptionChange(e.target.value)}
            />
            {props.nameError ? <div>{props.nameError}</div> : null}
            {props.onToggleArchive ? (
                <button
                    type='button'
                    onClick={props.onToggleArchive}
                >
                    {props.isArchived ? 'Unarchive Team' : 'Archive Team'}
                </button>
            ) : null}
        </div>
    ),
}));

jest.mock('./team_level_access_rules', () => {
    return function MockTeamLevelAccessRules(props: any) {
        return (
            <div data-testid='team-level-access-rules'>
                <input
                    type='checkbox'
                    data-testid='auto-add-members-checkbox'
                    checked={props.initialAutoSync ?? false}
                    onChange={(e) => props.onRulesChange(true, 'user.department == "Engineering"', e.target.checked)}
                />
            </div>
        );
    };
});

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
            updateAccessControlPoliciesActive: jest.fn().mockResolvedValue({data: {}}),
            createAccessControlTeamSyncJob: jest.fn().mockResolvedValue({data: {}}),
            getTeamStats: jest.fn().mockResolvedValue({data: {total_member_count: 5}}),
            saveTeamAccessPolicy: jest.fn().mockResolvedValue({data: {}}),
            getAccessControlFields: jest.fn().mockResolvedValue({data: []}),
            searchUsersForExpression: jest.fn().mockResolvedValue({data: {users: [], total: 0}}),
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

    test('saves the edited team name and description through patchTeam', async () => {
        const patchTeam = jest.fn().mockResolvedValue({data: {}});
        const props = {
            ...baseProps,
            actions: {...baseProps.actions, patchTeam},
        };
        renderWithContext(<TeamDetails {...props}/>);

        const nameInput = screen.getByLabelText('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Renamed Team');

        const descriptionInput = screen.getByLabelText('Team Description');
        await userEvent.clear(descriptionInput);
        await userEvent.type(descriptionInput, 'A new description');

        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(patchTeam).toHaveBeenCalledWith(expect.objectContaining({
                display_name: 'Renamed Team',
                description: 'A new description',
            }));
        });
    });

    test('trims surrounding whitespace from the team name before saving', async () => {
        const patchTeam = jest.fn().mockResolvedValue({data: {}});
        const props = {
            ...baseProps,
            actions: {...baseProps.actions, patchTeam},
        };
        renderWithContext(<TeamDetails {...props}/>);

        const nameInput = screen.getByLabelText('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, '  Padded Name  ');

        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(patchTeam).toHaveBeenCalledWith(expect.objectContaining({display_name: 'Padded Name'}));
        });
    });

    test('blocks the save and shows a validation error when the team name is too short', async () => {
        const patchTeam = jest.fn().mockResolvedValue({data: {}});
        const props = {
            ...baseProps,
            actions: {...baseProps.actions, patchTeam},
        };
        renderWithContext(<TeamDetails {...props}/>);

        const nameInput = screen.getByLabelText('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'a');

        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText(/Team name must be 2 or more characters/)).toBeInTheDocument();
        });
        expect(patchTeam).not.toHaveBeenCalled();
    });

    test('blocks the save when the team name is only whitespace', async () => {
        const patchTeam = jest.fn().mockResolvedValue({data: {}});
        const props = {
            ...baseProps,
            actions: {...baseProps.actions, patchTeam},
        };
        renderWithContext(<TeamDetails {...props}/>);

        const nameInput = screen.getByLabelText('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, '   ');

        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText(/Team name must be 2 or more characters/)).toBeInTheDocument();
        });
        expect(patchTeam).not.toHaveBeenCalled();
    });

    test('clears the name error and saves once a valid name is entered after a failed validation', async () => {
        const patchTeam = jest.fn().mockResolvedValue({data: {}});
        const props = {
            ...baseProps,
            actions: {...baseProps.actions, patchTeam},
        };
        renderWithContext(<TeamDetails {...props}/>);

        const nameInput = screen.getByLabelText('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'a');
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText(/Team name must be 2 or more characters/)).toBeInTheDocument();
        });

        await userEvent.type(nameInput, 'cme Team');
        await waitFor(() => {
            expect(screen.queryByText(/Team name must be 2 or more characters/)).not.toBeInTheDocument();
        });

        await userEvent.click(screen.getByText('Save'));
        await waitFor(() => {
            expect(patchTeam).toHaveBeenCalledWith(expect.objectContaining({display_name: 'acme Team'}));
        });
    });

    test('blocks navigation once the team name is edited', async () => {
        const setNavigationBlocked = jest.fn();
        const props = {
            ...baseProps,
            actions: {...baseProps.actions, setNavigationBlocked},
        };
        renderWithContext(<TeamDetails {...props}/>);

        await userEvent.type(screen.getByLabelText('Team Name'), '!');

        expect(setNavigationBlocked).toHaveBeenCalledWith(true);
    });

    test('resets the edited fields when a different team is loaded', () => {
        const {rerender} = renderWithContext(<TeamDetails {...baseProps}/>);

        expect(screen.getByLabelText('Team Name')).toHaveValue('team');

        const otherTeam = TestHelper.getTeamMock({
            id: '456',
            display_name: 'Another Team',
            description: 'Another description',
            delete_at: 0,
        });
        rerender(
            <TeamDetails
                {...baseProps}
                team={otherTeam}
                teamID={otherTeam.id}
            />,
        );

        expect(screen.getByLabelText('Team Name')).toHaveValue('Another Team');
        expect(screen.getByLabelText('Team Description')).toHaveValue('Another description');
    });

    test('does not reset edited fields when only totalGroups changes', async () => {
        const {rerender} = renderWithContext(<TeamDetails {...baseProps}/>);

        const nameInput = screen.getByLabelText('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Edited Name');

        rerender(
            <TeamDetails
                {...baseProps}
                totalGroups={baseProps.totalGroups + 1}
            />,
        );

        expect(screen.getByLabelText('Team Name')).toHaveValue('Edited Name');
    });

    test('patches profile fields before archiving the team', async () => {
        const patchTeam = jest.fn().mockResolvedValue({data: {}});
        const deleteTeam = jest.fn().mockResolvedValue({data: {}});
        const props = {
            ...baseProps,
            actions: {...baseProps.actions, patchTeam, deleteTeam},
        };
        renderWithContext(<TeamDetails {...props}/>);

        const nameInput = screen.getByLabelText('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'Archived Team');

        await userEvent.click(screen.getByText('Archive Team'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText('Save and Archive Team')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('Archive'));

        await waitFor(() => {
            expect(patchTeam).toHaveBeenCalledWith(expect.objectContaining({
                display_name: 'Archived Team',
            }));
            expect(deleteTeam).toHaveBeenCalledWith('123');
        });
        expect(patchTeam.mock.invocationCallOrder[0]).toBeLessThan(deleteTeam.mock.invocationCallOrder[0]);
    });

    test('blocks the save-and-archive flow and shows a validation error when the team name is invalid', async () => {
        const patchTeam = jest.fn().mockResolvedValue({data: {}});
        const deleteTeam = jest.fn().mockResolvedValue({data: {}});
        const props = {
            ...baseProps,
            actions: {...baseProps.actions, patchTeam, deleteTeam},
        };
        renderWithContext(<TeamDetails {...props}/>);

        const nameInput = screen.getByLabelText('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'a');

        await userEvent.click(screen.getByText('Archive Team'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText(/Team name must be 2 or more characters/)).toBeInTheDocument();
        });

        // The confirm modal must not open and no destructive action should run.
        expect(screen.queryByText('Save and Archive Team')).not.toBeInTheDocument();
        expect(patchTeam).not.toHaveBeenCalled();
        expect(deleteTeam).not.toHaveBeenCalled();
    });

    test('blocks restore when the edited team name is invalid', async () => {
        const unarchiveTeam = jest.fn().mockResolvedValue({data: {}});
        const archivedTeam = {...baseProps.team, delete_at: 16465313};
        const props = {
            ...baseProps,
            team: archivedTeam,
            actions: {...baseProps.actions, unarchiveTeam},
        };
        renderWithContext(<TeamDetails {...props}/>);

        const nameInput = screen.getByLabelText('Team Name');
        await userEvent.clear(nameInput);
        await userEvent.type(nameInput, 'a');

        await userEvent.click(screen.getByText('Unarchive Team'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText(/Team name must be 2 or more characters/)).toBeInTheDocument();
        });
        expect(unarchiveTeam).not.toHaveBeenCalled();
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

    test('renders two ABAC panels when policy is enforced', async () => {
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
            expect(screen.getByText('Membership policies')).toBeInTheDocument();
        });
        expect(screen.getByTestId('team-level-access-rules')).toBeInTheDocument();
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

        await userEvent.click(screen.getByLabelText('Remove policy'));

        await userEvent.click(document.getElementById('confirmModalButton')!);
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

        // Confirm the disconnect dialog. The trash icon shares the "Remove policy"
        // accessible name, so target the ConfirmModal button by id.
        await userEvent.click(document.getElementById('confirmModalButton')!);
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

        await userEvent.click(screen.getByLabelText('Remove policy'));

        // Confirm the disconnect dialog. The trash icon shares the "Remove policy"
        // accessible name, so target the ConfirmModal button by id.
        await userEvent.click(document.getElementById('confirmModalButton')!);
        await userEvent.click(screen.getByTestId('policy-enforce-toggle-button'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(unassignTeamsFromAccessControlPolicy).toHaveBeenCalledWith('parent1', ['123']);
        });
        expect(assignTeamToAccessControlPolicy).not.toHaveBeenCalled();
    });

    test('shows the auto-add checkbox when a policy is enforced and ABAC is supported', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: [], active: false}, enforced: true},
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
            expect(screen.getByTestId('auto-add-members-checkbox')).toBeInTheDocument();
        });
        expect(screen.getByTestId('auto-add-members-checkbox')).not.toBeChecked();
    });

    test('auto-add checkbox reflects the active flag from the server policy', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: [], active: true}, enforced: true},
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
            expect(screen.getByTestId('auto-add-members-checkbox')).toBeChecked();
        });
    });

    test('shows the ABAC save confirmation modal when toggling auto-add and clicking Save', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: [], active: false}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: []},
        });
        const getTeamStats = jest.fn().mockResolvedValue({data: {total_member_count: 8}});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {...baseProps.actions, getTeamAccessControlPolicy, getAccessControlPolicy, getTeamStats},
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByTestId('auto-add-members-checkbox')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByTestId('auto-add-members-checkbox'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText('Apply membership policy')).toBeInTheDocument();
        });
        expect(getTeamStats).toHaveBeenCalledWith('123');
    });

    test('shows empty-team warning in save confirmation when all members would be removed', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: [], active: false}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: []},
        });
        const getTeamStats = jest.fn().mockResolvedValue({data: {total_member_count: 0}});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true, allow_open_invite: false},
            actions: {...baseProps.actions, getTeamAccessControlPolicy, getAccessControlPolicy, getTeamStats},
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByTestId('auto-add-members-checkbox')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByTestId('auto-add-members-checkbox'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText(/Saving may result in an empty private team/)).toBeInTheDocument();
        });
    });

    test('persists auto-add flag and triggers team sync job on confirmation', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: [], active: false}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: []},
        });
        const updateAccessControlPoliciesActive = jest.fn().mockResolvedValue({data: {}});
        const createAccessControlTeamSyncJob = jest.fn().mockResolvedValue({data: {}});
        const saveTeamAccessPolicy = jest.fn().mockResolvedValue({data: {}});
        const getTeamStats = jest.fn().mockResolvedValue({data: {total_member_count: 5}});
        const patchTeam = jest.fn().mockResolvedValue({data: {}});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy,
                getAccessControlPolicy,
                updateAccessControlPoliciesActive,
                createAccessControlTeamSyncJob,
                saveTeamAccessPolicy,
                getTeamStats,
                patchTeam,
            },
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByTestId('auto-add-members-checkbox')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByTestId('auto-add-members-checkbox'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText('Apply membership policy')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText('Apply'));

        await waitFor(() => {
            expect(updateAccessControlPoliciesActive).toHaveBeenCalledWith([{id: '123', active: true}]);
        });
        await waitFor(() => {
            expect(createAccessControlTeamSyncJob).toHaveBeenCalledWith({policy_id: '123'});
        });
    });

    test('toggling auto-add from the Membership policies list persists the team child active on save', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: [], active: false}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: [], active: false},
        });
        const updateAccessControlPoliciesActive = jest.fn().mockResolvedValue({data: {}});
        const saveTeamAccessPolicy = jest.fn().mockResolvedValue({data: {}});
        const patchTeam = jest.fn().mockResolvedValue({data: {}});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy,
                getAccessControlPolicy,
                updateAccessControlPoliciesActive,
                saveTeamAccessPolicy,
                patchTeam,
            },
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Engineering Policy')).toBeInTheDocument();
        });

        // The per-policy Auto-add checkbox in the Membership policies list starts
        // unchecked (child.active = false) and toggles the team child's auto-add.
        const autoAdd = screen.getByLabelText('Auto-add members for Engineering Policy');
        expect(autoAdd).not.toBeChecked();
        await userEvent.click(autoAdd);
        expect(screen.getByLabelText('Auto-add members for Engineering Policy')).toBeChecked();

        await userEvent.click(screen.getByText('Save'));

        // The team child's active is flipped to true; the parent policy is untouched.
        await waitFor(() => {
            expect(updateAccessControlPoliciesActive).toHaveBeenCalledWith([{id: '123', active: true}]);
        });
        expect(saveTeamAccessPolicy).toHaveBeenCalled();
    });
});
