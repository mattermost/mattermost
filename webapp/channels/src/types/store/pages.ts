// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

/**
 * Page is a type alias for Post.
 * Pages are stored as Posts in the backend with type='page'.
 */
export type Page = Post;

/**
 * DraftPage represents a page draft in the hierarchy tree.
 * It's similar to a Post but has a draft-specific type.
 */
export type DraftPage = Omit<Post, 'type' | 'page_parent_id'> & {
    type: 'page_draft';
    page_parent_id: string;
};

/**
 * PageOrDraft is a union type for pages or draft pages in the hierarchy.
 */
export type PageOrDraft = Page | DraftPage;

/**
 * TreeNode represents a node in the page hierarchy tree.
 */
export type TreeNode = {
    id: string;
    title: string;
    page: PageOrDraft;
    children: TreeNode[];
    parentId: string | null;
};

/**
 * PageDraftListItem is used for rendering draft items in the UI.
 * This is a simplified representation for the drafts section.
 */
export type PageDraftListItem = {
    id: string;
    title: string;
    lastModified: number;
    pageParentId?: string;
};

/**
 * InlineAnchor represents an anchor point for inline comments on page content.
 * It captures the selected text and a unique anchor ID for positioning.
 */
export type InlineAnchor = {
    anchor_id: string;
    text: string;
};

/**
 * TranslationReference links a page to its translation in another language.
 */
export type TranslationReference = {
    page_id: string;
    language_code: string;
};
