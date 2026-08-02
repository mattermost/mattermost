// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// RenderPermissionDecision is a non-authoritative, render-time ABAC decision for a single action.
// It decides whether to show a control; it must never authorize one — enforcement re-evaluates the
// PDP server-side on every request, so the worst a stale decision can cause is a wrong affordance.
//
// "Render-time" means cached per resource and refreshed on invalidation, not evaluated live.
// Decisions are fetched lazily on a cache miss (so a channel switch costs one request for that
// channel, and revisiting it costs none) and are never polled. They are dropped only when a
// websocket event says an input changed: channel_access_control_updated for one channel, and
// permission_policy_updated, a current-user attribute or role change, or a config/license change
// that flips the feature for the whole cache.
export type RenderPermissionDecision = {
    allowed: boolean;
    evaluated: boolean;
    reason?: string;
};

export type ActionSearchResult = {action: {name: string}};

export type ActionSearchSubject = {
    id: string;
    type?: string;
};

export type ActionSearchPage = {next_token?: string};

export type ActionSearchRequest = {
    resource: {
        type: string;
        id: string;
    };
    actions?: string[]; // optional; omit for discovery mode
    subject?: ActionSearchSubject; // reserved
    page?: ActionSearchPage; // reserved
};

export type ActionSearchResponse = {
    resource: {
        type: string;
        id: string;
    };
    results: ActionSearchResult[];
    decisions: Record<string, RenderPermissionDecision>;
    page?: ActionSearchPage;
};

// Entries carry the monotonic generation assigned to their fetch by the action creator, which is
// what lets the reducer ignore stale completions.
export type RenderPermissionEntry = RenderPermissionDecision & {
    generation: number;
};

// Identifies a single cached decision. Doubles as the batching key for the decision data loader.
export type RenderDecisionIdentifier = {
    resourceType: string;
    resourceId: string;
    action: string;
};

// The client-only cache of the current user's render decisions.
export type RenderPermissionsState = {
    byResource: {
        [resourceType: string]: {
            [resourceId: string]: {
                [action: string]: RenderPermissionEntry;
            };
        };
    };

    // Generation of the most recent invalidation. Completions at or below it predate it and are
    // discarded, so an in-flight fetch cannot repopulate a cache that was just cleared.
    invalidatedAt: number;
};
