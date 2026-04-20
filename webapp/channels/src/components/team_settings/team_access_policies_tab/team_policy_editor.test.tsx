// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import TeamPolicyEditor from './team_policy_editor';

// Mock the hook — return no-op actions with proper promise returns
jest.mock('hooks/useChannelAccessControlActions', () => ({
    useChannelAccessControlActions: () => ({
        getAccessControlFields: jest.fn().mockResolvedValue({data: []}),
        getVisualAST: jest.fn().mockResolvedValue({data: null}),
        searchUsers: jest.fn().mockResolvedValue({data: {}}),
        getChannelPolicy: jest.fn().mockResolvedValue({data: null}),
        saveChannelPolicy: jest.fn().mockResolvedValue({data: {}}),
        deleteChannelPolicy: jest.fn().mockResolvedValue({data: {}}),
        getChannelMembers: jest.fn().mockResolvedValue({data: []}),
        createJob: jest.fn().mockResolvedValue({data: {}}),
        validateExpressionAgainstRequester: jest.fn().mockResolvedValue({data: {requester_matches: true}}),
        createAccessControlSyncJob: jest.fn().mockResolvedValue({data: {}}),
        updateAccessControlPoliciesActive: jest.fn().mockResolvedValue({data: {}}),
    }),
}));

describe('TeamPolicyEditor', () => {
    const defaultProps: ComponentProps<typeof TeamPolicyEditor> = {
        teamId: 'team1',
        accessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: false,
        },
        onNavigateBack: jest.fn(),
        actions: {
            fetchPolicy: jest.fn().mockResolvedValue({data: {}}),
            createPolicy: jest.fn().mockResolvedValue({data: {id: 'new-policy-id', name: 'Test'}}),
            deletePolicy: jest.fn().mockResolvedValue({data: {}}),
            searchChannels: jest.fn().mockResolvedValue({data: {total_count: 0}}),
            assignChannelsToAccessControlPolicy: jest.fn().mockResolvedValue({}),
            unassignChannelsFromAccessControlPolicy: jest.fn().mockResolvedValue({}),
            createJob: jest.fn().mockResolvedValue({data: {}}),
            updateAccessControlPoliciesActive: jest.fn().mockResolvedValue({}),
        },
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should show back button with create title for new policy', async () => {
        renderWithContext(<TeamPolicyEditor {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByText('Add membership policy')).toBeInTheDocument();
        });
    });

    test('should show back button with edit title for existing policy', async () => {
        const fetchPolicy = jest.fn().mockResolvedValue({
            data: {id: 'p1', name: 'Existing', rules: [{expression: 'true', actions: ['*']}]},
        });
        const searchChannels = jest.fn().mockResolvedValue({data: {total_count: 1}});

        renderWithContext(
            <TeamPolicyEditor
                {...defaultProps}
                policyId='p1'
                actions={{...defaultProps.actions, fetchPolicy, searchChannels}}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Edit membership policy')).toBeInTheDocument();
        });
    });

    test('should call onNavigateBack without message when back button clicked', async () => {
        const onNavigateBack = jest.fn();
        renderWithContext(
            <TeamPolicyEditor
                {...defaultProps}
                onNavigateBack={onNavigateBack}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Add membership policy')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText('Add membership policy'));

        expect(onNavigateBack).toHaveBeenCalledWith();
    });

    test('should render name input', async () => {
        renderWithContext(<TeamPolicyEditor {...defaultProps}/>);

        await waitFor(() => {
            const nameInput = document.getElementById('input_policyName');
            expect(nameInput).toBeInTheDocument();
        });
    });

    test('should not show delete section for new policy', async () => {
        renderWithContext(<TeamPolicyEditor {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Access rules')).toBeInTheDocument();
        });
        expect(screen.queryByText('Delete policy')).not.toBeInTheDocument();
    });

    test('should show delete section for existing policy', async () => {
        const fetchPolicy = jest.fn().mockResolvedValue({
            data: {id: 'p1', name: 'Existing', rules: [{expression: 'true', actions: ['*']}]},
        });
        const searchChannels = jest.fn().mockResolvedValue({data: {total_count: 1}});
        renderWithContext(
            <TeamPolicyEditor
                {...defaultProps}
                policyId='p1'
                actions={{...defaultProps.actions, fetchPolicy, searchChannels}}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('Delete policy')).toBeInTheDocument();
        });
    });
});
