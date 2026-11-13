// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/core';

import type {MarkdownMode} from 'utils/markdown/apply_markdown';

const isWordChar = (/\S/);

export const applyWysiwygFormatting = (editor: Editor, mode: MarkdownMode) => {
    const isInlineMark = mode === 'bold' || mode === 'italic' || mode === 'strike';
    let caret: number | undefined;
    if (isInlineMark && editor.state.selection.empty) {
        const $from = editor.state.selection.$from;
        const text = $from.parent.textBetween(0, $from.parent.content.size, undefined, ' ');
        const offset = $from.parentOffset;
        if (isWordChar.test(text[offset - 1] ?? '') && isWordChar.test(text[offset] ?? '')) {
            let start = offset;
            while (start > 0 && isWordChar.test(text[start - 1])) {
                start--;
            }
            let end = offset;
            while (end < text.length && isWordChar.test(text[end])) {
                end++;
            }
            const parentStart = $from.pos - offset;
            caret = $from.pos;
            editor.chain().focus().setTextSelection({from: parentStart + start, to: parentStart + end}).run();
        }
    }

    const chain = editor.chain().focus();
    switch (mode) {
    case 'bold':
        chain.toggleBold().run();
        break;
    case 'italic':
        chain.toggleItalic().run();
        break;
    case 'strike':
        chain.toggleStrike().run();
        break;
    case 'heading':
        chain.toggleHeading({level: 3}).run();
        break;
    case 'code':
        chain.toggleCodeBlock().run();
        break;
    case 'quote':
        chain.toggleBlockquote().run();
        break;
    case 'ul':
        chain.toggleBulletList().run();
        break;
    case 'ol':
        chain.toggleOrderedList().run();
        break;
    }

    if (caret !== undefined) {
        editor.commands.setTextSelection(caret);
    }
};
