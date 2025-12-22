// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/action_types';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {DispatchFunc, GetStateFunc} from 'types/store';

export interface PostRevealedData {
    post?: string | Post;
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
        const currentUserId = getCurrentUserId(state);

        let post;
        if (typeof data.post === 'string') {
            try {
                post = JSON.parse(data.post);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('Failed to parse burn-on-read post revealed data:', e);
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

export interface AllRevealedData {
    post_id: string;
    sender_expire_at: number;
}

/**
 * Handles the burn_on_read_all_revealed websocket event.
 * Sent to the post author when all recipients have revealed the message.
 */
export function handleBurnOnReadAllRevealed(data: AllRevealedData) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const {post_id: postId, sender_expire_at: senderExpireAt} = data;

        if (!postId || !senderExpireAt) {
            return {data: false};
        }

        const post = state.entities.posts.posts[postId];
        if (!post) {
            return {data: false};
        }

        // Update the post with the sender's expiration time
        dispatch({
            type: PostTypes.BURN_ON_READ_ALL_REVEALED,
            data: {
                postId,
                senderExpireAt,
            },
        });

        return {data: true};
    };
}
