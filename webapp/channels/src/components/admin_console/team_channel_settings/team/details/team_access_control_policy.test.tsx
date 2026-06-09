// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {TeamAccessControl} from './team_access_control_policy';

const baseActions = {
    searchPolicies: jest.fn().mockResolvedValue({data: {policies: [], total: 0}}),
    onPolicyRemoveAll: jest.fn(),
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
    test('renders empty state with Link Policy button when no policies assigned', () => {
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[]}
                actions={baseActions}
            />,
        );

        expect(screen.getByText('Link to a policy')).toBeInTheDocument();
        expect(screen.queryByLabelText('Remove policy')).not.toBeInTheDocument();
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

    test('trash-icon Remove policy uses Button component (has btn class)', () => {
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[parentPolicy]}
                actions={baseActions}
            />,
        );

        const removeBtn = screen.getByLabelText('Remove policy');
        expect(removeBtn.tagName).toBe('BUTTON');
        expect(removeBtn).toHaveClass('policy-remove-icon');
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

    test('does not render auto-add section when onAutoAddToggle is not provided', () => {
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[parentPolicy]}
                actions={baseActions}
            />,
        );

        expect(screen.queryByTestId('auto-add-members-checkbox')).not.toBeInTheDocument();
    });

    test('renders auto-add checkbox when onAutoAddToggle is provided', () => {
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[parentPolicy]}
                autoAddMembers={false}
                onAutoAddToggle={jest.fn()}
                actions={baseActions}
            />,
        );

        expect(screen.getByTestId('auto-add-members-checkbox')).toBeInTheDocument();
        expect(screen.getByTestId('auto-add-members-checkbox')).not.toBeChecked();
    });

    test('auto-add checkbox reflects the autoAddMembers prop value', () => {
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[parentPolicy]}
                autoAddMembers={true}
                onAutoAddToggle={jest.fn()}
                actions={baseActions}
            />,
        );

        expect(screen.getByTestId('auto-add-members-checkbox')).toBeChecked();
    });

    test('clicking auto-add checkbox calls onAutoAddToggle with the inverted value', async () => {
        const onAutoAddToggle = jest.fn();
        renderWithContext(
            <TeamAccessControl
                parentPolicies={[parentPolicy]}
                autoAddMembers={false}
                onAutoAddToggle={onAutoAddToggle}
                actions={baseActions}
            />,
        );

        await userEvent.click(screen.getByTestId('auto-add-members-checkbox'));
        expect(onAutoAddToggle).toHaveBeenCalledWith(true);
    });
});
