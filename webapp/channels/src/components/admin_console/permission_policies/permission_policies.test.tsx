// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {renderWithContext, screen, within} from 'tests/react_testing_utils';

import PermissionPolicyList from './permission_policies';
import {AVAILABLE_ROLES, BOT_ROLE_KEY, getPolicyRoleKey, roleMessages, toServerRole} from './roles';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: jest.fn(),
    }),
}));

const SEARCH_BOT_EXPRESSION =
    '!user.isbot || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" &&\n' +
    'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon" &&\n' +
    'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h != "Public" &&\n' +
    'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr != "Phoenix" &&\n' +
    'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h != "Restricted"';

const SEARCH_MEMBER_EXPRESSION = 'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret"';

const BOT_PROPS = {bot_scope: true};

const makePolicy = (id: string, roles: string[] | undefined, expressions: string[], props?: AccessControlPolicy['props']): AccessControlPolicy => ({
    id,
    name: `Policy ${id}`,
    type: 'permission',
    roles,
    props,
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
        ['plain system_user policy', makePolicy('member', ['system_user'], [SEARCH_MEMBER_EXPRESSION]), 'Members'],
        ['flagged, ID-encoded, multi-line bot-prefixed policy', makePolicy('bot', ['system_user'], [SEARCH_BOT_EXPRESSION], BOT_PROPS), 'Bot accounts'],
        ['flagged policy with a plain rule', makePolicy('botplain', ['system_user'], [SEARCH_MEMBER_EXPRESSION], BOT_PROPS), 'Bot accounts'],
        ['flagged policy alongside other props', makePolicy('botextra', ['system_user'], [SEARCH_BOT_EXPRESSION], {...BOT_PROPS, child_ids: []}), 'Bot accounts'],
        ['bot-prefixed system_user policy without the flag', makePolicy('prefixed', ['system_user'], [SEARCH_BOT_EXPRESSION]), 'Members'],
        ['policy whose props set bot_scope to false', makePolicy('botfalse', ['system_user'], [SEARCH_BOT_EXPRESSION], {bot_scope: false}), 'Members'],
        ['policy mixing prefixed and unprefixed rules', makePolicy('mixed', ['system_user'], [SEARCH_BOT_EXPRESSION, SEARCH_MEMBER_EXPRESSION]), 'Members'],
        ['system_user policy with zero rules', makePolicy('norules', ['system_user'], []), 'Members'],
        ['guest policy', makePolicy('guest', ['system_guest'], [SEARCH_MEMBER_EXPRESSION]), 'Guest users'],
        ['admin policy', makePolicy('admin', ['system_admin'], [SEARCH_MEMBER_EXPRESSION]), 'System administrators'],
        ['admin policy with bot-prefixed rules', makePolicy('adminbot', ['system_admin'], [SEARCH_BOT_EXPRESSION]), 'System administrators'],
        ['guest policy with bot-prefixed rules', makePolicy('guestbot', ['system_guest'], [SEARCH_BOT_EXPRESSION]), 'Guest users'],
        ['unknown role', makePolicy('custom', ['custom_role'], [SEARCH_MEMBER_EXPRESSION]), 'custom_role'],
        ['undefined roles', makePolicy('none', undefined, [SEARCH_MEMBER_EXPRESSION]), 'None'],
        ['empty roles', makePolicy('empty', [], [SEARCH_MEMBER_EXPRESSION]), 'None'],
        ['undefined roles with bot-prefixed rules', makePolicy('nonebot', undefined, [SEARCH_BOT_EXPRESSION]), 'None'],
    ])('shows the role label for %s', async (_, policy, expected) => {
        renderWithPolicies([policy]);

        const row = await getRow(policy.name);

        expect(within(row).getByText(expected)).toBeInTheDocument();
    });

    test('shows Bot accounts instead of Members for a bot-scope policy and never renders the expression', async () => {
        renderWithPolicies([makePolicy('bot', ['system_user'], [SEARCH_BOT_EXPRESSION], BOT_PROPS)]);

        const row = await getRow('Policy bot');

        expect(within(row).getByText('Bot accounts')).toBeInTheDocument();
        expect(within(row).queryByText('Members')).not.toBeInTheDocument();
        expect(within(row).queryByText(/id_9f34/)).not.toBeInTheDocument();
        expect(within(row).queryByText(/user\.isbot/)).not.toBeInTheDocument();
    });

    test('resolves the role label per row when several policies are listed', async () => {
        renderWithPolicies([
            makePolicy('member', ['system_user'], [SEARCH_MEMBER_EXPRESSION]),
            makePolicy('bot', ['system_user'], [SEARCH_BOT_EXPRESSION], BOT_PROPS),
            makePolicy('mixed', ['system_user'], [SEARCH_BOT_EXPRESSION, SEARCH_MEMBER_EXPRESSION]),
            makePolicy('guest', ['system_guest'], [SEARCH_MEMBER_EXPRESSION]),
            makePolicy('admin', ['system_admin'], [SEARCH_MEMBER_EXPRESSION]),
        ]);

        const memberRow = await getRow('Policy member');
        const botRow = await getRow('Policy bot');
        const mixedRow = await getRow('Policy mixed');
        const guestRow = await getRow('Policy guest');
        const adminRow = await getRow('Policy admin');

        expect(within(memberRow).getByText('Members')).toBeInTheDocument();
        expect(within(memberRow).queryByText('Bot accounts')).not.toBeInTheDocument();

        expect(within(botRow).getByText('Bot accounts')).toBeInTheDocument();
        expect(within(botRow).queryByText('Members')).not.toBeInTheDocument();

        expect(within(mixedRow).getByText('Members')).toBeInTheDocument();
        expect(within(mixedRow).queryByText('Bot accounts')).not.toBeInTheDocument();

        expect(within(guestRow).getByText('Guest users')).toBeInTheDocument();
        expect(within(adminRow).getByText('System administrators')).toBeInTheDocument();

        expect(screen.getAllByText('Bot accounts')).toHaveLength(1);
        expect(screen.getAllByText('Members')).toHaveLength(2);
    });
});

