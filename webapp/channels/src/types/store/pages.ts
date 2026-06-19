// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@mattermost/types/wikis';

export type {Page};

/**
 * DraftPage represents a page draft in the hierarchy tree.
 * It uses Post fields since drafts are still stored as PostDraft (post-shaped).
 */
export type DraftPage = {
    id: string;
    type: 'page_draft';
    parent_id: string;
    title: string;
    body: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    edit_at: number;
    sort_order: number;
    wiki_id: string;
    user_id: string;
    last_modified_by: string;
    search_text: string;
    original_id: string;
    has_effective_view_restriction: boolean;
    has_local_edit_restriction: boolean;
    properties: Record<string, unknown>;
    pending_file_ids: string[];
    state?: 'DELETED';
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
