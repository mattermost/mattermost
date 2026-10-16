// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {CELExpressionError} from '@mattermost/types/access_control';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PermissionPolicyDetails from './permission_policy_details';
import {
    BOT_C_RETURNED,
    BOT_C_UNWRAPPED,
    BOT_PROPS,
    E,
    LDAP_TEAMS,
    NATIVE_FIELDS,
    SERVER_PREFIXED_E,
    baseProps,
    chooseMenuItem,
    customField,
    lastCELProps,
    lastTableProps,
    mockCreatePolicy,
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

describe('components/admin_console/permission_policies/policy_details/PermissionPolicyDetails save', () => {
    let checkExpressionSpy: jest.SpyInstance;

    beforeEach(() => {
        checkExpressionSpy = setUpPolicyDetailsMocks();
    });

    afterEach(() => {
        checkExpressionSpy.mockRestore();
        jest.clearAllMocks();
    });

    const POLICIES_PATH = '/admin_console/system_attributes/permission_policies';
    const BREAKOUT_OR = 'user.attributes.teams == "x") || (true';
    const BREAKOUT_TERNARY = 'user.attributes.teams == "x") ? (true) : (false';
    const SAML_REGION = customField('u-region', 'region', {saml: 'Region', display_name: 'Sales region'});
    const PLAIN_DEPT = customField('u-dept', 'department', {managed: 'admin'});

    const editTable = (value: string) => act(() => lastTableProps().onChange(value));
    const clickSave = () => userEvent.click(screen.getByTestId('saveSetting'));
    const savedPayload = (index = mockCreatePolicy.mock.calls.length - 1) => mockCreatePolicy.mock.calls[index][0];

    const deferred = <T, >() => {
        let resolve!: (value: T) => void;
        const promise = new Promise<T>((r) => {
            resolve = r;
        });
        return {promise, resolve};
    };

    const savedBotPolicy = (expression = wrapBotExpression(E)) => ({
        data: {id: 'policy1', roles: ['system_user'], props: BOT_PROPS, rules: [{actions: ['download_file_attachment'], expression}]},
    });

    const renderDirtyBotPolicy = async (initialState = {}) => {
        const utils = renderBotPolicy([wrapBotExpression(E)], initialState);
        await screen.findByTestId('table-editor');
        await editTable(E);
        return utils;
    };

    beforeEach(() => {
        mockCreatePolicy.mockResolvedValue(savedBotPolicy());
    });

    describe('payload', () => {
        test('wraps the rule, sends system_user with props.bot_scope, and navigates back', async () => {
            await renderDirtyBotPolicy();

            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload()).toEqual({
                id: 'policy1',
                name: 'Policy 1',
                type: 'permission',
                roles: ['system_user'],
                rules: [{actions: ['download_file_attachment'], expression: wrapBotExpression(E)}],
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
            expect(savedPayload().rules[0].expression).toBe(wrapBotExpression(E));
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
                rules: [{actions: ['upload_file_attachment'], expression: wrapBotExpression(E)}],
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
            expect(savedPayload().rules[0].expression).toBe(wrapBotExpression(E));
            expect(checkExpressionSpy).toHaveBeenCalledTimes(1);
            expect(checkExpressionSpy).toHaveBeenCalledWith(E);
        });
    });

    describe('validation', () => {
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
    });

    describe('saving state', () => {
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
            renderBotPolicy([wrapBotExpression(E)]);
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
            expect(savedPayload().rules[0].expression).toBe(wrapBotExpression(E));
            expect(savedPayload().roles).toEqual(['system_user']);
            expect(savedPayload().props).toEqual({bot_scope: true});
            expect(checkExpressionSpy).toHaveBeenCalledWith(E);
        });

        test('Bot accounts to Guest users saves unwrapped as system_guest', async () => {
            mockCreatePolicy.mockResolvedValue({data: {id: 'policy1', roles: ['system_guest'], rules: [{actions: ['download_file_attachment'], expression: E}]}});
            renderBotPolicy([wrapBotExpression(E)]);
            await screen.findByTestId('table-editor');

            await selectScope('pp-role-option-system_guest');
            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload().rules[0].expression).toBe(E);
            expect(savedPayload().roles).toEqual(['system_guest']);
            expect(savedPayload()).not.toHaveProperty('props');
        });

        test('switching scope keeps a showing validation error', async () => {
            renderBotPolicy([wrapBotExpression(E)]);
            await screen.findByTestId('table-editor');
            await editTable(BREAKOUT_OR);
            await clickSave();
            expect(await screen.findByText(/This expression isn't valid/)).toBeInTheDocument();

            await selectScope('pp-role-option-system_user');

            expect(selectorText()).toContain('Members');
            expect(screen.getByText(/This expression isn't valid/)).toBeInTheDocument();
        });
    });

    describe('synced-attribute warning', () => {
        const SYNCED_TITLE = 'Bots can\'t hold synced attributes';
        const syncedNotice = () => screen.queryByText(SYNCED_TITLE)?.closest('.sectionNoticeContainer') ?? null;
        const editorStandIn = () => screen.queryByTestId('table-editor') ?? screen.getByTestId('cel-editor');
        const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

        beforeEach(() => {
            useFields([LDAP_TEAMS, SAML_REGION, PLAIN_DEPT]);
        });

        test('an LDAP-synced reference shows the warning with the label in a code span', async () => {
            renderBotPolicy([wrapBotExpression('user.attributes.teams == "engineering"')]);

            expect(await screen.findByText(SYNCED_TITLE)).toBeInTheDocument();
            expect(syncedNotice()).toHaveTextContent('teams is synced from LDAP or SAML, and bots can\'t hold synced values. This policy will deny every bot.');
            expect(syncedNotice()!.querySelector('code')).toHaveTextContent('teams');
        });

        test('a SAML-synced reference uses the display label', async () => {
            renderBotPolicy([wrapBotExpression('user.attributes.region == "EMEA"')]);

            await screen.findByText(SYNCED_TITLE);
            expect(syncedNotice()).toHaveTextContent('Sales region is synced from LDAP or SAML');
            expect(syncedNotice()!.querySelector('code')!.textContent).toBe('Sales region');
        });

        test('a plain admin-managed attribute shows no warning', async () => {
            renderBotPolicy([wrapBotExpression('user.attributes.department == "eng"')]);
            await screen.findByTestId('table-editor');

            expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument();
        });

        test('a synced name only inside a string literal shows no warning', async () => {
            renderBotPolicy([wrapBotExpression('user.attributes.department == "user.attributes.teams"')]);
            expect(await screen.findByText('Bot attribute requirements')).toBeInTheDocument();
            expect(editorStandIn()).toBeInTheDocument();

            expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument();
        });

        test('it updates as the expression changes and pluralizes in field order', async () => {
            renderBotPolicy([wrapBotExpression('user.attributes.department == "eng"')]);
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
            renderBotPolicy([wrapBotExpression('user.attributes.level == "x" && user.attributes.region == "y" && user.attributes.teams == "z"')]);

            await screen.findByText(SYNCED_TITLE);
            expect(syncedNotice()).toHaveTextContent('teams, Sales region, and Level are synced from LDAP or SAML');
        });

        test('a duplicate reference is listed once and stays singular', async () => {
            renderBotPolicy([wrapBotExpression('user.attributes.department == "eng"')]);
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
            renderBotPolicy([wrapBotExpression('user.attributes.teams == "engineering"')]);
            await screen.findByText(SYNCED_TITLE);

            expect(follows(syncedNotice()!, screen.getByTestId('table-editor'))).toBe(true);
            expect(follows(screen.getByText('Who this policy applies to'), syncedNotice()!)).toBe(true);
            expect(follows(syncedNotice()!, screen.getByText('Bot attribute requirements'))).toBe(true);
        });

        test('it updates from CEL-mode edits', async () => {
            renderBotPolicy([wrapBotExpression('user.attributes.department == "eng"')]);
            await screen.findByTestId('table-editor');
            await switchToAdvanced();

            await act(() => lastCELProps().onChange('user.attributes.region == "a" || user.attributes.department == "b"'));

            await screen.findByText(SYNCED_TITLE);
            expect(syncedNotice()).toHaveTextContent('Sales region is synced');
        });

        test('a markdown-unsafe display label renders literally with backticks stripped', async () => {
            const odd = customField('u-odd', 'cost', {ldap: 'cc', display_name: '*Cost_center* `x`'});
            useFields([odd]);
            renderBotPolicy([wrapBotExpression('user.attributes.cost == "1"')]);

            await screen.findByText(SYNCED_TITLE);
            const codes = syncedNotice()!.querySelectorAll('code');
            expect(codes).toHaveLength(1);
            expect(codes[0].textContent).toBe('*Cost_center* x');
            expect(syncedNotice()!.querySelector('em, strong')).toBeNull();
        });

        test('a native field never triggers it, but a synced custom field with the same name does', async () => {
            const syncedEmail = customField('cpa-email', 'email', {saml: 'mail', display_name: 'Work email'});
            useFields([...NATIVE_FIELDS]);
            const {unmount} = renderBotPolicy([wrapBotExpression('user.attributes.email == "a@b.c"')]);
            await screen.findByTestId('table-editor');
            expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument();
            unmount();

            useFields([...NATIVE_FIELDS, syncedEmail]);
            renderBotPolicy([wrapBotExpression('user.attributes.email == "a@b.c"')]);
            await screen.findByText(SYNCED_TITLE);
            expect(syncedNotice()).toHaveTextContent('Work email is synced');
        });

        test('it is advisory and does not block saving', async () => {
            mockCreatePolicy.mockResolvedValue(savedBotPolicy(wrapBotExpression('user.attributes.teams == "x"')));
            renderBotPolicy([wrapBotExpression('user.attributes.department == "eng"')]);
            await screen.findByTestId('table-editor');
            await editTable('user.attributes.teams == "x"');
            await screen.findByText(SYNCED_TITLE);

            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload().rules[0].expression).toBe(wrapBotExpression('user.attributes.teams == "x"'));
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
        });
    });
});
