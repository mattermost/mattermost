// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import isEqual from 'lodash/isEqual';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {getGlobalItem, getStorage} from 'selectors/storage';

import {StoragePrefixes} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

/**
 * Creates a storage key for a page draft.
 * Each user has their own draft for a page, so userId is required to prevent
 * websocket events from overwriting another user's local draft.
 */
export function makePageDraftKey(wikiId: string, pageId: string, userId: string): string {
    return `${StoragePrefixes.PAGE_DRAFT}${wikiId}_${pageId}_${userId}`;
}

/**
 * Creates a prefix for searching all drafts in a wiki (regardless of user).
 */
export function makePageDraftPrefix(wikiId: string): string {
    return `${StoragePrefixes.PAGE_DRAFT}${wikiId}_`;
}

export const getPageDraft: (state: GlobalState, wikiId: string, pageId: string) => PostDraft | null = (state: GlobalState, wikiId: string, pageId: string): PostDraft | null => {
    const userId = getCurrentUserId(state);
    const key = makePageDraftKey(wikiId, pageId, userId);
    return getGlobalItem<PostDraft | null>(state, key, null);
};

export const hasPageDraft: (state: GlobalState, wikiId: string, pageId: string) => boolean = (state: GlobalState, wikiId: string, pageId: string): boolean => {
    return getPageDraft(state, wikiId, pageId) !== null;
};

/**
 * Checks if a TipTap JSON document is semantically empty.
 * An empty TipTap doc has structure {type: 'doc', content: []} or content with only empty paragraphs.
 */
function isTipTapDocEmpty(doc: any): boolean {
    if (!doc || typeof doc !== 'object') {
        return true;
    }

    // Not a TipTap doc structure
    if (doc.type !== 'doc') {
        return Object.keys(doc).length === 0;
    }

    // No content array or empty content array
    if (!Array.isArray(doc.content) || doc.content.length === 0) {
        return true;
    }

    // Check if all content nodes are empty paragraphs (no text content)
    return doc.content.every((node: any) => {
        if (node.type === 'paragraph') {
            return !node.content || node.content.length === 0;
        }
        return false;
    });
}

/**
 * Recursively removes null and undefined values from an object.
 * TipTap sometimes adds null attributes (e.g., {type: null, start: 1} in orderedList)
 * that cause deep comparison to fail even though the content is semantically identical.
 */
function removeNullValues(obj: any): any {
    if (obj === null || obj === undefined) {
        return undefined;
    }

    if (Array.isArray(obj)) {
        return obj.map(removeNullValues);
    }

    if (typeof obj === 'object') {
        const result: Record<string, any> = {};
        for (const key of Object.keys(obj)) {
            const value = removeNullValues(obj[key]);
            if (value !== null && value !== undefined) {
                result[key] = value;
            }
        }
        return result;
    }

    return obj;
}

/**
 * Computes whether a draft has unsaved changes compared to published content.
 * This is the core comparison logic, extracted for use in the memoized selector.
 */
function computeHasUnsavedChanges(draftMessage: string | undefined, publishedContent: string): boolean {
    const draftContent = draftMessage || '';

    // Fast path: if strings are exactly equal, no changes
    if (draftContent === publishedContent) {
        return false;
    }

    // Fast path: if both are empty strings, no changes
    if (!draftContent && !publishedContent) {
        return false;
    }

    // For TipTap JSON content, do deep comparison instead of string comparison
    // This handles cases where JSON formatting differs but content is semantically identical
    try {
        const draftJson = JSON.parse(draftContent || '{}');
        const publishedJson = JSON.parse(publishedContent || '{}');

        // Handle the case where both are semantically empty
        // TipTap may serialize empty content as {type: 'doc', content: []}
        // while the published page may be empty string '' (parsed as {})
        const draftEmpty = isTipTapDocEmpty(draftJson);
        const publishedEmpty = isTipTapDocEmpty(publishedJson);
        if (draftEmpty && publishedEmpty) {
            return false;
        }

        // Normalize both documents by removing null values before comparison
        // TipTap sometimes adds null attributes (e.g., {type: null} in orderedList)
        // that would cause comparison to fail even though content is identical
        const normalizedDraft = removeNullValues(draftJson);
        const normalizedPublished = removeNullValues(publishedJson);

        // Use lodash isEqual for deep comparison
        return !isEqual(normalizedDraft, normalizedPublished);
    } catch {
        // Fallback to string comparison if JSON parsing fails
        // (though this shouldn't happen for TipTap content)
        return draftContent !== publishedContent;
    }
}

