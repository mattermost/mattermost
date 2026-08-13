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
                <button
                    data-testid='clear-rule-button'
                    onClick={() => props.onRulesChange(true, '', false)}
                >{'clear'}</button>

                {/* Reproduces the real editor removing the only rule while its frozen
                    original is empty: it reports hasChanges=false even though the
                    expression changed relative to what was loaded. */}
                <button
                    data-testid='remove-loaded-rule-button'
                    onClick={() => props.onRulesChange(false, '', false)}
                >{'remove'}</button>

                {/* Adds a custom rule WITHOUT enabling auto-add — the real editor's
                    behavior when you add an attribute row and leave the checkbox off. */}
                <button
                    data-testid='add-rule-no-autoadd-button'
                    onClick={() => props.onRulesChange(true, 'user.attributes.Department == "Engineering"', false)}
                >{'add-rule'}</button>

                {/* Enables auto-add WITHOUT changing the expression — checking the box on
                    an already-loaded rule. Isolates the "auto-add newly enabled" trigger. */}
                <button
                    data-testid='enable-autoadd-same-expr-button'
                    onClick={() => props.onRulesChange(true, props.initialExpression ?? '', true)}
                >{'enable-autoadd'}</button>
                {props.syncFooter}
            </div>
        );
    };
});

// Surface the footer's hasAbacPolicy gate without its network/polling internals.
jest.mock('./team_membership_sync_footer', () => {
    return function MockTeamMembershipSyncFooter(props: any) {
        return props.hasAbacPolicy ? <div data-testid='team-membership-sync-footer'/> : null;
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
            getTeamMembers: jest.fn().mockResolvedValue({data: []}),
            saveTeamAccessPolicy: jest.fn().mockResolvedValue({data: {}}),
            deleteAccessControlPolicy: jest.fn().mockResolvedValue({data: {}}),
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

    test('removing the last policy unassigns it and auto-disables enforcement without a manual toggle-off', async () => {
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

        // Removing the last policy drops the enforce toggle on its own.
        await waitFor(() => {
            expect(screen.getByTestId('policy-enforce-toggle-button')).toHaveAttribute('aria-pressed', 'false');
        });

        // Save goes straight through — no spurious "Apply membership policy" modal.
        await userEvent.click(screen.getByText('Save'));

        expect(screen.queryByText('Apply membership policy')).not.toBeInTheDocument();
        await waitFor(() => {
            expect(unassignTeamsFromAccessControlPolicy).toHaveBeenCalledWith('parent1', ['123']);
        });
    });

    test('removing the custom rule then the policy still tears down the child policy (order-independent)', async () => {
        // Regression: emptying ABAC by removing the rule first (forces policyEnforced
        // true) then the policy (sets it false) must still delete the team's child
        // policy — otherwise its custom rule is orphaned and reappears on reload.
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {
                policy: {
                    id: '123',
                    type: 'team',
                    imports: ['parent1'],
                    rules: [{expression: 'user.attributes.Department == "Engineering"', actions: ['membership']}],
                    active: false,
                },
                enforced: true,
            },
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: []},
        });
        const deleteAccessControlPolicy = jest.fn().mockResolvedValue({data: {}});
        const unassignTeamsFromAccessControlPolicy = jest.fn().mockResolvedValue({data: {status: 'OK'}});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy,
                getAccessControlPolicy,
                deleteAccessControlPolicy,
                unassignTeamsFromAccessControlPolicy,
                patchTeam: jest.fn().mockResolvedValue({data: {}}),
            },
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => expect(screen.getByText('Engineering Policy')).toBeInTheDocument());

        // Remove the rule first, then the policy — the order that used to skip teardown.
        await userEvent.click(screen.getByTestId('clear-rule-button'));
        await userEvent.click(screen.getByLabelText('Remove policy'));
        await userEvent.click(document.getElementById('confirmModalButton')!);

        await userEvent.click(screen.getByText('Save'));

        // No apply modal (teardown applies no removal criteria), the child policy is
        // deleted (so the custom rule is gone), and the parent is unassigned.
        expect(screen.queryByText('Apply membership policy')).not.toBeInTheDocument();
        await waitFor(() => expect(deleteAccessControlPolicy).toHaveBeenCalledWith('123'));
        expect(unassignTeamsFromAccessControlPolicy).toHaveBeenCalledWith('parent1', ['123']);
    });

    test('removing a policy while an unedited custom rule remains keeps enforcement on and saves without the apply modal', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {
                policy: {
                    id: '123',
                    type: 'team',
                    imports: ['parent1'],
                    rules: [{actions: ['membership'], expression: 'user.attributes.office == "Home"'}],
                    active: false,
                },
                enforced: true,
            },
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
                saveTeamAccessPolicy: jest.fn().mockResolvedValue({data: {}}),
                patchTeam: jest.fn().mockResolvedValue({data: {}}),
            },
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Engineering Policy')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByLabelText('Remove policy'));
        await userEvent.click(document.getElementById('confirmModalButton')!);

        // Custom rule still governs, so enforcement stays on.
        expect(screen.getByTestId('policy-enforce-toggle-button')).toHaveAttribute('aria-pressed', 'true');

        // Removal is not new criteria: the unedited custom rule must not trigger the apply-count modal.
        await userEvent.click(screen.getByText('Save'));

        expect(screen.queryByText('Apply membership policy')).not.toBeInTheDocument();
        await waitFor(() => {
            expect(unassignTeamsFromAccessControlPolicy).toHaveBeenCalledWith('parent1', ['123']);
        });
    });

    test('clearing the only custom rule with no policy disables ABAC and saves without the apply modal', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {
                policy: {
                    id: '123',
                    type: 'team',
                    imports: [],
                    rules: [{actions: ['membership'], expression: 'user.attributes.office == "Home"'}],
                    active: true,
                },
                enforced: true,
            },
        });
        const deleteAccessControlPolicy = jest.fn().mockResolvedValue({data: {}});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy,
                deleteAccessControlPolicy,
                saveTeamAccessPolicy: jest.fn().mockResolvedValue({data: {}}),
                patchTeam: jest.fn().mockResolvedValue({data: {}}),
            },
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByTestId('team-level-access-rules')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByTestId('clear-rule-button'));
        await userEvent.click(screen.getByText('Save'));

        // Disabling ABAC is not new criteria — no affected-count modal.
        expect(screen.queryByText('Apply membership policy')).not.toBeInTheDocument();

        // The team's own policy is deleted so enforcement clears server-side.
        await waitFor(() => {
            expect(deleteAccessControlPolicy).toHaveBeenCalledWith('123');
        });
    });

    test('surfaces a delete failure instead of clearing enforcement silently', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {
                policy: {
                    id: '123',
                    type: 'team',
                    imports: [],
                    rules: [{actions: ['membership'], expression: 'user.attributes.office == "Home"'}],
                    active: true,
                },
                enforced: true,
            },
        });

        // deleteAccessControlPolicy resolves with {error} (it never throws), so the
        // save must inspect the result and surface the failure.
        const deleteAccessControlPolicy = jest.fn().mockResolvedValue({error: {message: 'server exploded'}});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy,
                deleteAccessControlPolicy,
                saveTeamAccessPolicy: jest.fn().mockResolvedValue({data: {}}),
                patchTeam: jest.fn().mockResolvedValue({data: {}}),
            },
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByTestId('team-level-access-rules')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByTestId('clear-rule-button'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(deleteAccessControlPolicy).toHaveBeenCalledWith('123');
            expect(screen.getByText('server exploded')).toBeInTheDocument();
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
        const searchUsersForExpression = jest.fn().mockResolvedValue({data: {users: []}});
        const getTeamMembers = jest.fn().mockResolvedValue({data: []});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {...baseProps.actions, getTeamAccessControlPolicy, getAccessControlPolicy, searchUsersForExpression, getTeamMembers},
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

        // Staging a team rule routes the count through the unscoped match query, not team stats.
        expect(searchUsersForExpression).toHaveBeenCalledWith(expect.any(String), '', '', 1000);
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

    test('counts qualifying members against the parent policy expression instead of reporting an empty team', async () => {
        // Regression for the confirm modal reporting "no one meets the criteria" while
        // qualifying members exist. The expression endpoint neither resolves imports nor
        // scopes to a team, so the count must match all users then intersect with current
        // members — here 2 of 3 members qualify, so exactly 1 is affected.
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: [], active: false}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {
                id: 'parent1',
                name: 'Engineering Policy',
                type: 'parent',
                rules: [{expression: 'user.attributes.Department == "Engineering"', actions: ['membership']}],
            },
        });
        const searchUsersForExpression = jest.fn().mockResolvedValue({data: {users: [{id: 'u1'}, {id: 'u2'}]}});
        const getTeamMembers = jest.fn().mockResolvedValue({
            data: [{user_id: 'u1'}, {user_id: 'u2'}, {user_id: 'u3'}],
        });
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true, allow_open_invite: false},
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy,
                getAccessControlPolicy,
                searchUsersForExpression,
                getTeamMembers,
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

        // The match query runs unscoped (exactly four args, no team id) so members
        // are counted correctly; the expression combines the team and parent rules.
        expect(searchUsersForExpression).toHaveBeenCalledWith(
            expect.stringContaining('user.attributes.Department == "Engineering"'), '', '', 1000,
        );
        expect(screen.getByText(/1 member does not currently meet the criteria/)).toBeInTheDocument();
        expect(screen.queryByText(/No current members meet the criteria/)).not.toBeInTheDocument();
    });

    test('pages through all team members so counts are correct past the first page', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: [], active: false}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {
                id: 'parent1',
                name: 'Engineering Policy',
                type: 'parent',
                rules: [{expression: 'user.attributes.Department == "Engineering"', actions: ['membership']}],
            },
        });

        // 250 members across two pages; only the first 200 match the rule. Without
        // pagination the second page (50 non-matching members) would be missed.
        const page0 = Array.from({length: 200}, (_, i) => ({user_id: `u${i}`}));
        const page1 = Array.from({length: 50}, (_, i) => ({user_id: `m${i}`}));
        const searchUsersForExpression = jest.fn().mockResolvedValue({
            data: {users: page0.map((member) => ({id: member.user_id}))},
        });
        const getTeamMembers = jest.fn().
            mockResolvedValueOnce({data: page0}).
            mockResolvedValueOnce({data: page1});

        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true, allow_open_invite: false},
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy,
                getAccessControlPolicy,
                searchUsersForExpression,
                getTeamMembers,
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

        // Both pages were fetched, and the 50 second-page members count as affected.
        expect(getTeamMembers).toHaveBeenCalledTimes(2);
        expect(screen.getByText(/50 members do not currently meet the criteria/)).toBeInTheDocument();
    });

    test('previews auto-add additions instead of a false empty-team warning', async () => {
        // A private team whose only current member does not match, but many non-members
        // do. With auto-add on the sync populates the team, so the modal must preview the
        // additions and must NOT warn of an empty team.
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: [], active: false}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {
                id: 'parent1',
                name: 'Engineering Policy',
                type: 'parent',
                rules: [{expression: 'user.attributes.Department == "Engineering"', actions: ['membership']}],
            },
        });

        // Three matching users, none currently on the team; the sole member does not match.
        const searchUsersForExpression = jest.fn().mockResolvedValue({data: {users: [{id: 'e1'}, {id: 'e2'}, {id: 'e3'}]}});
        const getTeamMembers = jest.fn().mockResolvedValue({data: [{user_id: 'sysadmin'}]});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true, allow_open_invite: false},
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy,
                getAccessControlPolicy,
                searchUsersForExpression,
                getTeamMembers,
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

        // Additions previewed, one non-matching member flagged for removal, no empty warning.
        expect(screen.getByText(/3 qualifying users will be added/)).toBeInTheDocument();
        expect(screen.getByText(/1 member does not currently meet the criteria/)).toBeInTheDocument();
        expect(screen.queryByText(/No current members meet the criteria/)).not.toBeInTheDocument();
    });

    test('enables Save when the only custom rule is removed, even if the editor reports hasChanges=false', async () => {
        // The rules editor freezes its "original" at first mount (before the policy
        // loads for an already-enforced team), so removing the only rule returns the
        // expression to the frozen-empty original and the editor reports no change.
        // team_details must still detect the change against its own loaded original.
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {
                policy: {
                    id: '123',
                    type: 'team',
                    imports: [],
                    rules: [{expression: 'user.attributes.Department == "Engineering"', actions: ['membership']}],
                    active: false,
                },
                enforced: true,
            },
        });
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {...baseProps.actions, getTeamAccessControlPolicy},
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByTestId('team-level-access-rules')).toBeInTheDocument();
        });

        // No unsaved changes on load.
        expect(screen.getByText('Save').closest('button')).toBeDisabled();

        // Remove the only rule (editor reports hasChanges=false).
        await userEvent.click(screen.getByTestId('remove-loaded-rule-button'));

        // Save must enable — the expression differs from the loaded original.
        expect(screen.getByText('Save').closest('button')).not.toBeDisabled();
    });

    test('falls back to a generic confirmation when the match query fails, not a false empty-team warning', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: [], active: false}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {
                id: 'parent1',
                name: 'Engineering Policy',
                type: 'parent',
                rules: [{expression: 'user.attributes.Department == "Engineering"', actions: ['membership']}],
            },
        });

        // The expression endpoint returns {error} rather than throwing.
        const searchUsersForExpression = jest.fn().mockResolvedValue({error: {message: 'PDP unavailable'}});
        const getTeamMembers = jest.fn().mockResolvedValue({data: [{user_id: 'sysadmin'}]});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true, allow_open_invite: false},
            actions: {...baseProps.actions, getTeamAccessControlPolicy, getAccessControlPolicy, searchUsersForExpression, getTeamMembers},
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

        // A failed count must not masquerade as "nobody qualifies".
        expect(screen.getByText(/Are you sure you want to apply the membership policy/)).toBeInTheDocument();
        expect(screen.queryByText(/No current members meet the criteria/)).not.toBeInTheDocument();
        expect(screen.queryByText(/will be added/)).not.toBeInTheDocument();
        expect(screen.queryByText(/will be removed/)).not.toBeInTheDocument();
    });

    test('shows the empty-team warning with auto-add OFF even when qualifying non-members exist (T11)', async () => {
        // Mirrors e2e MM-68846-T11: private team, one non-matching member, matching
        // non-members exist elsewhere, auto-add OFF. The sole member is removed and
        // nothing is added, so the team ends empty and the warning must show.
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: [], rules: [], active: false}, enforced: true},
        });

        // Two matching users exist in the workspace, neither on the team.
        const searchUsersForExpression = jest.fn().mockResolvedValue({data: {users: [{id: 'e1'}, {id: 'e2'}]}});
        const getTeamMembers = jest.fn().mockResolvedValue({data: [{user_id: 'mkt'}]});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true, allow_open_invite: false},
            actions: {...baseProps.actions, getTeamAccessControlPolicy, searchUsersForExpression, getTeamMembers},
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => expect(screen.getByTestId('team-level-access-rules')).toBeInTheDocument());

        // Add a custom rule but leave auto-add OFF.
        await userEvent.click(screen.getByTestId('add-rule-no-autoadd-button'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(screen.getByText('Apply membership policy')).toBeInTheDocument());

        // Empty-team warning shows; the add line does NOT (auto-add off).
        expect(screen.getByText(/No current members meet the criteria/)).toBeInTheDocument();
        expect(screen.queryByText(/will be added/)).not.toBeInTheDocument();
    });

    test('does not show a removal line for a public (advisory) team', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: [], rules: [], active: false}, enforced: true},
        });
        const searchUsersForExpression = jest.fn().mockResolvedValue({data: {users: [{id: 'e1'}]}});
        const getTeamMembers = jest.fn().mockResolvedValue({data: [{user_id: 'mkt'}]});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true, allow_open_invite: true}, // PUBLIC / advisory
            actions: {...baseProps.actions, getTeamAccessControlPolicy, searchUsersForExpression, getTeamMembers},
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => expect(screen.getByTestId('team-level-access-rules')).toBeInTheDocument());

        await userEvent.click(screen.getByTestId('add-rule-no-autoadd-button'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(screen.getByText('Apply membership policy')).toBeInTheDocument());

        // Advisory teams never remove members, so no removal line and no empty-team warning.
        expect(screen.queryByText(/will be removed at the next sync/)).not.toBeInTheDocument();
        expect(screen.queryByText(/No current members meet the criteria/)).not.toBeInTheDocument();
    });

    test('falls back to a generic confirmation when loading team members fails', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: [], rules: [], active: false}, enforced: true},
        });
        const searchUsersForExpression = jest.fn().mockResolvedValue({data: {users: [{id: 'e1'}]}});
        const getTeamMembers = jest.fn().mockResolvedValue({error: {message: 'network error'}});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true, allow_open_invite: false},
            actions: {...baseProps.actions, getTeamAccessControlPolicy, searchUsersForExpression, getTeamMembers},
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => expect(screen.getByTestId('team-level-access-rules')).toBeInTheDocument());

        await userEvent.click(screen.getByTestId('add-rule-no-autoadd-button'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(screen.getByText('Apply membership policy')).toBeInTheDocument());

        // Member load failed → unknown counts → generic prompt only.
        expect(screen.getByText(/Are you sure you want to apply the membership policy/)).toBeInTheDocument();
        expect(screen.queryByText(/will be removed/)).not.toBeInTheDocument();
        expect(screen.queryByText(/No current members meet the criteria/)).not.toBeInTheDocument();
    });

    test('does not preview additions when every matching user is already a member', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: [], active: false}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: []},
        });

        // Both matching users are already members → addCount = 0.
        const searchUsersForExpression = jest.fn().mockResolvedValue({data: {users: [{id: 'u1'}, {id: 'u2'}]}});
        const getTeamMembers = jest.fn().mockResolvedValue({data: [{user_id: 'u1'}, {user_id: 'u2'}]});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true, allow_open_invite: false},
            actions: {...baseProps.actions, getTeamAccessControlPolicy, getAccessControlPolicy, searchUsersForExpression, getTeamMembers},
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => expect(screen.getByTestId('auto-add-members-checkbox')).toBeInTheDocument());

        // Turn auto-add ON, then save.
        await userEvent.click(screen.getByTestId('auto-add-members-checkbox'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(screen.getByText('Apply membership policy')).toBeInTheDocument());

        // No non-members to add, so the add line is absent even with auto-add on.
        expect(screen.queryByText(/will be added/)).not.toBeInTheDocument();
    });

    test('enabling auto-add alone raises the apply-policy confirmation previewing additions', async () => {
        // Enabling auto-add without editing the expression must still confirm on save and
        // preview the backfill count (UX spec §4.4: auto-add off→on shows the count).
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {
                policy: {
                    id: '123',
                    type: 'team',
                    imports: [],
                    rules: [{expression: 'user.attributes.Department == "Engineering"', actions: ['membership']}],
                    active: false,
                },
                enforced: true,
            },
        });

        // One matching non-member exists → add-count of 1.
        const searchUsersForExpression = jest.fn().mockResolvedValue({data: {users: [{id: 'e1'}]}});
        const getTeamMembers = jest.fn().mockResolvedValue({data: []});
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true, allow_open_invite: false},
            actions: {...baseProps.actions, getTeamAccessControlPolicy, searchUsersForExpression, getTeamMembers},
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => expect(screen.getByTestId('enable-autoadd-same-expr-button')).toBeInTheDocument());

        // Enable auto-add with no expression change, then save.
        await userEvent.click(screen.getByTestId('enable-autoadd-same-expr-button'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(screen.getByText('Apply membership policy')).toBeInTheDocument());
        expect(screen.getByText(/1 qualifying user will be added/)).toBeInTheDocument();
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

    test('toggling auto-add on a parent-governed team persists the team child active on save', async () => {
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

        // Parent-governed team: the rules-section checkbox is reachable and flips the
        // team child's active without touching the parent policy.
        const autoAdd = screen.getByTestId('auto-add-members-checkbox');
        expect(autoAdd).not.toBeChecked();
        await userEvent.click(autoAdd);

        await userEvent.click(screen.getByText('Save'));

        // Saving rule changes surfaces the Apply membership policy confirmation.
        await userEvent.click(document.getElementById('confirmModalButton')!);

        await waitFor(() => {
            expect(updateAccessControlPoliciesActive).toHaveBeenCalledWith([{id: '123', active: true}]);
        });
        expect(saveTeamAccessPolicy).toHaveBeenCalled();
    });

    test('linking a parent policy does not seed auto-add from the parent active flag', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({data: {policy: null, enforced: false}});
        const searchPolicies = jest.fn().mockResolvedValue({
            data: {policies: [{id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: [], imports: [], active: true}], total: 1},
        });
        const props = {
            ...baseProps,
            abacSupported: true,
            actions: {
                ...baseProps.actions,
                getTeamAccessControlPolicy,
                searchPolicies,
            },
        };
        renderWithContext(<TeamDetails {...props}/>);

        // Enforce ABAC, then link a parent policy whose own active flag is true.
        await userEvent.click(screen.getByTestId('policy-enforce-toggle-button'));
        await userEvent.click(screen.getByText('Link to a policy'));
        await waitFor(() => expect(screen.getByText('Engineering Policy')).toBeInTheDocument());
        await userEvent.click(screen.getByText('Engineering Policy'));

        // The linked policy is active, but the team's auto-add checkbox must stay off —
        // the seed was dropped, so auto-add is only set explicitly by the admin. It is
        // still interactive (reachable), just unchecked.
        await waitFor(() => expect(screen.getByTestId('auto-add-members-checkbox')).toBeInTheDocument());
        expect(screen.getByTestId('auto-add-members-checkbox')).not.toBeChecked();
        expect(screen.getByTestId('auto-add-members-checkbox')).not.toBeDisabled();
    });

    test('hides the sync footer until a membership policy is persisted', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({data: {policy: null, enforced: false}});
        const searchPolicies = jest.fn().mockResolvedValue({
            data: {policies: [{id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: [], imports: [], active: false}], total: 1},
        });
        const props = {
            ...baseProps,
            abacSupported: true,
            actions: {...baseProps.actions, getTeamAccessControlPolicy, searchPolicies},
        };
        renderWithContext(<TeamDetails {...props}/>);

        // Enforce ABAC and stage a policy link — nothing is persisted yet.
        await userEvent.click(screen.getByTestId('policy-enforce-toggle-button'));
        await userEvent.click(screen.getByText('Link to a policy'));
        await waitFor(() => expect(screen.getByText('Engineering Policy')).toBeInTheDocument());
        await userEvent.click(screen.getByText('Engineering Policy'));

        // Rules section renders, but the sync footer is withheld pre-save.
        await waitFor(() => expect(screen.getByTestId('team-level-access-rules')).toBeInTheDocument());
        expect(screen.queryByTestId('team-membership-sync-footer')).not.toBeInTheDocument();
    });

    test('shows the sync footer when the team already has a persisted policy', async () => {
        const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {policy: {id: '123', type: 'team', imports: ['parent1'], rules: [], active: false}, enforced: true},
        });
        const getAccessControlPolicy = jest.fn().mockResolvedValue({
            data: {id: 'parent1', name: 'Engineering Policy', type: 'parent', rules: [], active: false},
        });
        const props = {
            ...baseProps,
            abacSupported: true,
            team: {...baseProps.team, policy_enforced: true},
            actions: {...baseProps.actions, getTeamAccessControlPolicy, getAccessControlPolicy},
        };
        renderWithContext(<TeamDetails {...props}/>);

        await waitFor(() => expect(screen.getByTestId('team-membership-sync-footer')).toBeInTheDocument());
    });
});
