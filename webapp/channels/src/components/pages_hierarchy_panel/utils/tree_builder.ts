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

    // Sort children recursively by create_at (oldest first)
    const sortChildren = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.sort((a, b) => {
            return a.page.create_at - b.page.create_at;
        }).map((node) => ({
            ...node,
            children: sortChildren(node.children),
        }));
    };

    return sortChildren(rootNodes);
}

/**
 * Get all ancestor IDs for a given page (for expanding path)
 */
export function getAncestorIds(pages: Post[], pageId: string): string[] {
    const ancestorIds: string[] = [];
    const pageMap = new Map(pages.map((p) => [p.id, p]));

    let currentPage = pageMap.get(pageId);
    while (currentPage && currentPage.page_parent_id) {
        const parentId = currentPage.page_parent_id;
        ancestorIds.unshift(parentId);
        currentPage = pageMap.get(parentId);
    }

    return ancestorIds;
}
