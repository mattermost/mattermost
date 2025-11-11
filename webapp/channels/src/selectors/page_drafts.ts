// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {makePageDraftKey} from 'actions/page_drafts';

import {StoragePrefixes} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

// Input selectors
const getStorage = (state: GlobalState) => state.storage?.storage || {};
const getWikiId = (_state: GlobalState, wikiId: string) => wikiId;

export const getPageDraftsForWiki = createSelector(
    'getPageDraftsForWiki',
    getStorage,
    getWikiId,
    (storage, wikiId) => {
        if (!wikiId) {
            return [];
        }

        const prefix = `${StoragePrefixes.PAGE_DRAFT}${wikiId}_`;
        const drafts: PostDraft[] = [];

        for (const key in storage) {
            if (key.startsWith(prefix)) {
                const storedDraft = storage[key];
                if (storedDraft?.value) {
                    drafts.push(storedDraft.value as PostDraft);
                }
            }
        }

        const sorted = drafts.sort((a, b) => (a.createAt || 0) - (b.createAt || 0));
        return sorted;
    },
);

export function getPageDraft(state: GlobalState, wikiId: string, draftId: string): PostDraft | null {
    const key = makePageDraftKey(wikiId, draftId);
    const storedDraft = state.storage.storage[key];

    if (storedDraft && storedDraft.value) {
        return storedDraft.value as PostDraft;
    }

    return null;
}

export function getFirstPageDraftForWiki(state: GlobalState, wikiId: string): PostDraft | null {
    const drafts = getPageDraftsForWiki(state, wikiId);
    return drafts.length > 0 ? drafts[0] : null;
}
