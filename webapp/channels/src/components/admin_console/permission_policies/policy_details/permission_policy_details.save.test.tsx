// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PermissionPolicyDetails from './permission_policy_details';
import {
    E,
    LDAP_TEAMS,
    NATIVE_FIELDS,
    TERNARY_E,
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

const mockHistoryPush = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: mockHistoryPush}),
}));

jest.mock('hooks/useEnabledSessionAttributeFields', () => ({
    useEnabledSessionAttributeFields: jest.fn(() => []),
}));

// Stand-ins: the real CELEditor boots Monaco (unavailable in JSDOM) and the
// real TableEditor parses CEL through an async action.
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

    const savedBotPolicy = (expression = E) => ({
        data: {id: 'policy1', roles: ['system_bot'], rules: [{actions: ['download_file_attachment'], expression}]},
    });

    const renderDirtyBotPolicy = async (initialState = {}) => {
        const utils = renderBotPolicy([E], initialState);
        await screen.findByTestId('table-editor');
        await editTable(E);
        return utils;
    };

    beforeEach(() => {
        mockCreatePolicy.mockResolvedValue(savedBotPolicy());
    });

    describe('payload', () => {
        test('sends system_bot with the plain rule and no props, then navigates back', async () => {
            await renderDirtyBotPolicy();

            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload()).toEqual({
                id: 'policy1',
                name: 'Policy 1',
                type: 'permission',
                roles: ['system_bot'],
                rules: [{actions: ['download_file_attachment'], expression: E}],
            });
            expect(savedPayload()).not.toHaveProperty('props');
            expect(checkExpressionSpy).not.toHaveBeenCalled();
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
            expect(baseProps.actions.setNavigationBlocked).toHaveBeenLastCalledWith(false);
        });

        test('trims the rule before saving', async () => {
            await renderDirtyBotPolicy();
            await editTable(`  ${E}  `);

            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload().rules[0].expression).toBe(E);
        });

        test('Members sends system_user with the plain rule and no props', async () => {
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

        test('a new Bot accounts policy is created with an empty id and system_bot', async () => {
            renderWithContext(
                <PermissionPolicyDetails
                    {...baseProps}
                    policyId={undefined}
                />,
            );
            await screen.findByTestId('table-editor');

            await userEvent.type(screen.getByPlaceholderText('Add a unique policy name'), 'Bot policy');
            await chooseMenuItem('pp-add-permission-btn', 'pp-add-permission-menu', 'pp-add-permission-upload_file_attachment');
            await selectScope('pp-role-option-system_bot');
            await editTable(E);

            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload()).toEqual({
                id: '',
                name: 'Bot policy',
                type: 'permission',
                roles: ['system_bot'],
                rules: [{actions: ['upload_file_attachment'], expression: E}],
            });
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
        });

        test('loaded props are not sent back', async () => {
            renderWithPolicy({roles: ['system_bot'], expressions: [E], props: {foo: ['x']}});
            await screen.findByTestId('table-editor');
            await editTable(E);

            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload()).not.toHaveProperty('props');
        });

        test('a top-level OR expression loads in CEL and saves verbatim', async () => {
            const orExpression = `user.attributes.department == "eng" || ${E}`;
            renderBotPolicy([orExpression]);
            await screen.findByTestId('cel-editor');
            expect(lastCELProps().value).toBe(orExpression);
            await act(() => lastCELProps().onChange(orExpression));

            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload().roles).toEqual(['system_bot']);
            expect(savedPayload().rules[0].expression).toBe(orExpression);
        });

        test('an unknown stored role blocks save with the role-required error', async () => {
            renderWithPolicy({roles: ['custom_role'], expressions: [E]});
            await screen.findByTestId('table-editor');
            await editTable(E);

            await clickSave();

            expect(await screen.findByText(/Please select a role/)).toBeInTheDocument();
            expect(mockCreatePolicy).not.toHaveBeenCalled();
            expect(mockHistoryPush).not.toHaveBeenCalled();
        });

        test('a server rejection of a Bot accounts expression shows the server error without a pre-check', async () => {
            mockCreatePolicy.mockResolvedValue({error: {message: 'Invalid expression'}});
            await renderDirtyBotPolicy();
            await editTable('user.attributes.teams == "x');

            await clickSave();

            expect(await screen.findByText(/There are errors in the form above: Invalid expression/)).toBeInTheDocument();
            expect(checkExpressionSpy).not.toHaveBeenCalled();
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('saveSetting')).toBeEnabled();
        });

        test('an empty rule keeps the expression-required error', async () => {
            await renderDirtyBotPolicy();
            await editTable('   ');

            await clickSave();

            expect(await screen.findByText(/Please add an expression to the policy/)).toBeInTheDocument();
            expect(checkExpressionSpy).not.toHaveBeenCalled();
            expect(mockCreatePolicy).not.toHaveBeenCalled();
        });
    });

    describe('saving state', () => {
        test('disables the table editor while saving and re-enables it after a failed save', async () => {
            const save = deferred<{error: {message: string}}>();
            mockCreatePolicy.mockReturnValue(save.promise);
            await renderDirtyBotPolicy();
            expect(lastTableProps().disabled).toBe(false);

            await clickSave();
            expect(lastTableProps().disabled).toBe(true);
            expect(screen.getByTestId('saveSetting')).toBeDisabled();

            await act(async () => save.resolve({error: {message: 'boom'}}));

            expect(await screen.findByText(/There are errors in the form above: boom/)).toBeInTheDocument();
            expect(lastTableProps().disabled).toBe(false);
            expect(screen.getByTestId('saveSetting')).toBeEnabled();
        });

        test('a second Save click while the first is in flight does not save again', async () => {
            const save = deferred<ReturnType<typeof savedBotPolicy>>();
            mockCreatePolicy.mockReturnValue(save.promise);
            await renderDirtyBotPolicy();

            await clickSave();
            await clickSave();
            expect(mockCreatePolicy).toHaveBeenCalledTimes(1);

            await act(async () => save.resolve(savedBotPolicy()));
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
            expect(mockCreatePolicy).toHaveBeenCalledTimes(1);
        });

        test('disables the CEL editor while saving', async () => {
            const save = deferred<ReturnType<typeof savedBotPolicy>>();
            mockCreatePolicy.mockReturnValue(save.promise);
            renderBotPolicy([TERNARY_E]);
            await screen.findByTestId('cel-editor');
            await act(() => lastCELProps().onChange(TERNARY_E));
            expect(lastCELProps().disabled).toBe(false);

            await clickSave();
            expect(lastCELProps().disabled).toBe(true);

            await act(async () => save.resolve(savedBotPolicy(TERNARY_E)));
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
        });

        test('shows a server error', async () => {
            mockCreatePolicy.mockResolvedValue({error: {message: 'boom'}});
            await renderDirtyBotPolicy();

            await clickSave();

            expect(await screen.findByText(/There are errors in the form above: boom/)).toBeInTheDocument();
            expect(mockHistoryPush).not.toHaveBeenCalled();
            expect(screen.getByTestId('saveSetting')).toBeEnabled();
        });
    });

    describe('role switching', () => {
        const expectSavedRole = async (role: string) => {
            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload().roles).toEqual([role]);
            expect(savedPayload().rules[0].expression).toBe(E);
            expect(savedPayload()).not.toHaveProperty('props');
            expect(checkExpressionSpy).not.toHaveBeenCalled();
        };

        test('Bot accounts to Members saves system_user', async () => {
            renderBotPolicy([E]);
            await screen.findByTestId('table-editor');

            await selectScope('pp-role-option-system_user');
            expect(selectorText()).toContain('Members');
            await clickSave();

            await expectSavedRole('system_user');
        });

        test('Members to Bot accounts saves system_bot', async () => {
            renderWithExpression(E);
            await screen.findByTestId('table-editor');

            await selectScope('pp-role-option-system_bot');
            expect(selectorText()).toContain('Bot accounts');
            await clickSave();

            await expectSavedRole('system_bot');
        });

        test('Bot accounts to Guest users saves system_guest', async () => {
            renderBotPolicy([E]);
            await screen.findByTestId('table-editor');

            await selectScope('pp-role-option-system_guest');
            await clickSave();

            await expectSavedRole('system_guest');
        });

        test('Bot accounts to System administrators saves system_admin', async () => {
            renderBotPolicy([E]);
            await screen.findByTestId('table-editor');

            await selectScope('pp-role-option-system_admin');
            await clickSave();

            await expectSavedRole('system_admin');
        });

        test('Members to Bot accounts and back saves system_user', async () => {
            renderWithExpression(E);
            await screen.findByTestId('table-editor');

            await selectScope('pp-role-option-system_bot');
            await selectScope('pp-role-option-system_user');
            await clickSave();

            await expectSavedRole('system_user');
        });
    });

    describe('synced-attribute warning', () => {
        const SYNCED_TITLE = 'Bots can\'t hold synced attributes';
        const syncedNotice = () => screen.queryByText(SYNCED_TITLE)?.closest('[class*="section-notice--type-"]') ?? null;
        const editorStandIn = () => screen.queryByTestId('table-editor') ?? screen.getByTestId('cel-editor');
        const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

        beforeEach(() => {
            useFields([LDAP_TEAMS, SAML_REGION, PLAIN_DEPT]);
        });

        test('an LDAP-synced reference shows the warning with the label in a code span', async () => {
            renderBotPolicy(['user.attributes.teams == "engineering"']);

            expect(await screen.findByText(SYNCED_TITLE)).toBeInTheDocument();
            expect(syncedNotice()).toHaveTextContent('teams is synced from LDAP or SAML, and bots can\'t hold synced values. This policy will deny every bot.');
            expect(syncedNotice()!.querySelector('code')).toHaveTextContent('teams');
        });

        test('a SAML-synced reference uses the display label', async () => {
            renderBotPolicy(['user.attributes.region == "EMEA"']);

            await screen.findByText(SYNCED_TITLE);
            expect(syncedNotice()).toHaveTextContent('Sales region is synced from LDAP or SAML');
            expect(syncedNotice()!.querySelector('code')!.textContent).toBe('Sales region');
        });

        test('a plain admin-managed attribute shows no warning', async () => {
            renderBotPolicy(['user.attributes.department == "eng"']);
            await screen.findByTestId('table-editor');

            expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument();
        });

        test('a synced name only inside a string literal shows no warning', async () => {
            renderBotPolicy(['user.attributes.department == "user.attributes.teams"']);
            expect(await screen.findByText('Bot attribute requirements')).toBeInTheDocument();
            expect(editorStandIn()).toBeInTheDocument();

            expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument();
        });

        test('it updates as the expression changes and pluralizes in field order', async () => {
            renderBotPolicy(['user.attributes.department == "eng"']);
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
            renderBotPolicy(['user.attributes.level == "x" && user.attributes.region == "y" && user.attributes.teams == "z"']);

            await screen.findByText(SYNCED_TITLE);
            expect(syncedNotice()).toHaveTextContent('teams, Sales region, and Level are synced from LDAP or SAML');
        });

        test('a duplicate reference is listed once and stays singular', async () => {
            renderBotPolicy(['user.attributes.department == "eng"']);
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

            await selectScope('pp-role-option-system_bot');
            expect(await screen.findByText(SYNCED_TITLE)).toBeInTheDocument();

            await selectScope('pp-role-option-system_user');
            await waitFor(() => expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument());
        });

        test('it sits above the editor card', async () => {
            renderBotPolicy(['user.attributes.teams == "engineering"']);
            await screen.findByText(SYNCED_TITLE);

            expect(follows(syncedNotice()!, screen.getByTestId('table-editor'))).toBe(true);
            expect(follows(screen.getByText('Who this policy applies to'), syncedNotice()!)).toBe(true);
            expect(follows(syncedNotice()!, screen.getByText('Bot attribute requirements'))).toBe(true);
        });

        test('it updates from CEL-mode edits', async () => {
            renderBotPolicy(['user.attributes.department == "eng"']);
            await screen.findByTestId('table-editor');
            await switchToAdvanced();

            await act(() => lastCELProps().onChange('user.attributes.region == "a" || user.attributes.department == "b"'));

            await screen.findByText(SYNCED_TITLE);
            expect(syncedNotice()).toHaveTextContent('Sales region is synced');
        });

        test('a markdown-unsafe display label renders literally with backticks stripped', async () => {
            const odd = customField('u-odd', 'cost', {ldap: 'cc', display_name: '*Cost_center* `x`'});
            useFields([odd]);
            renderBotPolicy(['user.attributes.cost == "1"']);

            await screen.findByText(SYNCED_TITLE);
            const codes = syncedNotice()!.querySelectorAll('code');
            expect(codes).toHaveLength(1);
            expect(codes[0].textContent).toBe('*Cost_center* x');
            expect(syncedNotice()!.querySelector('em, strong')).toBeNull();
        });

        test('a native field never triggers it, but a synced custom field with the same name does', async () => {
            const syncedEmail = customField('cpa-email', 'email', {saml: 'mail', display_name: 'Work email'});
            useFields([...NATIVE_FIELDS]);
            const {unmount} = renderBotPolicy(['user.attributes.email == "a@b.c"']);
            await screen.findByTestId('table-editor');
            expect(screen.queryByText(SYNCED_TITLE)).not.toBeInTheDocument();
            unmount();

            useFields([...NATIVE_FIELDS, syncedEmail]);
            renderBotPolicy(['user.attributes.email == "a@b.c"']);
            await screen.findByText(SYNCED_TITLE);
            expect(syncedNotice()).toHaveTextContent('Work email is synced');
        });

        test('it is advisory and does not block saving', async () => {
            mockCreatePolicy.mockResolvedValue(savedBotPolicy('user.attributes.teams == "x"'));
            renderBotPolicy(['user.attributes.department == "eng"']);
            await screen.findByTestId('table-editor');
            await editTable('user.attributes.teams == "x"');
            await screen.findByText(SYNCED_TITLE);

            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload().rules[0].expression).toBe('user.attributes.teams == "x"');
            expect(savedPayload().roles).toEqual(['system_bot']);
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
        });
    });

    describe('attributes bots do not have', () => {
        const HIDDEN_TITLE = 'Some attributes aren\'t available for bots';
        const EMAIL_RULE = 'user.email == "a@b.com"';
        const hiddenNotice = () => screen.queryByText(HIDDEN_TITLE)?.closest('[class*="section-notice--type-"]') ?? null;

        beforeEach(() => {
            useFields([...NATIVE_FIELDS, LDAP_TEAMS]);
        });

        test('switching a new Members policy with an Email rule to Bot accounts warns and blocks save', async () => {
            renderWithContext(
                <PermissionPolicyDetails
                    {...baseProps}
                    policyId={undefined}
                />,
            );
            await screen.findByTestId('table-editor');
            await userEvent.type(screen.getByPlaceholderText('Add a unique policy name'), 'Bot policy');
            await editTable(EMAIL_RULE);
            expect(screen.queryByText(HIDDEN_TITLE)).not.toBeInTheDocument();

            await selectScope('pp-role-option-system_bot');
            await chooseMenuItem('pp-add-permission-btn', 'pp-add-permission-menu', 'pp-add-permission-upload_file_attachment');

            expect(await screen.findByText(HIDDEN_TITLE)).toBeInTheDocument();
            expect(hiddenNotice()).toHaveTextContent('Email can\'t be used in Bot accounts policies. Remove it from the rules to save this policy.');
            expect(hiddenNotice()!.querySelector('code')).toHaveTextContent('Email');
            expect(lastTableProps().value).toBe(EMAIL_RULE);

            await clickSave();

            expect(await screen.findByText('There are errors in the form above: Remove Email from the rules. Bot accounts policies can\'t use this attribute.')).toBeInTheDocument();
            expect(mockCreatePolicy).not.toHaveBeenCalled();
            expect(mockHistoryPush).not.toHaveBeenCalled();
        });

        test('an advanced-mode expression referencing user.email under Bot accounts is blocked', async () => {
            renderBotPolicy([E]);
            await screen.findByTestId('table-editor');
            await switchToAdvanced();

            await act(() => lastCELProps().onChange(`${E} && (user.email.endsWith("@x.com") || user.isbot == true)`));

            expect(await screen.findByText(HIDDEN_TITLE)).toBeInTheDocument();
            expect(hiddenNotice()).toHaveTextContent('Email and Bot account can\'t be used in Bot accounts policies. Remove them from the rules');

            await clickSave();

            expect(await screen.findByText(/Remove Email and Bot account from the rules\. Bot accounts policies can't use these attributes\./)).toBeInTheDocument();
            expect(mockCreatePolicy).not.toHaveBeenCalled();
        });

        test('without native field metadata the attribute name is shown and save is still blocked', async () => {
            useFields([LDAP_TEAMS]);
            renderBotPolicy([E]);
            await screen.findByTestId('table-editor');
            await editTable('user.verified == true');

            await screen.findByText(HIDDEN_TITLE);
            expect(hiddenNotice()!.querySelector('code')).toHaveTextContent('verified');

            await clickSave();

            expect(await screen.findByText(/Remove verified from the rules/)).toBeInTheDocument();
            expect(mockCreatePolicy).not.toHaveBeenCalled();
        });

        test('removing the rule clears the warning and the policy saves', async () => {
            renderBotPolicy([E]);
            await screen.findByTestId('table-editor');
            await editTable(`${E} && ${EMAIL_RULE}`);
            await screen.findByText(HIDDEN_TITLE);

            await clickSave();
            await screen.findByText(/Remove Email from the rules/);
            expect(mockCreatePolicy).not.toHaveBeenCalled();

            await editTable(E);
            await waitFor(() => expect(screen.queryByText(HIDDEN_TITLE)).not.toBeInTheDocument());
            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload().rules[0].expression).toBe(E);
        });

        test('the same Email rule under Members shows no warning and saves', async () => {
            mockCreatePolicy.mockResolvedValue({data: {id: 'policy1', roles: ['system_user'], rules: [{actions: ['download_file_attachment'], expression: EMAIL_RULE}]}});
            renderWithExpression(EMAIL_RULE);
            await screen.findByTestId('table-editor');
            await editTable(EMAIL_RULE);

            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload().roles).toEqual(['system_user']);
            expect(savedPayload().rules[0].expression).toBe(EMAIL_RULE);
            expect(screen.queryByText(HIDDEN_TITLE)).not.toBeInTheDocument();
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
        });

        test('switching back to Members clears the warning and saves', async () => {
            renderWithExpression(EMAIL_RULE);
            await screen.findByTestId('table-editor');

            await selectScope('pp-role-option-system_bot');
            expect(await screen.findByText(HIDDEN_TITLE)).toBeInTheDocument();

            await selectScope('pp-role-option-system_user');
            await waitFor(() => expect(screen.queryByText(HIDDEN_TITLE)).not.toBeInTheDocument());
            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload().roles).toEqual(['system_user']);
        });

        test('Bot accounts with only allowed attributes shows no warning and saves', async () => {
            const allowed = `user.createat.youngerThanDays(7) && ${E} && user.attributes.email == "a@b.com"`;
            mockCreatePolicy.mockResolvedValue(savedBotPolicy(allowed));
            renderBotPolicy([E]);
            await screen.findByTestId('table-editor');
            await editTable(allowed);

            await clickSave();

            await waitFor(() => expect(mockCreatePolicy).toHaveBeenCalledTimes(1));
            expect(savedPayload().roles).toEqual(['system_bot']);
            expect(savedPayload().rules[0].expression).toBe(allowed);
            expect(screen.queryByText(HIDDEN_TITLE)).not.toBeInTheDocument();
            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalledWith(POLICIES_PATH));
        });
    });
});
