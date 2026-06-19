// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {makeGetPages} from 'selectors/pages';

import {buildTree, getAncestorIds} from 'components/pages_hierarchy_panel/utils/tree_builder';

import type {Heading} from 'utils/page_outline';

import type {GlobalState} from 'types/store';
import type {PageOrDraft} from 'types/store/pages';

// Re-export types from canonical source
export type {Page, DraftPage, PageOrDraft, TreeNode} from 'types/store/pages';
export {buildTree, getAncestorIds, isDescendant, convertDraftToPagePost} from 'components/pages_hierarchy_panel/utils/tree_builder';

// Get expanded nodes for a wiki
export function getExpandedNodes(state: GlobalState, wikiId: string): {[pageId: string]: boolean} {
    return state.views.pagesHierarchy?.expandedNodes?.[wikiId] || {};
}

// Check if a specific node is expanded
export function isNodeExpanded(state: GlobalState, wikiId: string, nodeId: string): boolean {
    const expandedNodes = getExpandedNodes(state, wikiId);
    return expandedNodes[nodeId] || false;
}

// Get panel collapsed state
export function getIsPanesPanelCollapsed(state: GlobalState): boolean {
    return state.views.pagesHierarchy?.isPanelCollapsed ?? false;
}

// Get last viewed page for a wiki
export function getLastViewedPage(state: GlobalState, wikiId: string): string | null {
    return state.views.pagesHierarchy?.lastViewedPage?.[wikiId] || null;
}

// Get outline expanded nodes (which pages have their outline sections expanded)
export function getOutlineExpandedNodes(state: GlobalState): {[pageId: string]: boolean} {
    return state.views.pagesHierarchy?.outlineExpandedNodes ?? {};
}

// Get outline cache (cached headings per page)
export function getOutlineCache(state: GlobalState): {[pageId: string]: Heading[]} {
    return state.views.pagesHierarchy?.outlineCache ?? {};
}

// Dedicated instances so these module-level selectors don't share cache with the
// exported getPages singleton (which only caches the last wikiId argument).
const getPagesForTree = makeGetPages();
const getPagesForAncestors = makeGetPages();

/**
 * Get pages tree for a wiki (memoized with createSelector)
 * Builds hierarchical tree structure from flat pages array
 */
export const getPagesTree = createSelector(
    'getPagesTree',
    (state: GlobalState, wikiId: string) => getPagesForTree(state, wikiId),
    (pages) => buildTree(pages as PageOrDraft[]),
);

/**
 * Get ancestor IDs for a page (for expanding path to current page)
 * Memoized to avoid recalculating on every render
 */
export const getPageAncestorIds = createSelector(
    'getPageAncestorIds',
    (state: GlobalState, wikiId: string) => getPagesForAncestors(state, wikiId),
    (_state: GlobalState, _wikiId: string, pageId: string) => pageId,
    (pages, pageId) => getAncestorIds(pages as PageOrDraft[], pageId),
);
