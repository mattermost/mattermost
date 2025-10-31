// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/constants/posts';
import {createIdsSelector} from 'mattermost-redux/utils/helpers';

import type {GlobalState} from 'types/store';

export function makeGetFilteredPostIdsForWikiThread(): (
    state: GlobalState,
    rootId: string,
    focusedInlineCommentId: string | null
) => string[] {
    return createIdsSelector(
        'makeGetFilteredPostIdsForWikiThread',
        (state: GlobalState) => state.entities.posts.posts,
        (state: GlobalState, rootId: string) => state.entities.posts.postsInThread[rootId] || [],
        (state: GlobalState, rootId: string, focusedId: string | null) => focusedId,
        (allPostsById, postIdsInThread, focusedInlineCommentId) => {
            // Only look at posts in this thread, not all posts in the system
            const posts = postIdsInThread.map((id) => allPostsById[id]).filter(Boolean);

            // Helper to check if a post is an inline comment
            const isInlineComment = (post: Post): boolean => {
                return post.type === PostTypes.PAGE_COMMENT &&
                       post.props?.comment_type === 'inline' &&
                       Boolean(post.props?.inline_anchor);
            };

            // Build a map of post IDs for quick lookup
            const postMap = new Map<string, Post>();
            posts.forEach((post) => postMap.set(post.id, post));

            // If no inline comment is focused, show only page-level comments
            // (exclude inline comments and their replies)
            if (!focusedInlineCommentId) {
                const filteredIds = posts.
                    filter((post: Post) => {
                        // Exclude inline comments themselves
                        if (isInlineComment(post)) {
                            return false;
                        }

                        // Exclude replies to inline comments
                        const parentCommentId = post.props?.parent_comment_id as string | undefined;
                        if (parentCommentId) {
                            const parentComment = postMap.get(parentCommentId);
                            if (parentComment && isInlineComment(parentComment)) {
                                return false;
                            }
                        }

                        // Include everything else (page comments and their replies)
                        return true;
                    }).
                    map((p) => p.id);

                // Reverse to match standard thread viewer order (newest to oldest)
                return filteredIds.reverse();
            }

            // If an inline comment is focused, show ONLY that comment + its replies
            const focusedIds = posts.
                filter((post: Post) => {
                    // Include the focused inline comment itself
                    if (post.id === focusedInlineCommentId) {
                        return true;
                    }

                    // Include replies to the focused inline comment
                    if (post.props?.parent_comment_id === focusedInlineCommentId) {
                        return true;
                    }

                    return false;
                }).
                map((p) => p.id);

            // Reverse to match standard thread viewer order (newest to oldest)
            return focusedIds.reverse();
        },
    );
}
