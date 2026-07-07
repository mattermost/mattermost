// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamMembershipTab from './team_membership_tab';

jest.mock('hooks/useChannelAccessControlActions');
jest.mock('mattermost-redux/actions/access_control', () => ({
    ...jest.requireActual('mattermost-redux/actions/access_control'),
    getTeamAccessControlPolicy: jest.fn(() => () => Promise.resolve({data: {policy: null, enforced: false}})),
    createAccessControlTeamSyncJob: jest.fn(() => () => Promise.resolve({data: {}})),
}));
jest.mock('mattermost-redux/actions/teams', () => ({
    ...jest.requireActual('mattermost-redux/actions/teams'),
    getTeamStats: jest.fn(() => () => Promise.resolve({data: {total_member_count: 10, active_member_count: 10}})),
}));

jest.mock('components/admin_console/access_control/editors/table_editor/table_editor', () => {
    const MockReact = require('react');
    return jest.fn(({onChange}: {onChange: (val: string) => void}) =>
        MockReact.createElement('div', {'data-testid': 'table-editor'},
            MockReact.createElement('button', {
                onClick: () => onChange('user.attributes.department in ["Engineering"]'),
                'data-testid': 'table-editor-change',
            }, 'Change expression'),
        ),
    );
});

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;

describe('components/team_settings/TeamMembershipTab', () => {
    const mockActions = {
        getAccessControlFields: jest.fn(),
        getVisualAST: jest.fn(),
        searchUsers: jest.fn(),
        getChannelPolicy: jest.fn(),
        saveChannelPolicy: jest.fn(),
        deleteChannelPolicy: jest.fn(),
        getChannelMembers: jest.fn(),
        createJob: jest.fn(),
        createAccessControlSyncJob: jest.fn(),
        createAccessControlTeamSyncJob: jest.fn(),
        updateAccessControlPoliciesActive: jest.fn(),
        validateExpressionAgainstRequester: jest.fn(),
        simulatePolicyForUsers: jest.fn(),
    };

    const mockUserAttributes: UserPropertyField[] = [
        {
            id: 'attr1',
            name: 'department',
            type: 'select',
            group_id: 'custom_profile_attributes',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            created_by: '',
            updated_by: '',
            target_id: '',
            target_type: '',
            object_type: '',
            attrs: {
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
                options: [{id: 'eng', name: 'Engineering'}],
            },
        },
    ];

    const baseTeam = TestHelper.getTeamMock({
        id: 'team_id',
        display_name: 'Test Team',
        type: 'O',
        allow_open_invite: true,
    });

    const baseProps = {
        team: baseTeam,
        areThereUnsavedChanges: false,
        setAreThereUnsavedChanges: jest.fn(),
        showTabSwitchError: false,
        setShowTabSwitchError: jest.fn(),
    };

    const initialState = {
        entities: {
            general: {
                config: {
                    EnableAttributeBasedAccessControl: 'true',
                    FeatureFlagTeamMembershipAccessControl: 'true',
                    EnableUserManagedAttributes: 'false',
                },
            },
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: TestHelper.getUserMock({id: 'user_id', roles: 'system_admin'}),
                },
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockActions.getAccessControlFields.mockResolvedValue({data: mockUserAttributes});
        mockActions.getChannelPolicy.mockResolvedValue({data: null});
        mockActions.saveChannelPolicy.mockResolvedValue({data: {id: 'team_id'}});
        mockActions.updateAccessControlPoliciesActive.mockResolvedValue({data: {}});
        mockActions.createAccessControlTeamSyncJob.mockResolvedValue({data: {}});
        mockActions.validateExpressionAgainstRequester.mockResolvedValue({data: {requester_matches: true}});
        mockActions.searchUsers.mockResolvedValue({data: {users: [], total: 5}});

        mockUseChannelAccessControlActions.mockReturnValue(mockActions as any);
    });

    it('renders the tab with title and table editor', async () => {
        renderWithContext(
            <TeamMembershipTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getByText('Team Membership Rules')).toBeInTheDocument();
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });
    });

    it('renders auto-add checkbox reflecting initial policy state', async () => {
        const {getTeamAccessControlPolicy} = require('mattermost-redux/actions/access_control');
        getTeamAccessControlPolicy.mockImplementation(() => () => Promise.resolve({
            data: {
                policy: {
                    id: 'team_id',
                    active: true,
                    rules: [{actions: ['membership'], expression: 'user.attributes.department in ["Engineering"]'}],
                    imports: [],
                },
                enforced: true,
            },
        }));

        renderWithContext(
            <TeamMembershipTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => {
            const checkbox = screen.getByRole('checkbox', {name: /auto-add members/i});
            expect(checkbox).toBeChecked();
        });
    });

    it('shows system policy indicator when parent policies are applied', async () => {
        const parentPolicy = {
            id: 'parent_policy_id',
            name: 'Global Policy',
            type: 'team',
            active: true,
            rules: [{actions: ['membership'], expression: 'user.attributes.location in ["US"]'}],
            imports: [],
        };

        const {getTeamAccessControlPolicy} = require('mattermost-redux/actions/access_control');
        getTeamAccessControlPolicy.mockImplementation(() => () => Promise.resolve({
            data: {
                policy: {
                    id: 'team_id',
                    active: false,
                    rules: [],
                    imports: ['parent_policy_id'],
                },
                enforced: true,
            },
        }));
        mockActions.getChannelPolicy.mockResolvedValue({data: parentPolicy});

        renderWithContext(
            <TeamMembershipTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(mockActions.getChannelPolicy).toHaveBeenCalledWith('parent_policy_id');
        });
    });

    it('triggers createAccessControlTeamSyncJob on a rule change even with auto-add off', async () => {
        const {createAccessControlTeamSyncJob} = require('mattermost-redux/actions/access_control');

        renderWithContext(
            <TeamMembershipTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => expect(screen.getByTestId('table-editor')).toBeInTheDocument());

        // Simulate an expression change; auto-add is left OFF on purpose. On a strict
        // team the reconcile removal pass runs regardless of auto-add, so the save must
        // still enqueue a sync job — membership changes apply on save, not on the
        // hourly scheduler.
        await userEvent.click(screen.getByTestId('table-editor-change'));

        // Trigger save
        await userEvent.click(screen.getByText('Save'));

        // Confirm modal
        await waitFor(() => expect(screen.getByText('Save team membership rules?')).toBeInTheDocument());
        const confirmButtons = screen.getAllByText('Save');
        await userEvent.click(confirmButtons[confirmButtons.length - 1]);

        await waitFor(() => {
            expect(createAccessControlTeamSyncJob).toHaveBeenCalledWith({policy_id: 'team_id'});
        });
    });

    it('triggers createAccessControlTeamSyncJob when auto-add toggled on', async () => {
        const {getTeamAccessControlPolicy, createAccessControlTeamSyncJob} = require('mattermost-redux/actions/access_control');
        getTeamAccessControlPolicy.mockImplementation(() => () => Promise.resolve({
            data: {
                policy: {
                    id: 'team_id',
                    active: false,
                    rules: [{actions: ['membership'], expression: 'user.attributes.department in ["Engineering"]'}],
                    imports: [],
                },
                enforced: true,
            },
        }));

        renderWithContext(
            <TeamMembershipTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => expect(screen.getByRole('checkbox', {name: /auto-add members/i})).toBeInTheDocument());

        await userEvent.click(screen.getByRole('checkbox', {name: /auto-add members/i}));

        // Trigger save
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(screen.getByText('Save team membership rules?')).toBeInTheDocument());

        const confirmButtons = screen.getAllByText('Save');
        await userEvent.click(confirmButtons[confirmButtons.length - 1]);

        await waitFor(() => {
            expect(createAccessControlTeamSyncJob).toHaveBeenCalledWith({policy_id: 'team_id'});
        });
    });

    it('does not trigger sync job when auto-add is turned off', async () => {
        const {getTeamAccessControlPolicy, createAccessControlTeamSyncJob} = require('mattermost-redux/actions/access_control');
        getTeamAccessControlPolicy.mockImplementation(() => () => Promise.resolve({
            data: {
                policy: {
                    id: 'team_id',
                    active: true,
                    rules: [{actions: ['membership'], expression: 'user.attributes.department in ["Engineering"]'}],
                    imports: [],
                },
                enforced: true,
            },
        }));

        renderWithContext(
            <TeamMembershipTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => {
            const checkbox = screen.getByRole('checkbox', {name: /auto-add members/i});
            expect(checkbox).toBeChecked();
        });

        await userEvent.click(screen.getByRole('checkbox', {name: /auto-add members/i}));

        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(screen.getByText('Save team membership rules?')).toBeInTheDocument());

        const confirmButtons = screen.getAllByText('Save');
        await userEvent.click(confirmButtons[confirmButtons.length - 1]);

        await waitFor(() => {
            expect(createAccessControlTeamSyncJob).not.toHaveBeenCalled();
        });
    });

    it('blocks save and shows error when self-exclusion detected', async () => {
        const {getTeamAccessControlPolicy} = require('mattermost-redux/actions/access_control');
        getTeamAccessControlPolicy.mockImplementation(() => () => Promise.resolve({
            data: {policy: {id: 'team_id', active: false, rules: [], imports: []}, enforced: false},
        }));
        mockActions.validateExpressionAgainstRequester.mockResolvedValue({
            data: {requester_matches: false},
        });

        renderWithContext(
            <TeamMembershipTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => expect(screen.getByTestId('table-editor')).toBeInTheDocument());

        await userEvent.click(screen.getByTestId('table-editor-change'));

        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText('Cannot save access rules')).toBeInTheDocument();
            expect(screen.getByText('You cannot set these rules because that will remove you from the team.')).toBeInTheDocument();
        });
    });

    it('shows empty team warning in confirm modal when no users match and team is private', async () => {
        mockActions.searchUsers.mockResolvedValue({data: {users: [], total: 0}});

        const privateTeam = TestHelper.getTeamMock({
            id: 'team_id',
            display_name: 'Private Team',
            type: 'I',
            allow_open_invite: false,
        });

        renderWithContext(
            <TeamMembershipTab {...{...baseProps, team: privateTeam}}/>,
            initialState,
        );

        await waitFor(() => expect(screen.getByTestId('table-editor')).toBeInTheDocument());

        await userEvent.click(screen.getByTestId('table-editor-change'));

        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText(/empty private team/i)).toBeInTheDocument();
        });
    });

    it('shows allowed count in confirmation modal', async () => {
        mockActions.searchUsers.mockResolvedValue({data: {users: [], total: 7}});

        renderWithContext(
            <TeamMembershipTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => expect(screen.getByTestId('table-editor')).toBeInTheDocument());

        await userEvent.click(screen.getByTestId('table-editor-change'));

        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(screen.getByText(/7 users match/i)).toBeInTheDocument();
        });
    });

    it('combines the custom rule with the system policy expression when computing confirm counts', async () => {
        // The team has a system/parent policy applied plus a custom rule added in the
        // editor. The confirm count must simulate the SAME expression the sync enforces:
        // (customRule) && (systemPolicyRule). Before the fix, only the custom rule was
        // evaluated, so the count diverged from what sync actually removes.
        const parentPolicy = {
            id: 'parent_policy_id',
            name: 'Global Policy',
            type: 'team',
            active: true,
            rules: [{actions: ['membership'], expression: 'user.attributes.location in ["US"]'}],
            imports: [],
        };

        const {getTeamAccessControlPolicy} = require('mattermost-redux/actions/access_control');
        getTeamAccessControlPolicy.mockImplementation(() => () => Promise.resolve({
            data: {
                policy: {
                    id: 'team_id',
                    active: false,
                    rules: [],
                    imports: ['parent_policy_id'],
                },
                enforced: true,
            },
        }));
        mockActions.getChannelPolicy.mockResolvedValue({data: parentPolicy});
        mockActions.searchUsers.mockResolvedValue({data: {users: [], total: 3}});

        const privateTeam = TestHelper.getTeamMock({
            id: 'team_id',
            display_name: 'Private Team',
            type: 'I',
            allow_open_invite: false,
        });

        renderWithContext(
            <TeamMembershipTab {...{...baseProps, team: privateTeam}}/>,
            initialState,
        );

        // Wait until the parent/system policy has been loaded into state.
        await waitFor(() => expect(mockActions.getChannelPolicy).toHaveBeenCalledWith('parent_policy_id'));

        // Add a custom rule via the editor, then save to open the confirm modal.
        await userEvent.click(screen.getByTestId('table-editor-change'));
        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(mockActions.searchUsers).toHaveBeenCalled());

        // The evaluated expression must AND the custom rule with the system policy rule.
        const combinedCall = mockActions.searchUsers.mock.calls.find((c) => String(c[0]).includes('location'));
        expect(combinedCall).toBeDefined();
        expect(combinedCall![0]).toContain('user.attributes.department in ["Engineering"]');
        expect(combinedCall![0]).toContain('user.attributes.location in ["US"]');
        expect(combinedCall![0]).toContain('&&');
    });

    it('preserves masked values when expression is loaded from policy', async () => {
        const maskedExpression = 'user.attributes.department in []';
        const {getTeamAccessControlPolicy} = require('mattermost-redux/actions/access_control');
        getTeamAccessControlPolicy.mockImplementation(() => () => Promise.resolve({
            data: {
                policy: {
                    id: 'team_id',
                    active: false,
                    rules: [{actions: ['membership'], expression: maskedExpression}],
                    imports: [],
                },
                enforced: false,
            },
        }));

        renderWithContext(
            <TeamMembershipTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => expect(screen.getByTestId('table-editor')).toBeInTheDocument());

        const TableEditorMock = TableEditor as jest.MockedFunction<typeof TableEditor>;
        expect(TableEditorMock).toHaveBeenCalledWith(
            expect.objectContaining({value: maskedExpression}),
            expect.anything(),
        );
    });
});
