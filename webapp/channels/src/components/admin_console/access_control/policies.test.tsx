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

    test('Edit menu item should navigate to membership policy editor', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [
                    {id: 'policy1', name: 'Policy 1'} as AccessControlPolicy,
                ],
                total: 1,
            },
        } as ActionResult);
        renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Policy 1')).toBeInTheDocument();
        });

        const menuButton = document.getElementById('policy-menu-policy1')!;
        await userEvent.click(menuButton);
        const editItem = document.getElementById('policy-menu-edit-policy1')!;
        await userEvent.click(editItem);

        await waitFor(() => {
            expect(mockHistoryPushInternal).toHaveBeenCalledWith('/admin_console/system_attributes/membership_policies/edit_policy/policy1');
        });
    });

    test('Delete menu item is disabled when a policy contains masked values', async () => {
        // The "--------" sentinel in a rule expression means the caller can't
        // see at least one referenced value. Server enforces a 403 on delete
        // in that case, so the menu item must be disabled to avoid a useless
        // confirmation modal → 403 round-trip.
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [{
                    id: 'masked-policy',
                    name: 'Masked Policy',
                    rules: [{actions: ['*'], expression: 'user.attributes.program in ["Alpha", "--------"]'}],
                } as unknown as AccessControlPolicy],
                total: 1,
            },
        } as ActionResult);
        renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Masked Policy')).toBeInTheDocument();
        });

        const menuButton = document.getElementById('policy-menu-masked-policy')!;
        await userEvent.click(menuButton);

        const deleteItem = document.getElementById('policy-menu-delete-masked-policy')!;
        expect(deleteItem).toHaveAttribute('aria-disabled', 'true');
    });

    test('Delete menu item is enabled for a clean policy with no channels', async () => {
        // Sanity: a policy that has neither child channels nor masked values
        // must keep Delete enabled.
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [{
                    id: 'clean-policy',
                    name: 'Clean Policy',
                    rules: [{actions: ['*'], expression: 'user.attributes.program in ["Alpha"]'}],
                } as unknown as AccessControlPolicy],
                total: 1,
            },
        } as ActionResult);
        renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Clean Policy')).toBeInTheDocument();
        });

        const menuButton = document.getElementById('policy-menu-clean-policy')!;
        await userEvent.click(menuButton);

        const deleteItem = document.getElementById('policy-menu-delete-clean-policy')!;
        expect(deleteItem).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('Delete confirmation modal no longer surfaces the masked-values warning', async () => {
        // The inner-modal "This policy contains restricted values" notice was
        // removed once we started disabling the Delete menu item upstream.
        // Open the modal on a clean policy and assert the warning text is gone.
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [{
                    id: 'clean-policy',
                    name: 'Clean Policy',
                    rules: [{actions: ['*'], expression: 'user.attributes.program in ["Alpha"]'}],
                } as unknown as AccessControlPolicy],
                total: 1,
            },
        } as ActionResult);
        renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Clean Policy')).toBeInTheDocument();
        });

        const menuButton = document.getElementById('policy-menu-clean-policy')!;
        await userEvent.click(menuButton);
        await userEvent.click(screen.getByText('Delete'));

        await waitFor(() => {
            expect(screen.getByText('Confirm Policy Deletion')).toBeInTheDocument();
        });
        expect(screen.queryByText(/This policy includes attribute values that are hidden from you/)).not.toBeInTheDocument();
        expect(screen.queryByText('This policy contains restricted values')).not.toBeInTheDocument();
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

    test('Applies to renders both channel and team counts', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [{
                    id: 'policy1',
                    name: 'Policy 1',
                    props: {child_ids: ['c1', 'c2', 'c3', 't1', 't2'], channel_count: 3, team_count: 2},
                } as unknown as AccessControlPolicy],
                total: 1,
            },
        } as ActionResult);
        renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Policy 1')).toBeInTheDocument();
        });

        // The channel and team counts render as sibling text nodes in one cell,
        // so assert on the cell's combined text rather than a single element.
        const cell = document.getElementById('customAppliedTo-policy1')!;
        expect(cell).toHaveTextContent('3 channels');
        expect(cell).toHaveTextContent('2 teams');
    });

    test('Applies to omits the team side when team_count is zero', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [{
                    id: 'policy1',
                    name: 'Policy 1',
                    props: {child_ids: ['c1', 'c2'], channel_count: 2, team_count: 0},
                } as unknown as AccessControlPolicy],
                total: 1,
            },
        } as ActionResult);
        renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Policy 1')).toBeInTheDocument();
        });

        // Scope to the policy's "Applies to" cell — the page text elsewhere contains
        // the word "team", so a global matcher false-positives.
        const cell = document.getElementById('customAppliedTo-policy1')!;
        expect(cell).toHaveTextContent('2 channels');
        expect(cell).not.toHaveTextContent('team');
    });

    test('Applies to omits the channel side when channel_count is zero', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [{
                    id: 'policy1',
                    name: 'Policy 1',
                    props: {child_ids: ['t1', 't2', 't3'], channel_count: 0, team_count: 3},
                } as unknown as AccessControlPolicy],
                total: 1,
            },
        } as ActionResult);
        renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Policy 1')).toBeInTheDocument();
        });

        // Scope to the policy's "Applies to" cell — the page description text
        // also contains the word "channels", so a global matcher false-positives.
        const cell = document.getElementById('customAppliedTo-policy1')!;
        expect(cell).toHaveTextContent('3 teams');
        expect(cell).not.toHaveTextContent('channel');
    });

    test('Applies to shows None when both counts are zero', async () => {
        mockSearchPolicies.mockResolvedValue({
            data: {
                policies: [{
                    id: 'policy1',
                    name: 'Policy 1',
                    props: {child_ids: [], channel_count: 0, team_count: 0},
                } as unknown as AccessControlPolicy],
                total: 1,
            },
        } as ActionResult);
        renderWithContext(<PolicyList {...defaultProps}/>);
        await waitFor(() => {
            expect(screen.getByText('Policy 1')).toBeInTheDocument();
        });

        expect(screen.getByText('None')).toBeInTheDocument();
    });

    test('selecting a policy reports its active flag so callers can seed auto-add', async () => {
        const onPolicySelected = jest.fn();
        const policies = [
            {id: 'policy1', name: 'Policy 1', active: true} as AccessControlPolicy,
            {id: 'policy2', name: 'Policy 2', active: false} as AccessControlPolicy,
        ];
        mockSearchPolicies.mockResolvedValue({data: {policies, total: 2}} as ActionResult);
        renderWithContext(
            <PolicyList
                {...defaultProps}
                simpleMode={true}
                onPolicySelected={onPolicySelected}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('Policy 1')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText('Policy 1'));
        expect(onPolicySelected).toHaveBeenCalledWith(policies[0], true);
    });
});
