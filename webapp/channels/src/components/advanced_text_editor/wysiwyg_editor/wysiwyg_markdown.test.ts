// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {JSONContent} from '@tiptap/core';
import {Editor} from '@tiptap/core';
import Link from '@tiptap/extension-link';
import {Markdown} from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

import {isRedundantLinkText, serializeToMarkdown, stripRedundantLinkMarks} from './wysiwyg_markdown';

const paragraph = (...content: JSONContent[]): JSONContent => ({
    type: 'doc',
    content: [{type: 'paragraph', content}],
});

const linkText = (text: string, href: string): JSONContent => ({
    type: 'text',
    text,
    marks: [{type: 'link', attrs: {href}}],
});

describe('isRedundantLinkText', () => {
    it.each([
        ['https://mmtest.atlassian.net/', 'https://mmtest.atlassian.net/'],
        ['www.example.com', 'http://www.example.com'],
        ['example.com', 'https://example.com'],
        ['user@example.com', 'mailto:user@example.com'],
    ])('treats %s -> %s as redundant', (text, href) => {
        expect(isRedundantLinkText(text, href)).toBe(true);
    });

    it.each([
        ['Mattermost', 'https://mattermost.com'],
        ['https://example.com', 'https://example.com/other'],
        ['', 'https://example.com'],
        ['https://example.com', ''],
    ])('keeps %s -> %s', (text, href) => {
        expect(isRedundantLinkText(text, href)).toBe(false);
    });
});

describe('stripRedundantLinkMarks', () => {
    it('drops the mark when the text is the URL', () => {
        const stripped = stripRedundantLinkMarks(paragraph(linkText('https://example.com', 'https://example.com')));

        expect(stripped).toEqual(paragraph({type: 'text', text: 'https://example.com', marks: undefined}));
    });

    it('keeps the mark when the text is a label', () => {
        const doc = paragraph(linkText('Mattermost', 'https://mattermost.com'));

        expect(stripRedundantLinkMarks(doc)).toEqual(doc);
    });

    it('keeps other marks on the same text node', () => {
        const stripped = stripRedundantLinkMarks(paragraph({
            type: 'text',
            text: 'https://example.com',
            marks: [{type: 'bold'}, {type: 'link', attrs: {href: 'https://example.com'}}],
        }));

        expect(stripped).toEqual(paragraph({
            type: 'text',
            text: 'https://example.com',
            marks: [{type: 'bold'}],
        }));
    });

    it('compares the whole run when a link spans several text nodes', () => {
        const href = 'https://example.com/a_b';
        const stripped = stripRedundantLinkMarks(paragraph(
            linkText('https://example.com', href),
            linkText('/a_b', href),
        ));

        expect(stripped).toEqual(paragraph(
            {type: 'text', text: 'https://example.com', marks: undefined},
            {type: 'text', text: '/a_b', marks: undefined},
        ));
    });

    it('recurses into nested content', () => {
        const stripped = stripRedundantLinkMarks({
            type: 'doc',
            content: [{
                type: 'bulletList',
                content: [{
                    type: 'listItem',
                    content: [{
                        type: 'paragraph',
                        content: [linkText('https://example.com', 'https://example.com')],
                    }],
                }],
            }],
        });

        const listItemParagraph = stripped.content?.[0].content?.[0].content?.[0];
        expect(listItemParagraph?.content?.[0].marks).toBeUndefined();
    });
});

describe('serializeToMarkdown', () => {
    let editor: Editor;

    beforeEach(() => {
        editor = new Editor({
            extensions: [
                StarterKit.configure({link: false}),
                Link.configure({openOnClick: false, autolink: true, linkOnPaste: true}),
                Markdown.configure({markedOptions: {gfm: true}}),
            ],
            content: '',
            contentType: 'markdown',
        });
    });

    afterEach(() => {
        editor.destroy();
    });

    it('serializes an autolinked URL as a bare URL', () => {
        editor.commands.setContent(paragraph(linkText('https://mmtest.atlassian.net/', 'https://mmtest.atlassian.net/')));

        expect(serializeToMarkdown(editor)).toBe('https://mmtest.atlassian.net/');
    });

    it('keeps a slash command intact', () => {
        editor.commands.setContent(paragraph(
            {type: 'text', text: '/jira instance install cloud-oauth '},
            linkText('https://mmtest.atlassian.net/', 'https://mmtest.atlassian.net/'),
        ));

        expect(serializeToMarkdown(editor)).toBe('/jira instance install cloud-oauth https://mmtest.atlassian.net/');
    });

    it('still serializes labelled links as markdown', () => {
        editor.commands.setContent(paragraph(linkText('Mattermost', 'https://mattermost.com')));

        expect(serializeToMarkdown(editor)).toBe('[Mattermost](https://mattermost.com)');
    });
});
