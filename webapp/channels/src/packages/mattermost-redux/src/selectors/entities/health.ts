// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HealthFinding} from '@mattermost/types/health';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {compareHealthFindings, isHealthFindingMuted} from 'mattermost-redux/utils/health_utils';

function getFindingsByFingerprint(state: GlobalState) {
    return state.entities.health.findings;
}

const getSortedFindings = createSelector(
    'getSortedFindings',
    getFindingsByFingerprint,
    (findings): HealthFinding[] => Object.values(findings).sort(compareHealthFindings),
);

// Every unmuted finding, sorted for display; tab filtering and grouping happen over this list.
export const getFindings = createSelector(
    'getFindings',
    getSortedFindings,
    (findings) => findings.filter((finding) => !isHealthFindingMuted(finding)),
);

export const getMutedFindings = createSelector(
    'getMutedFindings',
    getSortedFindings,
    (findings) => findings.filter(isHealthFindingMuted),
);

export function getLastEvaluatedAt(state: GlobalState) {
    return state.entities.health.evaluatedAt;
}
