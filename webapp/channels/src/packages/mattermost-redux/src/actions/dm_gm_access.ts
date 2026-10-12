// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    ACCESS_CONTROL_DM_GM_DENIAL_ERROR_IDS,
    ACCESS_CONTROL_RESOURCE_TYPE_PERMISSION,
    ACCESS_CONTROL_SYSTEM_RESOURCE_ID,
} from '@mattermost/types/access_control';
import type {ServerError} from '@mattermost/types/errors';

import {RenderPermissionTypes} from 'mattermost-redux/action_types';
import {nextRenderDecisionGeneration} from 'mattermost-redux/actions/render_permissions_generation';

// Turns a DM/GM policy 403 into a recorded denial. Stamped with a new generation so a decision
// fetch already in flight can't overwrite it. Imports nothing from helpers.ts, which calls it.
export function dmGmDenialFromError(err: ServerError) {
    const action = err.server_error_id ? ACCESS_CONTROL_DM_GM_DENIAL_ERROR_IDS[err.server_error_id] : undefined;
    if (!action) {
        return undefined;
    }

    return {
        type: RenderPermissionTypes.RECEIVED_RENDER_DECISIONS,
        data: {
            resourceType: ACCESS_CONTROL_RESOURCE_TYPE_PERMISSION,
            resourceId: ACCESS_CONTROL_SYSTEM_RESOURCE_ID,
            actions: {[action]: {allowed: false, evaluated: true}},
            generation: nextRenderDecisionGeneration(),
        },
    };
}
