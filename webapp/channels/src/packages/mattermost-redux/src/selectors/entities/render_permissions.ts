// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RenderDecisionIdentifier, RenderPermissionEntry} from '@mattermost/types/render_permissions';
import type {GlobalState} from '@mattermost/types/store';

// getRenderDecision returns the cached render-time decision for a single
// resource/action, or undefined if none has been fetched yet.
export function getRenderDecision(state: GlobalState, identifier: RenderDecisionIdentifier): RenderPermissionEntry | undefined {
    const {resourceType, resourceId, action} = identifier;
    return state.entities.renderPermissions.byResource[resourceType]?.[resourceId]?.[action];
}
