// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostTypes} from 'mattermost-redux/action_types';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';

import type {ActionFuncAsync} from 'types/store';

/**
 * Manual "burn now" action - immediately deletes a burn-on-read post
 * Triggered when user clicks the timer chip and confirms deletion
 *
 * @param postId - The ID of the post to burn/delete
 * @param isSender - True if the current user is the post author (sender)
 *                   Sender uses DELETE endpoint (permanent delete for all)
 *                   Recipient uses /burn endpoint (per-user expiration)
 */
export function burnPostNow(postId: string, isSender: boolean = false): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        console.log('[burnPostNow] START - postId:', postId, 'isSender:', isSender);
        try {
            // Get the full post object from state before deleting
            // This is needed for proper cleanup in reducers (channel_id, etc.)
            const state = getState();
            const post = state.entities.posts.posts[postId];

            console.log('[burnPostNow] Post from state:', post ? {id: post.id, channel_id: post.channel_id, user_id: post.user_id} : 'NOT FOUND');

            if (!post) {
                // Post doesn't exist in state, nothing to do
                console.log('[burnPostNow] Post not found in state, returning');
                return {data: true};
            }

            if (isSender) {
                // Sender path: Use standard delete endpoint (DELETE /posts/{id})
                // This permanently deletes the post for ALL users
                console.log('[burnPostNow] SENDER path - calling deletePost');
                await Client4.deletePost(postId);
            } else {
                // Recipient path: Use burn endpoint (DELETE /posts/{id}/burn)
                // This only expires the ReadReceipt for this user
                console.log('[burnPostNow] RECIPIENT path - calling burnPostNow API');
                await Client4.burnPostNow(postId);
            }

            console.log('[burnPostNow] API call successful, dispatching POST_REMOVED with post:', {id: post.id, channel_id: post.channel_id});

            // Completely remove post from Redux state
            // Pass the full post object so postsInChannel reducer can access channel_id
            dispatch({
                type: PostTypes.POST_REMOVED,
                data: post,
            });

            console.log('[burnPostNow] POST_REMOVED dispatched successfully');

            return {data: true};
        } catch (error) {
            console.error('[burnPostNow] ERROR:', error);
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }
    };
}

/**
 * Handles automatic post expiration when timer reaches zero
 * Also used when receiving WebSocket expiration event
 */
export function handlePostExpired(postId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        // Get the full post object from state so we can properly remove it from all reducers
        const state = getState();
        const post = state.entities.posts.posts[postId];

        if (!post) {
            // Post already removed or doesn't exist
            return {data: true};
        }

        // Completely remove post from Redux state (client-side only, no API call)
        // Pass full post object so postsInChannel reducer can access channel_id
        dispatch({
            type: PostTypes.POST_REMOVED,
            data: post,
        });

        return {data: true};
    };
}

/**
 * Handles WebSocket event when a post is burned (recipient manual burn)
 * This syncs the burn action across all of the user's devices
 */
export function handlePostBurned(data: {post_id: string}): ActionFuncAsync<boolean> {
    return async (dispatch) => {
        // Remove the post from this user's view
        // Uses handlePostExpired since the behavior is identical
        return dispatch(handlePostExpired(data.post_id));
    };
}
