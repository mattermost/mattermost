// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {TeamAccessControl} from './team_access_control_policy';

const baseActions = {
    searchPolicies: jest.fn().mockResolvedValue({data: {policies: [], total: 0}}),
    onPolicyRemove: jest.fn(),
};

const parentPolicy = {
    id: 'policy1',
    name: 'Engineering Policy',
    type: 'parent',
    rules: [],
    imports: [],
    active: false,
};

describe('TeamAccessControl', () => {
    test('renders empty state with Add policy button when no policies assigned', () => {
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[]}
                actions={baseActions}
            />,
        );

        expect(screen.getByText('Link to a policy')).toBeInTheDocument();
        expect(screen.queryByLabelText('Remove policy')).not.toBeInTheDocument();
    });

    test('renders Membership policies title', () => {
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[]}
                actions={baseActions}
            />,
        );

        expect(screen.getByText('Membership policies')).toBeInTheDocument();
    });

    test('renders policy row when a policy is assigned', () => {
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[parentPolicy]}
                actions={baseActions}
            />,
        );

        expect(screen.getByText('Engineering Policy')).toBeInTheDocument();
        expect(screen.getByLabelText('Remove policy')).toBeInTheDocument();
    });

    test('renders Add policy button when policies are assigned', () => {
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[parentPolicy]}
                actions={baseActions}
            />,
        );

        expect(screen.getByText('+ Add policy')).toBeInTheDocument();
    });

    test('trash-icon Remove policy is a plain button', () => {
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[parentPolicy]}
                actions={baseActions}
            />,
        );

        const removeBtn = screen.getByLabelText('Remove policy');
        expect(removeBtn.tagName).toBe('BUTTON');
    });

    test('clicking Remove policy calls onPolicyRemove with the policy id', async () => {
        const onPolicyRemove = jest.fn();
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[parentPolicy]}
                actions={{...baseActions, onPolicyRemove}}
            />,
        );

        await userEvent.click(screen.getByLabelText('Remove policy'));
        expect(onPolicyRemove).toHaveBeenCalledWith('policy1');
    });

    test('does not render auto-add checkbox in the policies panel', () => {
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[parentPolicy]}
                actions={baseActions}
            />,
        );

        expect(screen.queryByTestId('auto-add-members-checkbox')).not.toBeInTheDocument();
        expect(screen.queryByText('Auto-add members based on access rules')).not.toBeInTheDocument();
    });

    test('does not render auto-add checkbox in empty state', () => {
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[]}
                actions={baseActions}
            />,
        );

        expect(screen.queryByTestId('auto-add-members-checkbox')).not.toBeInTheDocument();
    });

    describe('pagination', () => {
        function makePolicies(count: number) {
            return Array.from({length: count}, (_, i) => ({
                id: `policy${i + 1}`,
                name: `Policy ${i + 1}`,
                type: 'parent',
                rules: [],
                imports: [],
                active: false,
            }));
        }

        test('shows first 10 policies with count "1 - 10 of 12" when 12 policies are assigned', () => {
            renderWithContext(
                <TeamAccessControl
                    parentPolicies={makePolicies(12)}
                    actions={baseActions}
                />,
            );

            expect(screen.getByText('1 - 10 of 12')).toBeInTheDocument();
            expect(screen.getByText('Policy 1')).toBeInTheDocument();
            expect(screen.getByText('Policy 10')).toBeInTheDocument();
            expect(screen.queryByText('Policy 11')).not.toBeInTheDocument();
        });

        test('previous page button is disabled and next page enabled on first page', () => {
            renderWithContext(
                <TeamAccessControl
                    parentPolicies={makePolicies(12)}
                    actions={baseActions}
                />,
            );

            expect(screen.getByLabelText('Previous page')).toBeDisabled();
            expect(screen.getByLabelText('Next page')).not.toBeDisabled();
        });

        test('navigating to next page shows remaining policies with updated count', async () => {
            renderWithContext(
                <TeamAccessControl
                    parentPolicies={makePolicies(12)}
                    actions={baseActions}
                />,
            );

            await userEvent.click(screen.getByLabelText('Next page'));

            expect(screen.getByText('11 - 12 of 12')).toBeInTheDocument();
            expect(screen.getByText('Policy 11')).toBeInTheDocument();
            expect(screen.getByText('Policy 12')).toBeInTheDocument();
            expect(screen.queryByText('Policy 1')).not.toBeInTheDocument();
        });

        test('next page button is disabled on last page', async () => {
            renderWithContext(
                <TeamAccessControl
                    parentPolicies={makePolicies(12)}
                    actions={baseActions}
                />,
            );

            await userEvent.click(screen.getByLabelText('Next page'));

            expect(screen.getByLabelText('Next page')).toBeDisabled();
            expect(screen.getByLabelText('Previous page')).not.toBeDisabled();
        });
    });
});
