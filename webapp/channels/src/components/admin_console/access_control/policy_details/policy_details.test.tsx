// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelWithTeamData} from '@mattermost/types/channels';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';

import PolicyDetails from './policy_details';

import TableEditor from '../editors/table_editor/table_editor';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: jest.fn(),
    }),
}));

// Mock TableEditor so tests can control onMaskedStateChange callbacks.
// jest.mock factory may not reference out-of-scope variables, so React is required inline.
jest.mock('../editors/table_editor/table_editor', () => {
    const reactLib = require('react');
    return jest.fn(({onMaskedStateChange}: any) => {
        reactLib.useEffect(() => {
            onMaskedStateChange?.(false);
        }, []);
        return reactLib.createElement('div', {'data-testid': 'table-editor'});
    });
});

// Mock CELEditor — its real implementation boots Monaco on mount, which is
// not available in JSDOM. The mode-toggle tests only care that switching to
// Advanced/Simple flips state in the parent, not how Monaco renders.
jest.mock('../editors/cel_editor/editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'cel-editor'}));
});

// Mock the useChannelAccessControlActions hook
jest.mock('hooks/useChannelAccessControlActions', () => ({
    useChannelAccessControlActions: jest.fn(),
}));

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;
const MockedTableEditor = TableEditor as jest.MockedFunction<typeof TableEditor>;

