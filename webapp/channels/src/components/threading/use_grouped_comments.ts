// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/constants/posts';
import {getPostsInThread, getPost} from 'mattermost-redux/selectors/entities/posts';

import type {GlobalState} from 'types/store';

export type InlineAnchor = {
    text: string;
    char_offset: number;
    context_before: string;
    context_after: string;
    node_path?: string[];
};

export type CommentWithReplies = {
    comment: Post;
    replies: Post[];
};

export type GroupedComments = {
    pageComments: CommentWithReplies[];
    inlineGroups: {
        [anchorKey: string]: {
            anchor: InlineAnchor;
            comments: CommentWithReplies[];
        };
    };
};

export const useGroupedComments = (rootPostId: string): GroupedComments => {
    const threadPostIds = useSelector((state: GlobalState) => getPostsInThread(state)[rootPostId] || []);
    const posts = useSelector((state: GlobalState) => threadPostIds.map((id: string) => getPost(state, id)).filter(Boolean));

    return useMemo(() => {
        const grouped: GroupedComments = {
            pageComments: [],
            inlineGroups: {},
        };

        if (!posts || posts.length === 0) {
            return grouped;
        }

        const topLevelComments = new Map<string, Post>();
        const repliesByParent = new Map<string, Post[]>();

        posts.forEach((post: Post) => {
            if (post.type !== PostTypes.PAGE_COMMENT) {
                return;
            }

            const parentCommentId = (post.props?.parent_comment_id as string) || '';

            if (parentCommentId) {
                if (!repliesByParent.has(parentCommentId)) {
                    repliesByParent.set(parentCommentId, []);
                }
                repliesByParent.get(parentCommentId)!.push(post);
            } else {
                topLevelComments.set(post.id, post);
            }
        });

        topLevelComments.forEach((comment) => {
            const replies = repliesByParent.get(comment.id) || [];

            replies.sort((a, b) => a.create_at - b.create_at);

            const commentWithReplies: CommentWithReplies = {comment, replies};

            if (comment.props?.comment_type === 'inline') {
                const anchor = comment.props.inline_anchor as InlineAnchor;

                if (!anchor) {
                    return;
                }

                const anchorKey = `${anchor.char_offset}_${anchor.text.slice(0, 50)}`;

                if (!grouped.inlineGroups[anchorKey]) {
                    grouped.inlineGroups[anchorKey] = {
                        anchor,
                        comments: [],
                    };
                }

                grouped.inlineGroups[anchorKey].comments.push(commentWithReplies);
            } else {
                grouped.pageComments.push(commentWithReplies);
            }
        });

        grouped.pageComments.sort((a, b) =>
            a.comment.create_at - b.comment.create_at,
        );

        Object.values(grouped.inlineGroups).forEach((group) => {
            group.comments.sort((a, b) =>
                a.comment.create_at - b.comment.create_at,
            );
        });

        return grouped;
    }, [posts]);
};
