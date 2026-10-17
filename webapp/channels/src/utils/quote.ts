// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Splits text that is about to be quoted into paragraphs, each one being a list of lines.
 * Line endings are normalized, trailing whitespace is dropped and runs of blank lines
 * separate paragraphs. Returns an empty array when there is nothing to quote.
 */
export function getQuoteParagraphs(text: string): string[][] {
    const paragraphs: string[][] = [];
    let current: string[] = [];

    for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
        if (line.trim()) {
            current.push(line.trimEnd());
        } else if (current.length) {
            paragraphs.push(current);
            current = [];
        }
    }

    if (current.length) {
        paragraphs.push(current);
    }

    return paragraphs;
}

/**
 * Turns plain text into a Markdown blockquote by prefixing every line with "> ".
 * Paragraphs are separated by a ">" line so the quote isn't split into several blockquotes.
 */
export function formatQuote(text: string): string {
    return getQuoteParagraphs(text).
        map((lines) => lines.map((line) => `> ${line}`).join('\n')).
        join('\n>\n');
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
