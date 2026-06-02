// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** Documented cap for channel header preview in the channel bar (see PR). */
export const CHANNEL_HEADER_PREVIEW_MAX_LENGTH = 120;

/**
 * Shortens header text shown inline in the channel header bar.
 * Full text remains available via the existing overflow popover when detected.
 */
export function previewChannelHeaderText(
    text: string,
    maxLength: number = 80,
): string {
    if (text.length <= maxLength) {
        return text;
    }

    return text.slice(0, maxLength);
}
