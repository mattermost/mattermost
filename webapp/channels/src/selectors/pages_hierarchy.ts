// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {getPages} from 'selectors/pages';

import type {PageOrDraft} from 'components/pages_hierarchy_panel/utils/tree_builder';
import {buildTree, getAncestorIds} from 'components/pages_hierarchy_panel/utils/tree_builder';

import type {GlobalState} from 'types/store';

// Re-export types and utilities from tree_builder (single source of truth)
export type {Page, DraftPage, PageOrDraft, TreeNode} from 'components/pages_hierarchy_panel/utils/tree_builder';
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

/**
 * Get pages tree for a wiki (memoized with createSelector)
 * Builds hierarchical tree structure from flat pages array
 */
export const getPagesTree = createSelector(
    'getPagesTree',
    (state: GlobalState, wikiId: string) => getPages(state, wikiId),
    (pages) => buildTree(pages as PageOrDraft[]),
);

/**
 * Get ancestor IDs for a page (for expanding path to current page)
 */
export function getPageAncestorIds(state: GlobalState, wikiId: string, pageId: string): string[] {
    const pages = getPages(state, wikiId) as PageOrDraft[];
    return getAncestorIds(pages, pageId);
}
