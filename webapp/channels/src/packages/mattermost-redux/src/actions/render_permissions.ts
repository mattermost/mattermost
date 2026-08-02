// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ActionSearchResponse, RenderDecisionIdentifier} from '@mattermost/types/render_permissions';

import {RenderPermissionTypes} from 'mattermost-redux/action_types';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';
import {DelayedDataLoader} from 'mattermost-redux/utils/data_loader';

// Strictly-increasing token stamped on each fetch and on each invalidation. It is the ordering
// identity the reducer uses to discard completions that a newer fetch or an invalidation has
// already superseded. A counter rather than Date.now(), which can collide within a millisecond.
let generationCounter = 0;

export function fetchRenderActionsForResource(resourceType: string, resourceId: string, actions: string[]): ActionFuncAsync<ActionSearchResponse> {
    return async (dispatch, getState) => {
        const generation = ++generationCounter;

        let data: ActionSearchResponse;
        try {
            data = await Client4.searchAccessControlDecisionActions(resourceType, resourceId, actions);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }

        dispatch({
            type: RenderPermissionTypes.RECEIVED_RENDER_DECISIONS,
            data: {
                resourceType: data.resource.type,
                resourceId: data.resource.id,
                actions: data.decisions,
                generation,
            },
        });

        return {data};
    };
}

// The Action Search endpoint takes one resource per request, so a batch is grouped by resource and
// issued as one request per group carrying that group's actions. Capping the batch at the server's
// per-request action limit keeps any single group within it, since a group can never hold more
// identifiers than the batch itself.
const maxRenderDecisionsPerBatch = 16;
const renderDecisionsBatchWaitMs = 100;

function sameRenderDecisionIdentifier(a: RenderDecisionIdentifier, b: RenderDecisionIdentifier) {
    return a.resourceType === b.resourceType && a.resourceId === b.resourceId && a.action === b.action;
}

// fetchRenderActionsForResourceBatched coalesces the decision fetches of components that are
// unaware of each other — the centre channel and RHS editors, and eventually one hook per post or
// attachment — into a single request per resource.
export function fetchRenderActionsForResourceBatched(identifier: RenderDecisionIdentifier): ActionFuncAsync {
    return async (dispatch, getState, {loaders}: any) => {
        if (!loaders.renderDecisionsLoader) {
            loaders.renderDecisionsLoader = new DelayedDataLoader<RenderDecisionIdentifier>({
                fetchBatch: (identifiers) => {
                    const byResource = new Map<string, {resourceType: string; resourceId: string; actions: string[]}>();

                    for (const queued of identifiers) {
                        const key = `${queued.resourceType}:${queued.resourceId}`;
                        const group = byResource.get(key);
                        if (group) {
                            group.actions.push(queued.action);
                        } else {
                            byResource.set(key, {resourceType: queued.resourceType, resourceId: queued.resourceId, actions: [queued.action]});
                        }
                    }

                    return Promise.all(Array.from(byResource.values()).map(({resourceType, resourceId, actions}) =>
                        dispatch(fetchRenderActionsForResource(resourceType, resourceId, actions))));
                },
                maxBatchSize: maxRenderDecisionsPerBatch,
                wait: renderDecisionsBatchWaitMs,
                comparator: sameRenderDecisionIdentifier,
            });
        }

        const loader = loaders.renderDecisionsLoader as DelayedDataLoader<RenderDecisionIdentifier>;
        loader.queue([identifier]);

        return {data: true};
    };
}

// Invalidations carry the current generation so the reducer can discard the completion of a fetch
// that was already in flight when they landed.
export function invalidateRenderDecisionsForChannel(channelId: string) {
    return {type: RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL, data: {channelId, generation: generationCounter}};
}

export function clearRenderDecisions() {
    return {type: RenderPermissionTypes.CLEAR_RENDER_DECISIONS, data: {generation: generationCounter}};
}
