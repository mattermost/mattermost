// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {CELExpressionError} from '@mattermost/types/access_control';
import type {AccessControlSettings} from '@mattermost/types/config';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {Client4} from 'mattermost-redux/client';

import SimulateAccessModal from 'components/admin_console/access_control/modals/simulate_access/simulate_access_modal';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useEnabledSessionAttributeFields} from 'hooks/useEnabledSessionAttributeFields';
import {act, renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';

import PermissionPolicyDetails from './permission_policy_details';

import CELEditor from '../../access_control/editors/cel_editor/editor';
import TableEditor from '../../access_control/editors/table_editor/table_editor';

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

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;
const mockUseEnabledSessionAttributeFields = useEnabledSessionAttributeFields as jest.MockedFunction<typeof useEnabledSessionAttributeFields>;
const MockedTableEditor = TableEditor as jest.MockedFunction<typeof TableEditor>;
const MockedCELEditor = CELEditor as jest.MockedFunction<typeof CELEditor>;
const MockedSimulateAccessModal = SimulateAccessModal as jest.MockedFunction<typeof SimulateAccessModal>;

const SESSION_GROUP_UUID = 'session_attributes';

const makeSessionField = (id: string, name: string): UserPropertyField => ({
    id,
    name,
    type: 'text',
    group_id: SESSION_GROUP_UUID,
    target_id: '',
    target_type: 'system',
    object_type: 'session',
    attrs: {
        sort_order: 0,
        visibility: 'always',
        value_type: '',
        enabled: true,
    } as UserPropertyField['attrs'],
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
});

describe('components/admin_console/permission_policies/policy_details/PermissionPolicyDetails', () => {
    const mockFetchPolicy = jest.fn();
    const mockGetAccessControlFields = jest.fn();
    const mockCreatePolicy = jest.fn();
    let checkExpressionSpy: jest.SpyInstance;

    const accessControlSettings: AccessControlSettings = {
        EnableAttributeBasedAccessControl: true,
        EnableUserManagedAttributes: false,
        EnableChannelPolicyIndicators: true,
        TrustProxyDeviceIdentityHeader: false,
        EnforceDeviceIDConsistency: false,
        EnableAccessControlAuditLogging: false,
        SyncJobIntervalSeconds: 3600,
        AttributeRefreshIntervalSeconds: 30,
    };

    const baseProps = {
        policyId: 'policy1',
        accessControlSettings,
        sessionAttributesEnabled: true,
        actions: {
            fetchPolicy: mockFetchPolicy,
            createPolicy: mockCreatePolicy,
            deletePolicy: jest.fn(),
            setNavigationBlocked: jest.fn(),
        },
    };

    const renderWithExpression = (expression: string) => {
        mockFetchPolicy.mockResolvedValue({
            data: {
                id: 'policy1',
                name: 'Policy 1',
                roles: ['system_user'],
                rules: expression ? [{actions: ['download_file_attachment'], expression}] : [],
            },
        });
        return renderWithContext(<PermissionPolicyDetails {...baseProps}/>);
    };

    beforeEach(() => {
        mockFetchPolicy.mockReset();
        mockGetAccessControlFields.mockReset();
        mockCreatePolicy.mockReset();
        checkExpressionSpy = jest.spyOn(Client4, 'checkAccessControlExpression').mockResolvedValue([]);

        mockFetchPolicy.mockResolvedValue({
            data: {
                id: 'policy1',
                name: 'Policy 1',
                roles: ['system_user'],
                rules: [],
            },
        });

        mockUseEnabledSessionAttributeFields.mockReturnValue([makeSessionField('s1', 'network_name')]);
        mockUseChannelAccessControlActions.mockReturnValue({
            getAccessControlFields: mockGetAccessControlFields,
            getVisualAST: jest.fn(),
            searchUsers: jest.fn(),
            getChannelPolicy: jest.fn(),
            saveChannelPolicy: jest.fn(),
            deleteChannelPolicy: jest.fn(),
            getChannelMembers: jest.fn(),
            createJob: jest.fn(),
            createAccessControlSyncJob: jest.fn(),
            validateExpressionAgainstRequester: jest.fn(),
            simulatePolicyForUsers: jest.fn(),
            updateAccessControlPoliciesActive: jest.fn(),
        });

        // One LDAP-synced attribute keeps the editor usable so the mode toggle
        // is enabled and reflects the loaded expression rather than the
        // no-attributes gate.
        mockGetAccessControlFields.mockResolvedValue({
            data: [
                {id: 'u1', name: 'teams', attrs: {ldap: true}},
                {id: 'u2', name: 'department', group_id: 'custom_profile_attributes', object_type: 'user', attrs: {managed: 'admin'}},
            ],
        });
    });

    afterEach(() => {
        checkExpressionSpy.mockRestore();
        jest.clearAllMocks();
    });

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

    test('disables the mode toggle when a complex expression forces Advanced mode', async () => {
        renderWithExpression('user.attributes.a == "x" || user.attributes.b == "y"');

        const toggle = await screen.findByText('Switch to Simple Mode');
        expect(toggle.closest('button')).toBeDisabled();
    });

    // MM-64357: after switching an apostrophe-valued rule to Advanced mode, the
    // "Switch to Simple Mode" toggle must stay enabled so the admin can return.
    test('keeps the mode toggle enabled for an apostrophe value in Advanced mode (MM-64357)', async () => {
        renderWithExpression('user.attributes.department == "Matt\'s Department"');

        // Opens in Simple mode; switch to Advanced to reach the toggle under test.
        await userEvent.click(await screen.findByText('Switch to Advanced Mode'));

        const toggle = await screen.findByText('Switch to Simple Mode');
        expect(toggle.closest('button')).toBeEnabled();
    });

    describe('Bot accounts scope', () => {
        const SIM_STATE = {entities: {general: {config: {FeatureFlagPermissionPolicies: 'true', FeatureFlagPolicySimulation: 'true'}}}};
        const POLICIES_PATH = '/admin_console/system_attributes/permission_policies';

        const BOT_A_RETURNED = '!user.isbot || user.attributes.Clearance == "Secret" && user.attributes.Program == "Dragon" &&\nuser.attributes.Clearance != "Public" && user.attributes.Program != "Phoenix" &&\nuser.attributes.Clearance != "Restricted"';
        const BOT_A_UNWRAPPED = 'user.attributes.Clearance == "Secret" && user.attributes.Program == "Dragon" &&\nuser.attributes.Clearance != "Public" && user.attributes.Program != "Phoenix" &&\nuser.attributes.Clearance != "Restricted"';
        const BOT_C_RETURNED = '!user.isbot || ((user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret" &&\nuser.attributes.Program != "Phoenix") : (user.attributes.Clearance == "TopSecret" &&\nuser.attributes.Program == "Hydra"))';
        const BOT_C_UNWRAPPED = '(user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret" &&\nuser.attributes.Program != "Phoenix") : (user.attributes.Clearance == "TopSecret" &&\nuser.attributes.Program == "Hydra")';
        const BOT_D1_RETURNED = '!user.isbot || "a" in user.attributes.Tags || "b" in user.attributes.Tags';
        const D1_UNWRAPPED = '"a" in user.attributes.Tags || "b" in user.attributes.Tags';
        const E = 'user.attributes.teams == "engineering"';
        const WRAPPED_E = '!user.isbot || (user.attributes.teams == "engineering"\n)';
        const BREAKOUT_OR = 'user.attributes.teams == "x") || (true';
        const BREAKOUT_TERNARY = 'user.attributes.teams == "x") ? (true) : (false';
        const HAS_ANY_OF = '"a" in user.attributes.teams || "b" in user.attributes.teams';
        const BOT_HELP_TEXT = 'Each row is a single condition that must be met for a bot to comply with the policy. All rules are combined with logical AND operator (`&&`).';
        const BOT_EMPTY_STATE_TEXT = 'Select a bot attribute and values to create a rule';
        const BOT_PROPS = {bot_scope: true};
        const SERVER_PREFIXED_E = `!user.isbot || ${E}`;

        const renderWithPolicy = (policy: {roles?: string[]; expressions: string[]; props?: Record<string, unknown>}, initialState = {}) => {
            mockFetchPolicy.mockResolvedValue({
                data: {
                    id: 'policy1',
                    name: 'Policy 1',
                    type: 'permission',
                    roles: policy.roles ?? ['system_user'],
                    props: policy.props,
                    rules: policy.expressions.map((expression) => ({actions: ['download_file_attachment'], expression})),
                },
            });
            return renderWithContext(<PermissionPolicyDetails {...baseProps}/>, initialState);
        };

        const renderBotPolicy = (expressions: string[], initialState = {}) => renderWithPolicy({expressions, props: BOT_PROPS}, initialState);

        const lastTableProps = () => MockedTableEditor.mock.calls[MockedTableEditor.mock.calls.length - 1][0];
        const lastCELProps = () => MockedCELEditor.mock.calls[MockedCELEditor.mock.calls.length - 1][0];
        const lastModalProps = () => MockedSimulateAccessModal.mock.calls[MockedSimulateAccessModal.mock.calls.length - 1][0];

        const selectorText = () => document.querySelector('#pp-role-selector-btn')!.textContent;

        // Menu items run their onClick only after the menu's close transition.
        const chooseMenuItem = async (buttonId: string, menuId: string, optionId: string) => {
            await userEvent.click(document.querySelector(`#${buttonId}`)!);
            await userEvent.click(document.querySelector(`#${optionId}`)!);
            await waitFor(() => expect(document.querySelector(`#${menuId}`)).not.toBeInTheDocument());
        };

        const selectScope = (optionId: string) => chooseMenuItem('pp-role-selector-btn', 'pp-role-selector-menu', optionId);

        const editTable = (value: string) => act(() => lastTableProps().onChange(value));
        const clickSave = () => userEvent.click(screen.getByTestId('saveSetting'));
        const savedPayload = (index = mockCreatePolicy.mock.calls.length - 1) => mockCreatePolicy.mock.calls[index][0];
        const triggerTest = () => act(() => lastTableProps().onTestClick!());

        const deferred = <T, >() => {
            let resolve!: (value: T) => void;
            const promise = new Promise<T>((r) => {
                resolve = r;
            });
            return {promise, resolve};
        };

        const savedBotPolicy = (expression = WRAPPED_E) => ({
            data: {id: 'policy1', roles: ['system_user'], props: BOT_PROPS, rules: [{actions: ['download_file_attachment'], expression}]},
        });

        const renderDirtyBotPolicy = async (initialState = {}) => {
            const utils = renderBotPolicy([WRAPPED_E], initialState);
            await screen.findByTestId('table-editor');
            await editTable(E);
            return utils;
        };

        describe('selector', () => {
            test('lists the four scopes with Bot accounts last', async () => {
                renderWithExpression(E);
                await screen.findByTestId('table-editor');

                await userEvent.click(document.querySelector('#pp-role-selector-btn')!);

                expect(screen.getAllByRole('menuitem').map((el) => el.id)).toEqual([
                    'pp-role-option-system_guest',
                    'pp-role-option-system_user',
                    'pp-role-option-system_admin',
                    'pp-role-option-bot',
                ]);
                expect(screen.getByText('Applies only to bot accounts')).toBeInTheDocument();
            });
        });

        describe('load', () => {
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
                renderWithPolicy({expressions: [WRAPPED_E], props: {...BOT_PROPS, child_ids: []}});

                expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
                expect(lastTableProps().value).toBe(E);
                expect(selectorText()).toContain('Bot accounts');
            });

            test.each([
                ['the submitted wrapper', WRAPPED_E],
                ['the server-serialized wrapper', SERVER_PREFIXED_E],
            ])('a hand-written system_user rule with %s and no props loads as Members, shown verbatim', async (_label, expression) => {
                renderWithPolicy({expressions: [expression]});

                expect(await screen.findByTestId('cel-editor')).toBeInTheDocument();
                expect(lastCELProps().value).toBe(expression);
                expect(selectorText()).toContain('Members');
                expect(selectorText()).not.toContain('Bot accounts');
            });

            test('a wrapped rule with bot_scope false loads as Members', async () => {
                renderWithPolicy({expressions: [WRAPPED_E], props: {bot_scope: false}});

                expect(await screen.findByTestId('cel-editor')).toBeInTheDocument();
                expect(lastCELProps().value).toBe(WRAPPED_E);
                expect(selectorText()).toContain('Members');
            });

            test('mixed prefixed and unprefixed rules load as Members with the raw first rule', async () => {
                renderWithPolicy({expressions: [WRAPPED_E, E]});

                expect(await screen.findByTestId('cel-editor')).toBeInTheDocument();
                expect(lastCELProps().value).toBe(WRAPPED_E);
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
                renderWithPolicy({roles: ['system_guest'], expressions: [WRAPPED_E]});

                await screen.findByTestId('cel-editor');
                expect(selectorText()).toContain('Guest users');
                expect(lastCELProps().value).toBe(WRAPPED_E);
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

        describe('save', () => {
            beforeEach(() => {
                mockCreatePolicy.mockResolvedValue(savedBotPolicy());
            });

            test('wraps the rule, sends system_user with props.bot_scope, and navigates back', async () => {
                await renderDirtyBotPolicy();

                await clickSave();

                await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
                expect(savedPayload()).toEqual({
                    id: 'policy1',
                    name: 'Policy 1',
                    type: 'permission',
                    roles: ['system_user'],
                    rules: [{actions: ['download_file_attachment'], expression: WRAPPED_E}],
                    props: {bot_scope: true},
                });
                expect(savedPayload().props).toEqual({bot_scope: true});
                expect(checkExpressionSpy).toHaveBeenCalledTimes(1);
                expect(checkExpressionSpy).toHaveBeenCalledWith(E);
                await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
                expect(baseProps.actions.setNavigationBlocked).toHaveBeenLastCalledWith(false);
            });

            test('validates the trimmed bare rule and wraps it trimmed', async () => {
                await renderDirtyBotPolicy();
                await editTable(`  ${E}  `);

                await clickSave();

                await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
                expect(checkExpressionSpy).toHaveBeenCalledWith(E);
                expect(savedPayload().rules[0].expression).toBe(WRAPPED_E);
            });

            test('Members sends the rule unwrapped without an expression check', async () => {
                mockCreatePolicy.mockResolvedValue({data: {id: 'policy1', roles: ['system_user'], rules: [{actions: ['download_file_attachment'], expression: E}]}});
                renderWithExpression(E);
                await screen.findByTestId('table-editor');
                await editTable(E);

                await clickSave();

                await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
                expect(savedPayload().rules[0].expression).toBe(E);
                expect(savedPayload().roles).toEqual(['system_user']);
                expect(savedPayload()).not.toHaveProperty('props');
                expect(checkExpressionSpy).not.toHaveBeenCalled();
                await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
            });

            test.each([
                ['an || breakout', BREAKOUT_OR],
                ['a ternary breakout', BREAKOUT_TERNARY],
                ['an unclosed paren', `(${E}`],
                ['an unterminated string', 'user.attributes.teams == "x'],
            ])('blocks %s without a network check', async (_label, expression) => {
                await renderDirtyBotPolicy();
                await editTable(expression);

                await clickSave();

                expect(await screen.findByText(/This expression isn't valid\. Check parentheses and quotes\.$/)).toBeInTheDocument();
                expect(checkExpressionSpy).not.toHaveBeenCalled();
                expect(mockCreatePolicy).not.toHaveBeenCalled();
                expect(mockHistoryPush).not.toHaveBeenCalled();
            });

            test('blocks the save when the expression check reports errors, showing the first', async () => {
                checkExpressionSpy.mockResolvedValue([
                    {message: 'Syntax error: mismatched input \')\'', line: 1, column: 4},
                    {message: 'second error', line: 1, column: 9},
                ]);
                await renderDirtyBotPolicy();

                await clickSave();

                expect(await screen.findByText(/This expression isn't valid\. Check parentheses and quotes\. Details: Syntax error: mismatched input '\)'/)).toBeInTheDocument();
                expect(screen.queryByText(/second error/)).not.toBeInTheDocument();
                expect(mockCreatePolicy).not.toHaveBeenCalled();
            });

            test('blocks the save when the expression check fails', async () => {
                checkExpressionSpy.mockRejectedValue(new Error('network'));
                await renderDirtyBotPolicy();

                await clickSave();

                expect(await screen.findByText(/Couldn't validate the expression\. Try again\./)).toBeInTheDocument();
                expect(mockCreatePolicy).not.toHaveBeenCalled();
                expect(screen.getByTestId('saveSetting')).toBeEnabled();
            });

            test('treats a null expression check response as valid', async () => {
                checkExpressionSpy.mockResolvedValue(null as unknown as CELExpressionError[]);
                await renderDirtyBotPolicy();

                await clickSave();

                await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
                await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
            });

            test('an empty rule keeps the expression-required error and skips the check', async () => {
                await renderDirtyBotPolicy();
                await editTable('   ');

                await clickSave();

                expect(await screen.findByText(/Please add an expression to the policy/)).toBeInTheDocument();
                expect(checkExpressionSpy).not.toHaveBeenCalled();
                expect(mockCreatePolicy).not.toHaveBeenCalled();
            });

            test('a validation error clears once a later save validates', async () => {
                checkExpressionSpy.mockResolvedValueOnce([{message: 'bad', line: 1, column: 1}]);
                mockCreatePolicy.mockResolvedValue({error: {message: 'boom'}});
                await renderDirtyBotPolicy();

                await clickSave();
                expect(await screen.findByText(/Details: bad/)).toBeInTheDocument();

                await clickSave();
                expect(await screen.findByText(/There are errors in the form above: boom/)).toBeInTheDocument();
                expect(screen.queryByText(/Details: bad/)).not.toBeInTheDocument();
            });

            test('a new Bot accounts policy is created with an empty id and props.bot_scope', async () => {
                renderWithContext(
                    <PermissionPolicyDetails
                        {...baseProps}
                        policyId={undefined}
                    />,
                );
                await screen.findByTestId('table-editor');

                await userEvent.type(screen.getByPlaceholderText('Add a unique policy name'), 'Bot policy');
                await chooseMenuItem('pp-add-permission-btn', 'pp-add-permission-menu', 'pp-add-permission-upload_file_attachment');
                await selectScope('pp-role-option-bot');
                await editTable(E);

                await clickSave();

                await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
                expect(savedPayload()).toEqual({
                    id: '',
                    name: 'Bot policy',
                    type: 'permission',
                    roles: ['system_user'],
                    rules: [{actions: ['upload_file_attachment'], expression: WRAPPED_E}],
                    props: {bot_scope: true},
                });
                await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
            });

            test('saving navigates back even when the response lacks the flag', async () => {
                mockCreatePolicy.mockResolvedValue({data: {id: 'policy1', roles: ['system_user'], rules: [{actions: ['download_file_attachment'], expression: E}]}});
                await renderDirtyBotPolicy();

                await clickSave();

                await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
                expect(mockCreatePolicy).toHaveBeenCalledTimes(1);
            });

            test('a hand-written prefixed Members rule saves byte-for-byte without props', async () => {
                mockCreatePolicy.mockResolvedValue({data: {id: 'policy1', roles: ['system_user'], rules: [{actions: ['download_file_attachment'], expression: SERVER_PREFIXED_E}]}});
                renderWithPolicy({expressions: [SERVER_PREFIXED_E]});
                await screen.findByTestId('cel-editor');
                expect(selectorText()).toContain('Members');
                await act(() => lastCELProps().onChange(SERVER_PREFIXED_E));

                await clickSave();

                await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
                expect(savedPayload()).toEqual({
                    id: 'policy1',
                    name: 'Policy 1',
                    type: 'permission',
                    roles: ['system_user'],
                    rules: [{actions: ['download_file_attachment'], expression: SERVER_PREFIXED_E}],
                });
                expect(savedPayload()).not.toHaveProperty('props');
                expect(checkExpressionSpy).not.toHaveBeenCalled();
                await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
            });

            test('an edit during the save check still saves the validated rule', async () => {
                const check = deferred<CELExpressionError[]>();
                checkExpressionSpy.mockReturnValue(check.promise);
                await renderDirtyBotPolicy();

                await clickSave();
                await editTable(BREAKOUT_OR);
                await act(async () => check.resolve([]));

                await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
                expect(savedPayload().rules[0].expression).toBe(WRAPPED_E);
                expect(checkExpressionSpy).toHaveBeenCalledTimes(1);
                expect(checkExpressionSpy).toHaveBeenCalledWith(E);
            });

            test('disables the table editor while saving and re-enables it after a failed save', async () => {
                const check = deferred<CELExpressionError[]>();
                checkExpressionSpy.mockReturnValue(check.promise);
                mockCreatePolicy.mockResolvedValue({error: {message: 'boom'}});
                await renderDirtyBotPolicy();
                expect(lastTableProps().disabled).toBe(false);

                await clickSave();
                expect(lastTableProps().disabled).toBe(true);
                expect(screen.getByTestId('saveSetting')).toBeDisabled();

                await act(async () => check.resolve([]));

                expect(await screen.findByText(/There are errors in the form above: boom/)).toBeInTheDocument();
                expect(lastTableProps().disabled).toBe(false);
                expect(screen.getByTestId('saveSetting')).toBeEnabled();
            });

            test('disables the CEL editor while saving', async () => {
                const check = deferred<CELExpressionError[]>();
                checkExpressionSpy.mockReturnValue(check.promise);
                renderBotPolicy([BOT_C_RETURNED]);
                await screen.findByTestId('cel-editor');
                await act(() => lastCELProps().onChange(BOT_C_UNWRAPPED));
                expect(lastCELProps().disabled).toBe(false);

                await clickSave();
                expect(lastCELProps().disabled).toBe(true);

                await act(async () => check.resolve([]));
                await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
            });

            test('shows a server error after a valid check', async () => {
                mockCreatePolicy.mockResolvedValue({error: {message: 'boom'}});
                await renderDirtyBotPolicy();

                await clickSave();

                expect(await screen.findByText(/There are errors in the form above: boom/)).toBeInTheDocument();
                expect(mockHistoryPush).not.toHaveBeenCalled();
                expect(screen.getByTestId('saveSetting')).toBeEnabled();
            });
        });

        describe('scope switching', () => {
            test('Bot accounts to Members saves unwrapped without a check', async () => {
                mockCreatePolicy.mockResolvedValue({data: {id: 'policy1', roles: ['system_user'], rules: [{actions: ['download_file_attachment'], expression: E}]}});
                renderBotPolicy([WRAPPED_E]);
                await screen.findByTestId('table-editor');

                await selectScope('pp-role-option-system_user');
                expect(selectorText()).toContain('Members');
                await clickSave();

                await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
                expect(savedPayload().rules[0].expression).toBe(E);
                expect(savedPayload().roles).toEqual(['system_user']);
                expect(savedPayload()).not.toHaveProperty('props');
                expect(checkExpressionSpy).not.toHaveBeenCalled();
                await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
            });

            test('Members to Bot accounts saves wrapped as system_user', async () => {
                mockCreatePolicy.mockResolvedValue(savedBotPolicy());
                renderWithExpression(E);
                await screen.findByTestId('table-editor');

                await selectScope('pp-role-option-bot');
                expect(selectorText()).toContain('Bot accounts');
                await clickSave();

                await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
                expect(savedPayload().rules[0].expression).toBe(WRAPPED_E);
                expect(savedPayload().roles).toEqual(['system_user']);
                expect(savedPayload().props).toEqual({bot_scope: true});
                expect(checkExpressionSpy).toHaveBeenCalledWith(E);
            });

            test('Bot accounts to Guest users saves unwrapped as system_guest', async () => {
                mockCreatePolicy.mockResolvedValue({data: {id: 'policy1', roles: ['system_guest'], rules: [{actions: ['download_file_attachment'], expression: E}]}});
                renderBotPolicy([WRAPPED_E]);
                await screen.findByTestId('table-editor');

                await selectScope('pp-role-option-system_guest');
                await clickSave();

                await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
                expect(savedPayload().rules[0].expression).toBe(E);
                expect(savedPayload().roles).toEqual(['system_guest']);
                expect(savedPayload()).not.toHaveProperty('props');
            });

            test('switching scope keeps a showing validation error', async () => {
                renderBotPolicy([WRAPPED_E]);
                await screen.findByTestId('table-editor');
                await editTable(BREAKOUT_OR);
                await clickSave();
                expect(await screen.findByText(/This expression isn't valid/)).toBeInTheDocument();

                await selectScope('pp-role-option-system_user');

                expect(selectorText()).toContain('Members');
                expect(screen.getByText(/This expression isn't valid/)).toBeInTheDocument();
            });
        });

        describe('simulation', () => {
            test('Bot accounts passes the wrapped rule and system_user role to the simulator', async () => {
                renderBotPolicy([WRAPPED_E], SIM_STATE);
                await screen.findByTestId('table-editor');

                await triggerTest();

                expect(await screen.findByTestId('simulate-modal')).toBeInTheDocument();
                const props = lastModalProps();
                expect(props.policy.id).toBe('policy1');
                expect(props.policy.roles).toEqual(['system_user']);
                expect(props.policy.rules).toEqual([{actions: ['download_file_attachment'], expression: WRAPPED_E}]);
                expect(props.targetRole).toBe('system_user');
                expect(checkExpressionSpy).not.toHaveBeenCalled();
            });

            test('Simulate in the CEL editor opens the modal without an expression check', async () => {
                renderBotPolicy([BOT_C_RETURNED], SIM_STATE);
                await screen.findByTestId('cel-editor');

                act(() => lastCELProps().onTestClick!());

                expect(await screen.findByTestId('simulate-modal')).toBeInTheDocument();
                expect(checkExpressionSpy).not.toHaveBeenCalled();
            });

            test('Members simulates the unwrapped rule without a check', async () => {
                mockFetchPolicy.mockResolvedValue({
                    data: {id: 'policy1', name: 'Policy 1', roles: ['system_user'], rules: [{actions: ['download_file_attachment'], expression: E}]},
                });
                renderWithContext(<PermissionPolicyDetails {...baseProps}/>, SIM_STATE);
                await screen.findByTestId('table-editor');

                await triggerTest();

                expect(await screen.findByTestId('simulate-modal')).toBeInTheDocument();
                expect(lastModalProps().policy.rules[0].expression).toBe(E);
                expect(lastModalProps().targetRole).toBe('system_user');
                expect(checkExpressionSpy).not.toHaveBeenCalled();
            });

            test('the simulator is unavailable without the feature flags', async () => {
                renderBotPolicy([WRAPPED_E]);
                await screen.findByTestId('table-editor');

                expect(lastTableProps().onTestClick).toBeUndefined();
            });

            describe('legacy bare-expression test button', () => {
                const LEGACY_TOOLTIP = 'Testing the rule alone isn\'t available for bot account policies.';

                test('is disabled with an explanation in Bot accounts without the simulator', async () => {
                    renderBotPolicy([WRAPPED_E]);
                    await screen.findByTestId('table-editor');

                    expect(lastTableProps().onTestClick).toBeUndefined();
                    expect(lastTableProps().testButtonDisabled).toBe(true);
                    expect(lastTableProps().testButtonTooltip).toBe(LEGACY_TOOLTIP);
                });

                test('is disabled in Bot accounts when no permission is selected, even with the simulator', async () => {
                    mockFetchPolicy.mockResolvedValue({
                        data: {id: 'policy1', name: 'Policy 1', type: 'permission', roles: ['system_user'], rules: []},
                    });
                    renderWithContext(<PermissionPolicyDetails {...baseProps}/>, SIM_STATE);
                    await screen.findByTestId('table-editor');
                    await selectScope('pp-role-option-bot');

                    expect(lastTableProps().onTestClick).toBeUndefined();
                    expect(lastTableProps().testButtonDisabled).toBe(true);
                });

                test('is disabled with an explanation in the CEL editor in Bot accounts without the simulator', async () => {
                    renderBotPolicy([BOT_C_RETURNED]);
                    await screen.findByTestId('cel-editor');

                    expect(lastCELProps().onTestClick).toBeUndefined();
                    expect(lastCELProps().testButtonDisabled).toBe(true);
                    expect(lastCELProps().testButtonTooltip).toBe(LEGACY_TOOLTIP);
                });

                test('stays enabled in the CEL editor in Members without the simulator', async () => {
                    renderWithExpression('user.attributes.a == "x" || user.attributes.b == "y"');
                    await screen.findByTestId('cel-editor');

                    expect(lastCELProps().testButtonDisabled).toBeFalsy();
                    expect(lastCELProps().testButtonTooltip).toBeUndefined();
                });

                test('is replaced by Simulate rules in the CEL editor in Bot accounts with the simulator', async () => {
                    renderBotPolicy([BOT_C_RETURNED], SIM_STATE);
                    await screen.findByTestId('cel-editor');

                    expect(lastCELProps().onTestClick).toBeDefined();
                    expect(lastCELProps().testButtonDisabled).toBeFalsy();
                });

                test('stays enabled in Members without the simulator', async () => {
                    renderWithExpression(E);
                    await screen.findByTestId('table-editor');

                    expect(lastTableProps().onTestClick).toBeUndefined();
                    expect(lastTableProps().testButtonDisabled).toBeFalsy();
                    expect(lastTableProps().testButtonTooltip).toBeUndefined();
                });

                test('is replaced by Simulate rules in Bot accounts with the simulator', async () => {
                    renderBotPolicy([WRAPPED_E], SIM_STATE);
                    await screen.findByTestId('table-editor');

                    expect(lastTableProps().onTestClick).toBeDefined();
                    expect(lastTableProps().testButtonDisabled).toBeFalsy();
                });

                test('switching from Bot accounts to Members re-enables it', async () => {
                    renderBotPolicy([WRAPPED_E]);
                    await screen.findByTestId('table-editor');

                    await selectScope('pp-role-option-system_user');

                    expect(lastTableProps().testButtonDisabled).toBeFalsy();
                });
            });
        });

        describe('copy', () => {
            test('Bot accounts shows bot copy and passes bot help text to the table editor', async () => {
                renderBotPolicy([WRAPPED_E]);
                await screen.findByTestId('table-editor');

                expect(screen.getByText('Define rules based on bot attributes and values')).toBeInTheDocument();
                expect(screen.getByText('Bot attribute requirements')).toBeInTheDocument();
                expect(screen.getByText('Select attributes and values that bots must have for this policy')).toBeInTheDocument();
                expect(screen.queryByText('User attribute requirements')).not.toBeInTheDocument();
                expect(lastTableProps().helpText).toBe(BOT_HELP_TEXT);
                expect(lastTableProps().emptyStateText).toBe(BOT_EMPTY_STATE_TEXT);
            });

            test('Members keeps the default copy', async () => {
                renderWithExpression(E);
                await screen.findByTestId('table-editor');

                expect(screen.getByText('Define rules based on user attributes and values')).toBeInTheDocument();
                expect(screen.getByText('User attribute requirements')).toBeInTheDocument();
                expect(screen.getByText('Select attributes and values that users must have for this policy')).toBeInTheDocument();
                expect(screen.queryByText('Bot attribute requirements')).not.toBeInTheDocument();
                expect(lastTableProps().helpText).toBeUndefined();
                expect(lastTableProps().emptyStateText).toBeUndefined();
            });

            test('switching to Bot accounts swaps the copy', async () => {
                renderWithExpression(E);
                await screen.findByTestId('table-editor');

                await selectScope('pp-role-option-bot');

                expect(screen.getByText('Bot attribute requirements')).toBeInTheDocument();
                expect(lastTableProps().helpText).toBe(BOT_HELP_TEXT);
                expect(lastTableProps().emptyStateText).toBe(BOT_EMPTY_STATE_TEXT);
            });
        });

        describe('Bot accounts guidance', () => {
            const nativeField = (name: string, displayName: string): UserPropertyField => ({
                id: `native_user_attribute_${name}`,
                name,
                type: 'text',
                group_id: 'custom_profile_attributes',
                target_id: '',
                target_type: 'system',
                object_type: 'user',
                attrs: {sort_order: 0, visibility: 'always', value_type: '', native: true, display_name: displayName},
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
            } as UserPropertyField);

            const customField = (id: string, name: string, attrs: Partial<UserPropertyField['attrs']>): UserPropertyField => ({
                ...nativeField(name, ''),
                id,
                attrs: {sort_order: 0, visibility: 'always', value_type: '', ...attrs},
            } as UserPropertyField);

            const NATIVE_FIELDS = [
                nativeField('email', 'Email'),
                nativeField('verified', 'Email verified'),
                nativeField('isbot', 'Bot account'),
                nativeField('createat', 'Account created'),
            ];
            const HIDDEN = ['email', 'verified', 'isbot'];
            const CPA_EMAIL = customField('cpa-email', 'email', {managed: 'admin', display_name: 'Work email'});
            const LDAP_TEAMS = customField('u-teams', 'teams', {ldap: 'memberOf'});
            const SAML_REGION = customField('u-region', 'region', {saml: 'Region', display_name: 'Sales region'});
            const PLAIN_DEPT = customField('u-dept', 'department', {managed: 'admin'});

            const useFields = (fields: UserPropertyField[]) => mockGetAccessControlFields.mockResolvedValue({data: fields});
            const wrap = (e: string) => `!user.isbot || (${e}\n)`;

            const SYNCED_TITLE = 'Bots can\'t hold synced attributes';
            const syncedNotice = () => screen.queryByText(SYNCED_TITLE)?.closest('.sectionNoticeContainer') ?? null;
            const editorStandIn = () => screen.queryByTestId('table-editor') ?? screen.getByTestId('cel-editor');
            const nativeCELNames = () => lastCELProps().userAttributes.filter((a) => a.isNative).map((a) => a.attribute);
            const switchToAdvanced = async () => {
                await userEvent.click(screen.getByText('Switch to Advanced Mode'));
                await screen.findByTestId('cel-editor');
            };
            const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

            describe('built-ins', () => {
                test('the table editor gets the hidden names in Bot accounts with unfiltered attributes', async () => {
                    useFields([...NATIVE_FIELDS, CPA_EMAIL, LDAP_TEAMS]);
                    renderBotPolicy([WRAPPED_E]);
                    await screen.findByTestId('table-editor');

                    expect(lastTableProps().hiddenPickerAttributeNames).toEqual(HIDDEN);
                    const ids = lastTableProps().userAttributes.map((a) => a.id);
                    expect(ids).toEqual(expect.arrayContaining(['native_user_attribute_email', 'native_user_attribute_isbot', 'native_user_attribute_verified', 'cpa-email']));
                });

                test('Members passes no hidden names', async () => {
                    useFields([...NATIVE_FIELDS]);
                    renderWithExpression(E);
                    await screen.findByTestId('table-editor');

                    expect(lastTableProps().hiddenPickerAttributeNames).toBeUndefined();
                });

                // TableEditor's picker memo is keyed on this array's reference.
                test('switching scope toggles the prop and keeps one reference across edits and round trips', async () => {
                    useFields([...NATIVE_FIELDS]);
                    renderWithExpression(E);
                    await screen.findByTestId('table-editor');

                    await selectScope('pp-role-option-bot');
                    await editTable('user.attributes.teams == "other"');
                    await selectScope('pp-role-option-system_user');
                    expect(lastTableProps().hiddenPickerAttributeNames).toBeUndefined();
                    await selectScope('pp-role-option-bot');

                    expect(lastTableProps().hiddenPickerAttributeNames).toEqual(HIDDEN);
                    const refs = new Set(MockedTableEditor.mock.calls.map(([p]) => p.hiddenPickerAttributeNames).filter(Boolean));
                    expect(refs.size).toBe(1);
                });

                test('CEL autocomplete drops the native built-ins in Bot accounts but keeps the custom email and session fields', async () => {
                    useFields([...NATIVE_FIELDS, CPA_EMAIL, LDAP_TEAMS]);
                    renderBotPolicy([WRAPPED_E]);
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

                test('the simulator keeps the unfiltered fields', async () => {
                    useFields([...NATIVE_FIELDS]);
                    renderBotPolicy([WRAPPED_E], SIM_STATE);
                    await screen.findByTestId('table-editor');

                    await triggerTest();

                    expect(await screen.findByTestId('simulate-modal')).toBeInTheDocument();
                    expect(lastModalProps().accessControlFields?.map((f) => f.name)).toEqual(expect.arrayContaining(['isbot', 'email', 'verified']));
                });
            });

            describe('synced warning', () => {
                beforeEach(() => {
                    useFields([LDAP_TEAMS, SAML_REGION, PLAIN_DEPT]);
                });

                test('an LDAP-synced reference shows the warning with the label in a code span', async () => {
                    renderBotPolicy([wrap('user.attributes.teams == "engineering"')]);

                    expect(await screen.findByText(SYNCED_TITLE)).toBeInTheDocument();
                    expect(syncedNotice()).toHaveTextContent('teams is synced from LDAP or SAML, and bots can\'t hold synced values. This policy will deny every bot.');
                    expect(syncedNotice()!.querySelector('code')).toHaveTextContent('teams');
                });

                test('a SAML-synced reference uses the display label', async () => {
                    renderBotPolicy([wrap('user.attributes.region == "EMEA"')]);

                    await screen.findByText(SYNCED_TITLE);
                    expect(syncedNotice()).toHaveTextContent('Sales region is synced from LDAP or SAML');
                    expect(syncedNotice()!.querySelector('code')!.textContent).toBe('Sales region');
                });

                test('a plain admin-managed attribute shows no warning', async () => {
                    renderBotPolicy([wrap('user.attributes.department == "eng"')]);
                    await screen.findByTestId('table-editor');

                    expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument();
                });

                test('a synced name only inside a string literal shows no warning', async () => {
                    renderBotPolicy([wrap('user.attributes.department == "user.attributes.teams"')]);
                    expect(await screen.findByText('Bot attribute requirements')).toBeInTheDocument();
                    expect(editorStandIn()).toBeInTheDocument();

                    expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument();
                });

                test('it updates as the expression changes and pluralizes in field order', async () => {
                    renderBotPolicy([wrap('user.attributes.department == "eng"')]);
                    await screen.findByTestId('table-editor');
                    expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument();

                    await editTable('user.attributes.region == "b" && user.attributes.teams == "a"');

                    await screen.findByText(SYNCED_TITLE);
                    expect(syncedNotice()).toHaveTextContent('teams and Sales region are synced from LDAP or SAML');
                    expect(Array.from(syncedNotice()!.querySelectorAll('code')).map((c) => c.textContent)).toEqual(['teams', 'Sales region']);

                    await editTable('user.attributes.department == "eng"');
                    await waitFor(() => expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument());
                });

                test('three synced attributes are joined as a localized list', async () => {
                    const ldapLevel = customField('u-level', 'level', {ldap: 'title', display_name: 'Level'});
                    useFields([LDAP_TEAMS, SAML_REGION, ldapLevel, PLAIN_DEPT]);
                    renderBotPolicy([wrap('user.attributes.level == "x" && user.attributes.region == "y" && user.attributes.teams == "z"')]);

                    await screen.findByText(SYNCED_TITLE);
                    expect(syncedNotice()).toHaveTextContent('teams, Sales region, and Level are synced from LDAP or SAML');
                });

                test('a duplicate reference is listed once and stays singular', async () => {
                    renderBotPolicy([wrap('user.attributes.department == "eng"')]);
                    await screen.findByTestId('table-editor');

                    await editTable('user.attributes.teams == "a" && user.attributes.teams != "b"');

                    await screen.findByText(SYNCED_TITLE);
                    expect(syncedNotice()).toHaveTextContent('teams is synced');
                    expect(syncedNotice()!.querySelectorAll('code')).toHaveLength(1);
                });

                test('it never shows in Members and appears after switching to Bot accounts', async () => {
                    useFields([LDAP_TEAMS]);
                    renderWithExpression('user.attributes.teams == "engineering"');
                    await screen.findByTestId('table-editor');
                    expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument();

                    await selectScope('pp-role-option-bot');
                    expect(await screen.findByText(SYNCED_TITLE)).toBeInTheDocument();

                    await selectScope('pp-role-option-system_user');
                    await waitFor(() => expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument());
                });

                test('it sits above the editor card', async () => {
                    renderBotPolicy([wrap('user.attributes.teams == "engineering"')]);
                    await screen.findByText(SYNCED_TITLE);

                    expect(follows(syncedNotice()!, screen.getByTestId('table-editor'))).toBe(true);
                    expect(follows(screen.getByText('Who this policy applies to'), syncedNotice()!)).toBe(true);
                    expect(follows(syncedNotice()!, screen.getByText('Bot attribute requirements'))).toBe(true);
                });

                test('it updates from CEL-mode edits', async () => {
                    renderBotPolicy([wrap('user.attributes.department == "eng"')]);
                    await screen.findByTestId('table-editor');
                    await switchToAdvanced();

                    await act(() => lastCELProps().onChange('user.attributes.region == "a" || user.attributes.department == "b"'));

                    await screen.findByText(SYNCED_TITLE);
                    expect(syncedNotice()).toHaveTextContent('Sales region is synced');
                });

                test('a markdown-unsafe display label renders literally with backticks stripped', async () => {
                    const odd = customField('u-odd', 'cost', {ldap: 'cc', display_name: '*Cost_center* `x`'});
                    useFields([odd]);
                    renderBotPolicy([wrap('user.attributes.cost == "1"')]);

                    await screen.findByText(SYNCED_TITLE);
                    const codes = syncedNotice()!.querySelectorAll('code');
                    expect(codes).toHaveLength(1);
                    expect(codes[0].textContent).toBe('*Cost_center* x');
                    expect(syncedNotice()!.querySelector('em, strong')).toBeNull();
                });

                test('a native field never triggers it, but a synced custom field with the same name does', async () => {
                    const syncedEmail = customField('cpa-email', 'email', {saml: 'mail', display_name: 'Work email'});
                    useFields([...NATIVE_FIELDS]);
                    const {unmount} = renderBotPolicy([wrap('user.attributes.email == "a@b.c"')]);
                    await screen.findByTestId('table-editor');
                    expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument();
                    unmount();

                    useFields([...NATIVE_FIELDS, syncedEmail]);
                    renderBotPolicy([wrap('user.attributes.email == "a@b.c"')]);
                    await screen.findByText(SYNCED_TITLE);
                    expect(syncedNotice()).toHaveTextContent('Work email is synced');
                });

                test('it is advisory and does not block saving', async () => {
                    mockCreatePolicy.mockResolvedValue(savedBotPolicy(wrap('user.attributes.teams == "x"')));
                    renderBotPolicy([wrap('user.attributes.department == "eng"')]);
                    await screen.findByTestId('table-editor');
                    await editTable('user.attributes.teams == "x"');
                    await screen.findByText(SYNCED_TITLE);

                    await clickSave();

                    await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
                    expect(savedPayload().rules[0].expression).toBe(wrap('user.attributes.teams == "x"'));
                    await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
                });
            });
        });
    });
});
