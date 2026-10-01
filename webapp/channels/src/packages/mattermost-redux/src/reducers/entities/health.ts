// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {HealthFinding, HealthState} from '@mattermost/types/health';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {HealthTypes, UserTypes} from 'mattermost-redux/action_types';

// Each fetch returns the complete list, so a finding missing from it must not linger.
function findings(state: HealthState['findings'] = {}, action: MMReduxAction): HealthState['findings'] {
    switch (action.type) {
    case HealthTypes.RECEIVED_HEALTH_FINDINGS: {
        const next: HealthState['findings'] = {};
        for (const finding of action.data as HealthFinding[]) {
            next[finding.fingerprint] = finding;
        }
        return next;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    findings,
});
