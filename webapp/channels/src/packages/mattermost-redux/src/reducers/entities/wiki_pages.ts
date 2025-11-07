// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {Post} from '@mattermost/types/posts';
import type {SelectPropertyField} from '@mattermost/types/properties';

import {WikiTypes} from 'mattermost-redux/action_types';

export type WikiPagesState = {
    byWiki: Record<string, string[]>;
    loading: Record<string, boolean>;
    error: Record<string, string | null>;
    pendingPublishes: Record<string, boolean>;
    lastInvalidated: Record<string, number>;
    statusField: SelectPropertyField | null;
};

const initialState: WikiPagesState = {
    byWiki: {},
    loading: {},
    error: {},
    pendingPublishes: {},
    lastInvalidated: {},
    statusField: null,
};

export default function wikiPagesReducer(state = initialState, action: AnyAction): WikiPagesState {
    switch (action.type) {
    case WikiTypes.GET_PAGES_REQUEST: {
        const {wikiId} = action.data;
        return {
            ...state,
            loading: {
                ...state.loading,
                [wikiId]: true,
            },
            error: {
                ...state.error,
                [wikiId]: null,
            },
        };
    }
    case WikiTypes.GET_PAGES_SUCCESS: {
        const {wikiId, pages} = action.data;
        return {
            ...state,
            byWiki: {
                ...state.byWiki,
                [wikiId]: pages.map((p: Post) => p.id),
            },
            loading: {
                ...state.loading,
                [wikiId]: false,
            },
        };
    }
    case WikiTypes.GET_PAGES_FAILURE: {
        const {wikiId, error} = action.data;
        return {
            ...state,
            loading: {
                ...state.loading,
                [wikiId]: false,
            },
            error: {
                ...state.error,
                [wikiId]: error,
            },
        };
    }
    case WikiTypes.RECEIVED_PAGE_IN_WIKI: {
        const {page, wikiId} = action.data;

        const currentPageIds = state.byWiki[wikiId] || [];
        const nextPageIds = currentPageIds.includes(page.id) ? currentPageIds : [...currentPageIds, page.id];

        return {
            ...state,
            byWiki: {
                ...state.byWiki,
                [wikiId]: nextPageIds,
            },
        };
    }
    case WikiTypes.DELETED_PAGE: {
        const {id: pageId} = action.data;

        const nextByWiki = {...state.byWiki};
        Object.keys(nextByWiki).forEach((wikiId) => {
            nextByWiki[wikiId] = nextByWiki[wikiId].filter((id) => id !== pageId);
        });

        return {
            ...state,
            byWiki: nextByWiki,
        };
    }
    case WikiTypes.DELETED_WIKI: {
        const {wikiId} = action.data;

        const nextByWiki = {...state.byWiki};
        delete nextByWiki[wikiId];

        const nextLoading = {...state.loading};
        delete nextLoading[wikiId];

        const nextError = {...state.error};
        delete nextError[wikiId];

        const nextLastInvalidated = {...state.lastInvalidated};
        delete nextLastInvalidated[wikiId];

        return {
            ...state,
            byWiki: nextByWiki,
            loading: nextLoading,
            error: nextError,
            lastInvalidated: nextLastInvalidated,
        };
    }
    case WikiTypes.PUBLISH_DRAFT_REQUEST: {
        const {draftId} = action.data;
        return {
            ...state,
            pendingPublishes: {
                ...state.pendingPublishes,
                [draftId]: true,
            },
        };
    }
    case WikiTypes.PUBLISH_DRAFT_SUCCESS:
    case WikiTypes.PUBLISH_DRAFT_FAILURE: {
        const {draftId} = action.data;
        const nextPendingPublishes = {...state.pendingPublishes};
        delete nextPendingPublishes[draftId];
        return {
            ...state,
            pendingPublishes: nextPendingPublishes,
        };
    }
    case WikiTypes.PUBLISH_DRAFT_COMPLETED: {
        const {draftId} = action.data;
        const nextPendingPublishes = {...state.pendingPublishes};
        delete nextPendingPublishes[draftId];
        return {
            ...state,
            pendingPublishes: nextPendingPublishes,
        };
    }
    case WikiTypes.INVALIDATE_PAGES: {
        const {wikiId} = action.data;
        const timestamp = Date.now();
        return {
            ...state,
            lastInvalidated: {
                ...state.lastInvalidated,
                [wikiId]: timestamp,
            },
        };
    }
    case WikiTypes.RECEIVED_PAGE_STATUS_FIELD: {
        return {
            ...state,
            statusField: action.data,
        };
    }
    default:
        return state;
    }
}
