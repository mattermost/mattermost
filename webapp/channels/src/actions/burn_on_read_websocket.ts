// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostTypes} from 'mattermost-redux/action_types';

import type {DispatchFunc, GetStateFunc} from 'types/store';

export interface PostRevealedData {
    post?: string | any;
    recipients?: string[];
}

/**
 * Handles the post_revealed websocket event by updating the recipients list in post metadata.
 * Only updates state for the post author to enable real-time recipient count tracking.
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

        if (existingPost.user_id === currentUserId && data.recipients) {
            dispatch({
                type: PostTypes.POST_RECIPIENTS_UPDATED,
                data: {
                    postId: post.id,
                    recipients: data.recipients,
                },
            });
        }

        return {data: true};
    };
}
