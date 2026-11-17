// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

import ScopedConfigurationList from './scoped_configuration';

const mockPush = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn(() => ({
        push: mockPush,
    })),
}));

const makePolicy = (
    id: string,
    roles: string[],
    rules: Array<{actions: string[]; expression: string; value?: string}>,
): AccessControlPolicy => ({
    id,
    name: `Policy ${id}`,
    type: 'system_setting',
    roles,
    rules,
});

describe('components/admin_console/scoped_configuration/ScopedConfigurationList', () => {
    const mockSearchPolicies = jest.fn();
    const mockDeletePolicy = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getHistory).mockReturnValue({push: mockPush} as unknown as ReturnType<typeof getHistory>);
    });

    test('renders policies with role labels and formatted configuration values', async () => {
        const policies = [
            makePolicy('fin', ['system_user'], [{
                actions: ['MobileEnableBiometrics'],
                expression: 'user.attributes.dept == "finance"',
                value: 'true',
            }]),
            makePolicy('mdm', ['system_admin'], [{
                actions: ['MobileEnableBiometrics'],
                expression: 'user.session.hardware_id == "mdm"',
                value: 'false',
            }]),
        ];
        mockSearchPolicies.mockResolvedValue({data: {policies, total: 2}} as ActionResult);

        renderWithContext(
            <ScopedConfigurationList
                actions={{
                    searchPolicies: mockSearchPolicies,
                    deletePolicy: mockDeletePolicy,
                }}
            />,
        );

        const finCell = await screen.findByText('Policy fin');
        const finRow = finCell.closest('.DataGrid_row') as HTMLElement;
        expect(within(finRow).getByText('Members')).toBeInTheDocument();
        expect(within(finRow).getByText('Enable Biometric Authentication: True')).toBeInTheDocument();

        const mdmCell = screen.getByText('Policy mdm');
        const mdmRow = mdmCell.closest('.DataGrid_row') as HTMLElement;
        expect(within(mdmRow).getByText('System administrators')).toBeInTheDocument();
        expect(within(mdmRow).getByText('Enable Biometric Authentication: False')).toBeInTheDocument();

        await userEvent.click(finRow);
        expect(mockPush).toHaveBeenCalledWith('/admin_console/system_attributes/scoped_configuration/edit_policy/fin');
    });

    test('navigates to new policy editor when Add policy is clicked', async () => {
        mockSearchPolicies.mockResolvedValue({data: {policies: [], total: 0}} as ActionResult);

        renderWithContext(
            <ScopedConfigurationList
                actions={{
                    searchPolicies: mockSearchPolicies,
                    deletePolicy: mockDeletePolicy,
                }}
            />,
        );

        await screen.findByText('No scoped configuration policies found');
        await userEvent.click(screen.getByRole('button', {name: 'Add policy'}));

        expect(mockPush).toHaveBeenCalledWith('/admin_console/system_attributes/scoped_configuration/edit_policy');
    });
});
