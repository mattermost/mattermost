// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fetchPage} from 'actions/pages';

import {ActionTypes} from 'utils/constants';
import {extractHeadingsFromContent} from 'utils/page_outline';
import type {Heading} from 'utils/page_outline';

import type {ActionFuncAsync, GlobalState} from 'types/store';

export function toggleNodeExpanded(wikiId: string, nodeId: string) {
    return {
        type: ActionTypes.TOGGLE_PAGE_NODE_EXPANDED,
        data: {wikiId, nodeId},
    };
}

export function expandAncestors(wikiId: string, ancestorIds: string[]) {
    return {
        type: ActionTypes.EXPAND_PAGE_ANCESTORS,
        data: {wikiId, ancestorIds},
    };
}

export function togglePagesPanel() {
    return {
        type: ActionTypes.TOGGLE_PAGES_PANEL,
    };
}

export function openPagesPanel() {
    return {
        type: ActionTypes.OPEN_PAGES_PANEL,
    };
}

export function closePagesPanel() {
    return {
        type: ActionTypes.CLOSE_PAGES_PANEL,
    };
}

export function setOutlineExpanded(pageId: string, expanded: boolean, headings?: Heading[]) {
    return {
        type: ActionTypes.SET_PAGE_OUTLINE_EXPANDED,
        data: {pageId, expanded, headings},
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
                    const result = await dispatch(fetchPage(pageId, wikiId));
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

export function clearOutlineCache(pageId: string) {
    return {
        type: ActionTypes.CLEAR_PAGE_OUTLINE_CACHE,
        data: {pageId},
    };
}

export function setLastViewedPage(wikiId: string, pageId: string) {
    return {
        type: ActionTypes.SET_LAST_VIEWED_PAGE,
        data: {wikiId, pageId},
    };
}
