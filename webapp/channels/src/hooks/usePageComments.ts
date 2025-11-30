// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {createPageComment, createPageCommentReply} from 'actions/pages';
import {submitPageComment} from 'actions/views/create_page_comment';
import {getWikiRhsWikiId, getFocusedInlineCommentId} from 'selectors/wiki_rhs';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

/**
 * Hook to manage page comments.
 * Provides operations for creating comments and replies on wiki pages.
 *
 * @param pageId - The page ID to create comments on
 * @returns Comment operations
 */
export function usePageComments(pageId: string) {
    const dispatch = useDispatch();

    const page = useSelector((state: GlobalState) => getPost(state, pageId));
    const wikiId = useSelector(getWikiRhsWikiId);
    const focusedInlineCommentId = useSelector(getFocusedInlineCommentId);

    const createComment = useCallback(async (message: string) => {
        if (!wikiId) {
            return {error: new Error('Wiki ID not found')};
        }

        return dispatch(createPageComment(wikiId, pageId, message));
    }, [dispatch, wikiId, pageId]);

    const createReply = useCallback(async (parentCommentId: string, message: string) => {
        if (!wikiId) {
            return {error: new Error('Wiki ID not found')};
        }

        return dispatch(createPageCommentReply(wikiId, pageId, parentCommentId, message));
    }, [dispatch, wikiId, pageId]);

    const submitComment = useCallback(async (draft: PostDraft, afterSubmit?: (response: any) => void) => {
        return dispatch(submitPageComment(pageId, draft, afterSubmit));
    }, [dispatch, pageId]);

    const createCommentOrReply = useCallback(async (message: string) => {
        if (focusedInlineCommentId) {
            return createReply(focusedInlineCommentId, message);
        }
        return createComment(message);
    }, [focusedInlineCommentId, createComment, createReply]);

    return {
        page,
        wikiId,
        focusedInlineCommentId,
        createComment,
        createReply,
        submitComment,
        createCommentOrReply,
    };
}