describe('components/admin_console/permission_policies/roles', () => {
    test('AVAILABLE_ROLES pairs each role with its label and description messages, bot last', () => {
        expect(AVAILABLE_ROLES).toEqual([
            {value: 'system_guest', label: roleMessages.guestLabel, description: roleMessages.guestDescription},
            {value: 'system_user', label: roleMessages.memberLabel, description: roleMessages.memberDescription},
            {value: 'system_admin', label: roleMessages.adminLabel, description: roleMessages.adminDescription},
            {value: BOT_ROLE_KEY, label: roleMessages.botLabel, description: roleMessages.botDescription},
        ]);
    });

    test.each([
        [BOT_ROLE_KEY, 'system_user'],
        ['system_user', 'system_user'],
        ['system_guest', 'system_guest'],
        ['system_admin', 'system_admin'],
        ['custom_role', 'custom_role'],
    ])('toServerRole(%p) returns %p', (key, expected) => {
        expect(toServerRole(key)).toBe(expected);
    });

    test.each([
        ['an unflagged system_user policy', {roles: ['system_user']}, 'system_user'],
        ['a flagged system_user policy', {roles: ['system_user'], props: {bot_scope: true}}, BOT_ROLE_KEY],
        ['an unflagged system_user policy with a bot-prefixed rule', {roles: ['system_user'], rules: [{actions: [], expression: SEARCH_BOT_EXPRESSION}]}, 'system_user'],
        ['an unflagged policy whose first of several roles is system_user', {roles: ['system_user', 'system_admin']}, 'system_user'],
        ['an unflagged policy with no roles', {roles: undefined}, undefined],
    ])('getPolicyRoleKey for %s', (_, policy, expected) => {
        expect(getPolicyRoleKey(policy as Pick<AccessControlPolicy, 'roles' | 'props'>)).toBe(expected);
    });
});
