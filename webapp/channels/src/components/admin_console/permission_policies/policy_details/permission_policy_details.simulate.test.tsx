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
    lastCELProps,
    lastTableProps,
    mockFetchPolicy,
    renderBotPolicy,
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

    describe('test button gating', () => {
        test('the simulator is unavailable without the feature flags', async () => {
            renderBotPolicy([wrapBotExpression(E)]);
            await screen.findByTestId('table-editor');

            expect(lastTableProps().onTestClick).toBeUndefined();
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

        test('switching from Bot accounts to Members re-enables it', async () => {
            renderBotPolicy([wrapBotExpression(E)]);
            await screen.findByTestId('table-editor');

            await selectScope('pp-role-option-system_user');

            expect(lastTableProps().testButtonDisabled).toBeFalsy();
        });
    });
});
