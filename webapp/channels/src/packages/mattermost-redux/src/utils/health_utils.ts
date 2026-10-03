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

const severityRank: Record<HealthFindingSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
};

// Most severe first, then the most recent change of state.
export function compareHealthFindings(a: HealthFinding, b: HealthFinding) {
    return (severityRank[a.severity] - severityRank[b.severity]) ||
        (b.state_since - a.state_since) ||
        (a.title ?? '').localeCompare(b.title ?? '') ||
        a.scope.localeCompare(b.scope);
}

export function isRecentlyResolved(finding: HealthFinding, now: number) {
    return finding.state === 'resolved' && now - finding.state_since <= RECENTLY_RESOLVED_WINDOW;
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
    const counts = Object.fromEntries(HEALTH_FINDING_TABS.map((tab) => [tab, 0])) as Record<HealthFindingTab, number>;
    for (const finding of findings) {
        for (const tab of HEALTH_FINDING_TABS) {
            if (isInHealthFindingTab(finding, tab, now)) {
                counts[tab]++;
            }
        }
    }
    return counts;
}

// Firing findings only: an unknown is neither a problem nor an all-clear.
export function countFiringBySeverity(findings: HealthFinding[]) {
    const counts: Record<HealthFindingSeverity, number> = {critical: 0, warning: 0, info: 0};
    for (const finding of findings) {
        if (finding.state === 'firing') {
            counts[finding.severity]++;
        }
    }
    return counts;
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
