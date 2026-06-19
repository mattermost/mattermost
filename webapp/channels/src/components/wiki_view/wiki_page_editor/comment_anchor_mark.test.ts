// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';

import CommentAnchor, {ANCHOR_ID_PREFIX} from './comment_anchor_mark';

describe('CommentAnchor mark', () => {
    describe('ANCHOR_ID_PREFIX constant', () => {
        it('should be defined correctly', () => {
            expect(ANCHOR_ID_PREFIX).toBe('ic-');
        });
    });

    describe('mark configuration', () => {
        let editor: Editor;

        beforeEach(() => {
            editor = new Editor({
                extensions: [Document, Paragraph, Text, CommentAnchor],
                content: '<p>Hello world</p>',
            });
        });

        afterEach(() => {
            editor.destroy();
        });

        it('should be registered with name "commentAnchor"', () => {
            const mark = editor.schema.marks.commentAnchor;
            expect(mark).toBeDefined();
            expect(mark.name).toBe('commentAnchor');
        });

        it('should have inclusive: false to prevent growth when typing at edges', () => {
            const mark = editor.schema.marks.commentAnchor;
            expect(mark.spec.inclusive).toBe(false);
        });

        it('should have priority: 1000 to render outermost', () => {
            const mark = editor.extensionManager.extensions.find((e) => e.name === 'commentAnchor');
            expect(mark?.options?.priority ?? mark?.config?.priority ?? 1000).toBe(1000);
        });

        it('should exclude itself (only one anchor per position)', () => {
            const mark = editor.schema.marks.commentAnchor;
            expect(mark.spec.excludes).toBe('commentAnchor');
        });
    });

    describe('attribute parsing and rendering', () => {
        let editor: Editor;

        beforeEach(() => {
            editor = new Editor({
                extensions: [Document, Paragraph, Text, CommentAnchor],
                content: '',
            });
        });

        afterEach(() => {
            editor.destroy();
        });

        it('should parse id attribute with ic- prefix into anchorId', () => {
            editor.commands.setContent('<p><span id="ic-abc123" class="comment-anchor">test</span></p>');

            const {doc} = editor.state;
            let foundMark = false;
            doc.descendants((node) => {
                node.marks.forEach((mark) => {
                    if (mark.type.name === 'commentAnchor') {
                        expect(mark.attrs.anchorId).toBe('abc123');
                        foundMark = true;
                    }
                });
            });

            expect(foundMark).toBe(true);
        });

        it('should NOT parse span without ic- prefix', () => {
            editor.commands.setContent('<p><span id="other-123">test</span></p>');

            const {doc} = editor.state;
            let foundMark = false;
            doc.descendants((node) => {
                node.marks.forEach((mark) => {
                    if (mark.type.name === 'commentAnchor') {
                        foundMark = true;
                    }
                });
            });

            expect(foundMark).toBe(false);
        });

        it('should render anchorId as id with ic- prefix', () => {
            editor.commands.setContent('<p>test text</p>');
            editor.commands.selectAll();

            // Apply the mark with an anchorId
            editor.commands.setMark('commentAnchor', {anchorId: 'xyz789'});

            const html = editor.getHTML();
            expect(html).toContain('id="ic-xyz789"');
            expect(html).toContain('class="comment-anchor"');
        });

        it('should not render id attribute when anchorId is null', () => {
            editor.commands.setContent('<p>test text</p>');
            editor.commands.selectAll();

            // Apply the mark without anchorId
            editor.commands.setMark('commentAnchor', {anchorId: null});

            const html = editor.getHTML();

            // Mark should still be applied but without id
            expect(html).toContain('class="comment-anchor"');
            expect(html).not.toContain('id="ic-null"');
            expect(html).not.toContain('id="null"');
        });

        it('should handle UUID-style anchor IDs', () => {
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            editor.commands.setContent(`<p><span id="ic-${uuid}" class="comment-anchor">test</span></p>`);

            const {doc} = editor.state;
            let anchorId = '';
            doc.descendants((node) => {
                node.marks.forEach((mark) => {
                    if (mark.type.name === 'commentAnchor') {
                        anchorId = mark.attrs.anchorId;
                    }
                });
            });

            expect(anchorId).toBe(uuid);
        });
    });

    describe('mark behavior', () => {
        let editor: Editor;

        beforeEach(() => {
            editor = new Editor({
                extensions: [Document, Paragraph, Text, CommentAnchor],
                content: '<p>test text</p>',
            });
        });

        afterEach(() => {
            editor.destroy();
        });

        it('should preserve mark when editing text in middle of marked range', () => {
            editor.commands.setContent('<p><span id="ic-test123" class="comment-anchor">Hello world</span></p>');

            // Position cursor inside the marked text
            editor.commands.setTextSelection({from: 8, to: 8});

            // Type additional text
            editor.commands.insertContent('X');

            const html = editor.getHTML();
            expect(html).toContain('ic-test123');
        });

        it('should allow removing mark with unsetMark', () => {
            editor.commands.setContent('<p><span id="ic-abc" class="comment-anchor">marked text</span></p>');
            editor.commands.selectAll();
            editor.commands.unsetMark('commentAnchor');

            const html = editor.getHTML();
            expect(html).not.toContain('comment-anchor');
            expect(html).not.toContain('ic-abc');
        });
    });
});
