// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {Heading} from 'utils/page_outline';

export const TOGGLE_NODE_EXPANDED = 'pages_hierarchy/TOGGLE_NODE_EXPANDED';
export const SET_SELECTED_PAGE = 'pages_hierarchy/SET_SELECTED_PAGE';
export const EXPAND_ANCESTORS = 'pages_hierarchy/EXPAND_ANCESTORS';
export const TOGGLE_PAGES_PANEL = 'pages_hierarchy/TOGGLE_PAGES_PANEL';
export const OPEN_PAGES_PANEL = 'pages_hierarchy/OPEN_PAGES_PANEL';
export const CLOSE_PAGES_PANEL = 'pages_hierarchy/CLOSE_PAGES_PANEL';
export const SET_OUTLINE_EXPANDED = 'pages_hierarchy/SET_OUTLINE_EXPANDED';
export const TOGGLE_OUTLINE_EXPANDED = 'pages_hierarchy/TOGGLE_OUTLINE_EXPANDED';
export const CLEAR_OUTLINE_CACHE = 'pages_hierarchy/CLEAR_OUTLINE_CACHE';
export const SET_LAST_VIEWED_PAGE = 'pages_hierarchy/SET_LAST_VIEWED_PAGE';

type PagesHierarchyViewState = {
    expandedNodes: {[wikiId: string]: {[pageId: string]: boolean}};
    selectedPageId: string | null;
    isPanelCollapsed: boolean;
    outlineExpandedNodes: {[pageId: string]: boolean};
    outlineCache: {[pageId: string]: Heading[]};
    lastViewedPage: {[wikiId: string]: string};
};

const initialState: PagesHierarchyViewState = {
    expandedNodes: {},
    selectedPageId: null,
    isPanelCollapsed: false,
    outlineExpandedNodes: {},
    outlineCache: {},
    lastViewedPage: {},
};

export default function pagesHierarchyReducer(state = initialState, action: AnyAction): PagesHierarchyViewState {
    switch (action.type) {
    case TOGGLE_NODE_EXPANDED: {
        const {wikiId, nodeId} = action.data;
        const wikiExpanded = state.expandedNodes[wikiId] || {};
        const isExpanded = wikiExpanded[nodeId] || false;

        return {
            ...state,
            expandedNodes: {
                ...state.expandedNodes,
                [wikiId]: {
                    ...wikiExpanded,
                    [nodeId]: !isExpanded,
                },
            },
        };
    }

    case SET_SELECTED_PAGE: {
        const {pageId} = action.data;
        return {
            ...state,
            selectedPageId: pageId,
        };
    }

    case EXPAND_ANCESTORS: {
        const {wikiId, ancestorIds} = action.data;
        const wikiExpanded = state.expandedNodes[wikiId] || {};

        // Set all ancestors to expanded
        const newExpanded = {...wikiExpanded};
        ancestorIds.forEach((id: string) => {
            newExpanded[id] = true;
        });

        return {
            ...state,
            expandedNodes: {
                ...state.expandedNodes,
                [wikiId]: newExpanded,
            },
        };
    }

    case TOGGLE_PAGES_PANEL:
        return {
            ...state,
            isPanelCollapsed: !state.isPanelCollapsed,
        };

    case OPEN_PAGES_PANEL:
        return {
            ...state,
            isPanelCollapsed: false,
        };

    case CLOSE_PAGES_PANEL:
        return {
            ...state,
            isPanelCollapsed: true,
        };

    case SET_OUTLINE_EXPANDED: {
        const {pageId, expanded, headings} = action.data;
        const newState = {
            ...state,
            outlineExpandedNodes: {
                ...state.outlineExpandedNodes,
                [pageId]: expanded,
            },
        };

        if (headings) {
            newState.outlineCache = {
                ...state.outlineCache,
                [pageId]: headings,
            };
        }

        return newState;
    }

    case TOGGLE_OUTLINE_EXPANDED: {
        const {pageId} = action.data;
        const currentlyExpanded = state.outlineExpandedNodes[pageId] || false;

        return {
            ...state,
            outlineExpandedNodes: {
                ...state.outlineExpandedNodes,
                [pageId]: !currentlyExpanded,
            },
        };
    }

    case CLEAR_OUTLINE_CACHE: {
        const {pageId} = action.data;
        const restCache = {...state.outlineCache};
        delete restCache[pageId];

        const newExpandedNodes = {...state.outlineExpandedNodes};
        delete newExpandedNodes[pageId];

        return {
            ...state,
            outlineCache: restCache,
            outlineExpandedNodes: newExpandedNodes,
        };
    }

    case SET_LAST_VIEWED_PAGE: {
        const {wikiId, pageId} = action.data;
        return {
            ...state,
            lastViewedPage: {
                ...state.lastViewedPage,
                [wikiId]: pageId,
            },
        };
    }

    default:
        return state;
    }
}
