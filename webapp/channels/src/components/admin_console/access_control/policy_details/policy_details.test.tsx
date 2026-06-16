// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelWithTeamData} from '@mattermost/types/channels';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';

import PolicyDetails from './policy_details';

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
});
