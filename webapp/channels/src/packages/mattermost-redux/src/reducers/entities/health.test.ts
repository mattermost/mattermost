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
        expect(reducer(undefined, {type: 'INIT'})).toEqual({findings: {}});
    });

    test('RECEIVED_HEALTH_FINDINGS replaces the previous findings', () => {
        const first = makeFinding('first');
        const second = makeFinding('second');

        let state = reducer(undefined, {type: HealthTypes.RECEIVED_HEALTH_FINDINGS, data: [first]});
        expect(state.findings).toEqual({first});

        state = reducer(state, {type: HealthTypes.RECEIVED_HEALTH_FINDINGS, data: [second]});
        expect(state.findings).toEqual({second});
    });

    test('LOGOUT_SUCCESS clears the findings', () => {
        const state = reducer(undefined, {type: HealthTypes.RECEIVED_HEALTH_FINDINGS, data: [makeFinding('first')]});

        expect(reducer(state, {type: UserTypes.LOGOUT_SUCCESS}).findings).toEqual({});
    });
});
