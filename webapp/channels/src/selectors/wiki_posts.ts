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
        (state: GlobalState, rootId: string, focusedInlineCommentId: string | null) => focusedInlineCommentId,
        (allPostsById, postIdsInThread, focusedInlineCommentId) => {
            return computeFilteredPostIds(allPostsById, postIdsInThread, focusedInlineCommentId);
        },
    );
}

function computeFilteredPostIds(
    allPostsById: Record<string, Post>,
    postIdsInThread: string[],
    focusedInlineCommentId: string | null,
): string[] {
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

    let result: string[];

    // If an inline comment is focused, show ONLY that comment + its replies
    if (focusedInlineCommentId) {
        // getPostThread already includes the root post and its replies
        // Just return all posts, but ensure no duplicates
        const seen = new Set<string>();
        result = [];
        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (!seen.has(post.id)) {
                seen.add(post.id);
                result.push(post.id);
            }
        }
    } else {
        // If no inline comment is focused, show only page-level comments
        // (exclude inline comments and their replies)
        result = [];
        for (let i = posts.length - 1; i >= 0; i--) {
            const post = posts[i];

            // Exclude inline comments themselves
            if (isInlineComment(post)) {
                continue;
            }

            // Exclude replies to inline comments
            const parentCommentId = post.props?.parent_comment_id as string | undefined;
            if (parentCommentId) {
                const parentComment = postMap.get(parentCommentId);
                if (parentComment && isInlineComment(parentComment)) {
                    continue;
                }
            }

            // Include everything else (page comments and their replies)
            result.push(post.id);
        }
    }

    return result;
}
