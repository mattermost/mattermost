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
    invalidatedAt: 0,
};

export default function renderPermissions(state: RenderPermissionsState = initialState, action: MMReduxAction): RenderPermissionsState {
    switch (action.type) {
    case RenderPermissionTypes.RECEIVED_RENDER_DECISIONS: {
        const {resourceType, resourceId, actions, generation} = action.data as {
            resourceType: string;
            resourceId: string;
            actions: Record<string, {allowed: boolean; evaluated: boolean; reason?: string}>;
            generation: number;
        };

        // A fetch that was already in flight when an invalidation landed carries a decision from
        // before it, so it must not repopulate the cache. Comparing against the generation stamped
        // by the invalidation catches that, which the per-entry check below cannot: after an
        // invalidation there is no entry left to compare with.
        // Persisted state rehydrated from before this field existed has no invalidatedAt.
        if (generation <= (state.invalidatedAt ?? 0)) {
            return state;
        }

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
        const {channelId, generation} = action.data as {channelId: string; generation: number};
        const channels = state.byResource[CHANNEL_RESOURCE_TYPE];
        const nextState = {...state, invalidatedAt: generation};

        if (!channels || !channels[channelId]) {
            return nextState;
        }

        const nextChannels = {...channels};
        Reflect.deleteProperty(nextChannels, channelId);
        return {
            ...nextState,
            byResource: {
                ...state.byResource,
                [CHANNEL_RESOURCE_TYPE]: nextChannels,
            },
        };
    }
    case RenderPermissionTypes.CLEAR_RENDER_DECISIONS:
        return {...initialState, invalidatedAt: action.data.generation as number};
    case UserTypes.LOGOUT_SUCCESS:
        return {...initialState, invalidatedAt: state.invalidatedAt ?? 0};
    default:
        return state;
    }
}
