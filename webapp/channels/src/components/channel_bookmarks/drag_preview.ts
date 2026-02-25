// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Creates a synthetic drag preview element styled as a bookmark chip.
 * Used by both bar and overflow items for a consistent drag ghost.
 *
 * Styles are defined in channel_bookmarks.scss (.bookmarkDragPreview).
 */
export function createBookmarkDragPreview(displayName: string): HTMLElement {
    const chip = document.createElement('div');
    chip.className = 'bookmarkDragPreview';
    chip.textContent = displayName;
    return chip;
}
