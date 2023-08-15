// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * This is a wrapper around document.execCommand('insertText', false, text) to insert test into the focused element.
 * @param text The text to insert.
 */
export function execCommandInsertText(text: string) {
    document.execCommand('insertText', false, text);
}
