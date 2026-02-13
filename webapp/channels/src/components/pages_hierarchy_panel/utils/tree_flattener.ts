// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {TreeNode} from 'selectors/pages_hierarchy';

export type FlatNode = TreeNode & {
    depth: number;
    hasChildren: boolean;
    isExpanded: boolean;
};

/**
 * Flatten tree structure for rendering, respecting expanded state
 * Only includes nodes that should be visible based on parent expansion
 */
export function flattenTree(
    tree: TreeNode[],
    expandedNodes: {[pageId: string]: boolean},
    depth = 0,
): FlatNode[] {
    const flatNodes: FlatNode[] = [];

    tree.forEach((node) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedNodes[node.id] || false;

        // Add current node
        flatNodes.push({
            ...node,
            depth,
            hasChildren,
            isExpanded,
        });

        // Add children if expanded
        if (isExpanded && hasChildren) {
            const childNodes = flattenTree(node.children, expandedNodes, depth + 1);
            flatNodes.push(...childNodes);
        }
    });

    return flatNodes;
}

/**
 * Filter tree nodes by search query (matches title)
 * Returns all nodes that match OR have matching descendants
 */
export function filterTreeBySearch(tree: TreeNode[], query: string): TreeNode[] {
    if (!query.trim()) {
        return tree;
    }

    const lowerQuery = query.toLowerCase();

    const filterNode = (node: TreeNode): TreeNode | null => {
        const titleMatches = node.title.toLowerCase().includes(lowerQuery);

        // Recursively filter children
        const filteredChildren = node.children.
            map(filterNode).
            filter((child): child is TreeNode => child !== null);

        // Include node if it matches OR any child matches
        if (titleMatches || filteredChildren.length > 0) {
            return {
                ...node,
                children: filteredChildren,
            };
        }

        return null;
    };

    return tree.map(filterNode).filter((node): node is TreeNode => node !== null);
}

/**
 * Get all node IDs that match a search query (for auto-expanding)
 */
export function getMatchingNodeIds(tree: TreeNode[], query: string): string[] {
    if (!query.trim()) {
        return [];
    }

    const lowerQuery = query.toLowerCase();
    const matchingIds: string[] = [];

    const traverse = (nodes: TreeNode[]) => {
        nodes.forEach((node) => {
            if (node.title.toLowerCase().includes(lowerQuery)) {
                matchingIds.push(node.id);
            }
            if (node.children.length > 0) {
                traverse(node.children);
            }
        });
    };

    traverse(tree);
    return matchingIds;
}
