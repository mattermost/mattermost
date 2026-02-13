// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ActionFuncAsync} from 'types/store';

import {fetchPageDraftsForWiki} from './page_drafts';
import {fetchPages} from './pages';

/**
 * Load all wiki data (pages, drafts) for a given wiki.
 *
 * Always fetches pages from the server to ensure we have the complete list.
 * We cannot use a cache-first pattern because WebSocket events (page_published)
 * can populate byWiki[wikiId] with partial data before the user opens the wiki,
 * causing the cache check to incorrectly skip the full fetch.
 *
 * @param wikiId - The ID of the wiki to load
 * @returns ActionFuncAsync that resolves when loading is complete
 */
export function fetchWikiBundle(wikiId: string): ActionFuncAsync {
    return async (dispatch) => {
        // Always fetch pages to ensure we have the complete list.
        // WebSocket events can create partial cache entries, so we can't
        // rely on cache existence to determine if a full fetch was done.
        await Promise.all([
            dispatch(fetchPages(wikiId)),
            dispatch(fetchPageDraftsForWiki(wikiId)),
        ]);

        return {data: true};
    };
}

/**
 * Force reload wiki data, bypassing cache.
 * Used for explicit refresh actions (e.g., reconnect, manual refresh button).
 *
 * Unlike fetchWikiBundle, this always fetches from the server regardless of cache state.
 *
 * @param wikiId - The ID of the wiki to reload
 * @returns ActionFuncAsync that resolves when reloading is complete
 */
export function refetchWikiBundle(wikiId: string): ActionFuncAsync {
    return async (dispatch) => {
        // Always fetch, regardless of cache state
        await Promise.all([
            dispatch(fetchPages(wikiId)),
            dispatch(fetchPageDraftsForWiki(wikiId)),
        ]);

        return {data: true};
    };
}
