// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import {Markdown} from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

import WysiwygImage from './wysiwyg_image';
import {parseMarkdownContent, serializeToMarkdown} from './wysiwyg_markdown';

const createEditor = (hasImageProxy = false) => new Editor({
    extensions: [
        StarterKit.configure({link: false}),
        WysiwygImage.configure({hasImageProxy}),
        Markdown.configure({markedOptions: {gfm: true}}),
    ],
    content: '',
    contentType: 'markdown',
});

const type = (editor: Editor, text: string) => {
    for (const char of text) {
        const {from, to} = editor.state.selection;
        const deflt = () => editor.state.tr.insertText(char, from, to);
        const handled = editor.view.someProp('handleTextInput', (handler) => handler(editor.view, from, to, char, deflt));
        if (!handled) {
            editor.commands.insertContent({type: 'text', text: char});
        }
    }
};

describe('WysiwygImage', () => {
    let editor: Editor;

    afterEach(() => {
        editor?.destroy();
    });

    it('parses markdown image syntax into an image node', () => {
        editor = createEditor();
        editor.commands.setContent('![a kitten](https://example.com/cat.png)', {contentType: 'markdown'});

        const paragraph = editor.getJSON().content?.[0];
        expect(paragraph?.content?.[0]).toEqual({
            type: 'image',
            attrs: expect.objectContaining({
                src: 'https://example.com/cat.png',
                alt: 'a kitten',
            }),
        });
    });

    it('serializes an image node back to markdown', () => {
        editor = createEditor();
        editor.commands.setContent('![a kitten](https://example.com/cat.png)', {contentType: 'markdown'});

        expect(serializeToMarkdown(editor)).toBe('![a kitten](https://example.com/cat.png)');
    });

    it('keeps the title when one is present', () => {
        editor = createEditor();
        editor.commands.setContent('![a kitten](https://example.com/cat.png "Fluffy")', {contentType: 'markdown'});

        expect(serializeToMarkdown(editor)).toBe('![a kitten](https://example.com/cat.png "Fluffy")');
    });

    it('renders the src through the image proxy when it is enabled', () => {
        editor = createEditor(true);
        editor.commands.setContent('![a kitten](https://example.com/cat.png)', {contentType: 'markdown'});

        const src = editor.view.dom.querySelector('img')?.getAttribute('src');
        expect(src).toContain('/image?url=');
        expect(src).toContain(encodeURIComponent('https://example.com/cat.png'));
    });

    it('leaves the src alone when the image proxy is disabled', () => {
        editor = createEditor();
        editor.commands.setContent('![a kitten](https://example.com/cat.png)', {contentType: 'markdown'});

        expect(editor.view.dom.querySelector('img')?.getAttribute('src')).toBe('https://example.com/cat.png');
    });

    it('replaces the typed markdown with the image, leaving no text behind', () => {
        editor = createEditor();
        type(editor, '![a kitten](https://example.com/cat.png)');

        expect(editor.view.dom.querySelector('img')?.getAttribute('src')).toBe('https://example.com/cat.png');
        expect(editor.view.dom.textContent).toBe('');
    });

    it('keeps parentheses inside the typed src', () => {
        editor = createEditor();
        const src = 'https://example.com/filters:no_upscale():max_bytes(150000):format(webp)/cat.jpg';
        type(editor, `![a kitten](${src})`);

        expect(editor.view.dom.querySelector('img')?.getAttribute('src')).toBe(src);
        expect(editor.view.dom.textContent).toBe('');
    });

    describe('pasting markdown', () => {
        const paste = (markdown: string) => {
            const content = parseMarkdownContent(editor, markdown);
            editor.commands.insertContent(content!);
            return editor.view.dom;
        };

        it('inserts an image that is alone in its paragraph', () => {
            editor = createEditor();

            expect(paste('![a kitten](https://example.com/cat.png)').querySelector('img')?.getAttribute('src')).
                toBe('https://example.com/cat.png');
        });

        it('inserts an image that follows another paragraph', () => {
            editor = createEditor();

            expect(paste('hello\n\n![a kitten](https://example.com/cat.png)').querySelectorAll('img.markdown-inline-img')).
                toHaveLength(1);
        });

        it('inserts an image surrounded by text', () => {
            editor = createEditor();
            const dom = paste('before ![a kitten](https://example.com/cat.png) after');

            expect(dom.querySelector('img')?.getAttribute('src')).toBe('https://example.com/cat.png');
            expect(dom.textContent).toBe('before  after');
        });
    });

    it('completes the image when the src is pasted between typed delimiters', () => {
        editor = createEditor();
        type(editor, '![a kitten](');
        editor.commands.insertContent({type: 'text', text: 'https://example.com/cat.png'});
        type(editor, ')');

        expect(editor.view.dom.querySelector('img')?.getAttribute('src')).toBe('https://example.com/cat.png');
        expect(editor.view.dom.textContent).toBe('');
    });
});
