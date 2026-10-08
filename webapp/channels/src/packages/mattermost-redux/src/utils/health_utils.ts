// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HealthFinding, HealthFindingSeverity} from '@mattermost/types/health';

export type HealthFindingTab = 'open' | HealthFindingSeverity | 'resolved' | 'unknown';

// Where a finding is listed when grouped by severity. Unknown and resolved findings are never
// folded into the severity of their rule.
export type HealthFindingSection = HealthFindingSeverity | 'unknown' | 'resolved';

export const HEALTH_FINDING_TABS: HealthFindingTab[] = ['open', 'critical', 'warning', 'info', 'resolved', 'unknown'];

export const HEALTH_FINDING_SECTIONS: HealthFindingSection[] = ['critical', 'warning', 'info', 'unknown', 'resolved'];

export const HEALTH_SEVERITIES: HealthFindingSeverity[] = ['critical', 'warning', 'info'];

export const RECENTLY_RESOLVED_WINDOW = 7 * 24 * 60 * 60 * 1000;

// Most severe first, then the most recent change of state.
export function compareHealthFindings(a: HealthFinding, b: HealthFinding) {
    return (HEALTH_SEVERITIES.indexOf(a.severity) - HEALTH_SEVERITIES.indexOf(b.severity)) ||
        (b.state_since - a.state_since) ||
        (a.title ?? '').localeCompare(b.title ?? '') ||
        a.scope.localeCompare(b.scope);
}

export function isHealthFindingMuted(finding: HealthFinding) {
    return Boolean(finding.muted_at);
}

// A check that passed on its first run is stored as resolved without ever having changed state.
export function isRecentlyResolved(finding: HealthFinding, now: number) {
    return finding.state === 'resolved' &&
        finding.state_since !== finding.first_seen_at &&
        now - finding.state_since <= RECENTLY_RESOLVED_WINDOW;
}

export function getHealthFindingSection(finding: HealthFinding): HealthFindingSection {
    return finding.state === 'firing' ? finding.severity : finding.state;
}

export function isInHealthFindingTab(finding: HealthFinding, tab: HealthFindingTab, now: number) {
    switch (tab) {
    case 'open':
        return finding.state === 'firing' || finding.state === 'unknown';
    case 'resolved':
        return isRecentlyResolved(finding, now);
    case 'unknown':
        return finding.state === 'unknown';
    default:
        return finding.state === 'firing' && finding.severity === tab;
    }
}

export function filterHealthFindingsByTab(findings: HealthFinding[], tab: HealthFindingTab, now: number) {
    return findings.filter((finding) => isInHealthFindingTab(finding, tab, now));
}

export function countHealthFindingsByTab(findings: HealthFinding[], now: number) {
    return Object.fromEntries(
        HEALTH_FINDING_TABS.map((tab) => [tab, filterHealthFindingsByTab(findings, tab, now).length]),
    ) as Record<HealthFindingTab, number>;
}

// Non-empty sections in display order; findings keep their incoming order.
export function groupHealthFindingsBySection(findings: HealthFinding[]) {
    const groups = HEALTH_FINDING_SECTIONS.map((section) => ({
        section,
        findings: findings.filter((finding) => getHealthFindingSection(finding) === section),
    }));
    return groups.filter((group) => group.findings.length > 0);
}

export function groupHealthFindingsByArea(findings: HealthFinding[]) {
    const byArea: Record<string, HealthFinding[]> = {};
    for (const finding of findings) {
        if (!byArea[finding.area]) {
            byArea[finding.area] = [];
        }
        byArea[finding.area].push(finding);
    }
    return byArea;
}
