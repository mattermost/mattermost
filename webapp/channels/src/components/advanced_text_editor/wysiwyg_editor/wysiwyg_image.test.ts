// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import {Markdown} from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

import WysiwygImage, {updateWysiwygImageConfig} from './wysiwyg_image';
import type {WysiwygImageOptions} from './wysiwyg_image';
import {parseMarkdownContent, serializeToMarkdown} from './wysiwyg_markdown';

const createEditor = (options: Partial<WysiwygImageOptions> | boolean = false) => {
    const resolvedOptions: Partial<WysiwygImageOptions> = typeof options === 'boolean' ? {hasImageProxy: options} : options;
    return new Editor({
        extensions: [
            StarterKit.configure({link: false}),
            WysiwygImage.configure(resolvedOptions),
            Markdown.configure({markedOptions: {gfm: true}}),
        ],
        content: '',
        contentType: 'markdown',
    });
};

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

const contentImage = (root: ParentNode) => root.querySelector('img.markdown-inline-img');

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

    it('escapes brackets in the alt and quotes in the title', () => {
        editor = createEditor();
        editor.commands.setContent({
            type: 'doc',
            content: [{
                type: 'paragraph',
                content: [{type: 'image', attrs: {src: 'https://example.com/cat.png', alt: 'a [big] cat', title: 'say "hi"'}}],
            }],
        });

        const markdown = serializeToMarkdown(editor);
        expect(markdown).toBe('![a \\[big\\] cat](https://example.com/cat.png "say \\"hi\\"")');

        editor.commands.setContent(markdown, {contentType: 'markdown'});
        expect(contentImage(editor.view.dom)?.getAttribute('alt')).toBe('a [big] cat');
        expect(contentImage(editor.view.dom)?.getAttribute('title')).toBe('say "hi"');
    });

    it('renders the src through the image proxy when it is enabled', () => {
        editor = createEditor(true);
        editor.commands.setContent('![a kitten](https://example.com/cat.png)', {contentType: 'markdown'});

        const src = contentImage(editor.view.dom)?.getAttribute('src');
        expect(src).toContain('/image?url=');
        expect(src).toContain(encodeURIComponent('https://example.com/cat.png'));
    });

    it('leaves the src alone when the image proxy is disabled', () => {
        editor = createEditor();
        editor.commands.setContent('![a kitten](https://example.com/cat.png)', {contentType: 'markdown'});

        expect(contentImage(editor.view.dom)?.getAttribute('src')).toBe('https://example.com/cat.png');
    });

    it('replaces the typed markdown with the image, leaving no text behind', () => {
        editor = createEditor();
        type(editor, '![a kitten](https://example.com/cat.png)');

        expect(contentImage(editor.view.dom)?.getAttribute('src')).toBe('https://example.com/cat.png');
        expect(editor.view.dom.textContent).toBe('');
    });

    it('keeps parentheses inside the typed src', () => {
        editor = createEditor();
        const src = 'https://example.com/filters:no_upscale():max_bytes(150000):format(webp)/cat.jpg';
        type(editor, `![a kitten](${src})`);

        expect(contentImage(editor.view.dom)?.getAttribute('src')).toBe(src);
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

            expect(contentImage(paste('![a kitten](https://example.com/cat.png)'))?.getAttribute('src')).
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

            expect(contentImage(dom)?.getAttribute('src')).toBe('https://example.com/cat.png');
            expect(dom.textContent).toBe('before  after');
        });
    });

    it('completes the image when the src is pasted between typed delimiters', () => {
        editor = createEditor();
        type(editor, '![a kitten](');
        editor.commands.insertContent({type: 'text', text: 'https://example.com/cat.png'});
        type(editor, ')');

        expect(contentImage(editor.view.dom)?.getAttribute('src')).toBe('https://example.com/cat.png');
        expect(editor.view.dom.textContent).toBe('');
    });

    describe('blockExternalImages', () => {
        it('renders external image as a non-link span with data-blocked-image and round-trips markdown', () => {
            editor = createEditor({
                blockExternalImages: true,
                siteURL: 'https://chat.example.com',
            });
            editor.commands.setContent('![a kitten](https://external.example.com/cat.png)', {contentType: 'markdown'});

            expect(contentImage(editor.view.dom)).toBeNull();
            const span = editor.view.dom.querySelector('span[data-blocked-image="true"]');
            expect(span).not.toBeNull();
            expect(span?.textContent).toBe('a kitten');
            expect(editor.view.dom.querySelector('a')).toBeNull();
            expect(serializeToMarkdown(editor)).toBe('![a kitten](https://external.example.com/cat.png)');
        });

        it('falls back to unwrapped URL when alt is empty', () => {
            editor = createEditor({
                blockExternalImages: true,
                siteURL: 'https://chat.example.com',
            });
            editor.commands.setContent('![](https://chat.example.com/api/v4/image?url=https%3A%2F%2Fexternal.example.com%2Fcat.png)', {contentType: 'markdown'});

            const span = editor.view.dom.querySelector('span[data-blocked-image="true"]');
            expect(span?.textContent).toBe('https://external.example.com/cat.png');
        });

        it('renders internal image normally when blockExternalImages is true', () => {
            editor = createEditor({
                blockExternalImages: true,
                siteURL: 'https://chat.example.com',
            });
            editor.commands.setContent('![local](https://chat.example.com/api/v4/files/1/preview)', {contentType: 'markdown'});

            expect(contentImage(editor.view.dom)?.getAttribute('src')).toBe('https://chat.example.com/api/v4/files/1/preview');
            expect(editor.view.dom.querySelector('span[data-blocked-image]')).toBeNull();
        });

        it('updates open editor nodes in place when live config changes', () => {
            editor = createEditor({
                hasImageProxy: false,
                blockExternalImages: false,
                siteURL: 'https://chat.example.com',
            });
            editor.commands.setContent('![a kitten](https://external.example.com/cat.png)', {contentType: 'markdown'});

            expect(contentImage(editor.view.dom)).not.toBeNull();
            expect(editor.view.dom.querySelector('span[data-blocked-image]')).toBeNull();

            updateWysiwygImageConfig(editor, {
                hasImageProxy: false,
                blockExternalImages: true,
                siteURL: 'https://chat.example.com',
            });

            expect(contentImage(editor.view.dom)).toBeNull();
            expect(editor.view.dom.querySelector('span[data-blocked-image="true"]')?.textContent).toBe('a kitten');

            updateWysiwygImageConfig(editor, {
                hasImageProxy: false,
                blockExternalImages: false,
                siteURL: 'https://chat.example.com',
            });

            expect(contentImage(editor.view.dom)?.getAttribute('src')).toBe('https://external.example.com/cat.png');
            expect(editor.view.dom.querySelector('span[data-blocked-image]')).toBeNull();
        });

        it('serializes blocked external images without img tags in getHTML and round-trips HTML', () => {
            editor = createEditor({
                hasImageProxy: true,
                blockExternalImages: true,
                siteURL: 'https://chat.example.com',
            });
            editor.commands.setContent('![a kitten](https://external.example.com/cat.png "Fluffy")', {contentType: 'markdown'});

            const html = editor.getHTML();
            expect(html).not.toContain('<img');
            expect(html).toContain('data-blocked-image="true"');

            editor.commands.setContent(html);
            expect(serializeToMarkdown(editor)).toBe('![a kitten](https://external.example.com/cat.png "Fluffy")');
        });
    });
});
