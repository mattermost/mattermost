// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import unescape from 'lodash/unescape';
import type {AnyAction} from 'redux';

import type {Post} from '@mattermost/types/posts';

import {WikiTypes} from 'mattermost-redux/action_types';
import {PostTypes} from 'mattermost-redux/constants';

import {Locations, PagePropsKeys} from 'utils/constants';
import {DEFAULT_PAGE_TITLE, getPageTitle} from 'utils/post_utils';
import {tiptapToMarkdown} from 'utils/tiptap_to_markdown';
import {copyToClipboard} from 'utils/utils';

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
    return isPageComment(post) && post?.props?.comment_type === 'inline';
}

export function pageInlineCommentHasAnchor(post: Post | null | undefined): boolean {
    return isPageInlineComment(post) && Boolean(post?.props?.[PagePropsKeys.INLINE_ANCHOR]);
}

export function getPageIdFromComment(post: Post | null | undefined): string | null {
    if (!isPageComment(post)) {
        return null;
    }
    return (post?.props?.[PagePropsKeys.PAGE_ID] as string) || null;
}

export function getPageInlineAnchorText(post: Post | null | undefined): string | null {
    if (!isPageInlineComment(post) || !post?.props?.[PagePropsKeys.INLINE_ANCHOR]) {
        return null;
    }
    const text = (post.props[PagePropsKeys.INLINE_ANCHOR] as {text: string}).text || null;
    return text ? unescape(text) : null;
}

export function getPageInlineAnchorId(post: Post | null | undefined): string | null {
    if (!isPageInlineComment(post) || !post?.props?.[PagePropsKeys.INLINE_ANCHOR]) {
        return null;
    }
    return (post.props[PagePropsKeys.INLINE_ANCHOR] as {anchor_id: string}).anchor_id || null;
}

export function isEditingExistingPage(draft: PostDraft | Post | null | undefined): boolean {
    if (!draft) {
        return false;
    }

    // Use has_published_version from server if available, otherwise fall back to page_id prop
    if (draft.props?.has_published_version !== undefined) {
        return Boolean(draft.props.has_published_version);
    }
    return Boolean(draft.props?.[PagePropsKeys.PAGE_ID]);
}

export function getPublishedPageIdFromDraft(draft: PostDraft | Post | null | undefined): string | undefined {
    if (!draft) {
        return undefined;
    }
    return draft.props?.[PagePropsKeys.PAGE_ID] as string | undefined;
}

const MAX_PREVIEW_LENGTH = 200;

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}

/**
 * Gets the display message for a page post.
 * Returns formatted markdown with title and content preview.
 */
export function getPageDisplayMessage(
    post: Post | null | undefined,
    extractContent?: (message: string) => string | null,
): string | null {
    if (!isPagePost(post) || !post) {
        return null;
    }

    const title = getPageTitle(post, 'Untitled Page');
    const searchText = post.props?.search_text as string;

    if (searchText) {
        return `**${title}**\n\n${truncateText(searchText, MAX_PREVIEW_LENGTH)}`;
    }

    if (post.message && extractContent) {
        const plaintext = extractContent(post.message);
        if (plaintext) {
            return `**${title}**\n\n${truncateText(plaintext, MAX_PREVIEW_LENGTH)}`;
        }
    }

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

    if (isPagePost(post) && post.props?.[PagePropsKeys.WIKI_ID]) {
        actions.push({
            type: WikiTypes.RECEIVED_PAGE_IN_WIKI,
            data: {page: post, wikiId: post.props[PagePropsKeys.WIKI_ID]},
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

/**
 * Copies page content as markdown to the clipboard.
 * Parses TipTap JSON content, converts to markdown, and copies to clipboard.
 * @param content - TipTap JSON content string
 * @param title - Page title (defaults to DEFAULT_PAGE_TITLE if empty)
 */
export function copyPageAsMarkdown(content: string | undefined, title: string | undefined): void {
    if (!content || typeof content !== 'string' || !content.trim()) {
        return;
    }
    try {
        const doc = JSON.parse(content);
        const titleStr = (typeof title === 'string' && title.trim()) ? title.trim() : DEFAULT_PAGE_TITLE;
        const result = tiptapToMarkdown(doc, {
            title: titleStr,
            includeTitle: true,
            preserveFileUrls: true,
        });
        copyToClipboard(result.markdown);
    } catch {
        // Silent fail - clipboard operations are fire-and-forget
    }
}
