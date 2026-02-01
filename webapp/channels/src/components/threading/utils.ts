// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Clean up message text for display as thread name.
 * Removes markdown formatting and returns only the first line, truncated.
 */
export function cleanMessageForDisplay(message: string, maxLength = 50): string {
    if (!message) {
        return '';
    }

    let cleaned = message.

        // Remove code blocks
        replace(/```[\s\S]*?```/g, '[code]').
        replace(/`[^`]+`/g, '[code]').

        // Remove links but keep text
        replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').

        // Remove images
        replace(/!\[[^\]]*\]\([^)]+\)/g, '[image]').

        // Remove bold/italic
        replace(/\*\*([^*]+)\*\*/g, '$1').
        replace(/\*([^*]+)\*/g, '$1').
        replace(/__([^_]+)__/g, '$1').
        replace(/_([^_]+)_/g, '$1').

        // Remove headers
        replace(/^#+\s+/gm, '').

        // Remove blockquotes
        replace(/^>\s+/gm, '').

        // Remove horizontal rules
        replace(/^---+$/gm, '').

        // Collapse whitespace
        replace(/\s+/g, ' ').
        trim();

    // Get first line only
    const firstLine = cleaned.split('\n')[0];

    // Truncate if too long
    if (firstLine.length > maxLength) {
        return firstLine.substring(0, maxLength) + '...';
    }

    return firstLine;
}
