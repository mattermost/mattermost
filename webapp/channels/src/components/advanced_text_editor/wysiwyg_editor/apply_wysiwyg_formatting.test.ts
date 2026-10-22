// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import {Markdown} from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

import {applyWysiwygFormatting} from './apply_wysiwyg_formatting';

const createEditor = (markdown: string) => new Editor({
    extensions: [StarterKit, Markdown],
    content: markdown,
    contentType: 'markdown',
});

const typeText = (editor: Editor, text: string) => {
    editor.view.dispatch(editor.state.tr.insertText(text));
};

describe('applyWysiwygFormatting', () => {
    let editor: Editor;

    beforeAll(() => {
        document.elementFromPoint = () => null;
    });

    afterEach(() => {
        editor?.destroy();
    });

    it('turns bold on for the next text in an empty editor', () => {
        editor = createEditor('');
        editor.commands.clearContent();
        editor.commands.setTextSelection(1);

        applyWysiwygFormatting(editor, 'bold');
        typeText(editor, 'hi');

        expect(editor.getHTML()).toBe('<p><strong>hi</strong></p>');
    });

    it('turns bold off at the end of a bold word without touching the word', () => {
        editor = createEditor('**hi**');
        editor.commands.setTextSelection(3);

        applyWysiwygFormatting(editor, 'bold');
        typeText(editor, ' there');

        expect(editor.getHTML()).toBe('<p><strong>hi</strong> there</p>');
    });

    it('turns bold on at the end of a word without bolding the word', () => {
        editor = createEditor('hi');
        editor.commands.setTextSelection(3);

        applyWysiwygFormatting(editor, 'bold');
        typeText(editor, ' there');

        expect(editor.getHTML()).toBe('<p>hi<strong> there</strong></p>');
    });

    it('bolds the whole word when the caret is inside it and keeps the caret in place', () => {
        editor = createEditor('hello world');
        editor.commands.setTextSelection(3);

        applyWysiwygFormatting(editor, 'bold');

        expect(editor.getHTML()).toBe('<p><strong>hello</strong> world</p>');
        expect(editor.state.selection.empty).toBe(true);
        expect(editor.state.selection.from).toBe(3);
    });

    it('bolds the selection when there is one', () => {
        editor = createEditor('hello world');
        editor.commands.setTextSelection({from: 7, to: 12});

        applyWysiwygFormatting(editor, 'bold');

        expect(editor.getHTML()).toBe('<p>hello <strong>world</strong></p>');
    });
});
