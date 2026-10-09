// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HealthFinding} from '@mattermost/types/health';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {compareHealthFindings} from 'mattermost-redux/utils/health_utils';

function getFindingsByFingerprint(state: GlobalState) {
    return state.entities.health.findings;
}

// Every fetched finding, sorted for display; tab filtering and grouping happen over this list.
export const getFindings = createSelector(
    'getFindings',
    getFindingsByFingerprint,
    (findings): HealthFinding[] => Object.values(findings).sort(compareHealthFindings),
);

export function getLastEvaluatedAt(state: GlobalState) {
    return state.entities.health.evaluatedAt;
}
