// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RenderPermissionEntry} from '@mattermost/types/render_permissions';
import type {GlobalState} from '@mattermost/types/store';

// getRenderDecision returns the cached render-time decision for a single
// resource/action, or undefined if none has been fetched yet.
export function getRenderDecision(state: GlobalState, resourceType: string, resourceId: string, action: string): RenderPermissionEntry | undefined {
    return state.entities.renderPermissions.byResource[resourceType]?.[resourceId]?.[action];
}

export function isChannelPostsStaleForRedaction(state: GlobalState, channelId: string): boolean {
    return Boolean(state.entities.renderPermissions.channelsWithStalePosts?.[channelId]);
}
