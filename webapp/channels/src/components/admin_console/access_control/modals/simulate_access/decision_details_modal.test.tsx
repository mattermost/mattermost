// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {
    AccessControlPolicy,
    PolicySimulationActionDecision,
    PolicySimulationBlame,
    PolicySimulationEvaluationNode,
} from '@mattermost/types/access_control';
import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import DecisionDetailsModal from './decision_details_modal';

import {
    SINGLE_RULE_BOT_WITHOUT_ATTRIBUTE,
    SINGLE_RULE_PERSON,
    TWO_RULE_FOLD_BOT_WITHOUT_ATTRIBUTE,
    TWO_RULE_FOLD_PERSON,
} from '../../bot_scope/trace_test_fixtures';

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

const ruleATree = (): PolicySimulationEvaluationNode => ({
    kind: 'or',
    expression: `!user.isbot || ${A}`,
    outcome: 'false',
    children: [guard('false'), compareLeaf(A)],
});

const joinedTree = (): PolicySimulationEvaluationNode => ({
    kind: 'or',
    expression: `(!user.isbot || ${CLEARANCE}) || (!user.isbot || ${A})`,
    outcome: 'false',
    children: [botClearanceTree(), ruleATree()],
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

    test('server merged rules unwrap each per-rule tree', async () => {
        renderDetails({
            decision: false,
            blame: [{
                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                expression: JOINED,
                evaluation_tree: joinedTree(),
                merged_rules: [
                    {name: 'rule1', expression: WRAPPED, evaluation_tree: botClearanceTree()},
                    {name: 'rule2', expression: WRAPPED_A, evaluation_tree: ruleATree()},
                ],
            }],
        });

        await expandTrace();
        const first = screen.getByTestId(`simulate-access-details-merged-rule-${ACTION}-1`);
        const second = screen.getByTestId(`simulate-access-details-merged-rule-${ACTION}-2`);

        expect(within(first).getByTestId('simulate-access-trace-node-compare-false')).toBeInTheDocument();
        expect(within(first).queryByTestId('simulate-access-trace-node-not-false')).not.toBeInTheDocument();
        expect(first).not.toHaveTextContent('user.isbot');
        expect(within(second).getByText(A)).toBeInTheDocument();
        expect(within(second).queryByTestId('simulate-access-trace-node-not-false')).not.toBeInTheDocument();
        expect(second).not.toHaveTextContent('user.isbot');
    });

    test('client merged-rules fallback shows the combined header over the unwrapped merged tree', async () => {
        renderDetails(
            {
                decision: false,
                blame: [{
                    source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                    rule_name: 'rule1',
                    role: 'system_user',
                    expression: JOINED,
                    evaluation_tree: joinedTree(),
                }],
            },
            draftPolicy([
                {name: 'rule1', role: 'system_user', actions: [ACTION], expression: WRAPPED},
                {name: 'rule2', role: 'system_user', actions: [ACTION], expression: WRAPPED_A},
            ]),
        );

        const ruleBlock = await expandTrace();
        const tree = screen.getByTestId(`simulate-access-details-tree-${ACTION}`);

        expect(within(ruleBlock).getByText('Combined evaluation for role system_user')).toBeInTheDocument();
        expect(screen.queryByTestId(`simulate-access-details-merged-${ACTION}`)).not.toBeInTheDocument();
        expect(within(tree).queryByTestId('simulate-access-trace-node-not-false')).not.toBeInTheDocument();
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

describe('DecisionDetailsModal bot-scope unwrapping (captured server traces)', () => {
    const SECRET = 'user.attributes.QA3Clearance == "Secret"';
    const TOP_SECRET = 'user.attributes.QA3Clearance == "TopSecret"';

    function draftBlameOf(decision: PolicySimulationActionDecision): PolicySimulationBlame {
        const blame = decision.blame?.find((b) => b.source === POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE);
        if (!blame) {
            throw new Error('fixture has no this_rule blame');
        }
        return blame;
    }

    function foldRules(decision: PolicySimulationActionDecision): PolicySimulationEvaluationNode[] {
        const children = draftBlameOf(decision).evaluation_tree?.children;
        if (!children || children.length !== 2) {
            throw new Error('fixture is not a two-rule fold');
        }
        return children;
    }

    test.each([
        ['single rule', SINGLE_RULE_PERSON, 1],
        ['two-rule fold', TWO_RULE_FOLD_PERSON, 2],
    ])('an allowed person keeps the guard on the draft section (%s)', async (_, decision, guards) => {
        renderDetails(decision);

        await expandTrace();
        const draftSection = screen.getByTestId(`simulate-access-details-policy-${ACTION}-1`);
        const peerSection = screen.getByTestId(`simulate-access-details-policy-${ACTION}-2`);

        expect(within(draftSection).getByText('Your policy: Allowed')).toBeInTheDocument();
        expect(within(draftSection).getAllByTestId('simulate-access-trace-node-not-true')).toHaveLength(guards);
        expect(within(draftSection).getAllByTestId('simulate-access-trace-node-compare-error')).toHaveLength(guards);
        expect(within(peerSection).getByText('Policy: QA3-BotScope-bfbcf6')).toBeInTheDocument();
    });

    test('a denied bot sees only the rule body (single rule)', async () => {
        renderDetails(SINGLE_RULE_BOT_WITHOUT_ATTRIBUTE);

        await expandTrace();
        const tree = screen.getByTestId(`simulate-access-details-tree-${ACTION}`);

        expect(within(tree).queryByTestId('simulate-access-trace-node-or-error')).not.toBeInTheDocument();
        expect(within(tree).queryByTestId('simulate-access-trace-node-not-false')).not.toBeInTheDocument();
        expect(within(tree).getByTestId('simulate-access-trace-node-compare-error')).toBeInTheDocument();
        expect(within(tree).getByText(SECRET)).toBeInTheDocument();
        expect(tree).not.toHaveTextContent('user.isbot');
    });

    test('a denied bot sees only the rule bodies (two-rule fold)', async () => {
        renderDetails(TWO_RULE_FOLD_BOT_WITHOUT_ATTRIBUTE);

        await expandTrace();
        const tree = screen.getByTestId(`simulate-access-details-tree-${ACTION}`);

        expect(within(tree).getAllByTestId('simulate-access-trace-node-or-error')).toHaveLength(1);
        expect(within(tree).getAllByTestId('simulate-access-trace-node-compare-error')).toHaveLength(2);
        expect(within(tree).queryByTestId('simulate-access-trace-node-not-false')).not.toBeInTheDocument();
        expect(tree).not.toHaveTextContent('user.isbot');
    });

    test('without a tree the flat text is shown as-is', async () => {
        renderDetails({decision: false, blame: [{...draftBlameOf(SINGLE_RULE_BOT_WITHOUT_ATTRIBUTE), evaluation_tree: undefined}]});

        const ruleBlock = await expandTrace();

        expect(flatExpression(ruleBlock)).toBe(`(!(user.isbot)) || (${SECRET})`);
    });

    test('a merged rule without its own tree shows its text as-is', async () => {
        const [rule1, rule2] = foldRules(TWO_RULE_FOLD_BOT_WITHOUT_ATTRIBUTE);
        renderDetails({
            decision: false,
            blame: [{
                ...draftBlameOf(TWO_RULE_FOLD_BOT_WITHOUT_ATTRIBUTE),
                merged_rules: [
                    {name: 'rule1', expression: rule1.expression, evaluation_tree: rule1},
                    {name: 'rule2', expression: rule2.expression},
                ],
            }],
        });

        await expandTrace();
        const first = screen.getByTestId(`simulate-access-details-merged-rule-${ACTION}-1`);
        const second = screen.getByTestId(`simulate-access-details-merged-rule-${ACTION}-2`);

        expect(first).not.toHaveTextContent('user.isbot');
        expect(flatExpression(second)).toBe(`(!(user.isbot)) || (${TOP_SECRET})`);
    });
});
