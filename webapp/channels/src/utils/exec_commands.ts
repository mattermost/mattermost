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
