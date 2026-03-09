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
                        policy: {
                            id: 'policy1',
                            name: 'Policy 1',
                            rules: [{expression: 'true'}],
                        },
                    },
                }),
            },
        };
        const {container} = renderWithContext(<PolicyDetails {...props}/>);
        expect(container).toMatchSnapshot();
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
