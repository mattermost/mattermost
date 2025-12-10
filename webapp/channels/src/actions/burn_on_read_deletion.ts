// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostTypes} from 'mattermost-redux/action_types';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import type {DispatchFunc, GetStateFunc, ActionFuncAsync} from 'types/store';

/**
 * Shared helper to remove a post from Redux state
 * @param postId - The ID of the post to remove
 * @param dispatch - Redux dispatch function
 * @param getState - Redux getState function
 * @returns true if post was removed or didn't exist, false otherwise
 */
function removePostFromState(postId: string, dispatch: DispatchFunc, getState: GetStateFunc): boolean {
    const state = getState();
    const post = getPost(state, postId);

    if (!post) {
        return true;
    }

    dispatch({
        type: PostTypes.POST_REMOVED,
        data: post,
    });

    return true;
}

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
            // Use burn endpoint for both sender and recipient
            await Client4.burnPostNow(postId);

            // Remove post from Redux state
            const removed = removePostFromState(postId, dispatch, getState);
            return {data: removed};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }
    };
}

/**
 * Handles automatic post expiration and WebSocket burn events
 *
 * Called when:
 * - Timer reaches zero (automatic expiration)
 * - WebSocket receives burn event (syncs across user's devices)
 *
 * Note: This only removes the post from local Redux state (client-side deletion).
 * Backend cleanup job handles authoritative deletion. This is a UX optimization
 * to immediately remove expired posts from the UI without waiting for backend.
 */
export function handlePostExpired(postId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        // Remove post from Redux state (client-side only)
        const removed = removePostFromState(postId, dispatch, getState);
        return {data: removed};
    };
}
