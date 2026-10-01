// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HealthFinding} from '@mattermost/types/health';
import type {GlobalState} from '@mattermost/types/store';

import {
    getFindings,
    getFindingsByArea,
    getLastEvaluatedAt,
    getSeverityCounts,
    getUnknownFindings,
} from 'mattermost-redux/selectors/entities/health';

function makeFinding(overrides: Partial<HealthFinding> & Pick<HealthFinding, 'fingerprint'>): HealthFinding {
    return {
        code: 'rule',
        subject: 'subject',
        scope: '',
        severity: 'warning',
        state: 'firing',
        area: 'database',
        surface: 'product',
        title: 'Title',
        message_id: 'health.rule.rule.message',
        first_seen_at: 100,
        last_seen_at: 200,
        state_since: 100,
        ...overrides,
    };
}

function stateWith(findings: HealthFinding[]) {
    return {
        entities: {
            health: {
                findings: Object.fromEntries(findings.map((finding) => [finding.fingerprint, finding])),
            },
        },
    } as unknown as GlobalState;
}

describe('selectors.entities.health', () => {
    const critical = makeFinding({fingerprint: 'critical', severity: 'critical', area: 'notifications'});
    const warningOld = makeFinding({fingerprint: 'warningOld', severity: 'warning', state_since: 10});
    const warningNew = makeFinding({fingerprint: 'warningNew', severity: 'warning', state_since: 50});
    const info = makeFinding({fingerprint: 'info', severity: 'info', last_seen_at: 900});
    const unknownCritical = makeFinding({fingerprint: 'unknownCritical', severity: 'critical', state: 'unknown'});
    const unknownWarning = makeFinding({fingerprint: 'unknownWarning', severity: 'warning', state: 'unknown'});
    const resolved = makeFinding({fingerprint: 'resolved', severity: 'critical', state: 'resolved', last_seen_at: 1000});

    const state = stateWith([info, warningNew, critical, unknownWarning, warningOld, unknownCritical, resolved]);

    test('getFindings returns every fetched finding', () => {
        expect(getFindings(state)).toHaveLength(7);
    });

    test('getSeverityCounts counts firing findings only, never unknown or resolved', () => {
        expect(getSeverityCounts(state)).toEqual({critical: 1, warning: 2, info: 1});
    });

    test('getSeverityCounts is all zero when only unknowns exist', () => {
        expect(getSeverityCounts(stateWith([unknownCritical, unknownWarning]))).toEqual({critical: 0, warning: 0, info: 0});
    });

    test('getFindingsByArea groups firing findings, most severe then longest standing first', () => {
        expect(getFindingsByArea(state)).toEqual({
            notifications: [critical],
            database: [warningOld, warningNew, info],
        });
    });

    test('getFindingsByArea keeps node-scoped findings of one rule as separate entries', () => {
        const node3 = makeFinding({fingerprint: 'node3', code: 'disk_low', scope: 'node-3'});
        const node5 = makeFinding({fingerprint: 'node5', code: 'disk_low', scope: 'node-5'});

        expect(getFindingsByArea(stateWith([node5, node3]))).toEqual({database: [node3, node5]});
    });

    test('getUnknownFindings returns unknowns only, sorted by severity', () => {
        expect(getUnknownFindings(state)).toEqual([unknownCritical, unknownWarning]);
    });

    test('getLastEvaluatedAt is the newest last_seen_at, resolved findings included', () => {
        expect(getLastEvaluatedAt(state)).toBe(1000);
        expect(getLastEvaluatedAt(stateWith([]))).toBe(0);
    });
});