/**
 * Memoized selector that checks if a page draft has unsaved changes.
 * Uses createSelector to avoid expensive JSON parsing and deep comparison
 * when inputs haven't changed.
 */
export const hasUnsavedChanges = createSelector(
    'hasUnsavedChanges',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (state: GlobalState, wikiId: string, pageId: string, publishedContent: string) => getPageDraft(state, wikiId, pageId),
    (_state: GlobalState, _wikiId: string, _pageId: string, publishedContent: string) => publishedContent,
    (draft, publishedContent): boolean => {
        if (!draft) {
            return false;
        }
        return computeHasUnsavedChanges(draft.message, publishedContent);
    },
);

export const getPageDraftsForWiki: (state: GlobalState, wikiId: string) => PostDraft[] = createSelector(
    'getPageDraftsForWiki',
    getStorage,
    (_state: GlobalState, wikiId: string) => wikiId,
    (state: GlobalState) => getCurrentUserId(state),
    (storage, wikiId, currentUserId): PostDraft[] => {
        const prefix = makePageDraftPrefix(wikiId);
        const drafts: PostDraft[] = [];

        Object.keys(storage).forEach((key) => {
            // Only include drafts for the current user
            if (key.startsWith(prefix) && key.endsWith(`_${currentUserId}`)) {
                const storedDraft = storage[key];
                if (storedDraft && storedDraft.value) {
                    drafts.push(storedDraft.value as PostDraft);
                }
            }
        });

        return drafts;
    },
);

export const getUserDraftKeysForPage: (state: GlobalState, wikiId: string, pageId: string) => string[] = (state: GlobalState, wikiId: string, pageId: string): string[] => {
    const currentUserId = getCurrentUserId(state);
    const prefix = makePageDraftPrefix(wikiId);
    const storage = getStorage(state);
    const keys: string[] = [];

    Object.keys(storage).forEach((key) => {
        // Only include keys for the current user
        if (key.startsWith(prefix) && key.endsWith(`_${currentUserId}`)) {
            const draft = storage[key];
            if (draft && typeof draft === 'object' && 'rootId' in draft && draft.rootId === pageId) {
                keys.push(key);
            }
        }
    });

    return keys;
};

export const getFirstPageDraftForWiki: (state: GlobalState, wikiId: string) => PostDraft | null = (state: GlobalState, wikiId: string): PostDraft | null => {
    const drafts = getPageDraftsForWiki(state, wikiId);
    return drafts.length > 0 ? drafts[0] : null;
};

// Get published draft timestamps from wiki pages state
const getPublishedDraftTimestamps = (state: GlobalState): Record<string, number> => {
    return state.entities.wikiPages?.publishedDraftTimestamps || {};
};

/**
 * Get unpublished drafts for a wiki, filtering out recently published drafts.
 * When a draft is published, it gets added to publishedDraftTimestamps to prevent
 * the draft from appearing in the tree momentarily before being fully removed from storage.
 */
export const getUnpublishedPageDraftsForWiki: (state: GlobalState, wikiId: string) => PostDraft[] = createSelector(
    'getUnpublishedPageDraftsForWiki',
    getPageDraftsForWiki,
    getPublishedDraftTimestamps,
    (allDrafts, publishedDraftTimestamps): PostDraft[] => {
        return allDrafts.filter((draft) => {
            const draftId = draft.rootId;
            const isPublished = Boolean(publishedDraftTimestamps[draftId]);
            return !isPublished;
        });
    },
);

export const hasUnpublishedChanges: (state: GlobalState, wikiId: string, pageId: string, publishedContent: string) => boolean = (state: GlobalState, wikiId: string, pageId: string, publishedContent: string): boolean => {
    return hasUnsavedChanges(state, wikiId, pageId, publishedContent);
};

/**
 * Get new drafts for a wiki (drafts that are not edits of existing pages).
 * New drafts are identified by has_published_version being false/undefined.
 */
export const getNewDraftsForWiki: (state: GlobalState, wikiId: string) => PostDraft[] = createSelector(
    'getNewDraftsForWiki',
    getUnpublishedPageDraftsForWiki,
    (allDrafts): PostDraft[] => {
        return allDrafts.filter((draft) => !draft.props?.has_published_version);
    },
);
