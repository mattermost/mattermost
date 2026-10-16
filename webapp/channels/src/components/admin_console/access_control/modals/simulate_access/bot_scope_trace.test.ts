// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    PolicySimulationActionDecision,
    PolicySimulationBlame,
    PolicySimulationEvaluationNode,
} from '@mattermost/types/access_control';
import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';

import {unwrapBotTrace, unwrapBotTraceTree} from './bot_scope_trace';
import {
    SINGLE_RULE_BOT_WITHOUT_ATTRIBUTE,
    SINGLE_RULE_PERSON,
    TWO_RULE_FOLD_BOT_WITHOUT_ATTRIBUTE,
    TWO_RULE_FOLD_PERSON,
} from './bot_scope_trace_test_fixtures';

const CLEARANCE = 'user.attributes.Clearance == "Secret"';
const A = 'user.attributes.A == "x"';
const B = 'user.attributes.B == "y"';
const C = 'user.attributes.C == "z"';

function leaf(expression: string, outcome: 'true' | 'false' = 'false'): PolicySimulationEvaluationNode {
    return {kind: 'compare', operator: '==', expression, outcome};
}

function guard(outcome: 'true' | 'false' | 'error', expression = '!user.isbot'): PolicySimulationEvaluationNode {
    return {
        kind: 'not',
        expression,
        outcome,
        children: [{kind: 'other', expression: 'user.isbot', outcome: outcome === 'true' ? 'false' : 'true'}],
    };
}

function or(expression: string, children: PolicySimulationEvaluationNode[], outcome: 'true' | 'false' = 'false'): PolicySimulationEvaluationNode {
    return {kind: 'or', expression, outcome, children};
}

