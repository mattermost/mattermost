// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PermissionPolicyDetails from './permission_policy_details';
import {
    BOT_C_RETURNED,
    BOT_C_UNWRAPPED,
    BOT_PROPS,
    E,
    LDAP_TEAMS,
    MockedCELEditor,
    MockedTableEditor,
    NATIVE_FIELDS,
    SERVER_PREFIXED_E,
    baseProps,
    customField,
    lastCELProps,
    lastTableProps,
    mockFetchPolicy,
    mockUseEnabledSessionAttributeFields,
    renderBotPolicy,
    renderWithExpression,
    renderWithPolicy,
    selectScope,
    selectorText,
    setUpPolicyDetailsMocks,
    switchToAdvanced,
    useFields,
} from './test_utils';

import {wrapBotExpression} from '../../access_control/bot_scope';

const mockHistoryPush = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: mockHistoryPush}),
}));

jest.mock('hooks/useEnabledSessionAttributeFields', () => ({
    useEnabledSessionAttributeFields: jest.fn(() => []),
}));

// Render the editors as identifiable stand-ins. The real CELEditor boots
// Monaco (unavailable in JSDOM) and the real TableEditor parses CEL via an
// async action, neither of which is relevant here: these tests assert which
// editor the parent chooses on load. The shared isSimpleExpression helper is
// intentionally left unmocked so the real classification runs.
jest.mock('../../access_control/editors/table_editor/table_editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'table-editor'}));
});

jest.mock('../../access_control/editors/cel_editor/editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'cel-editor'}));
});

jest.mock('components/admin_console/access_control/modals/simulate_access/simulate_access_modal', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'simulate-modal'}));
});

jest.mock('hooks/useChannelAccessControlActions', () => ({
    useChannelAccessControlActions: jest.fn(),
}));

