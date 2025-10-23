// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {Post} from '@mattermost/types/posts';

import {WikiTypes} from 'mattermost-redux/action_types';

type PageSummary = Pick<Post, 'id' | 'type' | 'user_id' | 'create_at' | 'update_at' | 'delete_at' | 'props' | 'page_parent_id'>;

type WikiPagesState = {
    byWiki: Record<string, string[]>;
    pageSummaries: Record<string, PageSummary>;
    fullPages: Record<string, Post>;
    loading: Record<string, boolean>;
    error: Record<string, string | null>;
    pendingPublishes: Record<string, boolean>;
};

const initialState: WikiPagesState = {
    byWiki: {},
    pageSummaries: {},
    fullPages: {},
    loading: {},
    error: {},
    pendingPublishes: {},
};

export default function wikiPagesReducer(state = initialState, action: AnyAction): WikiPagesState {
    switch (action.type) {
    case WikiTypes.GET_WIKI_PAGES_REQUEST: {
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
    case WikiTypes.GET_WIKI_PAGES_SUCCESS: {
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
    case WikiTypes.GET_WIKI_PAGES_FAILURE: {
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
    case WikiTypes.RECEIVED_PAGE_SUMMARIES: {
        const {wikiId, pages} = action.data;
        const nextSummaries = {...state.pageSummaries};

        pages.forEach((page: Post) => {
            nextSummaries[page.id] = {
                id: page.id,
                type: page.type,
                user_id: page.user_id,
                create_at: page.create_at,
                update_at: page.update_at,
                delete_at: page.delete_at,
                props: page.props,
                page_parent_id: page.page_parent_id,
            };
        });

        return {
            ...state,
            byWiki: {
                ...state.byWiki,
                [wikiId]: pages.map((p: Post) => p.id),
            },
            pageSummaries: nextSummaries,
        };
    }
    case WikiTypes.RECEIVED_FULL_PAGE: {
        const page: Post = action.data;
        return {
            ...state,
            fullPages: {
                ...state.fullPages,
                [page.id]: page,
            },
        };
    }
    case WikiTypes.RECEIVED_PAGE: {
        const page: Post = action.data;
        const wikiId = page.channel_id;

        const nextSummaries = {...state.pageSummaries};
        nextSummaries[page.id] = {
            id: page.id,
            type: page.type,
            user_id: page.user_id,
            create_at: page.create_at,
            update_at: page.update_at,
            delete_at: page.delete_at,
            props: page.props,
            page_parent_id: page.page_parent_id,
        };

        const nextFullPages = {...state.fullPages};
        nextFullPages[page.id] = page;

        const currentPageIds = state.byWiki[wikiId] || [];
        const nextPageIds = currentPageIds.includes(page.id) ?
            currentPageIds :
            [...currentPageIds, page.id];

        return {
            ...state,
            byWiki: {
                ...state.byWiki,
                [wikiId]: nextPageIds,
            },
            pageSummaries: nextSummaries,
            fullPages: nextFullPages,
        };
    }
    case WikiTypes.DELETED_PAGE: {
        const {id: pageId} = action.data;

        const nextSummaries = {...state.pageSummaries};
        delete nextSummaries[pageId];

        const nextFullPages = {...state.fullPages};
        delete nextFullPages[pageId];

        const nextByWiki = {...state.byWiki};
        Object.keys(nextByWiki).forEach((wikiId) => {
            nextByWiki[wikiId] = nextByWiki[wikiId].filter((id) => id !== pageId);
        });

        return {
            ...state,
            byWiki: nextByWiki,
            pageSummaries: nextSummaries,
            fullPages: nextFullPages,
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
    default:
        return state;
    }
}
