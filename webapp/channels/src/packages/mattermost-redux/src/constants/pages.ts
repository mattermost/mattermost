// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Page/Wiki props keys — must match server constants in model/post.go.
// Canonical location inside mattermost-redux so both webapp and the redux
// package import the same strings; drift becomes a compile error.
export const PagePropsKeys = {
    PAGE_ID: 'page_id',
    WIKI_ID: 'wiki_id',
    PARENT_COMMENT_ID: 'parent_comment_id',
    PAGE_STATUS: 'page_status',
    COMMENT_RESOLVED: 'comment_resolved',
    RESOLVED_AT: 'resolved_at',
    RESOLVED_BY: 'resolved_by',
    INLINE_ANCHOR: 'inline_anchor',
    TITLE: 'title',
    PAGE_PARENT_ID: 'page_parent_id',
    ORIGINAL_PAGE_UPDATE_AT: 'original_page_update_at',
    ORIGINAL_PAGE_EDIT_AT: 'original_page_edit_at',

    // Translation metadata
    TRANSLATED_FROM: 'translated_from',
    TRANSLATION_LANGUAGE: 'translation_language',
    TRANSLATIONS: 'translations',
} as const;
