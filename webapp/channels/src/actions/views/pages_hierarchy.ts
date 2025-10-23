// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    TOGGLE_NODE_EXPANDED,
    SET_SELECTED_PAGE,
    EXPAND_ANCESTORS,
    TOGGLE_PAGES_PANEL,
    OPEN_PAGES_PANEL,
    CLOSE_PAGES_PANEL,
    SET_OUTLINE_EXPANDED,
    CLEAR_OUTLINE_CACHE,
} from 'reducers/views/pages_hierarchy';

import {extractHeadingsFromContent} from 'utils/page_outline';
import type {Heading} from 'utils/page_outline';

import type {ActionFunc, ActionFuncAsync, GlobalState} from 'types/store';

export function toggleNodeExpanded(wikiId: string, nodeId: string): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: TOGGLE_NODE_EXPANDED,
            data: {wikiId, nodeId},
        });

        return {data: true};
    };
}

export function setSelectedPage(pageId: string | null): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: SET_SELECTED_PAGE,
            data: {pageId},
        });

        return {data: true};
    };
}

export function expandAncestors(wikiId: string, ancestorIds: string[]): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: EXPAND_ANCESTORS,
            data: {wikiId, ancestorIds},
        });

        return {data: true};
    };
}

export function togglePagesPanel(): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: TOGGLE_PAGES_PANEL,
        });

        return {data: true};
    };
}

export function openPagesPanel(): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: OPEN_PAGES_PANEL,
        });

        return {data: true};
    };
}

export function closePagesPanel(): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: CLOSE_PAGES_PANEL,
        });

        return {data: true};
    };
}

export function setOutlineExpanded(pageId: string, expanded: boolean, headings?: Heading[]): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: SET_OUTLINE_EXPANDED,
            data: {pageId, expanded, headings},
        });

        return {data: true};
    };
}

export function togglePageOutline(pageId: string, pageContent?: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState() as GlobalState;
        const isExpanded = state.views.pagesHierarchy.outlineExpandedNodes[pageId];

        if (isExpanded) {
            dispatch({
                type: SET_OUTLINE_EXPANDED,
                data: {pageId, expanded: false},
            });
        } else {
            let content = pageContent;
            if (!content) {
                // Pages are stored in wikiPages.fullPages (with content) or pageSummaries (without)
                // If page isn't fully loaded yet, message will be empty
                const fullPage = state.entities.wikiPages?.fullPages?.[pageId];
                content = fullPage?.message || '';
            }

            const headings = extractHeadingsFromContent(content || '');

            dispatch({
                type: SET_OUTLINE_EXPANDED,
                data: {pageId, expanded: true, headings},
            });
        }

        return {data: true};
    };
}

export function clearOutlineCache(pageId: string): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: CLEAR_OUTLINE_CACHE,
            data: {pageId},
        });

        return {data: true};
    };
}
