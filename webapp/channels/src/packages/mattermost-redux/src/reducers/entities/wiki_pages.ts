// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {Post} from '@mattermost/types/posts';
import type {SelectPropertyField} from '@mattermost/types/properties';

import {UserTypes, WikiTypes} from 'mattermost-redux/action_types';

function byWiki(state: Record<string, string[]> = {}, action: AnyAction): Record<string, string[]> {
    switch (action.type) {
    case WikiTypes.GET_PAGES_SUCCESS: {
        const {wikiId, pages} = action.data;
        const fetchedPageIds = pages.map((p: Post) => p.id);
        const currentPageIds = state[wikiId] || [];

        // Merge fetched pages with existing pages to prevent race condition:
        // If a WebSocket event added a page while fetch was in-flight,
        // preserve it by including page IDs from current state that aren't
        // in the fetched result (they were added after fetch started)
        const fetchedSet = new Set(fetchedPageIds);
        const pagesAddedDuringFetch = currentPageIds.filter((id) => !fetchedSet.has(id));
        const mergedPageIds = [...fetchedPageIds, ...pagesAddedDuringFetch];

        return {
            ...state,
            [wikiId]: mergedPageIds,
        };
    }
    case WikiTypes.RECEIVED_PAGE_IN_WIKI: {
        const {page, wikiId, pendingPageId} = action.data;

        const currentPageIds = state[wikiId] || [];
        const pageIdSet = new Set(currentPageIds);

        if (pendingPageId) {
            const pendingIndex = currentPageIds.indexOf(pendingPageId);
            if (pendingIndex === -1) {
                if (pageIdSet.has(page.id)) {
                    return state;
                }
                pageIdSet.add(page.id);
                return {
                    ...state,
                    [wikiId]: Array.from(pageIdSet),
                };
            }

            // Replace pending ID with real ID at the same position
            pageIdSet.delete(pendingPageId);
            pageIdSet.delete(page.id);
            const nextPageIds = [
                ...currentPageIds.slice(0, pendingIndex).filter((id) => id !== page.id),
                page.id,
                ...currentPageIds.slice(pendingIndex + 1).filter((id) => id !== pendingPageId && id !== page.id),
            ];
            return {
                ...state,
                [wikiId]: nextPageIds,
            };
        }

        if (pageIdSet.has(page.id)) {
            return state;
        }
        pageIdSet.add(page.id);
        return {
            ...state,
            [wikiId]: Array.from(pageIdSet),
        };
    }
    case WikiTypes.REMOVED_PAGE_FROM_WIKI: {
        const {pageId, wikiId} = action.data;

        const currentPages = state[wikiId];
        if (!currentPages) {
            return state;
        }

        return {
            ...state,
            [wikiId]: currentPages.filter((id) => id !== pageId),
        };
    }
    case WikiTypes.DELETED_PAGE: {
        const {id: pageId, wikiId} = action.data;

        if (wikiId) {
            const currentPages = state[wikiId];
            if (!currentPages) {
                return state;
            }

            return {
                ...state,
                [wikiId]: currentPages.filter((id) => id !== pageId),
            };
        }

        const nextByWiki = {...state};
        Object.keys(nextByWiki).forEach((wiki) => {
            nextByWiki[wiki] = nextByWiki[wiki].filter((id) => id !== pageId);
        });

        return nextByWiki;
    }
    case WikiTypes.DELETED_WIKI: {
        const {wikiId} = action.data;
        const nextByWiki = {...state};
        delete nextByWiki[wikiId];
        return nextByWiki;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function lastPagesInvalidated(state: Record<string, number> = {}, action: AnyAction): Record<string, number> {
    switch (action.type) {
    case WikiTypes.INVALIDATE_PAGES: {
        const {wikiId, timestamp} = action.data;

        return {
            ...state,
            [wikiId]: timestamp,
        };
    }
    case WikiTypes.DELETED_WIKI: {
        const {wikiId} = action.data;
        const nextState = {...state};
        delete nextState[wikiId];
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function lastDraftsInvalidated(state: Record<string, number> = {}, action: AnyAction): Record<string, number> {
    switch (action.type) {
    case WikiTypes.INVALIDATE_DRAFTS: {
        const {wikiId, timestamp} = action.data;
        return {
            ...state,
            [wikiId]: timestamp,
        };
    }
    case WikiTypes.DELETED_WIKI: {
        const {wikiId} = action.data;
        const nextState = {...state};
        delete nextState[wikiId];
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

function statusField(state: SelectPropertyField | null = null, action: AnyAction): SelectPropertyField | null {
    switch (action.type) {
    case WikiTypes.RECEIVED_PAGE_STATUS_FIELD:
        return action.data;
    case UserTypes.LOGOUT_SUCCESS:
        return null;
    default:
        return state;
    }
}

function publishedDraftTimestamps(state: Record<string, number> = {}, action: AnyAction): Record<string, number> {
    switch (action.type) {
    case WikiTypes.PUBLISH_DRAFT_SUCCESS: {
        const {pageId, publishedAt} = action.data;
        return {
            ...state,
            [pageId]: publishedAt,
        };
    }
    case WikiTypes.DELETED_DRAFT: {
        const {id, publishedAt} = action.data;
        if (!publishedAt) {
            return state;
        }
        const existingTimestamp = state[id] || 0;
        if (publishedAt <= existingTimestamp) {
            return state;
        }
        return {
            ...state,
            [id]: publishedAt,
        };
    }
    case WikiTypes.CLEANUP_PUBLISHED_DRAFT_TIMESTAMPS: {
        const {staleThreshold} = action.data;
        const nextState: Record<string, number> = {};
        Object.entries(state).forEach(([pageId, timestamp]) => {
            if (timestamp > staleThreshold) {
                nextState[pageId] = timestamp;
            }
        });
        return nextState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({

    // mapping of wiki id to array of page ids
    byWiki,

    // timestamp of last pages invalidation per wiki
    lastPagesInvalidated,

    // timestamp of last drafts invalidation per wiki
    lastDraftsInvalidated,

    // status field configuration for pages
    statusField,

    // timestamps of recently published drafts (for deduplication)
    publishedDraftTimestamps,
});

export type WikiPagesState = ReturnType<ReturnType<typeof combineReducers>>;
