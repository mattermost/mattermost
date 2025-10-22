// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {makePageDraftKey} from 'actions/page_drafts';

import {StoragePrefixes} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

export function getPageDraftsForWiki(state: GlobalState, wikiId: string): PostDraft[] {
    const prefix = `${StoragePrefixes.PAGE_DRAFT}${wikiId}_`;
    const drafts: PostDraft[] = [];

    Object.keys(state.storage.storage).forEach((key) => {
        if (key.startsWith(prefix)) {
            const storedDraft = state.storage.storage[key];
            if (storedDraft && storedDraft.value) {
                drafts.push(storedDraft.value as PostDraft);
            }
        }
    });

    console.log('[getPageDraftsForWiki] Selector returning drafts:', {
        wikiId,
        draftsCount: drafts.length,
        drafts: drafts.map((d) => ({
            rootId: d.rootId,
            title: d.props?.title,
            pageParentId: d.props?.page_parent_id,
        })),
    });

    return drafts;
}

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
