// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {getPages} from 'selectors/pages';

import type {PageDisplayTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

export type Page = Post;

export type DraftPage = Omit<Post, 'type' | 'page_parent_id'> & {
    type: typeof PageDisplayTypes.PAGE_DRAFT;
    page_parent_id: string;
};

export type PageOrDraft = Page | DraftPage;

export type TreeNode = {
    id: string;
    title: string;
    page: PageOrDraft;
    children: TreeNode[];
    parentId: string | null;
};

// Get expanded nodes for a wiki
export function getExpandedNodes(state: GlobalState, wikiId: string): {[pageId: string]: boolean} {
    return state.views.pagesHierarchy.expandedNodes[wikiId] || {};
}

// Get selected page ID
export function getSelectedPageId(state: GlobalState): string | null {
    return state.views.pagesHierarchy.selectedPageId;
}

// Check if a specific node is expanded
export function isNodeExpanded(state: GlobalState, wikiId: string, nodeId: string): boolean {
    const expandedNodes = getExpandedNodes(state, wikiId);
    return expandedNodes[nodeId] || false;
}

// Get panel collapsed state
export function getIsPanesPanelCollapsed(state: GlobalState): boolean {
    return state.views.pagesHierarchy.isPanelCollapsed;
}

// Get last viewed page for a wiki
export function getLastViewedPage(state: GlobalState, wikiId: string): string | null {
    return state.views.pagesHierarchy.lastViewedPage[wikiId] || null;
}

/**
 * Build a tree structure from a flat list of pages
 * Pages are connected via page_parent_id field
 *
 * IMPORTANT: Pages array order is preserved! The input array should already be
 * in the correct order from Redux (server-defined order). This function only
 * organizes pages into a tree structure, it does NOT re-sort them.
 */
export function buildTree(pages: PageOrDraft[]): TreeNode[] {
    const nodeMap = new Map<string, TreeNode & {originalIndex: number}>();
    const rootNodes: Array<TreeNode & {originalIndex: number}> = [];

    pages.forEach((page, index) => {
        const title = (page.props?.title as string | undefined) || page.message || 'Untitled';

        nodeMap.set(page.id, {
            id: page.id,
            title,
            page,
            children: [],
            parentId: page.page_parent_id || null,
            originalIndex: index,
        });
    });

    pages.forEach((page) => {
        const node = nodeMap.get(page.id);
        if (!node) {
            return;
        }

        const parentId = page.page_parent_id;

        if (parentId) {
            const parent = nodeMap.get(parentId);
            if (parent) {
                parent.children.push(node);
            } else {
                rootNodes.push(node);
            }
        } else {
            rootNodes.push(node);
        }
    });

    const sortByCreateTime = (nodes: Array<TreeNode & {originalIndex: number}>): TreeNode[] => {
        return nodes.
            sort((a, b) => {
                const aCreateAt = a.page.create_at || 0;
                const bCreateAt = b.page.create_at || 0;
                if (aCreateAt !== bCreateAt) {
                    return aCreateAt - bCreateAt;
                }
                return a.id.localeCompare(b.id);
            }).
            map((node) => ({
                id: node.id,
                title: node.title,
                page: node.page,
                children: sortByCreateTime(node.children as Array<TreeNode & {originalIndex: number}>),
                parentId: node.parentId,
            }));
    };

    return sortByCreateTime(rootNodes);
}

/**
 * Get all ancestor IDs for a given page (for expanding path)
 */
export function getAncestorIds(pages: PageOrDraft[], pageId: string, pageMap?: Map<string, PageOrDraft>): string[] {
    const ancestorIds: string[] = [];
    const map = pageMap || new Map(pages.map((p) => [p.id, p]));

    let currentPage = map.get(pageId);
    while (currentPage && currentPage.page_parent_id) {
        const parentId = currentPage.page_parent_id;
        ancestorIds.unshift(parentId);
        currentPage = map.get(parentId);
    }

    return ancestorIds;
}

/**
 * Check if targetNode is a descendant of sourceNode
 * Used for drag-and-drop validation to prevent dropping a page into its own subtree
 */
export function isDescendant(source: TreeNode | null, target: TreeNode | null): boolean {
    if (!source || !target) {
        return false;
    }

    if (source.id === target.id) {
        return true;
    }

    return source.children.some((child) => isDescendant(child, target));
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
