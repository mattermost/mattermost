// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Clean up message text for display as a thread name/preview.
 * Used in thread view header, sidebar thread items, and thread list.
 * Takes only the first line and removes markdown formatting.
 */
export function cleanThreadNameForDisplay(message: string, maxLength = 100): string {
    if (!message) {
        return '';
    }

    // Get only the first line of content
    let cleaned = message.split(/\r?\n/)[0] || message;

    cleaned = cleaned.

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

    // Truncate if too long
    if (cleaned.length > maxLength) {
        cleaned = cleaned.substring(0, maxLength) + '...';
    }

    return cleaned;
}
