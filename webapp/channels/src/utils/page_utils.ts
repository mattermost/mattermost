// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'mattermost-redux/constants';

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
