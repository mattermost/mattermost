// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import type {CreatePostReturnType} from 'mattermost-redux/actions/posts';
import {PostTypes} from 'mattermost-redux/constants/posts';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {createPageComment as createPageCommentAction, createPageCommentReply} from 'actions/pages';
import {getWikiRhsWikiId, getFocusedInlineCommentId} from 'selectors/wiki_rhs';

import type {ActionFuncAsync} from 'types/store';
import type {PostDraft} from 'types/store/draft';

export type SubmitPageCommentReturnType = CreatePostReturnType;

/**
 * Check if a post is a page (and therefore comments on it should be page comments)
 */
export function isPagePost(post: Post | null | undefined): boolean {
    return post?.type === PostTypes.PAGE;
}

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
        const state = getState();

        const page = getPost(state, pageId);
        if (!page) {
            const error = new Error('Page not found');
            return {error};
        }

        if (page.type !== PostTypes.PAGE) {
            const error = new Error('Root post is not a page');
            return {error};
        }

        const wikiId = getWikiRhsWikiId(state);
        if (!wikiId) {
            const error = new Error('Wiki ID not found in RHS state');
            return {error};
        }

        const focusedInlineCommentId = getFocusedInlineCommentId(state);

        let response;
        if (focusedInlineCommentId) {
            response = await dispatch(createPageCommentReply(wikiId, pageId, focusedInlineCommentId, draft.message));
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
