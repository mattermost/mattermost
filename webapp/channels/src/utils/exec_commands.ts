// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * This is a wrapper around document.execCommand('insertText', false, text) to insert test into the focused element.
 * @param text The text to insert.
 */
export function execCommandInsertText(text: string) {
    document.execCommand('insertText', false, text);
}

/**
 * This is a wrapper around document.execCommand('insertText', false, text) to insert test into the focused element.
 * It should be used instead of execCommandInsertText when writing code with unit tests because document.execCommand
 * is not supported by JSDOM and Jest can't mock anything that acts on document.activeElement.
 */
export function focusAndInsertText(element: HTMLElement, text: string) {
    element.focus();
    document.execCommand('insertText', false, text);
}

/**
 * Replaces the contents of a textbox with the given value while preserving the browser's undo/redo history. Only the
 * range that differs between the current and new values is replaced so that a single undo step is recorded.
 * @returns true if the textbox now contains the given value, false if the caller needs to fall back to setting it.
 */
export function replaceTextboxValue(textbox: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
    const current = textbox.value;
    if (current === value) {
        return true;
    }

    let start = 0;
    const maxPrefix = Math.min(current.length, value.length);
    while (start < maxPrefix && current[start] === value[start]) {
        start++;
    }

    let end = 0;
    const maxSuffix = maxPrefix - start;
    while (end < maxSuffix && current[current.length - 1 - end] === value[value.length - 1 - end]) {
        end++;
    }

    const replacement = value.slice(start, value.length - end);

    textbox.focus();
    textbox.setSelectionRange(start, current.length - end);
    if (replacement) {
        document.execCommand('insertText', false, replacement);
    } else {
        document.execCommand('delete');
    }

    return textbox.value === value;
}
