// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HealthFinding} from '@mattermost/types/health';

import {
    compareHealthFindings,
    countHealthFindingsByTab,
    filterHealthFindingsByTab,
    groupHealthFindingsByArea,
    groupHealthFindingsBySection,
    RECENTLY_RESOLVED_WINDOW,
} from './health_utils';

const now = 1_000_000_000_000;
const hour = 60 * 60 * 1000;

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
        first_seen_at: now - hour,
        last_seen_at: now,
        state_since: now - hour,
        ...overrides,
    };
}

const critical = makeFinding({fingerprint: 'critical', severity: 'critical', area: 'notifications'});
const warning = makeFinding({fingerprint: 'warning', severity: 'warning'});
const info = makeFinding({fingerprint: 'info', severity: 'info'});
const unknownCritical = makeFinding({fingerprint: 'unknownCritical', severity: 'critical', state: 'unknown'});
const unknownWarning = makeFinding({fingerprint: 'unknownWarning', severity: 'warning', state: 'unknown', area: 'auth'});
const resolvedRecent = makeFinding({fingerprint: 'resolvedRecent', severity: 'critical', state: 'resolved', state_since: now - RECENTLY_RESOLVED_WINDOW});
const resolvedOld = makeFinding({fingerprint: 'resolvedOld', severity: 'critical', state: 'resolved', state_since: now - RECENTLY_RESOLVED_WINDOW - 1});

const all = [critical, warning, info, unknownCritical, unknownWarning, resolvedRecent, resolvedOld];

function fingerprints(findings: HealthFinding[]) {
    return findings.map((finding) => finding.fingerprint);
}

describe('mattermost-redux/utils/health_utils', () => {
    describe('filterHealthFindingsByTab', () => {
        test('open is every firing and every unknown finding', () => {
            expect(fingerprints(filterHealthFindingsByTab(all, 'open', now))).toEqual(['critical', 'warning', 'info', 'unknownCritical', 'unknownWarning']);
        });

        test('severity tabs hold firing findings of that severity only, never unknowns', () => {
            expect(fingerprints(filterHealthFindingsByTab(all, 'critical', now))).toEqual(['critical']);
            expect(fingerprints(filterHealthFindingsByTab(all, 'warning', now))).toEqual(['warning']);
            expect(fingerprints(filterHealthFindingsByTab(all, 'info', now))).toEqual(['info']);
        });

        test('recently resolved holds findings resolved within the last 7 days and hides older ones', () => {
            expect(fingerprints(filterHealthFindingsByTab(all, 'resolved', now))).toEqual(['resolvedRecent']);
        });

        test('the resolved window moves with now', () => {
            expect(filterHealthFindingsByTab([resolvedRecent], 'resolved', now + 1)).toEqual([]);
        });

        test('unknown holds unknown findings only', () => {
            expect(fingerprints(filterHealthFindingsByTab(all, 'unknown', now))).toEqual(['unknownCritical', 'unknownWarning']);
        });
    });

    describe('countHealthFindingsByTab', () => {
        test('counts every tab, with open as firing plus unknown', () => {
            expect(countHealthFindingsByTab(all, now)).toEqual({
                open: 5,
                critical: 1,
                warning: 1,
                info: 1,
                resolved: 1,
                unknown: 2,
            });
        });

        test('unknowns are excluded from severity counts', () => {
            expect(countHealthFindingsByTab([unknownCritical, unknownWarning], now)).toEqual({
                open: 2,
                critical: 0,
                warning: 0,
                info: 0,
                resolved: 0,
                unknown: 2,
            });
        });
    });

    test('compareHealthFindings sorts by severity, then newest state change first', () => {
        const oldCritical = makeFinding({fingerprint: 'oldCritical', severity: 'critical', state_since: now - (3 * hour)});
        const newCritical = makeFinding({fingerprint: 'newCritical', severity: 'critical', state_since: now - hour});
        const newInfo = makeFinding({fingerprint: 'newInfo', severity: 'info', state_since: now});
        const oldWarning = makeFinding({fingerprint: 'oldWarning', severity: 'warning', state_since: now - (5 * hour)});

        expect(fingerprints([newInfo, oldCritical, oldWarning, newCritical].sort(compareHealthFindings))).toEqual([
            'newCritical',
            'oldCritical',
            'oldWarning',
            'newInfo',
        ]);
    });

    test('groupHealthFindingsBySection keeps unknown and resolved apart from severities, in display order', () => {
        const groups = groupHealthFindingsBySection([resolvedRecent, unknownCritical, info, critical]);

        expect(groups.map(({section, findings}) => [section, fingerprints(findings)])).toEqual([
            ['critical', ['critical']],
            ['info', ['info']],
            ['unknown', ['unknownCritical']],
            ['resolved', ['resolvedRecent']],
        ]);
    });

    test('groupHealthFindingsByArea groups every state by area', () => {
        expect(groupHealthFindingsByArea([critical, warning, unknownWarning, resolvedRecent])).toEqual({
            notifications: [critical],
            database: [warning, resolvedRecent],
            auth: [unknownWarning],
        });
    });
});
