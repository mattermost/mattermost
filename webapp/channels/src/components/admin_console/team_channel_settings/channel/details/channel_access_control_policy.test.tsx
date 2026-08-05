// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {ChannelAccessControl} from './channel_access_control_policy';

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

describe('ChannelAccessControl', () => {
    test('renders empty state with Link Policy button when no policies assigned', () => {
        renderWithContext(
            <ChannelAccessControl
                parentPolicies={[]}
                actions={baseActions}
            />,
        );

        expect(screen.getByText('Link to a policy')).toBeInTheDocument();
        expect(screen.queryByLabelText('Remove policy')).not.toBeInTheDocument();
    });

    test('renders policy row when a policy is assigned', () => {
        renderWithContext(
            <ChannelAccessControl
                parentPolicies={[parentPolicy]}
                actions={baseActions}
            />,
        );

        expect(screen.getByText('Engineering Policy')).toBeInTheDocument();
        expect(screen.getByLabelText('Remove policy')).toBeInTheDocument();
    });

    test('trash-icon Remove policy uses Button component (has btn class)', () => {
        renderWithContext(
            <ChannelAccessControl
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
            <ChannelAccessControl
                parentPolicies={[parentPolicy]}
                actions={{...baseActions, onPolicyRemove}}
            />,
        );

        await userEvent.click(screen.getByLabelText('Remove policy'));
        expect(onPolicyRemove).toHaveBeenCalledWith('policy1');
    });
});
