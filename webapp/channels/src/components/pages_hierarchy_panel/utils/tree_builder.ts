// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PageDisplayTypes} from 'utils/constants';
import {getPageTitle} from 'utils/post_utils';

import type {PostDraft} from 'types/store/draft';
import type {DraftPage, PageOrDraft, TreeNode} from 'types/store/pages';

export type {Page, DraftPage, PageOrDraft, TreeNode} from 'types/store/pages';

const DEFAULT_UNTITLED = 'Untitled';

/**
 * Convert a PostDraft to a DraftPage object for tree display
 */
export function convertDraftToPagePost(draft: PostDraft, untitledText: string = DEFAULT_UNTITLED): DraftPage {
    return {
        id: draft.rootId,
        create_at: draft.createAt || 0,
        update_at: draft.updateAt || 0,
        delete_at: 0,
        edit_at: 0,
        is_pinned: false,
        user_id: '',
        channel_id: draft.channelId,
        root_id: '',
        original_id: '',
        message: draft.message,
        type: PageDisplayTypes.PAGE_DRAFT,
        page_parent_id: draft.props?.page_parent_id || '',
        props: {
            ...draft.props,
            title: draft.props?.title || untitledText,
        },
        hashtags: '',
        filenames: [],
        file_ids: [],
        pending_post_id: '',
        reply_count: 0,
        last_reply_at: 0,
        participants: null,
        metadata: {
            embeds: [],
            emojis: [],
            files: [],
            images: {},
        },
    };
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
    // Create lookup map and track original index for stable ordering
    const nodeMap = new Map<string, TreeNode & {originalIndex: number}>();
    const rootNodes: Array<TreeNode & {originalIndex: number}> = [];

    // First pass: Create all nodes and preserve original order
    pages.forEach((page, index) => {
        const title = getPageTitle(page);

        nodeMap.set(page.id, {
            id: page.id,
            title,
            page,
            children: [],
            parentId: page.page_parent_id || null,
            originalIndex: index, // Preserve input order
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
    // Use ID as tiebreaker to ensure deterministic ordering when timestamps are identical
    const sortByCreateTime = (nodes: Array<TreeNode & {originalIndex: number}>): TreeNode[] => {
        return nodes.
            sort((a, b) => {
                const aCreateAt = a.page.create_at || 0;
                const bCreateAt = b.page.create_at || 0;
                if (aCreateAt !== bCreateAt) {
                    return aCreateAt - bCreateAt;
                }

                // Use ID as tiebreaker for deterministic ordering
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
 * Get all descendant IDs for a given page (for move/delete operations)
 * Returns IDs in depth-first order (children before grandchildren at each level)
 */
export function getDescendantIds(pages: PageOrDraft[], pageId: string): string[] {
    const descendantIds: string[] = [];

    const findDescendants = (parentId: string) => {
        pages.forEach((page) => {
            if (page.page_parent_id === parentId) {
                descendantIds.push(page.id);
                findDescendants(page.id);
            }
        });
    };

    findDescendants(pageId);
    return descendantIds;
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
