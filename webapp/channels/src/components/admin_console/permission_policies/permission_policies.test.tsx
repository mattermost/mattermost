// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {renderWithContext, screen, within} from 'tests/react_testing_utils';

import PermissionPolicyList from './permission_policies';
import {AVAILABLE_ROLES, roleMessages} from './roles';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: jest.fn(),
    }),
}));

const SEARCH_MEMBER_EXPRESSION = 'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret"';

const makePolicy = (id: string, roles: string[] | undefined, expressions: string[]): AccessControlPolicy => ({
    id,
    name: `Policy ${id}`,
    type: 'permission',
    roles,
    rules: expressions.map((expression) => ({actions: ['upload_file_attachment'], expression})),
} as AccessControlPolicy);

describe('components/admin_console/permission_policies/PermissionPolicyList', () => {
    const mockSearchPolicies = jest.fn();
    const mockDeletePolicy = jest.fn();
    const defaultProps = {
        actions: {
            searchPolicies: mockSearchPolicies,
            deletePolicy: mockDeletePolicy,
        },
    };

    const renderWithPolicies = (policies: AccessControlPolicy[]) => {
        mockSearchPolicies.mockResolvedValue({data: {policies, total: policies.length}} as ActionResult);
        return renderWithContext(<PermissionPolicyList {...defaultProps}/>);
    };

    const getRow = async (name: string) => {
        const cell = await screen.findByText(name);
        return cell.closest('.DataGrid_row') as HTMLElement;
    };

    beforeEach(() => {
        mockSearchPolicies.mockReset();
        mockDeletePolicy.mockReset();
    });

    test.each([
        ['system_user policy', makePolicy('member', ['system_user'], [SEARCH_MEMBER_EXPRESSION]), 'Members'],
        ['system_bot policy', makePolicy('bot', ['system_bot'], [SEARCH_MEMBER_EXPRESSION]), 'Bot accounts'],
        ['system_bot policy with zero rules', makePolicy('botnorules', ['system_bot'], []), 'Bot accounts'],
        ['policy whose first of several roles is system_bot', makePolicy('botfirst', ['system_bot', 'system_user'], [SEARCH_MEMBER_EXPRESSION]), 'Bot accounts'],
        ['system_user policy with zero rules', makePolicy('norules', ['system_user'], []), 'Members'],
        ['guest policy', makePolicy('guest', ['system_guest'], [SEARCH_MEMBER_EXPRESSION]), 'Guest users'],
        ['admin policy', makePolicy('admin', ['system_admin'], [SEARCH_MEMBER_EXPRESSION]), 'System administrators'],
        ['unknown role', makePolicy('custom', ['custom_role'], [SEARCH_MEMBER_EXPRESSION]), 'custom_role'],
        ['undefined roles', makePolicy('none', undefined, [SEARCH_MEMBER_EXPRESSION]), 'None'],
        ['empty roles', makePolicy('empty', [], [SEARCH_MEMBER_EXPRESSION]), 'None'],
    ])('shows the role label for %s', async (_, policy, expected) => {
        renderWithPolicies([policy]);

        const row = await getRow(policy.name);

        expect(within(row).getByText(expected)).toBeInTheDocument();
    });

    test('shows Bot accounts instead of Members for a system_bot policy and never renders the expression', async () => {
        renderWithPolicies([makePolicy('bot', ['system_bot'], [SEARCH_MEMBER_EXPRESSION])]);

        const row = await getRow('Policy bot');

        expect(within(row).getByText('Bot accounts')).toBeInTheDocument();
        expect(within(row).queryByText('Members')).not.toBeInTheDocument();
        expect(within(row).queryByText(/id_9f34/)).not.toBeInTheDocument();
    });

    test('resolves the role label per row when several policies are listed', async () => {
        renderWithPolicies([
            makePolicy('member', ['system_user'], [SEARCH_MEMBER_EXPRESSION]),
            makePolicy('bot', ['system_bot'], [SEARCH_MEMBER_EXPRESSION]),
            makePolicy('guest', ['system_guest'], [SEARCH_MEMBER_EXPRESSION]),
            makePolicy('admin', ['system_admin'], [SEARCH_MEMBER_EXPRESSION]),
        ]);

        const memberRow = await getRow('Policy member');
        const botRow = await getRow('Policy bot');
        const guestRow = await getRow('Policy guest');
        const adminRow = await getRow('Policy admin');

        expect(within(memberRow).getByText('Members')).toBeInTheDocument();
        expect(within(memberRow).queryByText('Bot accounts')).not.toBeInTheDocument();

        expect(within(botRow).getByText('Bot accounts')).toBeInTheDocument();
        expect(within(botRow).queryByText('Members')).not.toBeInTheDocument();

        expect(within(guestRow).getByText('Guest users')).toBeInTheDocument();
        expect(within(adminRow).getByText('System administrators')).toBeInTheDocument();

        expect(screen.getAllByText('Bot accounts')).toHaveLength(1);
        expect(screen.getAllByText('Members')).toHaveLength(1);
    });
});

describe('components/admin_console/permission_policies/roles', () => {
    test('AVAILABLE_ROLES pairs each role with its label and description messages, guest then bot last', () => {
        expect(AVAILABLE_ROLES).toEqual([
            {value: 'system_user', label: roleMessages.memberLabel, description: roleMessages.memberDescription},
            {value: 'system_admin', label: roleMessages.adminLabel, description: roleMessages.adminDescription},
            {value: 'system_guest', label: roleMessages.guestLabel, description: roleMessages.guestDescription},
            {value: 'system_bot', label: roleMessages.botLabel, description: roleMessages.botDescription},
        ]);
    });

    test('role messages use the role value in their ids', () => {
        for (const role of AVAILABLE_ROLES) {
            expect(role.label.id).toBe(`admin.permission_policies.role.${role.value}.label`);
            expect(role.description.id).toBe(`admin.permission_policies.role.${role.value}.description`);
        }
    });
});
