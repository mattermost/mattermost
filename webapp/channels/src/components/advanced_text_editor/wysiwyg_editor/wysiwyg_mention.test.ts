// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import {Markdown} from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';

import {serializeToMarkdown} from './wysiwyg_markdown';
import WysiwygMention, {parseMentionTerm} from './wysiwyg_mention';

const createEditor = (markdown: string) => new Editor({
    extensions: [
        StarterKit.configure({link: false}),
        WysiwygMention,
        Markdown.configure({markedOptions: {gfm: true}}),
    ],
    content: markdown,
    contentType: 'markdown',
});

const mentionsIn = (editor: Editor) => {
    const mentions: Array<Record<string, unknown>> = [];
    editor.state.doc.descendants((node) => {
        if (node.type.name === 'mention') {
            mentions.push(node.attrs);
        }
    });
    return mentions;
};

describe('WysiwygMention', () => {
    let editor: Editor;

    afterEach(() => {
        editor?.destroy();
    });

    it('parses user and channel mentions from markdown', () => {
        editor = createEditor('hi @user1 and @remote:org, see ~town-square.');

        expect(mentionsIn(editor)).toEqual([
            {char: '@', name: 'user1'},
            {char: '@', name: 'remote:org'},
            {char: '~', name: 'town-square'},
        ]);
    });

    it('serializes mentions back to the original markdown', () => {
        const markdown = 'hi @user1 and ~town-square.';
        editor = createEditor(markdown);

        expect(serializeToMarkdown(editor)).toBe(markdown);
    });

    it('exposes mentions as plain text for autocomplete', () => {
        editor = createEditor('@user1 ~town-square');

        expect(editor.getText()).toBe('@user1 ~town-square');
    });

    it.each([
        ['an email address', 'mail me@example.com'],
        ['strikethrough', '~~gone~~'],
        ['an inline code span', '`@user1 ~town-square`'],
        ['a mid-word tilde', 'about~5 minutes'],
    ])('leaves %s alone', (_, markdown) => {
        editor = createEditor(markdown);

        expect(mentionsIn(editor)).toEqual([]);
        expect(serializeToMarkdown(editor)).toBe(markdown);
    });
});

describe('parseMentionTerm', () => {
    it.each([
        ['@sysadmin', {char: '@', name: 'sysadmin'}],
        ['@remote:org', {char: '@', name: 'remote:org'}],
        ['~town-square', {char: '~', name: 'town-square'}],
        [':smile:', undefined],
        ['/away', undefined],
        ['@two words', undefined],
    ])('parses %s', (term, expected) => {
        expect(parseMentionTerm(term)).toEqual(expected);
    });
});
