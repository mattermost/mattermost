// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useCallback} from 'react';
import {useDispatch} from 'react-redux';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {createPageComment} from 'actions/pages';

type CommentAnchor = {
    text: string;
    anchor_id: string;
};

export const useInlineComments = (pageId?: string, wikiId?: string, onCommentCreated?: (commentId: string) => void) => {
    const dispatch = useDispatch();
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

        const inlineAnchor = {
            text: commentAnchor.text,
            anchor_id: commentAnchor.anchor_id,
        };

        try {
            const result = await dispatch(createPageComment(wikiId, pageId, message, inlineAnchor));
            const comment = (result as ActionResult).data;

            if (onCommentCreated && comment?.id) {
                onCommentCreated(comment.id);
            }
        } catch {
            // Error is handled silently - the UI will reflect the failure
        }

        setShowCommentModal(false);
        setCommentAnchor(null);
    }, [dispatch, commentAnchor, pageId, wikiId, onCommentCreated]);

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
