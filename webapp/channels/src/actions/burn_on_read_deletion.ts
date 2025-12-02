// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostTypes} from 'mattermost-redux/action_types';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';

import type {ActionFuncAsync} from 'types/store';

/**
 * Manual "burn now" action - immediately deletes a burn-on-read post
 * Triggered when user clicks the timer chip/badge and confirms deletion
 * Works for both sender (permanent delete) and recipient (per-user burn)
 *
 * @param postId - The ID of the post to burn/delete
 */
export function burnPostNow(postId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            const state = getState();
            const post = state.entities.posts.posts[postId];

            if (!post) {
                return {data: true};
            }

            // Use burn endpoint for both sender and recipient
            await Client4.burnPostNow(postId);

            // Remove post from Redux state
            dispatch({
                type: PostTypes.POST_REMOVED,
                data: post,
            });

            return {data: true};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }
    };
}

/**
 * Handles automatic post expiration when timer reaches zero
 * Called by the global expiration scheduler when a BoR post's timer expires
 *
 * Note: This only removes the post from local Redux state (client-side deletion).
 * Backend cleanup job handles authoritative deletion. This is a UX optimization
 * to immediately remove expired posts from the UI without waiting for backend.
 */
export function handlePostExpired(postId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        const state = getState();
        const post = state.entities.posts.posts[postId];

        if (!post) {
            return {data: true};
        }

        // Remove post from Redux state (client-side only)
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
