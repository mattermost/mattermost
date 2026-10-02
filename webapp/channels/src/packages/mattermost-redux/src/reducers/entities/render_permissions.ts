// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RenderPermissionsState, RenderPermissionEntry} from '@mattermost/types/render_permissions';

import {RenderPermissionTypes, UserTypes} from 'mattermost-redux/action_types';
import type {MMReduxAction} from 'mattermost-redux/action_types';

// Matches the server's AccessControlPolicyTypeChannel.
const CHANNEL_RESOURCE_TYPE = 'channel';

type ByResource = RenderPermissionsState['byResource'];
type InvalidatedAtByResource = RenderPermissionsState['invalidatedAtByResource'];

export function invalidatedAt(state = 0, action: MMReduxAction): number {
    switch (action.type) {
    case RenderPermissionTypes.CLEAR_RENDER_DECISIONS:
        return (action.data?.generation as number) ?? state;
    default:
        return state;
    }
}

// Dropped wholesale on a cache-wide invalidation, whose stamp already supersedes every entry here.
export function invalidatedAtByResource(state: InvalidatedAtByResource = {}, action: MMReduxAction): InvalidatedAtByResource {
    switch (action.type) {
    case RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL: {
        const {channelId, generation} = action.data as {channelId: string; generation: number};
        return {
            ...state,
            [CHANNEL_RESOURCE_TYPE]: {
                ...state[CHANNEL_RESOURCE_TYPE],
                [channelId]: generation,
            },
        };
    }
    case RenderPermissionTypes.CLEAR_RENDER_DECISIONS:
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

// The one key that can't be reduced in isolation: applying a completion depends on the stamps.
export function byResource(
    state: ByResource = {},
    action: MMReduxAction,
    nextInvalidatedAt: number,
    nextInvalidatedAtByResource: InvalidatedAtByResource,
): ByResource {
    switch (action.type) {
    case RenderPermissionTypes.RECEIVED_RENDER_DECISIONS: {
        const {resourceType, resourceId, actions, generation} = action.data as {
            resourceType: string;
            resourceId: string;
            actions: Record<string, {allowed: boolean; evaluated: boolean; reason?: string}>;
            generation: number;
        };

        // A fetch in flight when an invalidation landed predates it and must not repopulate the
        // cache; the per-entry check below can't catch that, since the entry is gone. Scoped stamp
        // consulted too, so invalidating one channel doesn't discard another's in-flight fetch.
        const invalidated = Math.max(
            nextInvalidatedAt,
            nextInvalidatedAtByResource[resourceType]?.[resourceId] ?? 0,
        );
        if (generation <= invalidated) {
            return state;
        }

        const existingForType = state[resourceType] ?? {};
        const existingForResource = existingForType[resourceId] ?? {};

        const nextForResource: {[action: string]: RenderPermissionEntry} = {...existingForResource};
        let changed = false;
        for (const [actionName, decision] of Object.entries(actions)) {
            const prev = nextForResource[actionName];

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
            [resourceType]: {
                ...existingForType,
                [resourceId]: nextForResource,
            },
        };
    }
    case RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL: {
        const channelId = action.data.channelId as string;
        const channels = state[CHANNEL_RESOURCE_TYPE];
        if (!channels || !channels[channelId]) {
            return state;
        }

        const nextChannels = {...channels};
        Reflect.deleteProperty(nextChannels, channelId);
        return {
            ...state,
            [CHANNEL_RESOURCE_TYPE]: nextChannels,
        };
    }
    case RenderPermissionTypes.CLEAR_RENDER_DECISIONS:
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

// Composed by hand rather than with combineReducers, which gives a child no access to its
// siblings. Mirrors how posts.ts threads state.posts into postsInChannel.
export default function renderPermissions(state: Partial<RenderPermissionsState> = {}, action: MMReduxAction): RenderPermissionsState {
    const nextInvalidatedAt = invalidatedAt(state.invalidatedAt, action);
    const nextInvalidatedAtByResource = invalidatedAtByResource(state.invalidatedAtByResource, action);

    const nextState = {
        byResource: byResource(state.byResource, action, nextInvalidatedAt, nextInvalidatedAtByResource),
        invalidatedAt: nextInvalidatedAt,
        invalidatedAtByResource: nextInvalidatedAtByResource,
    };

    if (state.byResource === nextState.byResource &&
        state.invalidatedAt === nextState.invalidatedAt &&
        state.invalidatedAtByResource === nextState.invalidatedAtByResource) {
        // None of the children changed, so don't let the parent object change either.
        return state as RenderPermissionsState;
    }

    return nextState;
}
