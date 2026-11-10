// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HealthFinding} from '@mattermost/types/health';

import {HealthTypes, UserTypes} from 'mattermost-redux/action_types';
import reducer from 'mattermost-redux/reducers/entities/health';

function makeFinding(fingerprint: string): HealthFinding {
    return {
        fingerprint,
        code: 'rule',
        subject: 'subject',
        scope: '',
        severity: 'warning',
        state: 'firing',
        area: 'database',
        surface: 'product',
        message_id: 'health.rule.rule.message',
        first_seen_at: 1,
        last_seen_at: 2,
        state_since: 1,
    };
}

describe('reducers.entities.health', () => {
    test('initial state', () => {
        expect(reducer(undefined, {type: 'INIT'})).toEqual({findings: {}, evaluatedAt: 0});
    });

    test('RECEIVED_HEALTH_FINDINGS replaces the previous findings and evaluation time', () => {
        const first = makeFinding('first');
        const second = makeFinding('second');

        let state = reducer(undefined, {type: HealthTypes.RECEIVED_HEALTH_FINDINGS, data: {evaluated_at: 10, findings: [first]}});
        expect(state).toEqual({findings: {first}, evaluatedAt: 10});

        state = reducer(state, {type: HealthTypes.RECEIVED_HEALTH_FINDINGS, data: {evaluated_at: 20, findings: [second]}});
        expect(state).toEqual({findings: {second}, evaluatedAt: 20});
    });

    test('RECEIVED_HEALTH_FINDINGS keeps the evaluation time when every finding is filtered out', () => {
        const state = reducer(undefined, {type: HealthTypes.RECEIVED_HEALTH_FINDINGS, data: {evaluated_at: 10, findings: []}});

        expect(state).toEqual({findings: {}, evaluatedAt: 10});
    });

    test('RECEIVED_HEALTH_FINDING replaces one finding and keeps the others', () => {
        const first = makeFinding('first');
        const second = makeFinding('second');
        const state = reducer(undefined, {type: HealthTypes.RECEIVED_HEALTH_FINDINGS, data: {evaluated_at: 10, findings: [first, second]}});

        const mutedFirst = {...first, muted_at: 30, muted_by: 'admin'};
        const next = reducer(state, {type: HealthTypes.RECEIVED_HEALTH_FINDING, data: mutedFirst});

        expect(next).toEqual({findings: {first: mutedFirst, second}, evaluatedAt: 10});
        expect(next.findings.second).toBe(second);
    });

    test('LOGOUT_SUCCESS clears the findings and evaluation time', () => {
        const state = reducer(undefined, {type: HealthTypes.RECEIVED_HEALTH_FINDINGS, data: {evaluated_at: 10, findings: [makeFinding('first')]}});

        expect(reducer(state, {type: UserTypes.LOGOUT_SUCCESS})).toEqual({findings: {}, evaluatedAt: 0});
    });
});
