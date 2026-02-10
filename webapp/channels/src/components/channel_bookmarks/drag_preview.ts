// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Creates a synthetic drag preview element styled as a bookmark chip.
 * Used by both bar and overflow items for a consistent drag ghost.
 */
export function createBookmarkDragPreview(displayName: string): HTMLElement {
    const chip = document.createElement('div');
    chip.style.cssText = [
        'display: inline-flex',
        'align-items: center',
        'padding: 4px 12px',
        'border-radius: 12px',
        'background: var(--center-channel-bg)',
        'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)',
        'font-family: "Open Sans", sans-serif',
        'font-size: 12px',
        'font-weight: 600',
        'line-height: 16px',
        'color: var(--center-channel-color)',
        'white-space: nowrap',
        'max-width: 25rem',
        'overflow: hidden',
        'text-overflow: ellipsis',
    ].join(';');
    chip.textContent = displayName;
    return chip;
}
