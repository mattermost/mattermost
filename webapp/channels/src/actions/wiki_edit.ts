// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {savePageDraft} from 'actions/page_drafts';
import {hasUnsavedChanges, getPageDraft} from 'selectors/page_drafts';

import {getPageTitle} from 'utils/post_utils';

import type {ActionFuncAsync, GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

type UnsavedDraftError = {
    id: string;
    message: string;
    data: {
        existingDraft: PostDraft;
        draftCreateAt: number;
        requiresConfirmation: boolean;
    };
};

/**
 * Checks if user has an existing draft with unsaved changes for the given page.
 * Returns error data if unsaved changes are detected, null otherwise.
 */
function checkForUnsavedDraft(
    state: GlobalState,
    wikiId: string,
    pageId: string,
    publishedContent: string,
): {error: UnsavedDraftError} | null {
    if (!hasUnsavedChanges(state, wikiId, pageId, publishedContent)) {
        return null;
    }

    const existingDraft = getPageDraft(state, wikiId, pageId);
    if (!existingDraft) {
        return null;
    }

    return {
        error: {
            id: 'api.page.edit.unsaved_draft_exists',
            message: 'You have unsaved changes in a previous draft',
            data: {
                existingDraft,
                draftCreateAt: existingDraft.createAt,
                requiresConfirmation: true,
            },
        },
    };
}

/**
 * Creates a draft for editing a page.
 * Returns the pageId on success so the caller can navigate to the draft.
 */
export function openPageInEditMode(
    channelId: string,
    wikiId: string,
    page: Post,
): ActionFuncAsync<string> {
    return async (dispatch, getState) => {
        const state = getState();
        const pageId = page.id;
        const pageTitle = getPageTitle(page, 'Untitled page');
        const pageParentId = page.page_parent_id;
        const pageStatusFromProps = page.props?.page_status as string | undefined;

        // Check for unsaved draft before proceeding
        const unsavedDraftError = checkForUnsavedDraft(state, wikiId, pageId, page.message);
        if (unsavedDraftError) {
            return unsavedDraftError;
        }

        const additionalProps: Record<string, any> = {
            page_id: pageId,
            original_page_edit_at: page.edit_at,
            has_published_version: true,
        };
        if (pageParentId) {
            additionalProps.page_parent_id = pageParentId;
        }
        if (pageStatusFromProps) {
            additionalProps.page_status = pageStatusFromProps;
        }

        const result = await dispatch(savePageDraft(
            channelId,
            wikiId,
            pageId,
            page.message,
            pageTitle,
            undefined,
            additionalProps,
        ));

        if (result.error) {
            return {error: result.error};
        }

        return {data: pageId};
    };
}
