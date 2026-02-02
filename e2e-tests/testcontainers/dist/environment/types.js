// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Format elapsed time in a human-readable format.
 * Shows decimal if < 10s, whole seconds if < 60s, otherwise minutes and seconds.
 */
export function formatElapsed(ms) {
    const totalSeconds = ms / 1000;
    if (totalSeconds < 10) {
        return `${totalSeconds.toFixed(1)}s`;
    }
    if (totalSeconds < 60) {
        return `${Math.round(totalSeconds)}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}m ${seconds}s`;
}
