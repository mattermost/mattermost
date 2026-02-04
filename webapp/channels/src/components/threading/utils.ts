// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Clean up message text for display as thread name.
 * Extracts and cleans only the first line of the message.
 */
export function cleanMessageForDisplay(message: string, maxLength = 50): string {
    if (!message) {
        return '';
    }

    // Get first line BEFORE any other processing
    const firstLine = message.split('\n')[0].trim();

    if (!firstLine) {
        return '';
    }

    const cleaned = firstLine.

        // Remove code blocks (inline only since we're on first line)
        replace(/`[^`]+`/g, '[code]').

        // Remove images BEFORE links (images start with ! before the [)
        replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]').

        // Remove links but keep text
        replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').

        // Remove bold/italic
        replace(/\*\*([^*]+)\*\*/g, '$1').
        replace(/\*([^*]+)\*/g, '$1').
        replace(/__([^_]+)__/g, '$1').
        replace(/_([^_]+)_/g, '$1').

        // Remove headers
        replace(/^#+\s+/, '').

        // Remove blockquotes
        replace(/^>\s+/, '').

        // Collapse whitespace
        replace(/\s+/g, ' ').
        trim();

    // Truncate if too long
    if (cleaned.length > maxLength) {
        return cleaned.substring(0, maxLength) + '...';
    }

    return cleaned;
}
