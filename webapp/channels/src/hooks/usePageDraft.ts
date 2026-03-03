// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {savePageDraft, removePageDraft} from 'actions/page_drafts';
import {getPageDraft, hasUnsavedChanges} from 'selectors/page_drafts';

import type {GlobalState} from 'types/store';

/**
 * Hook to manage page draft for a specific wiki page.
 * Provides a clean API hiding storage implementation details.
 *
 * @param wikiId - Wiki ID
 * @param pageId - Page ID
 * @param channelId - Channel ID (required for saving)
 * @returns Draft state and operations
 */
export function usePageDraft(wikiId: string, pageId: string, channelId: string) {
    const dispatch = useDispatch();
    const draft = useSelector((state: GlobalState) => getPageDraft(state, wikiId, pageId));

    const save = useCallback((
        message: string,
        title?: string,
        additionalProps?: Record<string, any>,
    ) => {
        return dispatch(savePageDraft(channelId, wikiId, pageId, message, title, undefined, additionalProps));
    }, [dispatch, channelId, wikiId, pageId]);

    const remove = useCallback(() => {
        return dispatch(removePageDraft(wikiId, pageId));
    }, [dispatch, wikiId, pageId]);

    return {draft, save, remove};
}

/**
 * Hook to check if page has unsaved changes.
 *
 * @param wikiId - Wiki ID
 * @param pageId - Page ID
 * @param publishedContent - Current published content
 * @returns Boolean indicating unsaved changes
 */
export function useHasUnsavedChanges(wikiId: string, pageId: string, publishedContent: string): boolean {
    return useSelector((state: GlobalState) => hasUnsavedChanges(state, wikiId, pageId, publishedContent));
}
