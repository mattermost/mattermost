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
    lastPagesInvalidated: Record<string, number>;
    lastDraftsInvalidated: Record<string, number>;
    statusField: SelectPropertyField | null;
};

const initialState: WikiPagesState = {
    byWiki: {},
    loading: {},
    error: {},
    pendingPublishes: {},
    lastPagesInvalidated: {},
    lastDraftsInvalidated: {},
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
        const pageIds = pages.map((p: Post) => p.id);
        return {
            ...state,
            byWiki: {
                ...state.byWiki,
                [wikiId]: pageIds,
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
        const {page, wikiId, pendingPageId} = action.data;

        const currentPageIds = state.byWiki[wikiId] || [];
        let nextPageIds: string[];

        if (pendingPageId) {
            const pendingIndex = currentPageIds.indexOf(pendingPageId);
            if (pendingIndex === -1) {
                nextPageIds = currentPageIds.includes(page.id) ? currentPageIds : [...currentPageIds, page.id];
            } else {
                // Remove any existing instance of page.id first to prevent duplicates
                // This can happen if WebSocket/API adds the real page before optimistic update completes
                const withoutExistingPageId = currentPageIds.filter((id) => id !== page.id);
                const adjustedPendingIndex = withoutExistingPageId.indexOf(pendingPageId);

                nextPageIds = [
                    ...withoutExistingPageId.slice(0, adjustedPendingIndex),
                    page.id,
                    ...withoutExistingPageId.slice(adjustedPendingIndex + 1),
                ];
            }
        } else {
            const alreadyExists = currentPageIds.includes(page.id);
            nextPageIds = alreadyExists ? currentPageIds : [...currentPageIds, page.id];
        }

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

        const nextLastPagesInvalidated = {...state.lastPagesInvalidated};
        delete nextLastPagesInvalidated[wikiId];

        const nextLastDraftsInvalidated = {...state.lastDraftsInvalidated};
        delete nextLastDraftsInvalidated[wikiId];

        return {
            ...state,
            byWiki: nextByWiki,
            loading: nextLoading,
            error: nextError,
            lastPagesInvalidated: nextLastPagesInvalidated,
            lastDraftsInvalidated: nextLastDraftsInvalidated,
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
        const {wikiId, timestamp} = action.data;
        return {
            ...state,
            lastPagesInvalidated: {
                ...state.lastPagesInvalidated,
                [wikiId]: timestamp,
            },
        };
    }
    case WikiTypes.INVALIDATE_DRAFTS: {
        const {wikiId, timestamp} = action.data;
        return {
            ...state,
            lastDraftsInvalidated: {
                ...state.lastDraftsInvalidated,
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
