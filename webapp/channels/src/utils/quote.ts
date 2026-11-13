// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Turns Markdown into a blockquote by prefixing every line with "> " (">" for blank lines, so the
 * quote isn't split into several blockquotes). Leading and trailing blank lines are dropped.
 */
export function formatQuote(markdown: string): string {
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trimEnd());
    while (lines.length && !lines[0]) {
        lines.shift();
    }
    while (lines.length && !lines[lines.length - 1]) {
        lines.pop();
    }

    return lines.map((line) => (line ? `> ${line}` : '>')).join('\n');
}

/**
 * Appends a quote of the given text at the end of a draft message, separated from what's
 * already there, and followed by an empty line where the user can start typing their reply.
 */
export function appendQuoteToMessage(message: string, text: string): string {
    const quote = formatQuote(text);
    if (!quote) {
        return message;
    }

    const existing = message.trimEnd();
    if (!existing) {
        return `${quote}\n\n`;
    }

    return `${existing}\n\n${quote}\n\n`;
}
