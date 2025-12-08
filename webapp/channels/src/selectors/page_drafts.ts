// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {getGlobalItem} from 'selectors/storage';

import {StoragePrefixes} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

/**
 * Creates a storage key for a page draft.
 * Each user has their own draft for a page, so userId is required to prevent
 * websocket events from overwriting another user's local draft.
 */
export function makePageDraftKey(wikiId: string, pageId: string, userId: string): string {
    return `${StoragePrefixes.PAGE_DRAFT}${wikiId}_${pageId}_${userId}`;
}

/**
 * Creates a prefix for searching all drafts in a wiki (regardless of user).
 */
export function makePageDraftPrefix(wikiId: string): string {
    return `${StoragePrefixes.PAGE_DRAFT}${wikiId}_`;
}

export function getPageDraft(state: GlobalState, wikiId: string, pageId: string): PostDraft | null {
    const userId = getCurrentUserId(state);
    const key = makePageDraftKey(wikiId, pageId, userId);
    return getGlobalItem<PostDraft | null>(state, key, null);
}

export function hasPageDraft(state: GlobalState, wikiId: string, pageId: string): boolean {
    return getPageDraft(state, wikiId, pageId) !== null;
}

export function hasUnsavedChanges(state: GlobalState, wikiId: string, pageId: string, publishedContent: string): boolean {
    const draft = getPageDraft(state, wikiId, pageId);
    if (!draft) {
        return false;
    }
    return draft.message !== publishedContent;
}

export const getPageDraftsForWiki = createSelector(
    'getPageDraftsForWiki',
    (state: GlobalState) => state.storage.storage,
    (_state: GlobalState, wikiId: string) => wikiId,
    (state: GlobalState) => getCurrentUserId(state),
    (storage, wikiId, currentUserId) => {
        const prefix = makePageDraftPrefix(wikiId);
        const drafts: PostDraft[] = [];

        Object.keys(storage).forEach((key) => {
            // Only include drafts for the current user
            if (key.startsWith(prefix) && key.endsWith(`_${currentUserId}`)) {
                const storedDraft = storage[key];
                if (storedDraft && storedDraft.value) {
                    drafts.push(storedDraft.value as PostDraft);
                }
            }
        });

        return drafts;
    },
);

export function getUserDraftKeysForPage(state: GlobalState, wikiId: string, pageId: string): string[] {
    const currentUserId = getCurrentUserId(state);
    const prefix = makePageDraftPrefix(wikiId);
    const keys: string[] = [];

    Object.keys(state.storage.storage).forEach((key) => {
        // Only include keys for the current user
        if (key.startsWith(prefix) && key.endsWith(`_${currentUserId}`)) {
            const draft = state.storage.storage[key];
            if (draft && typeof draft === 'object' && 'rootId' in draft && draft.rootId === pageId) {
                keys.push(key);
            }
        }
    });

    return keys;
}

export function getFirstPageDraftForWiki(state: GlobalState, wikiId: string): PostDraft | null {
    const drafts = getPageDraftsForWiki(state, wikiId);
    return drafts.length > 0 ? drafts[0] : null;
}

export function hasUnpublishedChanges(state: GlobalState, wikiId: string, pageId: string, publishedContent: string): boolean {
    return hasUnsavedChanges(state, wikiId, pageId, publishedContent);
}
