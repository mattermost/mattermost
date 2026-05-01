// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import isNil from 'lodash/isNil';

import type {TextboxElement} from 'components/textbox';

import {Locations} from 'utils/constants';
import {execCommandInsertText} from 'utils/exec_commands';
import {DEFAULT_PLACEHOLDER_URL} from 'utils/markdown/apply_markdown';
import {splitMessageBasedOnCaretPosition, splitMessageBasedOnTextSelection} from 'utils/post_utils';
import turndownService from 'utils/turndown';

/**
 * Parses an HTML string and returns the first <table> element found, or null.
 *
 * @param html - Raw HTML string to parse.
 * @returns The first HTMLTableElement in the parsed document, or null if none exists.
 */
export function parseHtmlTable(html: string): HTMLTableElement | null {
    return new DOMParser().parseFromString(html, 'text/html').querySelector('table');
}

/**
 * Extracts an HTML table element from clipboard data, if present.
 *
 * Returns null if the clipboard does not contain 'text/html' or if
 * the HTML does not include a <table> element.
 *
 * @param clipboardData - The DataTransfer object from a paste event.
 * @returns The first HTMLTableElement found in the clipboard HTML, or null.
 */
export function getHtmlTable(clipboardData: DataTransfer): HTMLTableElement | null {
    // Check if clipboard data has html as one of its types
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

/**
 * Checks whether the clipboard data contains HTML with at least one hyperlink (<a> tag).
 *
 * @param clipboardData - The DataTransfer object from a paste event.
 * @returns True if the clipboard contains 'text/html' with an anchor tag, false otherwise.
 */
export function hasHtmlLink(clipboardData: DataTransfer): boolean {
    return Array.from(clipboardData.types).includes('text/html') && (/<a/i).test(clipboardData.getData('text/html'));
}

/**
 * Determines whether a table's CSS class name indicates it is a GitHub code block.
 *
 * GitHub code blocks are rendered as HTML tables with class names containing
 * 'js-', 'blob-', or 'diff-' prefixes.
 *
 * @param tableClassName - The className string of the HTML table element.
 * @returns True if the class name matches a known GitHub code block pattern.
 */
export function isGitHubCodeBlock(tableClassName: string): boolean {
    const result = (/\b(js|blob|diff)-./).test(tableClassName);
    return result;
}

/**
 * Checks whether the plain text content of the clipboard is a URL.
 *
 * @param clipboardData - The DataTransfer object from a paste event.
 * @returns True if the plain text starts with 'http://' or 'https://'.
 */
export function isTextUrl(clipboardData: DataTransfer): boolean {
    const clipboardText = clipboardData.getData('text/plain');
    return clipboardText.startsWith('http://') || clipboardText.startsWith('https://');
}

/**
 * Checks if the clipboard data contains plain text from list of types.
**/
export function hasPlainText(clipboardData: DataTransfer): boolean {
    if (Array.from(clipboardData.types).includes('text/plain')) {
        const clipboardText = clipboardData.getData('text/plain');

        return clipboardText.trim().length > 0;
    }
    return false;
}

/**
 * Returns true if the given HTML table has no header cells (<th>).
 *
 * @param table - The HTMLTableElement to inspect.
 * @returns True if the table contains zero <th> elements.
 */
function isTableWithoutHeaderRow(table: HTMLTableElement): boolean {
    return table.querySelectorAll('th').length === 0;
}

/**
 * Formats the given HTML clipboard data into a Markdown message.
 * @returns {Object} An object containing 'formattedMessage' and 'formattedMarkdown'.
 * @property {string} formattedMessage - The formatted message, including the formatted Markdown.
 * @property {string} formattedMarkdown - The resulting Markdown from the HTML clipboard data.
 */
export function formatMarkdownMessage(clipboardData: DataTransfer, message?: string, caretPosition?: number): {formattedMessage: string; formattedMarkdown: string} {
    const html = clipboardData.getData('text/html');

    let formattedMarkdown = turndownService.turndown(html).trim();

    const table = getHtmlTable(clipboardData);
    if (table && isTableWithoutHeaderRow(table)) {
        const newLineLimiter = '\n';
        formattedMarkdown = `${formattedMarkdown}${newLineLimiter}`;
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

type FormatGithubCodePasteParams = {
    message: string;
    clipboardData: DataTransfer;
    selectionStart: number | null;
    selectionEnd: number | null;
};

/**
 * Format the incoming github code paste into a markdown code block.
 * This function assumes that the clipboardData contains a code block.
 * @returns {Object} An object containing the 'formattedMessage' and 'formattedCodeBlock'.
 * @property {string} formattedMessage - The complete formatted message including the code block.
 * @property {string} formattedCodeBlock - The resulting code block from the clipboard data.
*/
export function formatGithubCodePaste({message, clipboardData, selectionStart, selectionEnd}: FormatGithubCodePasteParams): {formattedMessage: string; formattedCodeBlock: string} {
    const isTextSelected = selectionStart !== selectionEnd;
    const {firstPiece, lastPiece} = isTextSelected ? splitMessageBasedOnTextSelection(selectionStart ?? message.length, selectionEnd ?? message.length, message) : splitMessageBasedOnCaretPosition(selectionStart ?? message.length, message);

    // Add new lines if content exists before or after the cursor.
    const requireStartLF = firstPiece === '' ? '' : '\n';
    const requireEndLF = lastPiece === '' ? '' : '\n';
    const clipboardText = clipboardData.getData('text/plain');
    const formattedCodeBlock = requireStartLF + '```\n' + clipboardText + '\n```' + requireEndLF;
    const formattedMessage = `${firstPiece}${formattedCodeBlock}${lastPiece}`;

    return {formattedMessage, formattedCodeBlock};
}

type FormatMarkdownLinkMessage = {
    message: string;
    clipboardData: DataTransfer;
    selectionStart: number;
    selectionEnd: number;
};

/**
 * Formats the incoming link paste into a markdown link.
 * This function assumes that the clipboardData contains a link.
 * @returns The resulting markdown link from the clipboard data.
 */
export function formatMarkdownLinkMessage({message, clipboardData, selectionStart, selectionEnd}: FormatMarkdownLinkMessage) {
    const selectedText = message.slice(selectionStart, selectionEnd);
    const clipboardUrl = clipboardData.getData('text/plain');

    if (selectedText === DEFAULT_PLACEHOLDER_URL) {
        if (message.length > DEFAULT_PLACEHOLDER_URL.length) {
            const FORMATTED_LINK_URL_PREFIX = '](';
            const FORMATTED_LINK_URL_SUFFIX = ')';

            const textBefore = message.slice(selectionStart - FORMATTED_LINK_URL_PREFIX.length, selectionStart);
            const textAfter = message.slice(selectionEnd, selectionEnd + FORMATTED_LINK_URL_SUFFIX.length);

            // We check "](" "url" ")" to see if user is trying to paste inside of a markdown link
            // and selection is on "url"
            if (textBefore === FORMATTED_LINK_URL_PREFIX && textAfter === FORMATTED_LINK_URL_SUFFIX) {
                return clipboardUrl;
            }
        }
    }

    const markdownLink = `[${selectedText}](${clipboardUrl})`;
    return markdownLink;
}

/**
 * Determines whether a paste event is targeting a known Mattermost textbox element.
 *
 * Checks the event target's ID against expected textbox IDs based on the
 * current location (center channel, RHS comment) and whether the user is
 * in edit mode.
 *
 * @param event - The ClipboardEvent fired by the browser.
 * @param location - The current UI location (e.g. Locations.CENTER, Locations.RHS_COMMENT).
 * @param isInEditMode - Whether the user is currently editing an existing post.
 * @returns True if the event target is a recognised Mattermost input element.
 */
export function isKnownTargetForPaste(event: ClipboardEvent, location: string, isInEditMode?: boolean): boolean {
    let isKnownTarget = false;

    if (isInEditMode) {
        isKnownTarget = (event.target as TextboxElement)?.id === 'edit_textbox';
    } else if (location === Locations.CENTER) {
        isKnownTarget = (event.target as TextboxElement)?.id === 'post_textbox';
    } else if (location === Locations.RHS_COMMENT) {
        isKnownTarget = (event.target as TextboxElement)?.id === 'reply_textbox';
    } else {
        isKnownTarget = (event.target as TextboxElement)?.id === 'post_textbox';
    }

    return isKnownTarget;
}

/**
 * Central paste event handler for Mattermost message inputs.
 *
 * Intercepts paste events when the content would be transformed (HTML tables,
 * HTML hyperlinks, URL-over-selection markdown links). When the user invokes
 * plain-text paste (Ctrl+Shift+V, isNonFormattedPaste=true) and plain text is
 * available, the browser default is suppressed and the raw text/plain value is
 * inserted instead. If no transformation is needed, the event is left for the
 * browser to handle natively.
 *
 * @param event - The ClipboardEvent fired by the browser.
 * @param location - The current UI location (e.g. Locations.CENTER, Locations.RHS_COMMENT).
 * @param message - The current draft message string in the input.
 * @param isNonFormattedPaste - True when the user pressed Ctrl+Shift+V (paste as plain text).
 * @param isInEditMode - Whether the user is editing an existing post.
 * @returns void
 */
export function pasteHandler(
    event: ClipboardEvent,
    location: string,
    message: string,
    isNonFormattedPaste: boolean,
    isInEditMode?: boolean,
): void {
    const isKnownTarget = isKnownTargetForPaste(event, location, isInEditMode);

    // Not our textbox let other handlers deal with it.
    if (!isKnownTarget) {
        return;
    }

    const {clipboardData, target} = event;

    if (!clipboardData || !clipboardData.items || !target) {
        return;
    }

    const {selectionStart, selectionEnd} = target as TextboxElement;

    const hasHTMLLinks = hasHtmlLink(clipboardData);
    const htmlTable = getHtmlTable(clipboardData);
    const hasSelection = !isNil(selectionStart) && !isNil(selectionEnd) && selectionStart < selectionEnd;
    const hasTextUrl = isTextUrl(clipboardData);

    const shouldApplyLinkMarkdown = hasSelection && hasTextUrl;
    const shouldApplyGithubCodeBlock = htmlTable && isGitHubCodeBlock(htmlTable.className);

    // Only intercept when content would be transformed
    const shouldIntercept = htmlTable || hasHTMLLinks || shouldApplyLinkMarkdown;

    if (isNonFormattedPaste && shouldIntercept) {
        const plainText = clipboardData.getData('text/plain');
        if (plainText) {
            event.preventDefault();
            execCommandInsertText(plainText);
        }
        return;
    }

    // Nothing special → let browser handle normally
    if (!shouldIntercept) {
        return;
    }

    event.preventDefault();

    if (shouldApplyLinkMarkdown) {
        const formattedLink = formatMarkdownLinkMessage({
            selectionStart: selectionStart!,
            selectionEnd: selectionEnd!,
            message,
            clipboardData,
        });
        execCommandInsertText(formattedLink);
    } else if (shouldApplyGithubCodeBlock) {
        const {formattedCodeBlock} = formatGithubCodePaste({
            selectionStart,
            selectionEnd,
            message,
            clipboardData,
        });
        execCommandInsertText(formattedCodeBlock);
    } else {
        const {formattedMarkdown} = formatMarkdownMessage(
            clipboardData,
            message,
            selectionStart ?? message.length,
        );
        execCommandInsertText(formattedMarkdown);
    }
}

/**
 * Creates a named File object from a DataTransferItem.
 *
 * If the item has no file name, a timestamped name is generated using
 * the provided prefix and the item's MIME type as the extension.
 * Returns null if the item cannot be converted to a File.
 *
 * @param item - The DataTransferItem to convert.
 * @param fileNamePrefixIfNoName - Prefix used when generating a fallback filename.
 * @returns A File object, or null if the item has no associated file.
 */
export function createFileFromClipboardDataItem(item: DataTransferItem, fileNamePrefixIfNoName: string): File | null {
    const file = item.getAsFile();

    if (!file) {
        return null;
    }

    let ext = '';
    if (file.name && file.name.includes('.')) {
        ext = file.name.slice(file.name.lastIndexOf('.'));
    } else if (item.type.includes('/')) {
        ext = '.' + item.type.slice(item.type.lastIndexOf('/') + 1).toLowerCase();
    }

    let name = '';
    if (file.name) {
        name = file.name;
    } else {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const hour = now.getHours().toString().padStart(2, '0');
        const minute = now.getMinutes().toString().padStart(2, '0');

        name = `${fileNamePrefixIfNoName}${year}-${month}-${date} ${hour}-${minute}${ext}`;
    }

    return new File([file as Blob], name, {type: file.type});
}