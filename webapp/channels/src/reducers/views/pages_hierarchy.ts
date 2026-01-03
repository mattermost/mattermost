// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';
import type {Heading} from 'utils/page_outline';

type PagesHierarchyViewState = {
    expandedNodes: {[wikiId: string]: {[pageId: string]: boolean}};
    isPanelCollapsed: boolean;
    outlineExpandedNodes: {[pageId: string]: boolean};
    outlineCache: {[pageId: string]: Heading[]};
    lastViewedPage: {[wikiId: string]: string};
};

const initialState: PagesHierarchyViewState = {
    expandedNodes: {},
    isPanelCollapsed: false,
    outlineExpandedNodes: {},
    outlineCache: {},
    lastViewedPage: {},
};

export default function pagesHierarchyReducer(state = initialState, action: AnyAction): PagesHierarchyViewState {
    switch (action.type) {
    case ActionTypes.TOGGLE_PAGE_NODE_EXPANDED: {
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

    case ActionTypes.EXPAND_PAGE_ANCESTORS: {
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

    case ActionTypes.TOGGLE_PAGES_PANEL:
        return {
            ...state,
            isPanelCollapsed: !state.isPanelCollapsed,
        };

    case ActionTypes.OPEN_PAGES_PANEL:
        return {
            ...state,
            isPanelCollapsed: false,
        };

    case ActionTypes.CLOSE_PAGES_PANEL:
        return {
            ...state,
            isPanelCollapsed: true,
        };

    case ActionTypes.SET_PAGE_OUTLINE_EXPANDED: {
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

    case ActionTypes.TOGGLE_PAGE_OUTLINE_EXPANDED: {
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

    case ActionTypes.CLEAR_PAGE_OUTLINE_CACHE: {
        const {pageId} = action.data;

        const newOutlineCache = {...state.outlineCache};
        delete newOutlineCache[pageId];

        const newExpandedNodes = {...state.outlineExpandedNodes};
        delete newExpandedNodes[pageId];

        return {
            ...state,
            outlineCache: newOutlineCache,
            outlineExpandedNodes: newExpandedNodes,
        };
    }

    case ActionTypes.SET_LAST_VIEWED_PAGE: {
        const {wikiId, pageId} = action.data;
        return {
            ...state,
            lastViewedPage: {
                ...state.lastViewedPage,
                [wikiId]: pageId,
            },
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return initialState;

    default:
        return state;
    }
}
