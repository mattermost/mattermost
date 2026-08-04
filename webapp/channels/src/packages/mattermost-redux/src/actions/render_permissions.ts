// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PostList} from '@mattermost/types/posts';
import type {ActionSearchResponse} from '@mattermost/types/render_permissions';

import {RenderPermissionTypes} from 'mattermost-redux/action_types';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {getPosts} from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';
import {Posts} from 'mattermost-redux/constants';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

// generationCounter is a process-wide, strictly-increasing token assigned to
// each render-decision fetch at dispatch time. It is the invalidation identity:
// the reducer ignores any completion whose generation is older than what it
// already holds, so a slow response for a superseded request cannot overwrite a
// fresher one. A monotonic counter is used instead of Date.now() because
// timestamps can collide within the same millisecond.
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
                receivedAt: Date.now(),
            },
        });

        return {data};
    };
}

export function invalidateRenderDecisionsForChannel(channelId: string) {
    return {type: RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CHANNEL, data: {channelId}};
}

export function invalidateCurrentUserRenderDecisions() {
    return {type: RenderPermissionTypes.INVALIDATE_RENDER_DECISIONS_FOR_CURRENT_USER, data: {}};
}

export function clearRenderDecisions() {
    return {type: RenderPermissionTypes.CLEAR_RENDER_DECISIONS, data: {}};
}

export function markChannelPostsStaleForRedaction(channelId: string) {
    return {type: RenderPermissionTypes.MARK_CHANNEL_POSTS_STALE_FOR_REDACTION, data: {channelId}};
}

export function consumeChannelPostsStaleForRedaction(channelId: string) {
    return {type: RenderPermissionTypes.CONSUME_CHANNEL_POSTS_STALE_FOR_REDACTION, data: {channelId}};
}

// reconcileChannelPostsForRedaction fetches the latest posts with reload=true to
// bypass a stale ETag, forcing the server to re-run SanitizePostListMetadataForUser.
export function reconcileChannelPostsForRedaction(channelId: string): ActionFuncAsync<PostList> {
    return (dispatch) => dispatch(getPosts(channelId, 0, Posts.POST_CHUNK_SIZE, true, false, true));
}
