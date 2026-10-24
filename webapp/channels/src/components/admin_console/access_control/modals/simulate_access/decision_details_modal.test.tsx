// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {
    AccessControlPolicy,
    PolicySimulationActionDecision,
    PolicySimulationEvaluationNode,
} from '@mattermost/types/access_control';
import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import DecisionDetailsModal from './decision_details_modal';

const ACTION = 'upload_file_attachment';
const CLEARANCE = 'user.attributes.Clearance == "Secret"';
const A = 'user.attributes.A == "x"';
const B = 'user.attributes.B == "y"';
const JOINED = `(${CLEARANCE}) || (${A})`;

const user = TestHelper.getUserMock({id: 'u1', username: 'clearance-bot', is_bot: true, roles: 'system_user'});

const clearanceLeaf: PolicySimulationEvaluationNode = {
    kind: 'compare',
    operator: '==',
    expression: CLEARANCE,
    outcome: 'false',
    attribute: 'user.attributes.Clearance',
    actual_value: 'Public',
    expected_value: 'Secret',
};

const compareLeaf = (expression: string, outcome: 'true' | 'false' = 'false'): PolicySimulationEvaluationNode => ({
    kind: 'compare',
    operator: '==',
    expression,
    outcome,
});

const ruleATree = (): PolicySimulationEvaluationNode => compareLeaf(A);

const joinedTree = (): PolicySimulationEvaluationNode => ({
    kind: 'or',
    expression: JOINED,
    outcome: 'false',
    children: [clearanceLeaf, ruleATree()],
});

const draftPolicy = (rules: AccessControlPolicy['rules']): AccessControlPolicy => ({
    id: 'p1',
    name: 'p1',
    type: 'permission',
    roles: ['system_user'],
    rules,
} as AccessControlPolicy);

function renderDetails(decision: PolicySimulationActionDecision, policy?: AccessControlPolicy) {
    renderWithContext(
        <DecisionDetailsModal
            onExited={jest.fn()}
            user={user}
            actions={[ACTION]}
            decisions={{[ACTION]: decision}}
            pending={false}
            policy={policy}
        />,
        {entities: {users: {profiles: {[user.id]: user}}}},
    );
}

async function expandTrace(): Promise<HTMLElement> {
    await userEvent.click(await screen.findByTestId(`simulate-access-details-toggle-${ACTION}`));
    return screen.findByTestId(`simulate-access-details-rule-${ACTION}`);
}

function flatExpression(container: HTMLElement): string | null | undefined {
    return container.querySelector('code.SimulateAccessModal__detailsExpression')?.textContent;
}

describe('DecisionDetailsModal trace rendering', () => {
    test('flat expression renders as is', async () => {
        renderDetails({
            decision: false,
            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE, rule_name: 'rule1', expression: `(${CLEARANCE})`}],
        });

        const ruleBlock = await expandTrace();

        expect(flatExpression(ruleBlock)).toBe(`(${CLEARANCE})`);
    });

    test('OR tree renders both operands', async () => {
        renderDetails({
            decision: false,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                rule_name: 'rule1',
                expression: `${A} || ${B}`,
                evaluation_tree: {
                    kind: 'or',
                    expression: `${A} || ${B}`,
                    outcome: 'false',
                    children: [compareLeaf(A), compareLeaf(B)],
                },
            }],
        });

        await expandTrace();
        const tree = screen.getByTestId(`simulate-access-details-tree-${ACTION}`);

        expect(within(tree).getByTestId('simulate-access-trace-node-or-false')).toBeInTheDocument();
        expect(within(tree).getAllByTestId('simulate-access-trace-node-compare-false')).toHaveLength(2);
        expect(within(tree).getByText('ANY of the following may hold (OR)')).toBeInTheDocument();
    });

    test('server merged rules render each per-rule tree', async () => {
        renderDetails({
            decision: false,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                expression: JOINED,
                evaluation_tree: joinedTree(),
                merged_rules: [
                    {name: 'rule1', expression: CLEARANCE, evaluation_tree: clearanceLeaf},
                    {name: 'rule2', expression: A, evaluation_tree: ruleATree()},
                ],
            }],
        });

        await expandTrace();
        const first = screen.getByTestId(`simulate-access-details-merged-rule-${ACTION}-1`);
        const second = screen.getByTestId(`simulate-access-details-merged-rule-${ACTION}-2`);

        expect(within(first).getByTestId('simulate-access-trace-node-compare-false')).toBeInTheDocument();
        expect(within(second).getByText(A)).toBeInTheDocument();
    });

    test('server merged rules without per-rule trees fall back to the merged tree', async () => {
        renderDetails({
            decision: false,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                expression: JOINED,
                evaluation_tree: joinedTree(),
                merged_rules: [
                    {name: 'rule1', expression: CLEARANCE},
                    {name: 'rule2', expression: A},
                ],
            }],
        });

        const ruleBlock = await expandTrace();
        const tree = screen.getByTestId(`simulate-access-details-tree-${ACTION}`);

        expect(screen.queryByTestId(`simulate-access-details-merged-${ACTION}`)).not.toBeInTheDocument();
        expect(within(ruleBlock).getByText('Combined evaluation')).toBeInTheDocument();
        expect(within(tree).getAllByTestId('simulate-access-trace-node-or-false')).toHaveLength(1);
        expect(within(tree).getAllByTestId('simulate-access-trace-node-compare-false')).toHaveLength(2);
    });

    test('client merged-rules fallback shows the combined header with the role', async () => {
        renderDetails(
            {
                decision: false,
                blame: [{
                    source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                    rule_name: 'rule1',
                    role: 'system_bot',
                    expression: JOINED,
                    evaluation_tree: joinedTree(),
                }],
            },
            draftPolicy([
                {name: 'rule1', role: 'system_bot', actions: [ACTION], expression: CLEARANCE},
                {name: 'rule2', role: 'system_bot', actions: [ACTION], expression: A},
            ]),
        );

        const ruleBlock = await expandTrace();

        expect(within(ruleBlock).getByText('Combined evaluation for role system_bot')).toBeInTheDocument();
        expect(screen.queryByTestId(`simulate-access-details-merged-${ACTION}`)).not.toBeInTheDocument();
    });
});
