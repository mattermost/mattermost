// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SimulateAccessModal from 'components/admin_console/access_control/modals/simulate_access/simulate_access_modal';

import {act, renderWithContext, screen} from 'tests/react_testing_utils';

import PermissionPolicyDetails from './permission_policy_details';
import {
    BOT_C_RETURNED,
    E,
    NATIVE_FIELDS,
    baseProps,
    chooseMenuItem,
    lastCELProps,
    lastTableProps,
    mockFetchPolicy,
    renderBotPolicy,
    renderWithPolicy,
    selectScope,
    setUpPolicyDetailsMocks,
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

const MockedSimulateAccessModal = SimulateAccessModal as jest.MockedFunction<typeof SimulateAccessModal>;

describe('components/admin_console/permission_policies/policy_details/PermissionPolicyDetails simulate', () => {
    let checkExpressionSpy: jest.SpyInstance;

    beforeEach(() => {
        checkExpressionSpy = setUpPolicyDetailsMocks();
    });

    afterEach(() => {
        checkExpressionSpy.mockRestore();
        jest.clearAllMocks();
    });

    const SIM_STATE = {entities: {general: {config: {FeatureFlagPermissionPolicies: 'true', FeatureFlagPolicySimulation: 'true'}}}};

    const lastModalProps = () => MockedSimulateAccessModal.mock.calls[MockedSimulateAccessModal.mock.calls.length - 1][0];
    const triggerTest = () => act(() => lastTableProps().onTestClick!());

    describe('modal wiring', () => {
        test('Bot accounts passes the wrapped rule and system_user role to the simulator', async () => {
            renderBotPolicy([wrapBotExpression(E)], SIM_STATE);
            await screen.findByTestId('table-editor');

            await triggerTest();

            expect(await screen.findByTestId('simulate-modal')).toBeInTheDocument();
            const props = lastModalProps();
            expect(props.policy.id).toBe('policy1');
            expect(props.policy.roles).toEqual(['system_user']);
            expect(props.policy.rules).toEqual([{actions: ['download_file_attachment'], expression: wrapBotExpression(E)}]);
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

        test('the simulator keeps the unfiltered fields', async () => {
            useFields([...NATIVE_FIELDS]);
            renderBotPolicy([wrapBotExpression(E)], SIM_STATE);
            await screen.findByTestId('table-editor');

            await triggerTest();

            expect(await screen.findByTestId('simulate-modal')).toBeInTheDocument();
            expect(lastModalProps().accessControlFields?.map((f) => f.name)).toEqual(expect.arrayContaining(['isbot', 'email', 'verified']));
        });
    });

    // MM-71299: the editors' own expression-only test ignores the policy's
    // role, so no scope may fall back to it when the simulator can't run.
    describe('test button gating', () => {
        const ROLE_OPTIONS = ['pp-role-option-system_user', 'pp-role-option-system_admin', 'pp-role-option-system_guest', 'pp-role-option-bot'];

        const renderWithoutPermissions = () => {
            mockFetchPolicy.mockResolvedValue({
                data: {id: 'policy1', name: 'Policy 1', type: 'permission', roles: ['system_user'], rules: []},
            });
            return renderWithContext(<PermissionPolicyDetails {...baseProps}/>, SIM_STATE);
        };

        test.each(ROLE_OPTIONS)('without the feature flags, %s keeps Simulate rules disabled', async (optionId) => {
            renderWithPolicy({expressions: [E]});
            await screen.findByTestId('table-editor');
            await selectScope(optionId);

            expect(lastTableProps().onTestClick).toEqual(expect.any(Function));
            expect(lastTableProps().testButtonDisabled).toBe(true);
            expect(lastTableProps().testButtonTooltip).toBe('Rule simulation isn\'t enabled on this server.');
        });

        test.each(ROLE_OPTIONS)('with no permission selected, %s keeps Simulate rules disabled', async (optionId) => {
            renderWithoutPermissions();
            await screen.findByTestId('table-editor');
            await selectScope(optionId);

            expect(lastTableProps().onTestClick).toEqual(expect.any(Function));
            expect(lastTableProps().testButtonDisabled).toBe(true);
            expect(lastTableProps().testButtonTooltip).toBe('Add a permission to this policy to simulate it.');
        });

        test('adding a permission enables Simulate rules', async () => {
            renderWithoutPermissions();
            await screen.findByTestId('table-editor');

            await chooseMenuItem('pp-add-permission-btn', 'pp-add-permission-menu', 'pp-add-permission-download_file_attachment');

            expect(lastTableProps().testButtonDisabled).toBe(false);
            expect(lastTableProps().testButtonTooltip).toBeUndefined();
        });
    });
});