describe('components/admin_console/access_control/policy_details/PolicyDetails', () => {
    const mockCreatePolicy = jest.fn();
    const mockUpdatePolicy = jest.fn();
    const mockDeletePolicy = jest.fn();
    const mockSearchChannels = jest.fn();
    const mockSetChannelListSearch = jest.fn();
    const mockSetChannelListFilters = jest.fn();
    const mockOnRemoveCallback = jest.fn();
    const mockOnUndoRemoveCallback = jest.fn();
    const mockOnAddCallback = jest.fn();
    const mockOnPoliciesActiveStatusChange = jest.fn();
    const mockFetchPolicy = jest.fn();
    const mockSetNavigationBlocked = jest.fn();
    const mockAssignChannelsToAccessControlPolicy = jest.fn();
    const mockUnassignChannelsFromAccessControlPolicy = jest.fn();
    const mockGetAccessControlExpressionAutocomplete = jest.fn();
    const mockGetAccessControlFields = jest.fn();
    const mockCreateJob = jest.fn();
    const mockUpdateAccessControlPoliciesActive = jest.fn();
    const mockGetVisualAST = jest.fn();
    const defaultProps = {
        policyId: 'policy1',
        accessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: false,
            EnableChannelPolicyIndicators: true,
            TrustProxyDeviceIdentityHeader: false,
            EnforceDeviceIDConsistency: false,
        },
        channels: [
            {id: 'channel1', name: 'Channel 1', display_name: 'Channel 1', team_display_name: 'Team 1', type: 'O'} as ChannelWithTeamData,
            {id: 'channel2', name: 'channel2', display_name: 'Channel 2', team_display_name: 'Team 2', type: 'P'} as ChannelWithTeamData,
        ],
        totalCount: 2,
        searchTerm: '',
        filters: {},
        onRemoveCallback: mockOnRemoveCallback,
        onUndoRemoveCallback: mockOnUndoRemoveCallback,
        onAddCallback: mockOnAddCallback,
        onPolicyActiveStatusChange: mockOnPoliciesActiveStatusChange,
        channelsToRemove: {},
        policyActiveStatusChanges: [],
        channelsToAdd: {},
        autocompleteResult: {entities: {}},
        actions: {
            createPolicy: mockCreatePolicy,
            updatePolicy: mockUpdatePolicy,
            deletePolicy: mockDeletePolicy,
            searchChannels: mockSearchChannels,
            setChannelListSearch: mockSetChannelListSearch,
            setChannelListFilters: mockSetChannelListFilters,
            fetchPolicy: mockFetchPolicy,
            setNavigationBlocked: mockSetNavigationBlocked,
            assignChannelsToAccessControlPolicy: mockAssignChannelsToAccessControlPolicy,
            unassignChannelsFromAccessControlPolicy: mockUnassignChannelsFromAccessControlPolicy,
            getAccessControlExpressionAutocomplete: mockGetAccessControlExpressionAutocomplete,
            getAccessControlFields: mockGetAccessControlFields,
            createJob: mockCreateJob,
            getVisualAST: mockGetVisualAST,
            updateAccessControlPoliciesActive: mockUpdateAccessControlPoliciesActive,
            getTeam: jest.fn().mockResolvedValue({data: null}),
        },
    };

    beforeEach(() => {
        // Mock the hook to return the actions that PolicyDetails expects
        mockUseChannelAccessControlActions.mockReturnValue({
            getAccessControlFields: mockGetAccessControlFields,
            getVisualAST: mockGetVisualAST,
            searchUsers: jest.fn(),
            getChannelPolicy: jest.fn(),
            saveChannelPolicy: jest.fn(),
            deleteChannelPolicy: jest.fn(),
            getChannelMembers: jest.fn(),
            createJob: jest.fn(),
            createAccessControlSyncJob: jest.fn(),
            validateExpressionAgainstRequester: jest.fn(),
            simulatePolicyForUsers: jest.fn(),
            updateAccessControlPoliciesActive: mockUpdateAccessControlPoliciesActive,
        });

        mockCreatePolicy.mockReset();
        mockUpdatePolicy.mockReset();
        mockDeletePolicy.mockReset();
        mockSearchChannels.mockReset();
        mockSetChannelListSearch.mockReset();
        mockSetChannelListFilters.mockReset();
        mockOnRemoveCallback.mockReset();
        mockOnUndoRemoveCallback.mockReset();
        mockOnAddCallback.mockReset();
        mockOnPoliciesActiveStatusChange.mockReset();
        mockFetchPolicy.mockReset();
        mockSetNavigationBlocked.mockReset();
        mockAssignChannelsToAccessControlPolicy.mockReset();
        mockUnassignChannelsFromAccessControlPolicy.mockReset();
        mockGetAccessControlExpressionAutocomplete.mockReset();
        mockGetAccessControlFields.mockReset();
        mockCreateJob.mockReset();
        mockUpdateAccessControlPoliciesActive.mockReset();
        mockGetVisualAST.mockReset();

        // Default mock implementations
        mockGetAccessControlFields.mockResolvedValue({data: []});
        mockFetchPolicy.mockResolvedValue({data: {id: 'policy1', name: 'Policy 1', rules: []}});
        mockSearchChannels.mockResolvedValue({data: {channels: [], total_count: 0}});
    });

    test('should match snapshot with new policy', () => {
        // The ChannelList's Filter component has an existing prop type issue with TeamFilterDropdown
        // that only surfaces during full rendering (not shallow). Suppress for this test.
        const errorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
            if (typeof args[0] === 'string' && args[0].includes('Failed prop type')) {
                // no-op: suppress prop type warnings
            }
        });

        const props = {
            ...defaultProps,
            policyId: '',
        };
        const {container} = renderWithContext(<PolicyDetails {...props}/>);
        expect(container).toMatchSnapshot();

        errorSpy.mockRestore();
    });

    test('should match snapshot with existing policy', () => {
        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                fetchPolicy: jest.fn().mockResolvedValue({
                    data: {
                        id: 'policy1',
                        name: 'Policy 1',
                        rules: [{expression: 'true'}],
                    },
                }),
            },
        };
        const {container} = renderWithContext(<PolicyDetails {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should show masked values warning banner when policy has masked rows', async () => {
        // hasMaskedRows is derived in policy_details from the presence of the
        // "--------" sentinel in the loaded expression — drive the test via a
        // fetched policy carrying a masked rule.
        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                fetchPolicy: jest.fn().mockResolvedValue({
                    data: {
                        id: 'policy1',
                        name: 'Policy 1',
                        rules: [{
                            actions: ['*'],
                            expression: 'user.attributes.program in ["Alpha", "--------"]',
                        }],
                    },
                }),
            },
        };
        renderWithContext(<PolicyDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('This policy contains restricted values')).toBeInTheDocument();
        });
        expect(screen.getByText(/Some rules include attribute values you cannot see/)).toBeInTheDocument();
    });

    test('should not show masked values warning banner when no masked rows', async () => {
        renderWithContext(<PolicyDetails {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.queryByText('This policy contains restricted values')).not.toBeInTheDocument();
        });
    });

    test('excludes session attributes from the attributes passed to the editor', async () => {
        MockedTableEditor.mockClear();
        mockGetAccessControlFields.mockResolvedValue({
            data: [
                {id: 'u1', name: 'department', group_id: 'cpa9q4w7m2x5c8v1b6n3k0jr5h', object_type: 'user', attrs: {managed: 'admin'}},
                {id: 's1', name: 'network_name', group_id: 'nkpkzni6yjrjt8uktpbwkagoth', object_type: 'session', target_type: 'system', attrs: {}},
            ],
        });

        renderWithContext(<PolicyDetails {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        const lastCall = MockedTableEditor.mock.calls[MockedTableEditor.mock.calls.length - 1][0];
        const passedNames = lastCall.userAttributes.map((attr) => attr.name);
        expect(passedNames).toContain('department');
        expect(passedNames).not.toContain('network_name');
    });

    test('hasMaskedRows derivation survives Simple → Advanced → Simple mode toggles', async () => {
        // Regression guard: hasMaskedRows must come from the expression itself,
        // not from a TableEditor lifecycle callback. Toggling editor modes
        // remounts TableEditor; if the parent reset hasMaskedRows on remount,
        // the warning banner would flicker off and the CEL/delete gates would
        // briefly open. Deriving from the "--------" sentinel in the expression
        // is the only source of truth that's lifecycle-independent.

        // The mode-toggle button is disabled while no usable attributes are
        // available, so the test needs at least one to actually exercise the
        // Simple → Advanced → Simple round-trip.
        mockGetAccessControlFields.mockResolvedValue({data: [{name: 'program', attrs: {ldap: true}}]});

        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                fetchPolicy: jest.fn().mockResolvedValue({
                    data: {
                        id: 'policy1',
                        name: 'Policy 1',
                        rules: [{
                            actions: ['*'],
                            expression: 'user.attributes.program in ["Alpha", "--------"]',
                        }],
                    },
                }),
            },
        };
        renderWithContext(<PolicyDetails {...props}/>);

        // Banner present after initial load (Simple mode).
        await waitFor(() => {
            expect(screen.getByText('This policy contains restricted values')).toBeInTheDocument();
        });

        // Switch to Advanced mode — banner must remain (it lives outside the
        // editor swap, gated by hasMaskedRows which is expression-derived).
        const toAdvanced = screen.getByText('Switch to Advanced Mode');
        await userEvent.click(toAdvanced);
        expect(screen.getByText('This policy contains restricted values')).toBeInTheDocument();

        // Switch back to Simple mode — banner must STILL be there. Before the
        // fix, the TableEditor remount transiently flipped hasMaskedRows to
        // false and the banner disappeared.
        const toSimple = screen.getByText('Switch to Simple Mode');
        await userEvent.click(toSimple);
        expect(screen.getByText('This policy contains restricted values')).toBeInTheDocument();
    });

    test('hasMaskedRows stays false for a policy without the masked-token sentinel', async () => {
        // Negative case: a normal policy expression must not trip the
        // masked-rows banner.
        const props = {
            ...defaultProps,
            actions: {
                ...defaultProps.actions,
                fetchPolicy: jest.fn().mockResolvedValue({
                    data: {
                        id: 'policy1',
                        name: 'Policy 1',
                        rules: [{
                            actions: ['*'],
                            expression: 'user.attributes.program in ["Alpha", "Bravo"]',
                        }],
                    },
                }),
            },
        };
        renderWithContext(<PolicyDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Delete policy')).toBeInTheDocument();
        });
        expect(screen.queryByText('This policy contains restricted values')).not.toBeInTheDocument();
    });

    // Note: when hasMaskedRows is true the Delete button is disabled (policy_details.tsx),
    // so the masked-warning inside the confirmation modal is defense-in-depth and not
    // reachable through normal UI flow. Test only the no-masked-rows path here.

    test('should not show masked values warning in delete confirmation modal when no masked rows', async () => {
        renderWithContext(<PolicyDetails {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('Delete policy')).toBeInTheDocument();
        });

        const deleteButtons = screen.getAllByText('Delete');
        await userEvent.click(deleteButtons[deleteButtons.length - 1]);

        await waitFor(() => {
            expect(screen.getByText('Confirm Policy Deletion')).toBeInTheDocument();
        });

        expect(screen.queryByText(/This policy includes attribute values that are hidden from you/)).not.toBeInTheDocument();
    });

    test('should handle delete policy', async () => {
        const props = {
            ...defaultProps,
            policyId: 'policy1',
            actions: {
                ...defaultProps.actions,
                deletePolicy: mockDeletePolicy.mockResolvedValue({data: {}}),
            },
        };

        renderWithContext(<PolicyDetails {...props}/>);

        // Find and click the delete button
        await waitFor(() => {
            expect(screen.getByText('Delete policy')).toBeInTheDocument();
        });

        // Find the Delete button within the delete-policy card
        const deleteButtons = screen.getAllByText('Delete');
        const deleteButton = deleteButtons[deleteButtons.length - 1];
        await userEvent.click(deleteButton);

        // Find the confirmation modal and confirm
        await waitFor(() => {
            expect(screen.getByText('Confirm Policy Deletion')).toBeInTheDocument();
        });

        const confirmButton = screen.getByText('Delete Policy');
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(mockDeletePolicy).toHaveBeenCalledWith('policy1');
        });
    });

    test('should block deletion when the policy is assigned to teams (no channels)', async () => {
        // team_count is stamped into policy Props by the GET handler. Teams are not
        // editable from this editor, so a linked team must gate deletion the same way
        // channels do — otherwise deleting orphans the team-type child policies.
        const props = {
            ...defaultProps,
            policyId: 'policy1',
            actions: {
                ...defaultProps.actions,
                deletePolicy: mockDeletePolicy.mockResolvedValue({data: {}}),
                fetchPolicy: jest.fn().mockResolvedValue({
                    data: {
                        id: 'policy1',
                        name: 'Policy 1',
                        rules: [{expression: 'true'}],
                        props: {team_count: 2, channel_count: 0, child_ids: ['t1', 't2']},
                    },
                }),

                // No channels assigned — only teams gate the deletion.
                searchChannels: mockSearchChannels.mockResolvedValue({data: {channels: [], total_count: 0}}),

                // child_ids lists channels first, then teams; with no channels the
                // ids are the two team ids, resolved to names for the warning list.
                getTeam: jest.fn().
                    mockResolvedValueOnce({data: {id: 't1', display_name: 'Engineering'}}).
                    mockResolvedValueOnce({data: {id: 't2', display_name: 'Design'}}),
            },
        };

        renderWithContext(<PolicyDetails {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Delete policy')).toBeInTheDocument();
        });

        // The has-resources subtitle is shown instead of the deletable subtitle.
        expect(screen.getByText(/Remove all assigned resources/)).toBeInTheDocument();

        // The linked-teams warning lists each team, linking to its System Console page.
        await waitFor(() => {
            expect(screen.getByText('This policy is assigned to teams - Deletion not allowed')).toBeInTheDocument();
        });
        const engineeringLink = screen.getByRole('link', {name: 'Engineering'});
        expect(engineeringLink).toHaveAttribute('href', '/admin_console/user_management/teams/t1');
        expect(screen.getByRole('link', {name: 'Design'})).toHaveAttribute('href', '/admin_console/user_management/teams/t2');

        // Clicking Delete is a no-op — the confirmation modal never opens.
        const deleteButtons = screen.getAllByText('Delete');
        await userEvent.click(deleteButtons[deleteButtons.length - 1]);

        expect(screen.queryByText('Confirm Policy Deletion')).not.toBeInTheDocument();
        expect(mockDeletePolicy).not.toHaveBeenCalled();
    });

    test('clears a stale navigation-block flag on mount', async () => {
        // A page that links here (e.g. the per-team System Console page) may have
        // left navigationBlocked=true. If the editor inherits it, its own leave-guard
        // raises a spurious "Discard changes?" prompt even though nothing was edited.
        renderWithContext(<PolicyDetails {...defaultProps}/>);

        await waitFor(() => {
            expect(mockSetNavigationBlocked).toHaveBeenCalledWith(false);
        });
    });
});
