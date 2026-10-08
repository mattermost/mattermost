// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HealthFinding, HealthFindingFilter, HealthFindingList} from '@mattermost/types/health';

import {HealthTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {Client4} from 'mattermost-redux/client';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

// Muted findings are included by default because the selectors split muted from unmuted.
export function getHealthFindings(filter: HealthFindingFilter = {muted: 'included'}): ActionFuncAsync<HealthFindingList> {
    return bindClientFunc({
        clientFunc: Client4.getHealthFindings,
        onSuccess: HealthTypes.RECEIVED_HEALTH_FINDINGS,
        params: [filter],
    });
}

// Restores the finding if the request fails, so a mute that did not take effect never stays on screen.
function updateMuteOptimistically(
    fingerprint: string,
    update: (finding: HealthFinding) => HealthFinding,
    request: (fingerprint: string) => Promise<unknown>,
): ActionFuncAsync {
    return async (dispatch, getState) => {
        const original = getState().entities.health.findings[fingerprint];
        const optimistic = original && update(original);
        if (optimistic) {
            dispatch({type: HealthTypes.RECEIVED_HEALTH_FINDING, data: optimistic});
        }

        try {
            await request(fingerprint);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));

            // Skip the rollback if a later mute or unmute of this finding has replaced our update.
            if (original && getState().entities.health.findings[fingerprint] === optimistic) {
                dispatch({type: HealthTypes.RECEIVED_HEALTH_FINDING, data: original});
            }
            return {error};
        }

        return {data: true};
    };
}

export function muteHealthFinding(fingerprint: string): ActionFuncAsync {
    return (dispatch, getState) => {
        const mutedBy = getCurrentUserId(getState());
        return dispatch(updateMuteOptimistically(
            fingerprint,
            (finding) => ({...finding, muted_at: Date.now(), muted_by: mutedBy}),
            Client4.muteHealthFinding,
        ));
    };
}

export function unmuteHealthFinding(fingerprint: string): ActionFuncAsync {
    return updateMuteOptimistically(
        fingerprint,
        (finding) => ({...finding, muted_at: undefined, muted_by: undefined}),
        Client4.unmuteHealthFinding,
    );
}