describe('unwrapBotTraceTree', () => {
    test('binary draft tree returns the rule subtree', () => {
        const e = leaf(CLEARANCE);
        const root = or(`!user.isbot || ${CLEARANCE}`, [guard('false'), e]);

        expect(unwrapBotTraceTree(root)).toBe(e);
    });

    test('binary tree with an AND body returns the AND node', () => {
        const and: PolicySimulationEvaluationNode = {
            kind: 'and',
            expression: `${A} && ${B}`,
            outcome: 'false',
            children: [leaf(A, 'true'), leaf(B)],
        };
        const root = or(`!user.isbot || ${A} && ${B}`, [guard('false'), and]);

        expect(unwrapBotTraceTree(root)).toBe(and);
    });

    test('masked guard text is recognized', () => {
        const e = leaf('user.attributes.Clearance == "--------"');
        const root = or('(!(user.isbot)) || (user.attributes.Clearance == "--------")', [guard('false', '!(user.isbot)'), e]);

        expect(unwrapBotTraceTree(root)).toBe(e);
    });

    test('structural guard is recognized when its text is unrecognized', () => {
        const e = leaf(CLEARANCE);
        const root = or(`!user.isbot || ${CLEARANCE}`, [guard('false', ''), e]);

        expect(unwrapBotTraceTree(root)).toBe(e);
    });

    test('guard text is recognized without the structural NOT shape', () => {
        const e = leaf(CLEARANCE);
        const textOnlyGuard: PolicySimulationEvaluationNode = {kind: 'other', expression: '!user.isbot', outcome: 'false'};
        const root = or(`!user.isbot || ${CLEARANCE}`, [textOnlyGuard, e]);

        expect(unwrapBotTraceTree(root)).toBe(e);
    });

    test('guard that errored is still unwrapped', () => {
        const e = leaf(CLEARANCE);
        const root = or(`!user.isbot || ${CLEARANCE}`, [guard('error'), e]);

        expect(unwrapBotTraceTree(root)).toBe(e);
    });

    test('left-nested stored chain drops the guard from the inner OR', () => {
        const a = leaf(A);
        const b = leaf(B);
        const root = or(`!user.isbot || ${A} || ${B}`, [or(`!user.isbot || ${A}`, [guard('false'), a]), b]);

        const result = unwrapBotTraceTree(root);

        expect(result).toEqual({kind: 'or', expression: `(${A}) || (${B})`, outcome: 'false', children: [a, b]});
        expect(result.children?.[0]).toBe(a);
        expect(result.children?.[1]).toBe(b);
    });

    test('balanced four-term chain keeps the right subtree intact', () => {
        const a = leaf(A);
        const right = or(`${B} || ${C}`, [leaf(B), leaf(C)]);
        const root = or(`!user.isbot || ${A} || ${B} || ${C}`, [or(`!user.isbot || ${A}`, [guard('false'), a]), right]);

        const result = unwrapBotTraceTree(root);

        expect(result.children).toHaveLength(2);
        expect(result.children?.[0]).toBe(a);
        expect(result.children?.[1]).toBe(right);
        expect(result.expression).toBe(`(${A}) || (${B} || ${C})`);
    });

    test('masked left-nested chain drops the guard from the rebuilt text', () => {
        const a = leaf('user.attributes.A == "--------"');
        const b = leaf('user.attributes.B == "--------"');
        const root = or(
            '((!(user.isbot)) || (user.attributes.A == "--------")) || (user.attributes.B == "--------")',
            [or('(!(user.isbot)) || (user.attributes.A == "--------")', [guard('false', '!(user.isbot)'), a]), b],
        );

        const result = unwrapBotTraceTree(root);

        expect(result.children?.[0]).toBe(a);
        expect(result.children?.[1]).toBe(b);
        expect(result.expression).toBe('(user.attributes.A == "--------") || (user.attributes.B == "--------")');
    });

    test('rebuilt text skips an operand whose text is empty', () => {
        const b = leaf(B);
        const root = or(`!user.isbot || ${A} || ${B}`, [or(`!user.isbot || ${A}`, [guard('false'), leaf('')]), b]);

        expect(unwrapBotTraceTree(root).expression).toBe(`(${B})`);
    });

    test('does not mutate the input tree', () => {
        const a = leaf(A);
        const inner = or(`!user.isbot || ${A}`, [guard('false'), a]);
        const root = or(`!user.isbot || ${A} || ${B}`, [inner, leaf(B)]);
        const snapshot = JSON.parse(JSON.stringify(root));

        unwrapBotTraceTree(root);

        expect(root).toEqual(snapshot);
        expect(root.children?.[0]).toBe(inner);
    });

    describe('multi-rule folds', () => {
        const rule = (e: PolicySimulationEvaluationNode, guardText = '!user.isbot', outcome: 'true' | 'false' = 'false') =>
            or(`${guardText} || ${e.expression}`, [guard(outcome, guardText), e], outcome);

        test('two-rule fold unwraps both sides', () => {
            const a = leaf(A);
            const b = leaf(B);
            const root = or(`!user.isbot || ${A} || !user.isbot || ${B}`, [rule(a), rule(b)]);

            const result = unwrapBotTraceTree(root);

            expect(result.kind).toBe('or');
            expect(result.children?.[0]).toBe(a);
            expect(result.children?.[1]).toBe(b);
            expect(result.expression).toBe(`(${A}) || (${B})`);
        });

        test('masked two-rule fold unwraps both sides', () => {
            const a = leaf('user.attributes.A == "--------"');
            const b = leaf('user.attributes.B == "--------"');
            const root = or(
                '((!(user.isbot)) || (user.attributes.A == "--------")) || ((!(user.isbot)) || (user.attributes.B == "--------"))',
                [rule(a, '!(user.isbot)'), rule(b, '!(user.isbot)')],
            );

            const result = unwrapBotTraceTree(root);

            expect(result.children?.[0]).toBe(a);
            expect(result.children?.[1]).toBe(b);
            expect(result.expression).toBe('(user.attributes.A == "--------") || (user.attributes.B == "--------")');
        });

        test('three-rule fold (left-nested) unwraps every rule', () => {
            const a = leaf(A);
            const b = leaf(B);
            const c = leaf(C);
            const root = or('r1 || r2 || r3', [or('r1 || r2', [rule(a), rule(b)]), rule(c)]);

            const result = unwrapBotTraceTree(root);

            expect(result.children?.[1]).toBe(c);
            expect(result.children?.[0].kind).toBe('or');
            expect(result.children?.[0].children?.[0]).toBe(a);
            expect(result.children?.[0].children?.[1]).toBe(b);
            expect(result.expression).toBe(`((${A}) || (${B})) || (${C})`);
        });

        test('masked three-rule fold (right-nested) unwraps every rule', () => {
            const a = leaf('user.attributes.A == "--------"');
            const b = leaf('user.attributes.B == "--------"');
            const c = leaf('user.attributes.C == "--------"');
            const root = or('r1 || (r2 || r3)', [
                rule(a, '!(user.isbot)'),
                or('r2 || r3', [rule(b, '!(user.isbot)'), rule(c, '!(user.isbot)')]),
            ]);

            const result = unwrapBotTraceTree(root);

            expect(result.children?.[0]).toBe(a);
            expect(result.children?.[1].children?.[0]).toBe(b);
            expect(result.children?.[1].children?.[1]).toBe(c);
        });

        test('fold of a stored chain and a parenthesized rule unwraps both', () => {
            const a = leaf(A);
            const b = leaf(B);
            const c = leaf(C);
            const storedChain = or(`!user.isbot || ${A} || ${B}`, [or(`!user.isbot || ${A}`, [guard('false'), a]), b]);
            const root = or('r1 || r2', [storedChain, rule(c)]);

            const result = unwrapBotTraceTree(root);

            expect(result.children?.[0].children).toEqual([a, b]);
            expect(result.children?.[1]).toBe(c);
            expect(JSON.stringify(result)).not.toContain('isbot');
        });

        test('balanced four-rule fold unwraps every rule', () => {
            const a = leaf(A);
            const b = leaf(B);
            const c = leaf(C);
            const d = leaf(CLEARANCE);
            const root = or('r1 || r2 || r3 || r4', [
                or('r1 || r2', [rule(a), rule(b)]),
                or('r3 || r4', [rule(c), rule(d)]),
            ]);

            const result = unwrapBotTraceTree(root);

            expect(result.children?.[0].children).toEqual([a, b]);
            expect(result.children?.[1].children).toEqual([c, d]);
            expect(result.expression).toBe(`((${A}) || (${B})) || ((${C}) || (${CLEARANCE}))`);
            expect(JSON.stringify(result)).not.toContain('isbot');
        });

        test('fold for a person (every guard true) is kept', () => {
            const root = or('r1 || r2', [rule(leaf(A), '!user.isbot', 'true'), rule(leaf(B), '!user.isbot', 'true')], 'true');

            expect(unwrapBotTraceTree(root)).toBe(root);
        });
    });

    test('a person (guard true) keeps the binary tree', () => {
        const root = or(`!user.isbot || ${CLEARANCE}`, [guard('true'), leaf(CLEARANCE)], 'true');

        expect(unwrapBotTraceTree(root)).toBe(root);
    });

    test('an allowed bot (guard false, body true) shows only the body', () => {
        const body = leaf(CLEARANCE, 'true');
        const root = or(`!user.isbot || ${CLEARANCE}`, [guard('false'), body], 'true');

        expect(unwrapBotTrace(root.expression, root)).toEqual({expression: CLEARANCE, evaluationTree: body});
    });

    test('a person (guard true) keeps the left-nested tree', () => {
        const root = or(
            `!user.isbot || ${A} || ${B}`,
            [or(`!user.isbot || ${A}`, [guard('true'), leaf(A)], 'true'), leaf(B)],
            'true',
        );

        expect(unwrapBotTraceTree(root)).toBe(root);
    });

    describe('passthrough', () => {
        test('plain OR', () => {
            const root = or(`${A} || ${B}`, [leaf(A), leaf(B)]);
            expect(unwrapBotTraceTree(root)).toBe(root);
        });

        test('nested plain OR', () => {
            const root = or(`${A} || ${B} || ${C}`, [or(`${A} || ${B}`, [leaf(A), leaf(B)]), leaf(C)]);
            expect(unwrapBotTraceTree(root)).toBe(root);
        });

        test('AND root', () => {
            const root: PolicySimulationEvaluationNode = {kind: 'and', expression: `${A} && ${B}`, outcome: 'false', children: [leaf(A), leaf(B)]};
            expect(unwrapBotTraceTree(root)).toBe(root);
        });

        test('AND root whose first child is a guard', () => {
            const root: PolicySimulationEvaluationNode = {kind: 'and', expression: `!user.isbot && ${A}`, outcome: 'false', children: [guard('false'), leaf(A)]};
            expect(unwrapBotTraceTree(root)).toBe(root);
        });

        test('leaf root', () => {
            const root = leaf(CLEARANCE);
            expect(unwrapBotTraceTree(root)).toBe(root);
        });

        test('lone guard root', () => {
            const root = guard('false');
            expect(unwrapBotTraceTree(root)).toBe(root);
        });

        test('OR with fewer than two children', () => {
            const root = or('!user.isbot', [guard('false')]);
            expect(unwrapBotTraceTree(root)).toBe(root);
        });

        test('OR with more than two children', () => {
            const root = or(`!user.isbot || ${A} || ${B}`, [guard('false'), leaf(A), leaf(B)]);
            expect(unwrapBotTraceTree(root)).toBe(root);
        });

        test('fold whose left side is unguarded', () => {
            const root = or(`${A} || (!user.isbot || ${B})`, [
                or(`${A} || ${C}`, [leaf(A), leaf(C)]),
                or(`!user.isbot || ${B}`, [guard('false'), leaf(B)]),
            ]);
            expect(unwrapBotTraceTree(root)).toBe(root);
        });

        test('guard as the second child', () => {
            const root = or(`${A} || !user.isbot`, [leaf(A), guard('false')]);
            expect(unwrapBotTraceTree(root)).toBe(root);
        });

        test('guard inside a right-hand OR', () => {
            const root = or(`${A} || (!user.isbot || ${B})`, [leaf(A), or(`!user.isbot || ${B}`, [guard('false'), leaf(B)])]);
            expect(unwrapBotTraceTree(root)).toBe(root);
        });

        test('NOT over a different attribute', () => {
            const notOther: PolicySimulationEvaluationNode = {
                kind: 'not',
                expression: '!user.attributes.Flag',
                outcome: 'false',
                children: [{kind: 'other', expression: 'user.attributes.Flag', outcome: 'true'}],
            };
            const root = or(`!user.attributes.Flag || ${A}`, [notOther, leaf(A)]);
            expect(unwrapBotTraceTree(root)).toBe(root);
        });
    });
});

