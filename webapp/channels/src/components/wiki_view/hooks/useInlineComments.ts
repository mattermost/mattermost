// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useCallback} from 'react';

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

    const handleCreateInlineComment = useCallback((anchor: CommentAnchor) => {
        setCommentAnchor(anchor);
        setShowCommentModal(true);
    }, []);

    const handleSubmitComment = useCallback(async (message: string) => {
        if (!commentAnchor || !pageId || !wikiId) {
            return;
        }

        const payload = {
            text: commentAnchor.text,
            context_before: commentAnchor.context_before,
            context_after: commentAnchor.context_after,
            char_offset: commentAnchor.char_offset,
            node_path: [],
        };

        try {
            const result = await Client4.createPageComment(wikiId, pageId, message, payload);

            if (onCommentCreated && result.id) {
                onCommentCreated(result.id);
            }
        } catch (error) {
            // Silently handle inline comment creation errors
        }

        setShowCommentModal(false);
        setCommentAnchor(null);
    }, [commentAnchor, pageId, wikiId, onCommentCreated]);

    const handleCloseModal = useCallback(() => {
        setShowCommentModal(false);
        setCommentAnchor(null);
    }, []);

    return {
        showCommentModal,
        commentAnchor,
        handleCreateInlineComment,
        handleSubmitComment,
        handleCloseModal,
    };
};
