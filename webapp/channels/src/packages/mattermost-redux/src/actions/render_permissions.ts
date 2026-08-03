// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ActionSearchResponse, RenderDecisionIdentifier} from '@mattermost/types/render_permissions';

import {RenderPermissionTypes} from 'mattermost-redux/action_types';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';
import {DelayedDataLoader} from 'mattermost-redux/utils/data_loader';

// Ordering identity for fetches and invalidations, so the reducer can drop superseded completions.
// A counter rather than Date.now(), which collides within a millisecond.
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

// Matches the server's per-request action cap. Safe for the grouping below, since a group can
// never hold more identifiers than the batch itself.
const maxRenderDecisionsPerBatch = 16;
const renderDecisionsBatchWaitMs = 100;

function sameRenderDecisionIdentifier(a: RenderDecisionIdentifier, b: RenderDecisionIdentifier) {
    return a.resourceType === b.resourceType && a.resourceId === b.resourceId && a.action === b.action;
}

// Coalesces the fetches of components unaware of each other — centre channel and RHS editors
// today, one hook per post or attachment once downloads land.
export function fetchRenderActionsForResourceBatched(identifier: RenderDecisionIdentifier): ActionFuncAsync {
    return async (dispatch, getState, {loaders}: any) => {
        if (!loaders.renderDecisionsLoader) {
            loaders.renderDecisionsLoader = new DelayedDataLoader<RenderDecisionIdentifier>({
                // Action Search takes one resource per request, so a batch becomes one request per
                // resource carrying that resource's actions.
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

// Stamped with the current generation so the reducer can discard fetches already in flight.
export function invalidateRenderDecisionsForChannel(channelId: string) {
    return {type: RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL, data: {channelId, generation: generationCounter}};
}

export function clearRenderDecisions() {
    return {type: RenderPermissionTypes.CLEAR_RENDER_DECISIONS, data: {generation: generationCounter}};
}
