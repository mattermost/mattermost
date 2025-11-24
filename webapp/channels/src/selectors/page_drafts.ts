// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {getGlobalItem} from 'selectors/storage';

import {StoragePrefixes} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

function makePageDraftKey(wikiId: string, pageId: string): string {
    return `${StoragePrefixes.PAGE_DRAFT}${wikiId}_${pageId}`;
}

export function getPageDraft(state: GlobalState, wikiId: string, pageId: string): PostDraft | null {
    const key = makePageDraftKey(wikiId, pageId);
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
    (storage, wikiId) => {
        const prefix = `${StoragePrefixes.PAGE_DRAFT}${wikiId}_`;
        const drafts: PostDraft[] = [];

        Object.keys(storage).forEach((key) => {
            if (key.startsWith(prefix)) {
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
    const prefix = `${StoragePrefixes.PAGE_DRAFT}${wikiId}_`;
    const keys: string[] = [];

    Object.keys(state.storage.storage).forEach((key) => {
        if (key.startsWith(prefix)) {
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

export function hasUnpublishedChanges(state: GlobalState, wikiId: string, pageId: string): boolean {
    return hasPageDraft(state, wikiId, pageId);
}
