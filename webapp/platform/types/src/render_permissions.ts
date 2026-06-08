// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// RenderPermissionDecision is a non-authoritative, render-time ABAC decision for
// a single action. It is used to decide whether to show a control; it must never
// be used to authorize an action (enforcement re-evaluates the PDP server-side).
export type RenderPermissionDecision = {
    allowed: boolean;
    evaluated: boolean;
    reason?: string;
};

export type ActionSearchRequest = {
    resource: {
        type: string;
        id: string;
    };
    actions: string[];
};

export type ActionSearchResponse = {
    resource: {
        type: string;
        id: string;
    };
    actions: Record<string, RenderPermissionDecision>;
};

// RenderPermissionsState is the client-only cache of render decisions, keyed by
// resource type -> resource id -> action. Entries carry a monotonic generation
// (assigned by the action creator) used to ignore stale fetch completions.
export type RenderPermissionEntry = RenderPermissionDecision & {
    generation: number;
    receivedAt: number;
};

export type RenderPermissionsState = {
    byResource: {
        [resourceType: string]: {
            [resourceId: string]: {
                [action: string]: RenderPermissionEntry;
            };
        };
    };

    // Channels whose cached posts may be stale after an off-screen policy/attribute change.
    // Consumed by syncPostsOrReloadIfStale on next visit to trigger a fresh loadUnreads.
    channelsWithStalePosts: {[channelId: string]: true};
};
