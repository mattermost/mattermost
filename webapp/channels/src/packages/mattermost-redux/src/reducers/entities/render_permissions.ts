// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RenderPermissionsState, RenderPermissionEntry} from '@mattermost/types/render_permissions';

import {RenderPermissionTypes, UserTypes} from 'mattermost-redux/action_types';
import type {MMReduxAction} from 'mattermost-redux/action_types';

// Resource type string for channels, matching the server's
// AccessControlPolicyTypeChannel. Render decisions for the upload/download
// affordances are keyed under this type.
const CHANNEL_RESOURCE_TYPE = 'channel';

const initialState: RenderPermissionsState = {
    byResource: {},
};

export default function renderPermissions(state: RenderPermissionsState = initialState, action: MMReduxAction): RenderPermissionsState {
    switch (action.type) {
    case RenderPermissionTypes.RECEIVED_RENDER_DECISIONS: {
        const {resourceType, resourceId, actions, generation, receivedAt} = action.data as {
            resourceType: string;
            resourceId: string;
            actions: Record<string, {allowed: boolean; evaluated: boolean; reason?: string}>;
            generation: number;
            receivedAt: number;
        };

        const existingForType = state.byResource[resourceType] ?? {};
        const existingForResource = existingForType[resourceId] ?? {};

        const nextForResource: {[action: string]: RenderPermissionEntry} = {...existingForResource};
        let changed = false;
        for (const [actionName, decision] of Object.entries(actions)) {
            const prev = nextForResource[actionName];

            // Ignore stale fetch completions: only apply a decision whose
            // generation is at least as new as what we already hold. The
            // generation (not a timestamp) is the invalidation identity.
            if (prev && prev.generation > generation) {
                continue;
            }
            nextForResource[actionName] = {
                ...decision,
                generation,
                receivedAt,
            };
            changed = true;
        }

        if (!changed) {
            return state;
        }

        return {
            ...state,
            byResource: {
                ...state.byResource,
                [resourceType]: {
                    ...existingForType,
                    [resourceId]: nextForResource,
                },
            },
        };
    }
    case RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL: {
        const channelId = action.data.channelId as string;
        const channels = state.byResource[CHANNEL_RESOURCE_TYPE];
        if (!channels || !channels[channelId]) {
            return state;
        }

        const nextChannels = {...channels};
        Reflect.deleteProperty(nextChannels, channelId);
        return {
            ...state,
            byResource: {
                ...state.byResource,
                [CHANNEL_RESOURCE_TYPE]: nextChannels,
            },
        };
    }
    case RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CURRENT_USER:

        // The current user's attributes/roles drive every resource decision, so
        // drop the whole cache and let visible views refetch.
        return initialState;
    case RenderPermissionTypes.CLEAR_RENDER_DECISIONS:
    case UserTypes.LOGOUT_SUCCESS:
        return initialState;
    default:
        return state;
    }
}
