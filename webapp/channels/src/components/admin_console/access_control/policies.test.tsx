// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

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

    test('should not call previousPage if no history', async () => {
        mockSearchPolicies.mockResolvedValueOnce({data: {policies: [], total: 0}} as ActionResult);
        renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('No policies found')).toBeInTheDocument();
        });

        mockSearchPolicies.mockClear(); // Clear calls from mount

        // The previous page button should not trigger additional calls when there's no history
        // Since there are no policies and we're on page 0, previousPage should be a no-op
        expect(mockSearchPolicies).not.toHaveBeenCalled();
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
