// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import RenderEmoji from 'components/emoji/render_emoji';

const EMOJI_PATTERN = /:([a-zA-Z0-9_+-]+):/g;

/**
 * Strips blockquote lines (lines starting with ">") from a message
 * and collapses remaining text into a single line.
 */
export function stripBlockquotes(message: string): string {
    return message.
        split('\n').
        filter((line) => !line.trimStart().startsWith('>')).
        join(' ').
        trim();
}

/**
 * Renders a message preview string as React nodes, replacing :emoji: shortcodes
 * with inline RenderEmoji components.
 */
export function renderPreviewWithEmoji(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    EMOJI_PATTERN.lastIndex = 0;
    while ((match = EMOJI_PATTERN.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        parts.push(
            <RenderEmoji
                key={match.index}
                emojiName={match[1]}
                size={14}
            />,
        );
        lastIndex = EMOJI_PATTERN.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    if (parts.length === 0) {
        return text;
    }

    return parts;
}

/**
 * Formats a message for DM preview: strips blockquotes and renders emoji.
 */
export function formatDmPreview(message: string): React.ReactNode {
    const stripped = stripBlockquotes(message);
    if (!stripped) {
        return stripped;
    }
    return renderPreviewWithEmoji(stripped);
}
