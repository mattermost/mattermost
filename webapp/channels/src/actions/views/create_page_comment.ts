// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import {logError} from 'mattermost-redux/actions/errors';
import type {CreatePostReturnType} from 'mattermost-redux/actions/posts';
import {getPageById} from 'mattermost-redux/selectors/entities/pages';

import {createPageComment as createPageCommentAction, createPageCommentReply} from 'actions/pages';
import {setPendingInlineAnchor, setFocusedInlineCommentId, setSubmittingComment} from 'actions/views/wiki_rhs';
import {getWikiRhsWikiId, getFocusedInlineCommentId, getPendingInlineAnchor} from 'selectors/wiki_rhs';

import {isPagePost} from 'utils/page_utils';

import type {ActionFuncAsync} from 'types/store';
import type {PostDraft} from 'types/store/draft';

export type SubmitPageCommentReturnType = CreatePostReturnType;

/**
 * Submit a page comment using the dedicated page comment API.
 * This is separate from regular post creation to:
 * - Use page-specific API endpoints (/wikis/{wikiId}/pages/{pageId}/comments)
 * - Set Type="page_comment" on the backend
 * - Keep wiki/pages logic isolated and maintainable
 *
 * If there's a focused inline comment in the RHS state, creates a reply to that comment.
 * Otherwise, creates a new top-level page comment.
 *
 * @param pageId - The page post ID (used as rootId)
 * @param draft - The comment draft containing message and metadata
 * @param afterSubmit - Optional callback after submission completes
 */
export function submitPageComment(
    pageId: string,
    draft: PostDraft,
    afterSubmit?: (response: SubmitPageCommentReturnType) => void,
): ActionFuncAsync<CreatePostReturnType> {
    return async (dispatch, getState) => {
        // Early validation of message
        if (!draft.message || !draft.message.trim()) {
            const error = new Error('Comment message cannot be empty');
            return {error};
        }

        const state = getState();

        const page = getPageById(state, pageId);
        if (!page) {
            const error = new Error('Page not found');
            return {error};
        }

        if (!isPagePost(page)) {
            const error = new Error('Root post is not a page');
            return {error};
        }

        const wikiId = getWikiRhsWikiId(state);
        if (!wikiId) {
            const error = new Error('Wiki ID not found in RHS state');
            return {error};
        }

        const focusedInlineCommentId = getFocusedInlineCommentId(state);
        const pendingInlineAnchor = getPendingInlineAnchor(state);

        let response;
        if (pendingInlineAnchor) {
            // A new anchor selection wins over any previously-viewed thread: a fresh anchor means
            // the user is starting a new thread, not replying to the stale focused one.
            dispatch(setFocusedInlineCommentId(null));
            dispatch(setSubmittingComment(true));

            const anchorForCreate = pendingInlineAnchor;
            response = await dispatch(createPageCommentAction(wikiId, pageId, draft.message, anchorForCreate));

            if (!response.error && response.data?.id) {
                dispatch(batchActions([
                    setPendingInlineAnchor(null),
                    setFocusedInlineCommentId(response.data.id),
                    setSubmittingComment(false),
                ]));
            } else {
                dispatch(setSubmittingComment(false));
            }
        } else if (focusedInlineCommentId) {
            response = await dispatch(createPageCommentReply(wikiId, pageId, focusedInlineCommentId, draft.message));
            if (response.error) {
                dispatch(logError(response.error));
            }
        } else {
            response = await dispatch(createPageCommentAction(wikiId, pageId, draft.message));
        }

        const result: CreatePostReturnType = {
            error: response.error,
            created: !response.error,
        };

        if (afterSubmit) {
            afterSubmit(result);
        }

        return result;
    };
}
