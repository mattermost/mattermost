// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {Wiki, WikiLink} from '@mattermost/types/wikis';

import {WikiTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';

import type {ActionFuncAsync} from 'types/store';

import {fetchPageDraftsForWiki} from './page_drafts';
import {fetchPages, fetchWiki} from './pages';

export function fetchWikiBundle(wikiId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        // Fetch wiki + pages + drafts + links in one round-trip so the
        // permission selector (canEdit) and sidebar resolver both have what
        // they need on a fresh load — without depending on any URL parameter.
        // The links payload populates linksByChannel for ALL source channels
        // that link to this wiki, which is what canEditPageInWiki walks.
        //
        // Skip fetchWiki when already cached — wiki metadata is stable and not
        // populated by WebSocket stubs, so the cache-first check is safe here.
        // fetchPages always runs because WebSocket events can create partial entries.
        const wikiCached = Boolean(getState().entities.wikis?.byId?.[wikiId]);
        const fetches: Array<Promise<ActionResult>> = [
            dispatch(fetchPages(wikiId)),
            dispatch(fetchPageDraftsForWiki(wikiId)),
            dispatch(fetchWikiLinks(wikiId)),
        ];
        if (!wikiCached) {
            fetches.unshift(dispatch(fetchWiki(wikiId)));
        }

        const results = await Promise.all(fetches);

        for (const result of results) {
            if ('error' in result && result.error) {
                return {error: result.error};
            }
        }

        return {data: true};
    };
}

// Generation counter to discard stale responses when concurrent fetches race.
const wikiLinksFetchGeneration: Record<string, number> = {};
const wikiLinksByWikiFetchGeneration: Record<string, number> = {};

export function resetWikiLinksFetchGenerationCounters(): void {
    for (const key of Object.keys(wikiLinksFetchGeneration)) {
        delete wikiLinksFetchGeneration[key];
    }
    for (const key of Object.keys(wikiLinksByWikiFetchGeneration)) {
        delete wikiLinksByWikiFetchGeneration[key];
    }
}

// fetchWikiLinks fetches all WikiLinks pointing to the wiki's backing channel and
// merges each one into linksByChannel via the additive RECEIVED_WIKI_LINK action.
//
// This is the source of truth for client-side channel resolution and EDIT_PAGE
// permission checks when the user lands on a wiki URL without prior channel
// context (deep link, page reload, etc.). Without this, linksByChannel only
// contains entries for channels the user has visited via channel_tabs, so a
// fresh load on /team/wiki/W/P leaves linksByChannel empty and downstream
// permission selectors return false.
//
// Uses additive RECEIVED_WIKI_LINK (not RECEIVED_WIKI_LINKS) so we don't clobber
// links to OTHER wikis that may already be cached for the same source channel.
export function fetchWikiLinks(wikiId: string): ActionFuncAsync<WikiLink[]> {
    return async (dispatch, getState) => {
        wikiLinksByWikiFetchGeneration[wikiId] = (wikiLinksByWikiFetchGeneration[wikiId] ?? 0) + 1;
        const gen = wikiLinksByWikiFetchGeneration[wikiId];
        try {
            const links = await Client4.getWikiLinks(wikiId);

            if (wikiLinksByWikiFetchGeneration[wikiId] !== gen) {
                return {data: []};
            }

            if (links.length > 0) {
                dispatch(batchActions(links.map((link) => ({
                    type: WikiTypes.RECEIVED_WIKI_LINK,
                    data: {channelId: link.source_id, link, wikiId},
                }))));
            }

            return {data: links};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function fetchWikiLinksForChannel(channelId: string): ActionFuncAsync<WikiLink[]> {
    return async (dispatch, getState) => {
        wikiLinksFetchGeneration[channelId] = (wikiLinksFetchGeneration[channelId] ?? 0) + 1;
        const gen = wikiLinksFetchGeneration[channelId];
        try {
            const links = await Client4.getWikiLinksForChannel(channelId);

            if (wikiLinksFetchGeneration[channelId] !== gen) {
                return {data: []};
            }

            dispatch({
                type: WikiTypes.RECEIVED_WIKI_LINKS,
                data: {channelId, links},
            });

            return {data: links};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function linkWikiToChannel(channelId: string, wikiId: string): ActionFuncAsync<WikiLink> {
    return async (dispatch, getState) => {
        try {
            const link = await Client4.linkWikiToChannel(channelId, wikiId);

            // Ensure the wiki object is in byId so selectors can resolve it.
            // fetchWiki short-circuits if already cached.
            await dispatch(fetchWiki(wikiId));

            dispatch({
                type: WikiTypes.RECEIVED_WIKI_LINK,
                data: {channelId, link, wikiId},
            });

            return {data: link};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function fetchTeamWikis(teamId: string): ActionFuncAsync<Wiki[]> {
    return async (dispatch, getState) => {
        try {
            const wikis = await Client4.getTeamWikis(teamId);
            dispatch({type: WikiTypes.RECEIVED_TEAM_WIKIS, data: {teamId, wikis}});
            return {data: wikis};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

export function unlinkWikiFromChannel(channelId: string, wikiId: string): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        try {
            await Client4.unlinkWikiFromChannel(channelId, wikiId);

            dispatch({
                type: WikiTypes.REMOVED_WIKI_LINK,
                data: {channelId, wikiId},
            });

            return {data: true};
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }
    };
}

