// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {Post} from '@mattermost/types/posts';

import {WikiTypes} from 'mattermost-redux/action_types';
import {PostTypes} from 'mattermost-redux/constants';

import {Locations} from 'utils/constants';

import type {PostDraft} from 'types/store/draft';

export function isDraftPageId(pageId: string): boolean {
    return pageId.startsWith('draft-');
}

export function isPageComment(post: Post | null | undefined): boolean {
    return post?.type === PostTypes.PAGE_COMMENT;
}

export function isPagePost(post: Post | null | undefined): boolean {
    return post?.type === PostTypes.PAGE;
}

export function isPageInlineComment(post: Post | null | undefined): boolean {
    return post?.type === PostTypes.PAGE_COMMENT && post?.props?.comment_type === 'inline';
}

export function pageInlineCommentHasAnchor(post: Post | null | undefined): boolean {
    return isPageInlineComment(post) && Boolean(post?.props?.inline_anchor);
}

export function getPageIdFromComment(post: Post | null | undefined): string | null {
    if (!isPageComment(post)) {
        return null;
    }
    return (post?.props?.page_id as string) || null;
}

export function getPageInlineAnchorText(post: Post | null | undefined): string | null {
    if (!isPageInlineComment(post) || !post?.props?.inline_anchor) {
        return null;
    }
    return (post.props.inline_anchor as {text: string}).text || null;
}

export function isEditingExistingPage(draft: PostDraft | Post | null | undefined): boolean {
    if (!draft) {
        return false;
    }
    return Boolean(draft.props?.page_id);
}

export function getPublishedPageIdFromDraft(draft: PostDraft | Post | null | undefined): string | undefined {
    if (!draft) {
        return undefined;
    }
    return draft.props?.page_id as string | undefined;
}

/**
 * Gets the display message for a page post.
 * Returns formatted markdown with title and content preview.
 *
 * Content sources (in order of preference):
 * 1. props.search_text - plaintext from search results
 * 2. extractContent - function to extract from post.message (e.g., TipTap JSON)
 * 3. Empty - just returns title
 *
 * @param post - The page post
 * @param extractContent - Optional function to extract plaintext from post.message
 * @returns Formatted markdown string for display, or null if not a page post
 */
export function getPageDisplayMessage(
    post: Post | null | undefined,
    extractContent?: (message: string) => string | null,
): string | null {
    if (!isPagePost(post) || !post) {
        return null;
    }

    const title = (post.props?.title as string) || 'Untitled Page';
    const searchText = post.props?.search_text as string;

    // Priority 1: search_text from Props (used in search results)
    if (searchText) {
        const preview = searchText.length > 200 ? searchText.substring(0, 200) + '...' : searchText;
        return `**${title}**\n\n${preview}`;
    }

    // Priority 2: Extract from post.message (e.g., TipTap JSON)
    if (post.message && extractContent) {
        const plaintext = extractContent(post.message);
        if (plaintext) {
            const preview = plaintext.length > 200 ? plaintext.substring(0, 200) + '...' : plaintext;
            return `**${title}**\n\n${preview}`;
        }
    }

    // Fallback: just title
    return `**${title}**`;
}

/**
 * Returns true if the post is a page or page comment (any page-related type).
 */
export function isPageRelatedPost(post: Post | null | undefined): boolean {
    return isPagePost(post) || isPageComment(post);
}

/**
 * Returns true if this is a page comment thread root (inline comment with no parent).
 * Used for special threading logic in reducers.
 */
export function isPageCommentThreadRoot(post: Post | null | undefined): boolean {
    return isPageComment(post) && post?.root_id === '';
}

/**
 * Returns Redux actions needed when receiving a page post via WebSocket.
 * Centralizes the logic for updating wiki stores when pages are created/updated.
 */
export function getPageReceiveActions(post: Post): AnyAction[] {
    const actions: AnyAction[] = [];

    if (isPagePost(post) && post.props?.wiki_id) {
        actions.push({
            type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
            data: {page: post, wikiId: post.props.wiki_id},
        });
    }

    return actions;
}

/**
 * Returns true if page comment context should be shown for this post in the given location.
 * Used to determine when to render PageCommentedOn component.
 */
export function shouldShowPageCommentContext(post: Post | null | undefined, location: string): boolean {
    return isPageInlineComment(post) && location === Locations.RHS_ROOT;
}
