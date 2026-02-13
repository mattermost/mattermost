// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ANCHOR_ID_PREFIX} from './wiki_page_editor/comment_anchor_mark';

/**
 * Extracts the anchor ID from a URL hash.
 *
 * @param hash - URL hash (with or without leading #)
 * @returns The anchor ID if valid, null otherwise
 *
 * @example
 * getAnchorIdFromHash('#ic-abc123') // returns 'abc123'
 * getAnchorIdFromHash('ic-abc123')  // returns 'abc123'
 * getAnchorIdFromHash('#other')     // returns null
 */
export function getAnchorIdFromHash(hash: string): string | null {
    const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;

    if (cleanHash.startsWith(ANCHOR_ID_PREFIX)) {
        return cleanHash.slice(ANCHOR_ID_PREFIX.length);
    }

    return null;
}

/**
 * Constructs a URL with the inline comment anchor hash.
 *
 * @param pageUrl - Base page URL
 * @param anchorId - The anchor ID (without prefix)
 * @returns Full URL with anchor hash
 *
 * @example
 * getPageAnchorUrl('/team/wiki/page123', 'abc123')
 * // returns '/team/wiki/page123#ic-abc123'
 */
export function getPageAnchorUrl(pageUrl: string, anchorId: string): string {
    const baseUrl = pageUrl.split('#')[0];
    return `${baseUrl}#${ANCHOR_ID_PREFIX}${anchorId}`;
}

/**
 * Scrolls to and highlights a comment anchor element.
 * Uses native browser scrolling with smooth behavior and adds a highlight animation.
 *
 * @param anchorId - The anchor ID to scroll to (without prefix)
 * @returns True if element was found and scrolled to, false otherwise
 *
 * @example
 * scrollToAnchor('abc123') // scrolls to element with id="ic-abc123"
 */
export function scrollToAnchor(anchorId: string): boolean {
    const elementId = `${ANCHOR_ID_PREFIX}${anchorId}`;
    const element = document.getElementById(elementId);

    if (!element) {
        return false;
    }

    element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
    });

    element.classList.add('anchor-highlighted');

    setTimeout(() => {
        element.classList.remove('anchor-highlighted');
    }, 2000);

    return true;
}

/**
 * Handles anchor navigation from URL hash on page load.
 * Should be called after the editor content has rendered.
 *
 * @returns True if navigation occurred, false otherwise
 */
export function handleAnchorHashNavigation(): boolean {
    const hash = window.location.hash;
    const anchorId = getAnchorIdFromHash(hash);

    if (anchorId) {
        return scrollToAnchor(anchorId);
    }

    return false;
}
