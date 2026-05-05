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
});
