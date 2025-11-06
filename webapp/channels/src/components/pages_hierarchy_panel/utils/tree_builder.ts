// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import type {PageDisplayTypes} from 'utils/constants';

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

/**
 * Build a tree structure from a flat list of pages
 * Pages are connected via page_parent_id field
 */
export function buildTree(pages: PageOrDraft[]): TreeNode[] {
    // Create lookup map
    const nodeMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    // First pass: Create all nodes
    pages.forEach((page) => {
        const title = (page.props?.title as string | undefined) || page.message || 'Untitled';

        nodeMap.set(page.id, {
            id: page.id,
            title,
            page,
            children: [],
            parentId: page.page_parent_id || null,
        });
    });

    // Second pass: Build parent-child relationships
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
                // Parent doesn't exist in current set, treat as root
                rootNodes.push(node);
            }
        } else {
            // No parent = root node
            rootNodes.push(node);
        }
    });

    // Sort nodes by creation time (oldest first) for consistent ordering
    // This ensures tree order remains stable across navigation and updates
    const sortByCreateTime = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.
            sort((a, b) => {
                const aCreateAt = a.page.create_at || 0;
                const bCreateAt = b.page.create_at || 0;
                return aCreateAt - bCreateAt;
            }).
            map((node) => ({
                ...node,
                children: sortByCreateTime(node.children),
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
