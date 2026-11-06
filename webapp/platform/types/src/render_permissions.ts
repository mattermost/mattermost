// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Decides whether to show a control, never whether to allow one: the server re-evaluates the PDP
// on every request, so a stale decision costs a wrong affordance and nothing more.
//
// "Render-time" means cached per resource, not evaluated live. Fetched lazily on a miss — a
// channel switch costs one request, revisiting it costs none — and never polled. Dropped only on
// the websocket events that change an input: channel_access_control_updated for one channel;
// permission_policy_updated, a current-user attribute or role change, or a config/license flip
// for the whole cache.
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

export type RenderPermissionEntry = RenderPermissionDecision & {
    generation: number;
};

// Also the batching key for the decision data loader.
export type RenderDecisionIdentifier = {
    resourceType: string;
    resourceId: string;
    action: string;
};

// A registered system action the current user is allowed, with the permissions of it they hold.
export type DelegatedAction = {
    name: string;
    permissions: string[];
};

export type DelegatedActionsResponse = {
    resource: {
        type: string;
        id?: string;
    };
    results: DelegatedAction[];
};

// The union of the permissions of every allowed DelegatedAction. Like render decisions it only
// decides what the System Console shows; each request is re-evaluated server-side.
export type DelegatedPermissionsState = {
    permissions: string[];

    // False until a fetch completes and again once invalidated, so the console's route guard can
    // wait for the set rather than redirect a delegate who holds no admin role.
    loaded: boolean;

    // Of the last applied fetch or invalidation; a completion at or below it is dropped.
    generation: number;
};

// Client-only; always the current user's decisions.
export type RenderPermissionsState = {
    delegatedPermissions: DelegatedPermissionsState;

    byResource: {
        [resourceType: string]: {
            [resourceId: string]: {
                [action: string]: RenderPermissionEntry;
            };
        };
    };

    // Completions at or below these predate the invalidation and are discarded, so an in-flight
    // fetch can't repopulate a cache that was just cleared. Scoped separately from the cache-wide
    // stamp so dropping one channel doesn't discard another channel's in-flight fetch.
    invalidatedAt: number;
    invalidatedAtByResource: {
        [resourceType: string]: {
            [resourceId: string]: number;
        };
    };
};
