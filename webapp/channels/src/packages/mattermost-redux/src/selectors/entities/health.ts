// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HealthFinding, HealthFindingSeverity} from '@mattermost/types/health';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

const severityRank: Record<HealthFindingSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
};

// Most severe first, then the longest-standing, so what has been stuck the longest leads.
function compareFindings(a: HealthFinding, b: HealthFinding) {
    return (severityRank[a.severity] - severityRank[b.severity]) ||
        (a.state_since - b.state_since) ||
        (a.title ?? '').localeCompare(b.title ?? '') ||
        a.scope.localeCompare(b.scope);
}

function getFindingsByFingerprint(state: GlobalState) {
    return state.entities.health.findings;
}

export const getFindings = createSelector(
    'getFindings',
    getFindingsByFingerprint,
    (findings): HealthFinding[] => Object.values(findings),
);

// Firing findings only: unknowns are listed separately and resolved ones are not listed.
export const getFindingsByArea = createSelector(
    'getFindingsByArea',
    getFindings,
    (findings) => {
        const byArea: Record<string, HealthFinding[]> = {};
        for (const finding of findings) {
            if (finding.state !== 'firing') {
                continue;
            }
            if (!byArea[finding.area]) {
                byArea[finding.area] = [];
            }
            byArea[finding.area].push(finding);
        }
        for (const areaFindings of Object.values(byArea)) {
            areaFindings.sort(compareFindings);
        }
        return byArea;
    },
);

export const getUnknownFindings = createSelector(
    'getUnknownFindings',
    getFindings,
    (findings) => findings.filter((finding) => finding.state === 'unknown').sort(compareFindings),
);

// Counts firing findings only; an unknown is neither a problem nor an all-clear.
export const getSeverityCounts = createSelector(
    'getSeverityCounts',
    getFindings,
    (findings) => {
        const counts: Record<HealthFindingSeverity, number> = {critical: 0, warning: 0, info: 0};
        for (const finding of findings) {
            if (finding.state === 'firing') {
                counts[finding.severity]++;
            }
        }
        return counts;
    },
);

// Every cycle touches every evaluated subject, resolved ones included, so the newest
// last_seen_at is when the last cycle ran. 0 when nothing has been evaluated yet.
export const getLastEvaluatedAt = createSelector(
    'getLastEvaluatedAt',
    getFindings,
    (findings) => findings.reduce((latest, finding) => Math.max(latest, finding.last_seen_at), 0),
);
