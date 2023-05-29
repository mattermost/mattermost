// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import TurndownService from 'turndown';
import {tables} from '@guyplusplus/turndown-plugin-gfm';

import {splitMessageBasedOnCaretPosition, splitMessageBasedOnTextSelection} from 'utils/post_utils';

type FormatMarkdownParams = {
    message: string;
    clipboardData: DataTransfer;
    selectionStart: number | null;
    selectionEnd: number | null;
};

export function parseHtmlTable(html: string): HTMLTableElement | null {
    return new DOMParser().parseFromString(html, 'text/html').querySelector('table');
}

export function getHtmlTable(clipboardData: DataTransfer): HTMLTableElement | null {
    if (Array.from(clipboardData.types).indexOf('text/html') === -1) {
        return null;
    }

    const html = clipboardData.getData('text/html');

    if (!(/<table/i).test(html)) {
        return null;
    }

    const table = parseHtmlTable(html);
    if (!table) {
        return null;
    }

    return table;
}

export function hasHtmlLink(clipboardData: DataTransfer): boolean {
    return Array.from(clipboardData.types).includes('text/html') && (/<a/i).test(clipboardData.getData('text/html'));
}

export function getPlainText(clipboardData: DataTransfer): string | boolean {
    if (Array.from(clipboardData.types).indexOf('text/plain') === -1) {
        return false;
    }

    const plainText = clipboardData.getData('text/plain');

    return plainText;
}

export function isGitHubCodeBlock(tableClassName: string): boolean {
    const result = (/\b(js|blob|diff)-./).test(tableClassName);
    return result;
}

export function isHttpProtocol(url: string): boolean {
    return url.startsWith('http://');
}

export function isHttpsProtocol(url: string): boolean {
    return url.startsWith('https://');
}

function isHeaderlessTable(table: HTMLTableElement): boolean {
    return table.querySelectorAll('th').length === 0;
}

export function formatMarkdownMessage(clipboardData: DataTransfer, message?: string, caretPosition?: number): {formattedMessage: string; formattedMarkdown: string} {
    const html = clipboardData.getData('text/html');

    //TODO : Instantiate turndown service in a central file instead
    const service = new TurndownService({emDelimiter: '*'}).remove('style');
    service.use(tables);
    let formattedMarkdown = service.turndown(html).trim();

    const table = getHtmlTable(clipboardData);

    if (table && isHeaderlessTable(table)) {
        formattedMarkdown += '\n';
    }

    let formattedMessage: string;

    if (!message) {
        formattedMessage = formattedMarkdown;
    } else if (typeof caretPosition === 'undefined') {
        formattedMessage = `${message}\n\n${formattedMarkdown}`;
    } else {
        const newMessage = [message.slice(0, caretPosition) + '\n', formattedMarkdown, message.slice(caretPosition)];
        formattedMessage = newMessage.join('');
    }

    return {formattedMessage, formattedMarkdown};
}

export function formatGithubCodePaste({message, clipboardData, selectionStart, selectionEnd}: FormatMarkdownParams): {formattedMessage: string; formattedCodeBlock: string} {
    const isTextSelected = selectionStart !== selectionEnd;
    const {firstPiece, lastPiece} = isTextSelected ? splitMessageBasedOnTextSelection(selectionStart ?? message.length, selectionEnd ?? message.length, message) : splitMessageBasedOnCaretPosition(selectionStart ?? message.length, message);

    // Add new lines if content exists before or after the cursor.
    const requireStartLF = firstPiece === '' ? '' : '\n';
    const requireEndLF = lastPiece === '' ? '' : '\n';
    const formattedCodeBlock = requireStartLF + '```\n' + getPlainText(clipboardData) + '\n```' + requireEndLF;
    const formattedMessage = `${firstPiece}${formattedCodeBlock}${lastPiece}`;

    return {formattedMessage, formattedCodeBlock};
}

/**
 * Formats the selected text with the copied link to markdown link format.
 * @caution This function assumes that the clipboardData contains a link.
 */
export function formatMarkdownLinkMessage({message, clipboardData, selectionStart, selectionEnd}: FormatMarkdownParams): string {
    const isTextSelected = selectionStart !== selectionEnd;

    let selectedText = '';
    if (isTextSelected) {
        selectedText = message.slice(selectionStart || 0, selectionEnd || 0);
    }

    const url = clipboardData.getData('text/plain');
    const markdownLink = `[${selectedText}](${url})`;

    return markdownLink;
}
