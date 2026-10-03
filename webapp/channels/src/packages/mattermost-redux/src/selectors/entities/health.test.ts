// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HealthFinding} from '@mattermost/types/health';
import type {GlobalState} from '@mattermost/types/store';

import {getFindings, getLastEvaluatedAt} from 'mattermost-redux/selectors/entities/health';

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

function stateWith(findings: HealthFinding[], evaluatedAt = 0) {
    return {
        entities: {
            health: {
                findings: Object.fromEntries(findings.map((finding) => [finding.fingerprint, finding])),
                evaluatedAt,
            },
        },
    } as unknown as GlobalState;
}

describe('selectors.entities.health', () => {
    test('getFindings returns every fetched finding, most severe then newest first', () => {
        const critical = makeFinding({fingerprint: 'critical', severity: 'critical', state_since: 10});
        const warningOld = makeFinding({fingerprint: 'warningOld', severity: 'warning', state_since: 10});
        const warningNew = makeFinding({fingerprint: 'warningNew', severity: 'warning', state_since: 50});
        const info = makeFinding({fingerprint: 'info', severity: 'info', state_since: 90});
        const unknown = makeFinding({fingerprint: 'unknown', severity: 'warning', state: 'unknown', state_since: 30});
        const resolved = makeFinding({fingerprint: 'resolved', severity: 'critical', state: 'resolved', state_since: 5});

        expect(getFindings(stateWith([info, warningOld, resolved, unknown, critical, warningNew]))).toEqual([
            critical,
            resolved,
            warningNew,
            unknown,
            warningOld,
            info,
        ]);
    });

    test('getFindings keeps node-scoped findings of one rule as separate entries', () => {
        const node3 = makeFinding({fingerprint: 'node3', code: 'disk_low', scope: 'node-3'});
        const node5 = makeFinding({fingerprint: 'node5', code: 'disk_low', scope: 'node-5'});

        expect(getFindings(stateWith([node5, node3]))).toEqual([node3, node5]);
    });

    test('getLastEvaluatedAt is the stored evaluation time, not derived from the findings', () => {
        expect(getLastEvaluatedAt(stateWith([makeFinding({fingerprint: 'a', last_seen_at: 900})], 500))).toBe(500);
        expect(getLastEvaluatedAt(stateWith([]))).toBe(0);
    });

    test('getLastEvaluatedAt is set when every finding was muted and none were returned', () => {
        expect(getLastEvaluatedAt(stateWith([], 500))).toBe(500);
    });
});
