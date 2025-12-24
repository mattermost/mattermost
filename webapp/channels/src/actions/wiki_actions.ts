// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ActionFuncAsync} from 'types/store';

import {fetchPageDraftsForWiki} from './page_drafts';
import {fetchPages} from './pages';

/**
 * Load all wiki data (pages, drafts) for a given wiki.
 * Only fetches data if not already in cache (cache-first pattern).
 *
 * This action consolidates multiple data loading calls into a single coordinated action,
 * following the pattern of loadChannelsForCurrentUser in channel_actions.ts.
 *
 * Pattern match: webapp/channels/src/actions/channel_actions.ts:77-95 (loadChannelsForCurrentUser)
 *
 * @param wikiId - The ID of the wiki to load
 * @returns ActionFuncAsync that resolves when loading is complete
 */
export function fetchWikiBundle(wikiId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();

        // Cache check for pages (undefined = not loaded, [] = loaded but empty)
        const cachedPageIds = state.entities.wikiPages?.byWiki?.[wikiId];
        const needsPages = cachedPageIds === undefined;

        // Build list of actions to dispatch
        const promises = [];

        // Conditionally fetch pages if not cached
        if (needsPages) {
            promises.push(dispatch(fetchPages(wikiId)));
        }

        // Always fetch drafts - they're transient and stored in localStorage.
        // The fetchPageDraftsForWiki action reads from localStorage and optionally
        // fetches server drafts, so it's lightweight and always needed.
        promises.push(dispatch(fetchPageDraftsForWiki(wikiId)));

        await Promise.all(promises);

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
