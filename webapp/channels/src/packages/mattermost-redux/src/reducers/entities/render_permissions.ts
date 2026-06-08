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
    channelsWithStalePosts: {},
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

        // Preserve channelsWithStalePosts: persisted Redux state may not have this field.
        return {...initialState, channelsWithStalePosts: state.channelsWithStalePosts ?? {}};
    case RenderPermissionTypes.MARK_CHANNEL_POSTS_STALE_FOR_REDACTION: {
        const channelId = action.data.channelId as string;
        const stalePosts = state.channelsWithStalePosts ?? {};
        if (stalePosts[channelId]) {
            return state;
        }
        return {
            ...state,
            channelsWithStalePosts: {...stalePosts, [channelId]: true},
        };
    }
    case RenderPermissionTypes.CONSUME_CHANNEL_POSTS_STALE_FOR_REDACTION: {
        const channelId = action.data.channelId as string;
        const stalePosts = state.channelsWithStalePosts ?? {};
        if (!stalePosts[channelId]) {
            return state;
        }
        const next = {...stalePosts};
        Reflect.deleteProperty(next, channelId);
        return {...state, channelsWithStalePosts: next};
    }
    case RenderPermissionTypes.CLEAR_RENDER_DECISIONS:
    case UserTypes.LOGOUT_SUCCESS:
        return initialState;
    default:
        return state;
    }
}
