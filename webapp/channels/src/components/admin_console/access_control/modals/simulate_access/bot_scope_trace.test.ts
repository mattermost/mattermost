// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PolicySimulationEvaluationNode} from '@mattermost/types/access_control';

import {unwrapBotTraceExpression, unwrapBotTraceTree} from './bot_scope_trace';

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

describe('unwrapBotTraceExpression', () => {
    test.each([
        ['raw rule', `!user.isbot || (${CLEARANCE}\n)`, CLEARANCE],
        ['JoinExpressions form', `(!user.isbot || (${CLEARANCE}\n))`, CLEARANCE],
        ['JoinExpressions form with surrounding whitespace', `  (!user.isbot || (${CLEARANCE}\n))\n`, CLEARANCE],
        ['masked leaf', '(!(user.isbot)) || (user.attributes.Clearance == "--------")', 'user.attributes.Clearance == "--------"'],
        ['masked AND', `(!(user.isbot)) || ((${A}) && (${B}))`, `(${A}) && (${B})`],
        ['masked form wrapped by JoinExpressions', `((!(user.isbot)) || (${CLEARANCE}))`, CLEARANCE],
        ['re-serialized OR chain', `!user.isbot || ${A} || ${B}`, `${A} || ${B}`],
        ['re-serialized AND body', `!user.isbot || ${A} && ${B}`, `${A} && ${B}`],
    ])('unwraps %s', (_, input, expected) => {
        expect(unwrapBotTraceExpression(input)).toBe(expected);
    });

    test.each([
        ['plain', CLEARANCE],
        ['plain, outer paren closes early', `(${A}) && (${B})`],
        ['plain JoinExpressions form keeps its parens', `(${A})`],
        ['prefix inside a string literal', 'user.attributes.Note == "!user.isbot || x"'],
        ['guard on the right-hand side', `${A} || !user.isbot`],
        ['empty string', ''],
    ])('returns %s unchanged', (_, input) => {
        expect(unwrapBotTraceExpression(input)).toBe(input);
    });

    describe('multi-rule folds', () => {
        const rule = (e: string) => `!user.isbot || (${e}\n)`;
        const masked = (e: string) => `(!(user.isbot)) || (${e})`;

        test.each([
            ['two-rule fold', `(${rule(CLEARANCE)}) || (${rule(A)})`, `(${CLEARANCE}) || (${A})`],
            ['three-rule fold', `(${rule(CLEARANCE)}) || (${rule(A)}) || (${rule(B)})`, `(${CLEARANCE}) || (${A}) || (${B})`],
            ['two-rule fold wrapped in outer parens', `((${rule(CLEARANCE)}) || (${rule(A)}))`, `(${CLEARANCE}) || (${A})`],
            ['two-rule fold of stored chains', `(!user.isbot || ${A} || ${B}) || (${rule(C)})`, `(${A} || ${B}) || (${C})`],
            ['masked two-rule fold', `(${masked(A)}) || (${masked(B)})`, `(${A}) || (${B})`],
            ['masked three-rule fold (left-nested)', `((${masked(A)}) || (${masked(B)})) || (${masked(C)})`, `(${A}) || (${B}) || (${C})`],
            ['masked three-rule fold (right-nested)', `(${masked(A)}) || ((${masked(B)}) || (${masked(C)}))`, `(${A}) || (${B}) || (${C})`],
            ['masked four-rule fold (balanced)', `((${masked(A)}) || (${masked(B)})) || ((${masked(C)}) || (${masked(CLEARANCE)}))`, `(${A}) || (${B}) || (${C}) || (${CLEARANCE})`],
            ['fold with a literal containing a segment separator', `(${rule('user.attributes.Note == ") || ("')}) || (${rule(A)})`, `(user.attributes.Note == ") || (") || (${A})`]])('unwraps %s', (_, input, expected) => {
            expect(unwrapBotTraceExpression(input)).toBe(expected);
        });

        test.each([
            ['fold with a non-Bot-scoped segment', `(${rule(A)}) || (${B})`],
            ['fold with a non-Bot-scoped first segment', `(${B}) || (${rule(A)})`],
            ['masked fold with a non-Bot-scoped segment', `((!(user.isbot)) || (${A})) || (${B})`],
            ['AND of guarded segments', `(${rule(A)}) && (${rule(B)})`],
            ['segments separated by something other than ||', `(${rule(A)}) (${rule(B)})`],
            ['trailing ||', `(${rule(A)}) ||`],
            ['unbalanced parens', `(${rule(A)}) || (${rule(B)}`],
            ['plain fold', `(${A}) || (${B})`],
        ])('returns %s unchanged', (_, input) => {
            expect(unwrapBotTraceExpression(input)).toBe(input);
        });
    });
});

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

        expect(result).toEqual({kind: 'or', expression: `${A} || ${B}`, outcome: 'false', children: [a, b]});
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
        expect(result.expression).toBe(`${A} || ${B} || ${C}`);
    });

    test('masked left-nested chain drops the guard', () => {
        const a = leaf('user.attributes.A == "--------"');
        const b = leaf('user.attributes.B == "--------"');
        const maskedRootText = '((!(user.isbot)) || (user.attributes.A == "--------")) || (user.attributes.B == "--------")';
        const root = or(
            maskedRootText,
            [or('(!(user.isbot)) || (user.attributes.A == "--------")', [guard('false', '!(user.isbot)'), a]), b],
        );

        const result = unwrapBotTraceTree(root);

        expect(result.kind).toBe('or');
        expect(result.children).toHaveLength(2);
        expect(result.children?.[0]).toBe(a);
        expect(result.children?.[1]).toBe(b);

        // Compound text is never rendered; the masked left-nested form is not a flat prefix, so it is left as-is.
        expect(result.expression).toBe(maskedRootText);
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
            const root = or(`(!user.isbot || (${A}\n)) || (!user.isbot || (${B}\n))`, [rule(a), rule(b)]);

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

        test('fold for a person (every guard true) is kept', () => {
            const root = or('r1 || r2', [rule(leaf(A), '!user.isbot', 'true'), rule(leaf(B), '!user.isbot', 'true')], 'true');

            expect(unwrapBotTraceTree(root)).toBe(root);
        });
    });

    test('a person (guard true) keeps the binary tree', () => {
        const root = or(`!user.isbot || ${CLEARANCE}`, [guard('true'), leaf(CLEARANCE)], 'true');

        expect(unwrapBotTraceTree(root)).toBe(root);
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
