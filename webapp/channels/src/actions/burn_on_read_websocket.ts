// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostTypes} from 'mattermost-redux/action_types';

import type {DispatchFunc, GetStateFunc} from 'types/store';

export interface PostRevealedData {
    post?: string | any;
    recipients?: string[];
}

/**
 * Handles the post_revealed websocket event for burn-on-read posts.
 * Two scenarios:
 * 1. Post author: Updates recipients list for real-time recipient count tracking
 * 2. Revealing user: Updates post with revealed content for multi-device sync
 */
export function handleBurnOnReadPostRevealed(data: PostRevealedData) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const currentUserId = state.entities.users.currentUserId;

        let post;
        if (typeof data.post === 'string') {
            try {
                post = JSON.parse(data.post);
            } catch (e) {
                return {data: false};
            }
        } else {
            post = data.post;
        }

        if (!post || !post.id) {
            return {data: false};
        }

        const existingPost = state.entities.posts.posts[post.id];
        if (!existingPost) {
            return {data: false};
        }

        // Case 1: Current user is the post author - update recipients list
        if (existingPost.user_id === currentUserId && data.recipients) {
            dispatch({
                type: PostTypes.POST_RECIPIENTS_UPDATED,
                data: {
                    postId: post.id,
                    recipients: data.recipients,
                },
            });
        }

        // Case 2: Current user is a recipient - update with revealed content
        // This enables multi-device sync when user reveals on one device
        if (existingPost.user_id !== currentUserId && post.message) {
            const expireAt = post.metadata?.expire_at || 0;
            dispatch({
                type: PostTypes.REVEAL_BURN_ON_READ_SUCCESS,
                data: {
                    post,
                    expireAt,
                },
            });
        }

        return {data: true};
    };
}
