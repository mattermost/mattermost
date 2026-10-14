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
const WRAPPED = `!user.isbot || (${CLEARANCE}\n)`;
const A = 'user.attributes.A == "x"';
const B = 'user.attributes.B == "y"';
const WRAPPED_A = `!user.isbot || (${A}\n)`;
const JOINED = `(${WRAPPED}) || (${WRAPPED_A})`;

const bot = TestHelper.getUserMock({id: 'ubot', username: 'clearance-bot', is_bot: true, roles: 'system_user'});

const guard = (outcome: 'true' | 'false', expression = '!user.isbot'): PolicySimulationEvaluationNode => ({
    kind: 'not',
    expression,
    outcome,
    children: [{kind: 'other', expression: 'user.isbot', outcome: outcome === 'true' ? 'false' : 'true'}],
});

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

const botClearanceTree = (outcome: 'true' | 'false' = 'false'): PolicySimulationEvaluationNode => ({
    kind: 'or',
    expression: `!user.isbot || ${CLEARANCE}`,
    outcome,
    children: [guard(outcome), clearanceLeaf],
});

const joinedTree = (): PolicySimulationEvaluationNode => ({
    kind: 'or',
    expression: `(!user.isbot || ${CLEARANCE}) || (!user.isbot || ${A})`,
    outcome: 'false',
    children: [
        botClearanceTree(),
        {kind: 'or', expression: `!user.isbot || ${A}`, outcome: 'false', children: [guard('false'), compareLeaf(A)]},
    ],
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
            user={bot}
            actions={[ACTION]}
            decisions={{[ACTION]: decision}}
            pending={false}
            policy={policy}
        />,
        {entities: {users: {profiles: {[bot.id]: bot}}}},
    );
}

async function expandTrace(): Promise<HTMLElement> {
    await userEvent.click(await screen.findByTestId(`simulate-access-details-toggle-${ACTION}`));
    return screen.findByTestId(`simulate-access-details-rule-${ACTION}`);
}

function flatExpression(container: HTMLElement): string | null | undefined {
    return container.querySelector('code.SimulateAccessModal__detailsExpression')?.textContent;
}

