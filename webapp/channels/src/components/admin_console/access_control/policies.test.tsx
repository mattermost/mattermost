// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PolicyList from './policies';

const mockHistoryPushInternal = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: mockHistoryPushInternal,
    }),
}));

describe('components/admin_console/access_control/PolicyList', () => {
    const mockSearchPolicies = jest.fn();
    const mockDeletePolicy = jest.fn();
    const defaultProps = {
        actions: {
            searchPolicies: mockSearchPolicies,
            deletePolicy: mockDeletePolicy,
        },
    };

    beforeEach(() => {
        mockSearchPolicies.mockReset();
        mockDeletePolicy.mockReset();
        mockHistoryPushInternal.mockReset();
    });

    test('should match snapshot with no policies', async () => {
        mockSearchPolicies.mockResolvedValue({data: {policies: [], total: 0}} as ActionResult);
        const {container} = renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('No policies found')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with policies', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [
                    {id: 'policy1', name: 'Policy 1'} as AccessControlPolicy,
                    {id: 'policy2', name: 'Policy 2'} as AccessControlPolicy,
                ],
                total: 2,
            },
        } as ActionResult);
        const {container} = renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Policy 1')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with search error', async () => {
        mockSearchPolicies.mockRejectedValue(new Error('Search failed'));
        const {container} = renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Something went wrong. Try again')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should not call searchPolicies when clicking previous page on the first page', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [
                    {id: 'policy1', name: 'Policy 1'} as AccessControlPolicy,
                    {id: 'policy2', name: 'Policy 2'} as AccessControlPolicy,
                ],
                total: 2,
            },
        } as ActionResult);
        renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Policy 1')).toBeInTheDocument();
        });

        mockSearchPolicies.mockClear();

        const prevButton = screen.getByRole('button', {name: 'Previous page'});
        await userEvent.click(prevButton);

        expect(mockSearchPolicies).not.toHaveBeenCalled();
    });

    test('should hide delete menu item when hideDeleteAction is true', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [
                    {id: 'policy1', name: 'Policy 1', props: {child_ids: ['ch1']}} as unknown as AccessControlPolicy,
                ],
                total: 1,
            },
        } as ActionResult);
        renderWithContext(
            <PolicyList
                {...defaultProps}
                hideDeleteAction={true}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('Policy 1')).toBeInTheDocument();
        });

        // Open the three-dot menu
        const menuButton = document.getElementById('policy-menu-policy1')!;
        await userEvent.click(menuButton);

        // Edit should be present, Delete should not
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });

    test('should show delete menu item by default', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [
                    {id: 'policy1', name: 'Policy 1', props: {child_ids: ['ch1']}} as unknown as AccessControlPolicy,
                ],
                total: 1,
            },
        } as ActionResult);
        renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Policy 1')).toBeInTheDocument();
        });

        // Open the three-dot menu
        const menuButton = document.getElementById('policy-menu-policy1')!;
        await userEvent.click(menuButton);

        // Both Edit and Delete should be present
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    test('should get columns correctly', async () => {
        mockSearchPolicies.mockResolvedValue({data: {policies: [], total: 0}} as ActionResult);
        renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('No policies found')).toBeInTheDocument();
        });

        // Verify column headers are rendered
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Applies to')).toBeInTheDocument();
    });
});
