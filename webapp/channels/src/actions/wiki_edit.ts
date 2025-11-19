// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {savePageDraft, makePageDraftKey} from 'actions/page_drafts';
import {getGlobalItem} from 'selectors/storage';

import {getWikiUrl, getTeamNameFromPath} from 'utils/url';

import type {ActionFuncAsync, GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

/**
 * Checks if user has an existing draft with unsaved changes for the given page.
 * Returns error data if unsaved changes are detected, null otherwise.
 */
function checkForUnsavedDraft(
    state: GlobalState,
    wikiId: string,
    pageId: string,
    publishedContent: string,
): {error: any} | null {
    const draftKey = makePageDraftKey(wikiId, pageId);
    const existingDraft = getGlobalItem<PostDraft | null>(state, draftKey, null);

    if (!existingDraft) {
        return null;
    }

    const draftContent = existingDraft.message || '';
    const publishedContentTrimmed = publishedContent || '';

    if (draftContent !== publishedContentTrimmed) {
        // Unsaved changes detected
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

    return null;
}

/**
 * Opens a page in edit mode by creating a draft and navigating to it
 */
export function openPageInEditMode(
    channelId: string,
    wikiId: string,
    page: Post,
    history: any,
    location: any,
): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const pageId = page.id;
        const pageTitle = (page.props?.title as string | undefined) || 'Untitled page';
        const pageParentId = page.page_parent_id;
        const pageStatusFromProps = page.props?.page_status as string | undefined;

        // Check for unsaved draft before proceeding
        const unsavedDraftError = checkForUnsavedDraft(state, wikiId, pageId, page.message);
        if (unsavedDraftError) {
            return unsavedDraftError;
        }

        const additionalProps: Record<string, any> = {
            page_id: pageId,
            original_page_update_at: page.update_at,
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
            pageId,
            additionalProps,
        ));

        // Only navigate if draft was saved successfully
        if (result.data) {
            const teamName = getTeamNameFromPath(location.pathname);
            const draftPath = getWikiUrl(teamName, channelId, wikiId, pageId, true);
            history.replace(draftPath);
        }

        return {data: true};
    };
}