describe('unwrapBotTrace (captured server traces)', () => {
    const SECRET = 'user.attributes.QA3Clearance == "Secret"';
    const TOP_SECRET = 'user.attributes.QA3Clearance == "TopSecret"';

    function blameOf(decision: PolicySimulationActionDecision, source: PolicySimulationBlame['source']) {
        const blame = decision.blame?.find((b) => b.source === source);
        if (!blame?.expression || !blame.evaluation_tree) {
            throw new Error(`fixture has no ${source} blame with a tree`);
        }
        return {expression: blame.expression, tree: blame.evaluation_tree};
    }

    const draftBlame = (decision: PolicySimulationActionDecision) => blameOf(decision, POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE);

    test.each([
        ['single rule', SINGLE_RULE_PERSON],
        ['two-rule fold', TWO_RULE_FOLD_PERSON],
    ])('an allowed person keeps the guard in both the text and the tree (%s)', (_, decision) => {
        const blame = draftBlame(decision);

        const result = unwrapBotTrace(blame.expression, blame.tree);

        expect(result.evaluationTree).toBe(blame.tree);
        expect(result.expression).toBe(blame.expression);
    });

    test.each([
        ['single rule', SINGLE_RULE_BOT_WITHOUT_ATTRIBUTE, SECRET, 'compare'],
        ['two-rule fold', TWO_RULE_FOLD_BOT_WITHOUT_ATTRIBUTE, `(${SECRET}) || (${TOP_SECRET})`, 'or'],
    ])('a denied bot loses the guard in both the text and the tree (%s)', (_, decision, expectedText, rootKind) => {
        const blame = draftBlame(decision);

        const result = unwrapBotTrace(blame.expression, blame.tree);

        expect(result.expression).toBe(expectedText);
        expect(result.evaluationTree?.kind).toBe(rootKind);
        expect(JSON.stringify(result.evaluationTree)).not.toContain('user.isbot');
    });

    test('without a tree the text is returned as-is, guard included', () => {
        const blame = draftBlame(SINGLE_RULE_BOT_WITHOUT_ATTRIBUTE);

        expect(unwrapBotTrace(blame.expression)).toEqual({expression: blame.expression});
    });

    test('a peer policy without the guard is returned unchanged', () => {
        const blame = blameOf(SINGLE_RULE_PERSON, POLICY_SIMULATION_BLAME_SOURCES.PEER_POLICY);

        const result = unwrapBotTrace(blame.expression, blame.tree);

        expect(result.evaluationTree).toBe(blame.tree);
        expect(result.expression).toBe(blame.expression);
    });
});
