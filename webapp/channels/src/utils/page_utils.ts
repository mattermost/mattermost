// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PostDraft} from 'types/store/draft';

/**
 * Checks if a page ID is a draft ID (not yet published to server)
 * Draft IDs have the format: draft-<timestamp>
 */
export function isDraftPageId(pageId: string): boolean {
    return pageId.startsWith('draft-');
}

/**
 * Checks if a draft is editing an existing published page (vs creating a new page)
 * When editing an existing page, the draft stores the published page_id in props
 */
export function isEditingExistingPage(draft: PostDraft | null | undefined): boolean {
    if (!draft) {
        return false;
    }
    return Boolean(draft.props?.page_id);
}

/**
 * Gets the published page ID from a draft (if editing existing page)
 * Returns undefined if this is a new page draft
 */
export function getPublishedPageIdFromDraft(draft: PostDraft | null | undefined): string | undefined {
    if (!draft) {
        return undefined;
    }
    return draft.props?.page_id as string | undefined;
}