describe('DecisionDetailsModal bot-scope unwrapping', () => {
    test('flat fallback hides the guard on the JoinExpressions form', async () => {
        renderDetails({
            decision: false,
            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE, rule_name: 'rule1', expression: `(${WRAPPED})`}],
        });

        const ruleBlock = await expandTrace();

        expect(flatExpression(ruleBlock)).toBe(CLEARANCE);
        expect(ruleBlock).not.toHaveTextContent('user.isbot');
        expect(screen.queryByTestId(`simulate-access-details-tree-${ACTION}`)).not.toBeInTheDocument();
        expect(within(ruleBlock).getByText('Rule: rule1')).toBeInTheDocument();
    });

    test('flat fallback hides the guard on the stored rule form', async () => {
        renderDetails({
            decision: false,
            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE, rule_name: 'rule1', expression: WRAPPED}],
        });

        const ruleBlock = await expandTrace();

        expect(flatExpression(ruleBlock)).toBe(CLEARANCE);
        expect(ruleBlock).not.toHaveTextContent('user.isbot');
    });

    test('flat fallback hides the guard on the masked form', async () => {
        renderDetails({
            decision: false,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                rule_name: 'rule1',
                expression: '(!(user.isbot)) || (user.attributes.Clearance == "--------")',
            }],
        });

        const ruleBlock = await expandTrace();

        expect(flatExpression(ruleBlock)).toBe('user.attributes.Clearance == "--------"');
        expect(ruleBlock).not.toHaveTextContent('user.isbot');
    });

    test('flat fallback hides the guard when the expression comes from the draft lookup', async () => {
        renderDetails(
            {
                decision: false,
                blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE, rule_name: 'rule1'}],
            },
            draftPolicy([{name: 'rule1', actions: [ACTION], expression: WRAPPED}]),
        );

        const ruleBlock = await expandTrace();

        expect(flatExpression(ruleBlock)).toBe(CLEARANCE);
        expect(ruleBlock).not.toHaveTextContent('user.isbot');
    });

    test('binary tree for a bot renders only the rule subtree', async () => {
        renderDetails({
            decision: false,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                rule_name: 'rule1',
                expression: `(${WRAPPED})`,
                evaluation_tree: botClearanceTree(),
            }],
        });

        await expandTrace();
        const tree = screen.getByTestId(`simulate-access-details-tree-${ACTION}`);

        expect(within(tree).queryByTestId('simulate-access-trace-node-or-false')).not.toBeInTheDocument();
        expect(within(tree).queryByTestId('simulate-access-trace-node-not-false')).not.toBeInTheDocument();
        expect(within(tree).getByTestId('simulate-access-trace-node-compare-false')).toBeInTheDocument();
        expect(within(tree).getByText('Actual: Public')).toBeInTheDocument();
        expect(within(tree).getByText(CLEARANCE)).toBeInTheDocument();
        expect(within(tree).queryByText('ANY of the following may hold (OR)')).not.toBeInTheDocument();
        expect(tree).not.toHaveTextContent('user.isbot');
    });

    test('masked tree with an AND body renders the AND node without the guard', async () => {
        const maskedA = 'user.attributes.A == "--------"';
        const maskedB = 'user.attributes.B == "--------"';
        const maskedText = `(!(user.isbot)) || ((${maskedA}) && (${maskedB}))`;
        renderDetails({
            decision: false,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                rule_name: 'rule1',
                expression: maskedText,
                evaluation_tree: {
                    kind: 'or',
                    expression: maskedText,
                    outcome: 'false',
                    children: [
                        guard('false', '!(user.isbot)'),
                        {
                            kind: 'and',
                            expression: `(${maskedA}) && (${maskedB})`,
                            outcome: 'false',
                            children: [compareLeaf(maskedA, 'true'), compareLeaf(maskedB)],
                        },
                    ],
                },
            }],
        });

        await expandTrace();
        const tree = screen.getByTestId(`simulate-access-details-tree-${ACTION}`);

        expect(within(tree).getByTestId('simulate-access-trace-node-and-false')).toBeInTheDocument();
        expect(within(tree).getByTestId('simulate-access-trace-node-compare-true')).toBeInTheDocument();
        expect(within(tree).getByTestId('simulate-access-trace-node-compare-false')).toBeInTheDocument();
        expect(within(tree).queryByTestId('simulate-access-trace-node-or-false')).not.toBeInTheDocument();
        expect(within(tree).queryByTestId('simulate-access-trace-node-not-false')).not.toBeInTheDocument();
        expect(tree).not.toHaveTextContent('user.isbot');
    });

    test('left-nested stored peer rule keeps one OR over the rule terms', async () => {
        renderDetails({
            decision: false,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.PEER_POLICY,
                policy_id: 'p2',
                policy_name: 'Bot uploads',
                expression: `(!user.isbot || ${A} || ${B})`,
                evaluation_tree: {
                    kind: 'or',
                    expression: `!user.isbot || ${A} || ${B}`,
                    outcome: 'false',
                    children: [
                        {
                            kind: 'or',
                            expression: `!user.isbot || ${A}`,
                            outcome: 'false',
                            children: [guard('false'), compareLeaf(A)],
                        },
                        compareLeaf(B),
                    ],
                },
            }],
        });

        const ruleBlock = await expandTrace();
        const tree = screen.getByTestId(`simulate-access-details-tree-${ACTION}`);

        expect(within(tree).getAllByTestId('simulate-access-trace-node-or-false')).toHaveLength(1);
        expect(within(tree).getAllByTestId('simulate-access-trace-node-compare-false')).toHaveLength(2);
        expect(within(tree).queryByTestId('simulate-access-trace-node-not-false')).not.toBeInTheDocument();
        expect(tree).not.toHaveTextContent('user.isbot');
        expect(within(ruleBlock).getByText('Policy: Bot uploads')).toBeInTheDocument();
    });

    test('server merged rules unwrap both the per-rule tree and the per-rule flat text', async () => {
        renderDetails({
            decision: false,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                expression: JOINED,
                merged_rules: [
                    {name: 'rule1', expression: WRAPPED, evaluation_tree: botClearanceTree()},
                    {name: 'rule2', expression: WRAPPED_A},
                ],
            }],
        });

        await expandTrace();
        const first = screen.getByTestId(`simulate-access-details-merged-rule-${ACTION}-1`);
        const second = screen.getByTestId(`simulate-access-details-merged-rule-${ACTION}-2`);

        expect(first).not.toHaveTextContent('user.isbot');
        expect(within(first).getByTestId('simulate-access-trace-node-compare-false')).toBeInTheDocument();
        expect(within(first).queryByTestId('simulate-access-trace-node-or-false')).not.toBeInTheDocument();
        expect(within(first).queryByTestId('simulate-access-trace-node-not-false')).not.toBeInTheDocument();
        expect(flatExpression(second)).toBe(A);
        expect(second).not.toHaveTextContent('user.isbot');
    });

    test('client merged-rules fallback shows the combined header and an unwrapped joined expression', async () => {
        renderDetails(
            {
                decision: false,
                blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE, rule_name: 'rule1', role: 'system_user', expression: JOINED}],
            },
            draftPolicy([
                {name: 'rule1', role: 'system_user', actions: [ACTION], expression: WRAPPED},
                {name: 'rule2', role: 'system_user', actions: [ACTION], expression: WRAPPED_A},
            ]),
        );

        const ruleBlock = await expandTrace();

        expect(within(ruleBlock).getByText('Combined evaluation for role system_user')).toBeInTheDocument();
        expect(flatExpression(ruleBlock)).toBe(`(${CLEARANCE}) || (${A})`);
        expect(ruleBlock).not.toHaveTextContent('user.isbot');
    });

    test('server merged rules without per-rule trees fall back to an unwrapped merged tree', async () => {
        renderDetails({
            decision: false,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                expression: JOINED,
                evaluation_tree: joinedTree(),
                merged_rules: [
                    {name: 'rule1', expression: WRAPPED},
                    {name: 'rule2', expression: WRAPPED_A},
                ],
            }],
        });

        const ruleBlock = await expandTrace();
        const tree = screen.getByTestId(`simulate-access-details-tree-${ACTION}`);

        expect(screen.queryByTestId(`simulate-access-details-merged-${ACTION}`)).not.toBeInTheDocument();
        expect(within(ruleBlock).getByText('Combined evaluation')).toBeInTheDocument();
        expect(within(tree).queryByTestId('simulate-access-trace-node-not-false')).not.toBeInTheDocument();
        expect(within(tree).getAllByTestId('simulate-access-trace-node-or-false')).toHaveLength(1);
        expect(within(tree).getAllByTestId('simulate-access-trace-node-compare-false')).toHaveLength(2);
        expect(tree).not.toHaveTextContent('user.isbot');
    });

    test('joined multi-rule draft blame without merged rules hides every guard in the tree', async () => {
        renderDetails({
            decision: false,
            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE, expression: JOINED, evaluation_tree: joinedTree()}],
        });

        await expandTrace();
        const tree = screen.getByTestId(`simulate-access-details-tree-${ACTION}`);

        expect(within(tree).queryByTestId('simulate-access-trace-node-not-false')).not.toBeInTheDocument();
        expect(within(tree).getAllByTestId('simulate-access-trace-node-or-false')).toHaveLength(1);
        expect(within(tree).getByText(CLEARANCE)).toBeInTheDocument();
        expect(within(tree).getByText(A)).toBeInTheDocument();
        expect(tree).not.toHaveTextContent('user.isbot');
    });

    test('masked joined three-rule draft blame hides every guard in the tree', async () => {
        const maskedLeaf = (name: string) => compareLeaf(`user.attributes.${name} == "--------"`);
        const maskedRule = (name: string): PolicySimulationEvaluationNode => ({
            kind: 'or',
            expression: `(!(user.isbot)) || (user.attributes.${name} == "--------")`,
            outcome: 'false',
            children: [guard('false', '!(user.isbot)'), maskedLeaf(name)],
        });
        const r12: PolicySimulationEvaluationNode = {
            kind: 'or',
            expression: `(${maskedRule('A').expression}) || (${maskedRule('B').expression})`,
            outcome: 'false',
            children: [maskedRule('A'), maskedRule('B')],
        };
        const rootText = `(${r12.expression}) || (${maskedRule('C').expression})`;
        renderDetails({
            decision: false,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                expression: rootText,
                evaluation_tree: {kind: 'or', expression: rootText, outcome: 'false', children: [r12, maskedRule('C')]},
            }],
        });

        await expandTrace();
        const tree = screen.getByTestId(`simulate-access-details-tree-${ACTION}`);

        expect(within(tree).queryByTestId('simulate-access-trace-node-not-false')).not.toBeInTheDocument();
        expect(within(tree).getAllByTestId('simulate-access-trace-node-or-false')).toHaveLength(2);
        expect(within(tree).getAllByTestId('simulate-access-trace-node-compare-false')).toHaveLength(3);
        expect(tree).not.toHaveTextContent('user.isbot');
    });

    test('joined multi-rule flat fallback hides every guard', async () => {
        renderDetails({
            decision: false,
            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE, expression: JOINED}],
        });

        const ruleBlock = await expandTrace();

        expect(flatExpression(ruleBlock)).toBe(`(${CLEARANCE}) || (${A})`);
        expect(ruleBlock).not.toHaveTextContent('user.isbot');
    });

    test('masked joined multi-rule flat fallback hides every guard', async () => {
        renderDetails({
            decision: false,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                expression: '((!(user.isbot)) || (user.attributes.A == "--------")) || ((!(user.isbot)) || (user.attributes.B == "--------"))',
            }],
        });

        const ruleBlock = await expandTrace();

        expect(flatExpression(ruleBlock)).toBe('(user.attributes.A == "--------") || (user.attributes.B == "--------")');
        expect(ruleBlock).not.toHaveTextContent('user.isbot');
    });

    test('a person allowed by the policy keeps the guard branch', async () => {
        renderDetails({
            decision: true,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                outcome: 'allow',
                rule_name: 'rule1',
                expression: WRAPPED,
                evaluation_tree: botClearanceTree('true'),
            }],
        });

        await expandTrace();
        const tree = screen.getByTestId(`simulate-access-details-tree-${ACTION}`);

        expect(within(tree).getByTestId('simulate-access-trace-node-or-true')).toBeInTheDocument();
        expect(within(tree).getByTestId('simulate-access-trace-node-not-true')).toBeInTheDocument();
        expect(within(tree).getByTestId('simulate-access-trace-node-compare-false')).toBeInTheDocument();
        expect(within(tree).getByText('ANY of the following may hold (OR)')).toBeInTheDocument();
    });

    test('a person allowed by the draft and denied by a peer keeps the guard only on the draft section', async () => {
        renderDetails({
            decision: false,
            blame: [
                {
                    source: POLICY_SIMULATION_BLAME_SOURCES.PEER_POLICY,
                    policy_id: 'p2',
                    policy_name: 'Bot uploads',
                    expression: `(!user.isbot || (${A}\n))`,
                    evaluation_tree: {
                        kind: 'or',
                        expression: `!user.isbot || ${A}`,
                        outcome: 'false',
                        children: [guard('false'), compareLeaf(A)],
                    },
                },
                {
                    source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                    outcome: 'allow',
                    rule_name: 'rule1',
                    expression: WRAPPED,
                    evaluation_tree: botClearanceTree('true'),
                },
            ],
        });

        await expandTrace();
        const draftSection = screen.getByTestId(`simulate-access-details-policy-${ACTION}-1`);
        const peerSection = screen.getByTestId(`simulate-access-details-policy-${ACTION}-2`);

        expect(within(draftSection).getByText('Your policy: Allowed')).toBeInTheDocument();
        expect(within(draftSection).getByTestId('simulate-access-trace-node-not-true')).toBeInTheDocument();
        expect(within(peerSection).getByText('Policy: Bot uploads')).toBeInTheDocument();
        expect(within(peerSection).queryByTestId('simulate-access-trace-node-or-false')).not.toBeInTheDocument();
        expect(within(peerSection).getByTestId('simulate-access-trace-node-compare-false')).toBeInTheDocument();
        expect(peerSection).not.toHaveTextContent('user.isbot');
    });

    test('non-prefixed flat expression renders unchanged', async () => {
        renderDetails({
            decision: false,
            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE, rule_name: 'rule1', expression: `(${CLEARANCE})`}],
        });

        const ruleBlock = await expandTrace();

        expect(flatExpression(ruleBlock)).toBe(`(${CLEARANCE})`);
    });

    test('non-prefixed OR tree renders unchanged', async () => {
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
});
