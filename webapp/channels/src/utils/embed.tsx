// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Checks if the application is running embedded in another platform
 * This is determined by checking if window.self is not equal to window.parent.
 * If accessing window.parent throws an error, it is assumed the app is in a cross-origin iframe.
 * @returns True if the app is running embedded
 */
export function isEmbedded(): boolean {
    try {
        return window.self !== window.parent;
    } catch (e) {
        // If accessing window.parent throws an error, we're in a cross-origin iframe
        return true;
    }
}
