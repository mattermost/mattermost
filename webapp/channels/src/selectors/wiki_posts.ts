// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {createIdsSelector} from 'mattermost-redux/utils/helpers';

import {pageInlineCommentHasAnchor} from 'utils/page_utils';

import type {GlobalState} from 'types/store';

export function makeGetFilteredPostIdsForWikiThread(): (
state: GlobalState,
pageId: string,
focusedInlineCommentId: string | null
) => string[] {
    return createIdsSelector(
        'makeGetFilteredPostIdsForWikiThread',
        (state: GlobalState) => state.entities.pages.commentsById || {},
        (state: GlobalState, pageId: string) => state.entities.pages.commentsByPageId?.[pageId] || [],
        (state: GlobalState, pageId: string, focusedInlineCommentId: string | null) => focusedInlineCommentId,
        (allCommentsById, commentIdsForPage, focusedInlineCommentId) => {
            return computeFilteredPostIds(allCommentsById, commentIdsForPage, focusedInlineCommentId);
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

    // Build a map of post IDs for quick lookup
    const postMap = new Map<string, Post>();
    posts.forEach((post) => postMap.set(post.id, post));

    let result: string[];

    // If an inline comment is focused, show ONLY that comment + its replies.
    // commentsByPageId contains ALL comments for the page (not just the thread),
    // so filter to the focused comment + posts where parent_comment_id matches.
    if (focusedInlineCommentId) {
        const seen = new Set<string>();
        result = [focusedInlineCommentId];
        seen.add(focusedInlineCommentId);

        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            if (
                !seen.has(post.id) &&
                (post.props?.parent_comment_id as string | undefined) === focusedInlineCommentId
            ) {
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
            if (pageInlineCommentHasAnchor(post)) {
                continue;
            }

            // Exclude replies to inline comments
            const parentCommentId = post.props?.parent_comment_id as string | undefined;
            if (parentCommentId) {
                const parentComment = postMap.get(parentCommentId);
                if (parentComment && pageInlineCommentHasAnchor(parentComment)) {
                    continue;
                }
            }

            // Include everything else (page comments and their replies)
            result.push(post.id);
        }
    }

    return result;
}

export function isPageCommentResolved(post: Post): boolean {
    return Boolean(post.props?.comment_resolved);
}

export function getPageCommentResolutionInfo(post: Post): {
    resolved: boolean;
    resolvedAt: number;
    resolvedBy: string;
    resolutionReason: 'manual' | 'dangling' | '';
} {
    const props = post.props || {};
    return {
        resolved: Boolean(props.comment_resolved),
        resolvedAt: Number(props.resolved_at || 0),
        resolvedBy: String(props.resolved_by || ''),
        resolutionReason: (props.resolution_reason as 'manual' | 'dangling') || '',
    };
}

export function makeGetFilteredCommentsByResolution(): (
state: GlobalState,
pageId: string,
showResolved: boolean
) => string[] {
    return createIdsSelector(
        'makeGetFilteredCommentsByResolution',
        (state: GlobalState) => state.entities.pages.commentsById || {},
        (state: GlobalState, pageId: string) => state.entities.pages.commentsByPageId?.[pageId] || [],
        (state: GlobalState, pageId: string, showResolved: boolean) => showResolved,
        (allCommentsById, commentIdsForPage, showResolved) => {
            return commentIdsForPage.filter((commentId) => {
                const comment = allCommentsById[commentId];
                if (!comment) {
                    return false;
                }

                const resolved = isPageCommentResolved(comment);
                return showResolved ? resolved : !resolved;
            });
        },
    );
}
