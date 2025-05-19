// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {act} from 'react-dom/test-utils';

import type {ChannelWithTeamData} from '@mattermost/types/channels';

import PolicyDetails from './policy_details';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: jest.fn(),
    }),
}));

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
    const mockFetchPolicy = jest.fn();
    const mockSetNavigationBlocked = jest.fn();
    const mockAssignChannelsToAccessControlPolicy = jest.fn();
    const mockUnassignChannelsFromAccessControlPolicy = jest.fn();
    const mockGetAccessControlExpressionAutocomplete = jest.fn();
    const mockGetAccessControlFields = jest.fn();
    const mockCreateJob = jest.fn();
    const mockUpdateAccessControlPolicyActive = jest.fn();

    const defaultProps = {
        policyId: 'policy1',
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
        channelsToRemove: {},
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
            updateAccessControlPolicyActive: mockUpdateAccessControlPolicyActive,
        },
    };

    beforeEach(() => {
        mockCreatePolicy.mockReset();
        mockUpdatePolicy.mockReset();
        mockDeletePolicy.mockReset();
        mockSearchChannels.mockReset();
        mockSetChannelListSearch.mockReset();
        mockSetChannelListFilters.mockReset();
        mockOnRemoveCallback.mockReset();
        mockOnUndoRemoveCallback.mockReset();
        mockOnAddCallback.mockReset();
        mockFetchPolicy.mockReset();
        mockSetNavigationBlocked.mockReset();
        mockAssignChannelsToAccessControlPolicy.mockReset();
        mockUnassignChannelsFromAccessControlPolicy.mockReset();
        mockGetAccessControlExpressionAutocomplete.mockReset();
        mockGetAccessControlFields.mockReset();
        mockCreateJob.mockReset();
        mockUpdateAccessControlPolicyActive.mockReset();
    });

    test('should match snapshot with new policy', () => {
        const props = {
            ...defaultProps,
            policyId: '',
        };
        const wrapper = shallow(<PolicyDetails {...props}/>);
        expect(wrapper).toMatchSnapshot();
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
        const wrapper = shallow(<PolicyDetails {...props}/>);
        expect(wrapper).toMatchSnapshot();
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

        const wrapper = shallow(<PolicyDetails {...props}/>);

        // Find the delete-policy card
        const deleteCard = wrapper.find('Card.delete-policy');
        expect(deleteCard.exists()).toBe(true);

        // Find the header with button inside the card
        const deleteButtonHeader = deleteCard.find('TitleAndButtonCardHeader');
        expect(deleteButtonHeader.exists()).toBe(true);

        const onClickProp = deleteButtonHeader.props().onClick;
        expect(onClickProp).toBeDefined();

        // Click the delete button
        await act(async () => {
            if (onClickProp) {
                await onClickProp({} as React.MouseEvent);
            }
        });

        // Update the wrapper to see the modal
        wrapper.update();

        // Find the confirmation modal
        const confirmationModal = wrapper.find('GenericModal');
        expect(confirmationModal.exists()).toBe(true);

        // Trigger the confirmation
        await act(async () => {
            // Get the handleConfirm prop with proper type assertion
            const handleConfirm = (confirmationModal.props() as any).handleConfirm;
            if (handleConfirm) {
                await handleConfirm();
            }
        });

        expect(mockDeletePolicy).toHaveBeenCalledWith('policy1');
    });
});
