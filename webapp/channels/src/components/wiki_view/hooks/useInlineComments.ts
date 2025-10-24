// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState} from 'react';

import {Client4} from 'mattermost-redux/client';

type CommentAnchor = {
    text: string;
    context_before: string;
    context_after: string;
    char_offset: number;
};

export const useInlineComments = (pageId?: string, wikiId?: string, onCommentCreated?: (commentId: string) => void) => {
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null);

    const handleCreateInlineComment = (anchor: CommentAnchor) => {
        console.log('[useInlineComments] handleCreateInlineComment called with anchor:', anchor);
        setCommentAnchor(anchor);
        setShowCommentModal(true);
    };

    const handleSubmitComment = async (message: string) => {
        console.log('[useInlineComments] handleSubmitComment called with message:', message);
        console.log('[useInlineComments] Current anchor:', commentAnchor);
        console.log('[useInlineComments] pageId:', pageId, 'wikiId:', wikiId);

        if (!commentAnchor || !pageId || !wikiId) {
            console.log('[useInlineComments] Missing required data, aborting');
            return;
        }

        const payload = {
            text: commentAnchor.text,
            context_before: commentAnchor.context_before,
            context_after: commentAnchor.context_after,
            char_offset: commentAnchor.char_offset,
            node_path: [],
        };

        console.log('[useInlineComments] Creating page comment with payload:', payload);

        try {
            const result = await Client4.createPageComment(wikiId, pageId, message, payload);
            console.log('[useInlineComments] Comment created successfully:', result);

            if (onCommentCreated && result.id) {
                console.log('[useInlineComments] Calling onCommentCreated callback with commentId:', result.id);
                onCommentCreated(result.id);
            }
        } catch (error) {
            console.error('[useInlineComments] Failed to create inline comment:', error);
        }

        setShowCommentModal(false);
        setCommentAnchor(null);
    };

    const handleCloseModal = () => {
        setShowCommentModal(false);
        setCommentAnchor(null);
    };

    return {
        showCommentModal,
        commentAnchor,
        handleCreateInlineComment,
        handleSubmitComment,
        handleCloseModal,
    };
};
