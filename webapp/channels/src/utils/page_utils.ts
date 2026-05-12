// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import unescape from 'lodash/unescape';
import type {AnyAction} from 'redux';

import type {Post} from '@mattermost/types/posts';

import {WikiTypes} from 'mattermost-redux/action_types';
import {Permissions, PostTypes} from 'mattermost-redux/constants';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission, haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import {Locations, PagePropsKeys} from 'utils/constants';
import {tiptapToMarkdown} from 'utils/tiptap_to_markdown';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

export const DEFAULT_PAGE_TITLE = 'Untitled';

export function getPageTitle(
    page: Pick<Post, 'props'> | null | undefined,
    defaultTitle: string = DEFAULT_PAGE_TITLE,
): string {
    return (page?.props?.title as string | undefined) || defaultTitle;
}

// Mirrors server-side wiki edit permission: direct channel, system-level, or via any linked source channel.
export function canEditPageInWiki(state: GlobalState, page: Post | null | undefined): boolean {
    if (!page) {
        return false;
    }

    if (!page.channel_id) {
        return false;
    }

    if (haveISystemPermission(state, {permission: Permissions.MANAGE_SYSTEM})) {
        return true;
    }

    const linksByChannel = state.entities.wikis?.linksByChannel;
    if (!linksByChannel) {
        return false;
    }

    const wikiId = page.props?.[PagePropsKeys.WIKI_ID] as string | undefined;
    if (!wikiId) {
        return false;
    }

    for (const sourceChannelId of Object.keys(linksByChannel)) {
        const links = linksByChannel[sourceChannelId];
        if (!links?.some((link) => link.wiki_id === wikiId)) {
            continue;
        }
        const sourceChannel = getChannel(state, sourceChannelId);
        if (!sourceChannel) {
            continue;
        }
        if (haveIChannelPermission(state, sourceChannel.team_id, sourceChannel.id, Permissions.EDIT_PAGE)) {
            return true;
        }
    }

    return false;
}

type RouteMatch = {
    path: string;
    params: Record<string, any>;
};

export function getActiveTabFromRoute(match: RouteMatch): string {
    const wikiMatch = match.path?.match(/\/wiki\/:wikiId\(/);
    if (wikiMatch) {
        const wikiId = match.params.wikiId;
        if (wikiId) {
            return `wiki-${wikiId}`;
        }
    }
    return 'messages';
}

export function isDraftPageId(pageId: string): boolean {
    return pageId.startsWith('draft-');
}

export function isPageComment(post: Post | null | undefined): boolean {
    return post?.type === PostTypes.PAGE_COMMENT;
}

export function isPagePost(post: Post | null | undefined): boolean {
    return post?.type === PostTypes.PAGE;
}

export function isPageMentionPost(post: Post | null | undefined): boolean {
    return post?.type === PostTypes.PAGE_MENTION;
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

export function isPageRelatedPost(post: Post | null | undefined): boolean {
    return isPagePost(post) || isPageComment(post);
}

// isHiddenFeedPost returns true for post types that must not appear in the regular
// chat feed Redux state. Mirrors server-side WikiPostTypesHiddenInFeed (model/post.go).
export function isHiddenFeedPost(post: Post | null | undefined): boolean {
    return isPagePost(post) || isPageMentionPost(post);
}

export function isPageCommentThreadRoot(post: Post | null | undefined): boolean {
    return isPageComment(post) && post?.root_id === '';
}

export function getPageReceiveActions(post: Post): AnyAction[] {
    const actions: AnyAction[] = [];

    if (isPagePost(post)) {
        const wikiId = post.props?.[PagePropsKeys.WIKI_ID];
        actions.push({
            type: WikiTypes.RECEIVED_PAGE,
            data: {
                page: post,
                wikiId,
            },
        });
    }

    return actions;
}

export function shouldShowPageCommentContext(post: Post | null | undefined, location: string): boolean {
    return isPageInlineComment(post) && location === Locations.RHS_ROOT;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
    const clipboard = navigator.clipboard;
    if (clipboard) {
        try {
            await clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        const success = document.execCommand('copy');
        return success;
    } catch {
        return false;
    } finally {
        textArea.remove();
    }
}

export async function copyPageAsMarkdown(content: string | undefined, title: string | undefined): Promise<boolean> {
    if (!content || typeof content !== 'string' || !content.trim()) {
        return false;
    }
    try {
        const doc = JSON.parse(content);
        const titleStr = (typeof title === 'string' && title.trim()) ? title.trim() : DEFAULT_PAGE_TITLE;
        const result = tiptapToMarkdown(doc, {
            title: titleStr,
            includeTitle: true,
            preserveFileUrls: true,
        });
        return copyTextToClipboard(result.markdown);
    } catch {
        return false;
    }
}
