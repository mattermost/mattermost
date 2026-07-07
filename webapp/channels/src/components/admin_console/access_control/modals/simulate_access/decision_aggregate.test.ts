// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';

import {aggregateDecisions} from './decision_aggregate';

describe('aggregateDecisions', () => {
    test('pending while pending flag is set', () => {
        expect(aggregateDecisions(['a', 'b'], undefined, true)).toBe('pending');
    });

    test('pending when decisions map is missing entirely', () => {
        expect(aggregateDecisions(['a'], undefined, false)).toBe('pending');
    });

    test('pending when one action has no verdict yet', () => {
        expect(aggregateDecisions(
            ['a', 'b'],
            {a: {decision: true}},
            false,
        )).toBe('pending');
    });

    test('pending when actions array is empty', () => {
        expect(aggregateDecisions([], {}, false)).toBe('pending');
    });

    test('allowed when every action allows', () => {
        expect(aggregateDecisions(
            ['a', 'b'],
            {a: {decision: true}, b: {decision: true}},
            false,
        )).toBe('allowed');
    });

    test('denied when every action denies', () => {
        expect(aggregateDecisions(
            ['a', 'b'],
            {a: {decision: false}, b: {decision: false}},
            false,
        )).toBe('denied');
    });

    test('mixed when at least one allow + one deny', () => {
        expect(aggregateDecisions(
            ['a', 'b'],
            {a: {decision: true}, b: {decision: false}},
            false,
        )).toBe('mixed');
    });

    test('not-applicable only when every action is no_applicable_policy', () => {
        const inapplicable = {
            decision: true,
            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY}],
        };
        expect(aggregateDecisions(
            ['a', 'b'],
            {a: inapplicable, b: inapplicable},
            false,
        )).toBe('not-applicable');
    });

    test('inapplicable + real allow rolls up to allowed', () => {
        const inapplicable = {
            decision: true,
            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY}],
        };
        expect(aggregateDecisions(
            ['a', 'b'],
            {a: inapplicable, b: {decision: true}},
            false,
        )).toBe('allowed');
    });

    test('inapplicable + real deny rolls up to denied', () => {
        const inapplicable = {
            decision: true,
            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY}],
        };
        expect(aggregateDecisions(
            ['a', 'b'],
            {a: inapplicable, b: {decision: false}},
            false,
        )).toBe('denied');
    });

    test('single-action allow short-circuits to allowed', () => {
        expect(aggregateDecisions(
            ['a'],
            {a: {decision: true}},
            false,
        )).toBe('allowed');
    });

    test('not-applicable when every action is no_applicable_rule', () => {
        // In the "this rule only" view the server replaces an
        // orphaned-deny or sibling_saved verdict with a synthetic
        // no_applicable_rule blame. The aggregate must treat it the
        // same as no_applicable_policy so the row chip reads
        // "doesn't apply" instead of misleading "allowed".
        const inapplicable = {
            decision: true,
            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE}],
        };
        expect(aggregateDecisions(
            ['a', 'b'],
            {a: inapplicable, b: inapplicable},
            false,
        )).toBe('not-applicable');
    });

    test('no_applicable_rule + real allow rolls up to allowed', () => {
        const inapplicable = {
            decision: true,
            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE}],
        };
        expect(aggregateDecisions(
            ['a', 'b'],
            {a: inapplicable, b: {decision: true}},
            false,
        )).toBe('allowed');
    });

    test('no_applicable_rule + real deny rolls up to denied', () => {
        const inapplicable = {
            decision: true,
            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE}],
        };
        expect(aggregateDecisions(
            ['a', 'b'],
            {a: inapplicable, b: {decision: false}},
            false,
        )).toBe('denied');
    });

    test('mixed no_applicable_rule + no_applicable_policy still rolls up to not-applicable', () => {
        // The two synthetic markers can co-occur on different
        // actions of the same row (e.g. one action falls outside
        // the policy entirely, another falls outside this rule).
        // Both count as inapplicable for the row-level rollup.
        expect(aggregateDecisions(
            ['a', 'b'],
            {
                a: {decision: true, blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_POLICY}]},
                b: {decision: true, blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE}]},
            },
            false,
        )).toBe('not-applicable');
    });
});
