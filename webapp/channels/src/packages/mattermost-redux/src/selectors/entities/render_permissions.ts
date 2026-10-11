// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    ACCESS_CONTROL_ACTION_DM_GM_READ_ACCESS,
    ACCESS_CONTROL_ACTION_DM_GM_START,
    ACCESS_CONTROL_ACTION_DM_GM_WRITE_ACCESS,
    ACCESS_CONTROL_DM_GM_ACTIONS,
    ACCESS_CONTROL_RESOURCE_TYPE_PERMISSION,
    ACCESS_CONTROL_SYSTEM_RESOURCE_ID,
} from '@mattermost/types/access_control';
import type {RenderDecisionIdentifier, RenderPermissionEntry} from '@mattermost/types/render_permissions';
import type {GlobalState} from '@mattermost/types/store';

import {isPermissionPoliciesEnabled} from 'mattermost-redux/selectors/entities/general';

// getRenderDecision returns the cached render-time decision for a single
// resource/action, or undefined if none has been fetched yet.
export function getRenderDecision(state: GlobalState, identifier: RenderDecisionIdentifier): RenderPermissionEntry | undefined {
    const {resourceType, resourceId, action} = identifier;
    return state.entities.renderPermissions?.byResource?.[resourceType]?.[resourceId]?.[action];
}

// An unknown decision counts as allowed. Reads the cache directly, like isChannelActionDenied,
// because the Write check runs inside haveIChannelPermission.
function isDmGmActionDenied(state: GlobalState, action: string): boolean {
    if (!isPermissionPoliciesEnabled(state)) {
        return false;
    }

    const decision = state.entities.renderPermissions?.byResource?.[ACCESS_CONTROL_RESOURCE_TYPE_PERMISSION]?.[ACCESS_CONTROL_SYSTEM_RESOURCE_ID]?.[action];

    return Boolean(decision?.evaluated && !decision.allowed);
}

export function isDmGmStartDenied(state: GlobalState): boolean {
    return isDmGmActionDenied(state, ACCESS_CONTROL_ACTION_DM_GM_START);
}

export function isDmGmReadDenied(state: GlobalState): boolean {
    return isDmGmActionDenied(state, ACCESS_CONTROL_ACTION_DM_GM_READ_ACCESS);
}

export function isDmGmWriteDenied(state: GlobalState): boolean {
    return isDmGmActionDenied(state, ACCESS_CONTROL_ACTION_DM_GM_WRITE_ACCESS);
}

// The server doesn't require Read to start a conversation, but starting one the user can't
// read would only make it vanish, so the client offers it only when both are allowed.
export function canStartDmGm(state: GlobalState): boolean {
    return !isDmGmStartDenied(state) && !isDmGmReadDenied(state);
}

export function canReadDmGm(state: GlobalState): boolean {
    return !isDmGmReadDenied(state);
}

export function canWriteDmGm(state: GlobalState): boolean {
    return !isDmGmWriteDenied(state);
}

export function hasDeniedSessionDecision(state: GlobalState): boolean {
    return ACCESS_CONTROL_DM_GM_ACTIONS.some((action) => isDmGmActionDenied(state, action));
}
