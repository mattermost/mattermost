// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WikiRhsTypes} from 'utils/constants';

import type {InlineAnchor} from 'types/store/pages';

export function setPendingInlineAnchor(anchor: InlineAnchor | null) {
    return {
        type: WikiRhsTypes.SET_PENDING_INLINE_ANCHOR,
        anchor,
    };
}

export function setWikiRhsMode(mode: 'outline' | 'comments') {
    return {
        type: WikiRhsTypes.SET_MODE,
        mode,
    };
}

export function setWikiRhsWikiId(wikiId: string | null) {
    return {
        type: WikiRhsTypes.SET_WIKI_ID,
        wikiId,
    };
}

export function setWikiRhsActiveTab(tab: 'page_comments' | 'all_threads') {
    return {
        type: WikiRhsTypes.SET_ACTIVE_TAB,
        tab,
    };
}

export function setFocusedInlineCommentId(commentId: string | null) {
    return {
        type: WikiRhsTypes.SET_FOCUSED_INLINE_COMMENT_ID,
        commentId,
    };
}

export function setSubmittingComment(isSubmitting: boolean) {
    return {
        type: WikiRhsTypes.SET_SUBMITTING_COMMENT,
        isSubmitting,
    };
}