describe('components/admin_console/permission_policies/policy_details/PermissionPolicyDetails load', () => {
    let checkExpressionSpy: jest.SpyInstance;

    beforeEach(() => {
        checkExpressionSpy = setUpPolicyDetailsMocks();
    });

    afterEach(() => {
        checkExpressionSpy.mockRestore();
        jest.clearAllMocks();
    });

    const BOT_A_RETURNED = '!user.isbot || user.attributes.Clearance == "Secret" && user.attributes.Program == "Dragon" &&\nuser.attributes.Clearance != "Public" && user.attributes.Program != "Phoenix" &&\nuser.attributes.Clearance != "Restricted"';
    const BOT_A_UNWRAPPED = 'user.attributes.Clearance == "Secret" && user.attributes.Program == "Dragon" &&\nuser.attributes.Clearance != "Public" && user.attributes.Program != "Phoenix" &&\nuser.attributes.Clearance != "Restricted"';
    const BOT_D1_RETURNED = '!user.isbot || "a" in user.attributes.Tags || "b" in user.attributes.Tags';
    const D1_UNWRAPPED = '"a" in user.attributes.Tags || "b" in user.attributes.Tags';
    const HAS_ANY_OF = '"a" in user.attributes.teams || "b" in user.attributes.teams';
    const BOT_HELP_TEXT = 'Each row is a single condition that must be met for a bot to comply with the policy. All rules are combined with logical AND operator (`&&`).';
    const BOT_EMPTY_STATE_TEXT = 'Select a bot attribute and values to create a rule';
    const CPA_EMAIL = customField('cpa-email', 'email', {managed: 'admin', display_name: 'Work email'});

    const nativeCELNames = () => lastCELProps().userAttributes.filter((a) => a.isNative).map((a) => a.attribute);

    describe('load failure', () => {
        test('shows the load failure and hides the editor when fetchPolicy errors, even with a store-copy policy prop', async () => {
            mockFetchPolicy.mockResolvedValue({error: {message: 'failed'}});

            renderWithContext(
                <PermissionPolicyDetails
                    {...baseProps}
                    policy={{
                        id: 'policy1',
                        name: 'Policy 1',
                        roles: ['system_user'],
                        rules: [{actions: ['download_file_attachment'], expression: 'user.attributes.teams == "engineering"'}],
                        type: 'permission',
                    }}
                />,
            );

            expect(await screen.findByText('Failed to load policy')).toBeInTheDocument();
            expect(screen.getByText('failed')).toBeInTheDocument();
            expect(screen.queryByTestId('table-editor')).not.toBeInTheDocument();
            expect(screen.queryByTestId('cel-editor')).not.toBeInTheDocument();
        });
    });

    describe('editor attributes', () => {
        test('merges the fetched enabled session attributes into the table-mode picker', async () => {
            renderWithContext(<PermissionPolicyDetails {...baseProps}/>);

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            expect(mockUseEnabledSessionAttributeFields).toHaveBeenCalledWith(true);

            const lastCall = MockedTableEditor.mock.calls[MockedTableEditor.mock.calls.length - 1][0];
            const passedNames = lastCall.userAttributes.map((attr) => attr.name);
            expect(passedNames).toContain('department');
            expect(passedNames).toContain('network_name');
        });

        test('includes session attributes in CEL mode even when user-managed attributes are disabled, carrying the object type', async () => {
            renderWithContext(<PermissionPolicyDetails {...baseProps}/>);

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            await userEvent.click(screen.getByText('Switch to Advanced Mode'));

            await waitFor(() => {
                expect(screen.getByTestId('cel-editor')).toBeInTheDocument();
            });

            const lastCall = MockedCELEditor.mock.calls[MockedCELEditor.mock.calls.length - 1][0];
            const sessionEntry = lastCall.userAttributes.find((attr) => attr.attribute === 'network_name');
            expect(sessionEntry).toBeDefined();
            expect(sessionEntry?.objectType).toBe('session');
        });

        test('shows no session attributes when SessionAttributes is off', async () => {
            mockUseEnabledSessionAttributeFields.mockReturnValue([]);

            renderWithContext(
                <PermissionPolicyDetails
                    {...baseProps}
                    sessionAttributesEnabled={false}
                />,
            );

            await waitFor(() => {
                expect(screen.getByTestId('table-editor')).toBeInTheDocument();
            });

            expect(mockUseEnabledSessionAttributeFields).toHaveBeenCalledWith(false);

            const lastCall = MockedTableEditor.mock.calls[MockedTableEditor.mock.calls.length - 1][0];
            const passedNames = lastCall.userAttributes.map((attr) => attr.name);
            expect(passedNames).toEqual(['teams', 'department']);
        });

        test('the table editor gets every field in Bot accounts and hides the built-ins only from its picker', async () => {
            useFields([...NATIVE_FIELDS, CPA_EMAIL, LDAP_TEAMS]);
            renderBotPolicy([wrapBotExpression(E)]);
            await screen.findByTestId('table-editor');

            expect(lastTableProps().hiddenPickerAttributeNames).toEqual(['email', 'verified', 'isbot']);
            expect(lastTableProps().userAttributes.map((a) => a.id)).toEqual(expect.arrayContaining([
                'native_user_attribute_email', 'native_user_attribute_isbot', 'native_user_attribute_verified', 'cpa-email',
            ]));
        });

        test('CEL autocomplete drops the native built-ins in Bot accounts but keeps the custom email and session fields', async () => {
            useFields([...NATIVE_FIELDS, CPA_EMAIL, LDAP_TEAMS]);
            renderBotPolicy([wrapBotExpression(E)]);
            await screen.findByTestId('table-editor');
            await switchToAdvanced();

            const attrs = lastCELProps().userAttributes;
            expect(nativeCELNames()).toEqual(['createat']);
            expect(attrs.filter((a) => a.attribute === 'email')).toEqual([expect.objectContaining({attribute: 'email', isNative: false})]);
            expect(attrs.map((a) => a.attribute)).toEqual(expect.arrayContaining(['teams', 'network_name']));
            expect(attrs.find((a) => a.attribute === 'network_name')?.objectType).toBe('session');
        });

        test('CEL autocomplete keeps every built-in in Members', async () => {
            useFields([...NATIVE_FIELDS, CPA_EMAIL, LDAP_TEAMS]);
            renderWithExpression(E);
            await screen.findByTestId('table-editor');
            await switchToAdvanced();

            expect(nativeCELNames()).toEqual(['email', 'verified', 'isbot', 'createat']);
        });

        test('a scope switch while in CEL mode re-filters in both directions', async () => {
            useFields([...NATIVE_FIELDS, CPA_EMAIL, LDAP_TEAMS]);
            renderWithExpression(E);
            await screen.findByTestId('table-editor');
            await switchToAdvanced();

            await selectScope('pp-role-option-bot');
            expect(nativeCELNames()).toEqual(['createat']);

            await selectScope('pp-role-option-system_user');
            expect(nativeCELNames()).toEqual(['email', 'verified', 'isbot', 'createat']);
        });
    });

    describe('editor mode', () => {
        // MM-69527: editing an existing rule must default to Simple (table) mode
        // for every expression the simple editor can represent. The two named
        // cases below are the original regression: a parenthesized multiselect
        // "has any of" OR-group and a ranked-operator condition were misclassified
        // as complex by a stale local helper and forced the editor into Advanced
        // mode.
        test('opens a multiselect "has any of" group in Simple mode (MM-69527)', async () => {
            renderWithExpression('user.attributes.department == "engineering" && ("engineering" in user.attributes.teams || "sales" in user.attributes.teams)');

            expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
            expect(screen.queryByTestId('cel-editor')).not.toBeInTheDocument();
            expect(screen.getByText('Switch to Advanced Mode')).toBeInTheDocument();
        });

        test('opens a ranked-operator rule in Simple mode (MM-69527)', async () => {
            renderWithExpression('user.attributes.level >= "Senior"');

            expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
            expect(screen.queryByTestId('cel-editor')).not.toBeInTheDocument();
            expect(screen.getByText('Switch to Advanced Mode')).toBeInTheDocument();
        });

        describe('opens simple expressions in Simple (table) mode', () => {
            const simpleExpressions: Array<[string, string]> = [
                ['empty expression (new rule)', ''],
                ['equality', 'user.attributes.teams == "engineering"'],
                ['inequality', 'user.attributes.teams != "engineering"'],
                ['ranked is at most (<=)', 'user.attributes.level <= "Senior"'],
                ['ranked greater than (>)', 'user.attributes.level > "Junior"'],
                ['ranked less than (<)', 'user.attributes.level < "Lead"'],
                ['has all of (&&-joined "in")', '"engineering" in user.attributes.teams && "sales" in user.attributes.teams'],
                ['attribute in list', 'user.attributes.teams in ["engineering", "sales"]'],
                ['startsWith', 'user.attributes.email.startsWith("admin")'],
                ['endsWith', 'user.attributes.email.endsWith("@acme.com")'],
                ['contains', 'user.attributes.email.contains("acme")'],

                // MM-64357: values containing a quote character must stay simple so
                // reopening the policy lands in Simple mode instead of trapping the
                // admin in Advanced mode. These affect the Permission Policy surface
                // too, since it shares isSimpleExpression with the Membership editor.
                ['equality with an apostrophe value (MM-64357)', 'user.attributes.department == "Matt\'s Department"'],
                ['in-list with apostrophe values (MM-64357)', 'user.attributes.teams in ["Matt\'s", "sales"]'],
                ['multiselect "has any of" apostrophe group (MM-64357)', '("Matt\'s" in user.attributes.teams || "sales" in user.attributes.teams)'],
            ];

            test.each(simpleExpressions)('%s', async (_label, expression) => {
                renderWithExpression(expression);

                expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
                expect(screen.queryByTestId('cel-editor')).not.toBeInTheDocument();
            });
        });

        describe('opens complex expressions in Advanced (CEL) mode', () => {
            const complexExpressions: Array<[string, string]> = [
                ['top-level OR of equalities', 'user.attributes.a == "x" || user.attributes.b == "y"'],
                ['parenthesized OR of equalities', 'user.attributes.a == "x" && (user.attributes.b == "y" || user.attributes.c == "z")'],
                ['has-any-of group without parens followed by &&', '"a" in user.attributes.teams || "b" in user.attributes.teams && user.attributes.level == "Senior"'],
            ];

            test.each(complexExpressions)('%s', async (_label, expression) => {
                renderWithExpression(expression);

                expect(await screen.findByTestId('cel-editor')).toBeInTheDocument();
                expect(screen.queryByTestId('table-editor')).not.toBeInTheDocument();
            });
        });

        test('a Members has-any-of group without parens opens in table mode', async () => {
            renderWithExpression(HAS_ANY_OF);

            expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
            expect(lastTableProps().value).toBe(HAS_ANY_OF);
        });

        test('a has-any-of group without parens can switch from CEL to table', async () => {
            renderWithExpression('');
            await screen.findByTestId('table-editor');

            await userEvent.click(screen.getByText('Switch to Advanced Mode'));
            await screen.findByTestId('cel-editor');
            await act(() => lastCELProps().onChange(HAS_ANY_OF));

            const toggle = screen.getByText('Switch to Simple Mode').closest('button')!;
            expect(toggle).toBeEnabled();
            await userEvent.click(toggle);

            expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
            expect(lastTableProps().value).toBe(HAS_ANY_OF);
        });
    });

    describe('role detection', () => {
        test('lists the four scopes with Guest users second to last and Bot accounts last', async () => {
            renderWithExpression(E);
            await screen.findByTestId('table-editor');

            await userEvent.click(document.querySelector('#pp-role-selector-btn')!);

            expect(screen.getAllByRole('menuitem').map((el) => el.id)).toEqual([
                'pp-role-option-system_user',
                'pp-role-option-system_admin',
                'pp-role-option-system_guest',
                'pp-role-option-bot',
            ]);
            expect(screen.getByText('Applies only to bot accounts')).toBeInTheDocument();
        });

        test('seeds Bot accounts from a store-copy bot policy without waiting for fetchPolicy', async () => {
            renderWithContext(
                <PermissionPolicyDetails
                    {...baseProps}
                    policyId={undefined}
                    policy={{id: 'policy1', name: 'Policy 1', type: 'permission', roles: ['system_user'], props: BOT_PROPS, rules: []}}
                />,
            );
            await screen.findByTestId('table-editor');

            expect(mockFetchPolicy).not.toHaveBeenCalled();
            expect(selectorText()).toContain('Bot accounts');
        });

        test('a wrapped && chain selects Bot accounts and opens the unwrapped rule in table mode', async () => {
            renderBotPolicy([BOT_A_RETURNED]);

            expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
            expect(lastTableProps().value).toBe(BOT_A_UNWRAPPED);
            expect(selectorText()).toContain('Bot accounts');
        });

        test('a wrapped has-any-of group without parens opens in table mode', async () => {
            renderBotPolicy([BOT_D1_RETURNED]);

            expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
            expect(lastTableProps().value).toBe(D1_UNWRAPPED);
            expect(selectorText()).toContain('Bot accounts');
        });

        test('a wrapped ternary opens CEL mode with the unwrapped rule, still in Bot accounts', async () => {
            renderBotPolicy([BOT_C_RETURNED]);

            expect(await screen.findByTestId('cel-editor')).toBeInTheDocument();
            expect(screen.queryByTestId('table-editor')).not.toBeInTheDocument();
            expect(lastCELProps().value).toBe(BOT_C_UNWRAPPED);
            expect(selectorText()).toContain('Bot accounts');
        });

        test('a doubled prefix unwraps to the inner rule', async () => {
            renderBotPolicy([`!user.isbot || !user.isbot || ${E}`]);

            expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
            expect(lastTableProps().value).toBe(E);
            expect(selectorText()).toContain('Bot accounts');
        });

        test('a flagged policy with a plain rule loads as Bot accounts with the rule as is', async () => {
            renderBotPolicy([E]);

            expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
            expect(lastTableProps().value).toBe(E);
            expect(selectorText()).toContain('Bot accounts');
        });

        test('a flag alongside other props still loads as Bot accounts', async () => {
            renderWithPolicy({expressions: [wrapBotExpression(E)], props: {...BOT_PROPS, child_ids: []}});

            expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
            expect(lastTableProps().value).toBe(E);
            expect(selectorText()).toContain('Bot accounts');
        });

        test.each([
            ['the submitted wrapper', wrapBotExpression(E)],
            ['the server-serialized wrapper', SERVER_PREFIXED_E],
        ])('a hand-written system_user rule with %s and no props loads as Members, shown verbatim', async (_label, expression) => {
            renderWithPolicy({expressions: [expression]});

            expect(await screen.findByTestId('cel-editor')).toBeInTheDocument();
            expect(lastCELProps().value).toBe(expression);
            expect(selectorText()).toContain('Members');
            expect(selectorText()).not.toContain('Bot accounts');
        });

        test('a wrapped rule with bot_scope false loads as Members', async () => {
            renderWithPolicy({expressions: [wrapBotExpression(E)], props: {bot_scope: false}});

            expect(await screen.findByTestId('cel-editor')).toBeInTheDocument();
            expect(lastCELProps().value).toBe(wrapBotExpression(E));
            expect(selectorText()).toContain('Members');
        });

        test('mixed prefixed and unprefixed rules load as Members with the raw first rule', async () => {
            renderWithPolicy({expressions: [wrapBotExpression(E), E]});

            expect(await screen.findByTestId('cel-editor')).toBeInTheDocument();
            expect(lastCELProps().value).toBe(wrapBotExpression(E));
            expect(selectorText()).toContain('Members');
            expect(selectorText()).not.toContain('Bot accounts');
        });

        test('a policy with no rules loads as Members with an empty table', async () => {
            renderWithPolicy({expressions: []});

            expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
            expect(lastTableProps().value).toBe('');
            expect(selectorText()).toContain('Members');
        });

        test('a prefixed rule on a guest policy stays Guest users', async () => {
            renderWithPolicy({roles: ['system_guest'], expressions: [wrapBotExpression(E)]});

            await screen.findByTestId('cel-editor');
            expect(selectorText()).toContain('Guest users');
            expect(lastCELProps().value).toBe(wrapBotExpression(E));
        });
    });

    describe('copy', () => {
        test('switching to Bot accounts swaps the copy', async () => {
            renderWithExpression(E);
            await screen.findByTestId('table-editor');
            expect(screen.getByText('Define rules based on user attributes and values')).toBeInTheDocument();

            await selectScope('pp-role-option-bot');

            expect(screen.getByText('Define rules based on bot attributes and values')).toBeInTheDocument();
            expect(screen.queryByText('Define rules based on user attributes and values')).not.toBeInTheDocument();
            expect(screen.getByText('Bot attribute requirements')).toBeInTheDocument();
            expect(lastTableProps().helpText).toBe(BOT_HELP_TEXT);
            expect(lastTableProps().emptyStateText).toBe(BOT_EMPTY_STATE_TEXT);
        });
    });
});
