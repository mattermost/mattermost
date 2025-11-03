// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Checks if a page ID is a draft ID (not yet published to server)
 * Draft IDs have the format: draft-<timestamp>
 */
export function isDraftPageId(pageId: string): boolean {
    return pageId.startsWith('draft-');
}
