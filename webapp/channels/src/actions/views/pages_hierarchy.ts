// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {loadPage} from 'actions/pages';

import {ActionTypes} from 'utils/constants';
import {extractHeadingsFromContent} from 'utils/page_outline';
import type {Heading} from 'utils/page_outline';

import type {ActionFunc, ActionFuncAsync, GlobalState} from 'types/store';

export function toggleNodeExpanded(wikiId: string, nodeId: string): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: ActionTypes.TOGGLE_PAGE_NODE_EXPANDED,
            data: {wikiId, nodeId},
        });

        return {data: true};
    };
}

export function setSelectedPage(pageId: string | null): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: ActionTypes.SET_SELECTED_PAGE,
            data: {pageId},
        });

        return {data: true};
    };
}

export function expandAncestors(wikiId: string, ancestorIds: string[]): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: ActionTypes.EXPAND_PAGE_ANCESTORS,
            data: {wikiId, ancestorIds},
        });

        return {data: true};
    };
}

export function togglePagesPanel(): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: ActionTypes.TOGGLE_PAGES_PANEL,
        });

        return {data: true};
    };
}

export function openPagesPanel(): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: ActionTypes.OPEN_PAGES_PANEL,
        });

        return {data: true};
    };
}

export function closePagesPanel(): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: ActionTypes.CLOSE_PAGES_PANEL,
        });

        return {data: true};
    };
}

export function setOutlineExpanded(pageId: string, expanded: boolean, headings?: Heading[]): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: ActionTypes.SET_PAGE_OUTLINE_EXPANDED,
            data: {pageId, expanded, headings},
        });

        return {data: true};
    };
}

export function togglePageOutline(pageId: string, pageContent?: string, wikiId?: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState() as GlobalState;
        const isExpanded = state.views.pagesHierarchy.outlineExpandedNodes[pageId];

        if (isExpanded) {
            dispatch({
                type: ActionTypes.SET_PAGE_OUTLINE_EXPANDED,
                data: {pageId, expanded: false},
            });
        } else {
            let content = pageContent;
            if (!content) {
                const page = state.entities.posts.posts[pageId];
                content = page?.message || '';

                // Only fetch from server if content is completely missing
                if (!content && wikiId) {
                    const result = await dispatch(loadPage(pageId, wikiId));
                    if (result.data) {
                        content = result.data.message || '';
                    }
                }
            }

            const headings = extractHeadingsFromContent(content || '');

            dispatch({
                type: ActionTypes.SET_PAGE_OUTLINE_EXPANDED,
                data: {pageId, expanded: true, headings},
            });
        }

        return {data: true};
    };
}

export function clearOutlineCache(pageId: string): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: ActionTypes.CLEAR_PAGE_OUTLINE_CACHE,
            data: {pageId},
        });

        return {data: true};
    };
}

export function setLastViewedPage(wikiId: string, pageId: string): ActionFunc {
    return (dispatch) => {
        dispatch({
            type: ActionTypes.SET_LAST_VIEWED_PAGE,
            data: {wikiId, pageId},
        });

        return {data: true};
    };
}
