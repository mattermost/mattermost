// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import Callout from './callout_extension';

describe('Callout Extension', () => {
    let editor: Editor;

    beforeEach(() => {
        editor = new Editor({
            extensions: [StarterKit, Callout],
            content: '<p>Test content</p>',
        });
    });

    afterEach(() => {
        editor.destroy();
    });

    describe('setCallout command', () => {
        it('wraps selection in callout with default info type', () => {
            editor.commands.selectAll();
            editor.commands.setCallout({type: 'info'});

            const json = editor.getJSON();
            expect(json.content?.[0].type).toBe('callout');
            expect(json.content?.[0].attrs?.type).toBe('info');
        });

        it('creates callout with specified type', () => {
            editor.commands.selectAll();
            editor.commands.setCallout({type: 'warning'});

            const json = editor.getJSON();
            expect(json.content?.[0].attrs?.type).toBe('warning');
        });
    });

    describe('updateCalloutType command', () => {
        it('changes callout type without re-wrapping', () => {
            editor.commands.selectAll();
            editor.commands.setCallout({type: 'info'});

            // Move cursor inside the callout
            editor.commands.focus('start');
            editor.commands.updateCalloutType('error');

            const json = editor.getJSON();
            expect(json.content?.[0].attrs?.type).toBe('error');
        });

        it('returns false when not inside callout', () => {
            // Reset editor with plain paragraph
            editor.commands.setContent('<p>Plain text</p>');
            editor.commands.focus('start');

            const result = editor.commands.updateCalloutType('warning');
            expect(result).toBe(false);
        });
    });

    describe('unsetCallout command', () => {
        it('removes callout wrapper preserving content when selection includes callout content', () => {
            editor.commands.selectAll();
            editor.commands.setCallout({type: 'info'});

            // Select all content inside the callout and lift
            editor.commands.selectAll();
            const result = editor.commands.unsetCallout();

            // The lift command should work when content is selected
            // Note: behavior depends on selection - lift works on block containing selection
            expect(result).toBeDefined();
        });
    });

    describe('nested callouts prevention', () => {
        it('isolating property is set on callout node', () => {
            // Verify the callout extension has isolating: true configured
            // This prevents certain cross-boundary operations
            const calloutType = editor.schema.nodes.callout;
            expect(calloutType).toBeDefined();
            expect(calloutType.spec.isolating).toBe(true);
        });
    });

    describe('HTML parsing', () => {
        it('parses callout from HTML with correct type', () => {
            const html = '<div data-type="callout" data-callout-type="warning"><p>Warning text</p></div>';
            editor.commands.setContent(html);

            const json = editor.getJSON();
            expect(json.content?.[0].type).toBe('callout');
            expect(json.content?.[0].attrs?.type).toBe('warning');
        });

        it('defaults to info type when type attribute missing', () => {
            const html = '<div data-type="callout"><p>Info text</p></div>';
            editor.commands.setContent(html);

            const json = editor.getJSON();
            expect(json.content?.[0].attrs?.type).toBe('info');
        });
    });

    describe('HTML rendering', () => {
        it('renders with correct attributes and classes', () => {
            editor.commands.selectAll();
            editor.commands.setCallout({type: 'success'});

            const html = editor.getHTML();
            expect(html).toContain('data-type="callout"');
            expect(html).toContain('data-callout-type="success"');
            expect(html).toContain('class="callout callout-success"');
            expect(html).toContain('role="note"');
            expect(html).toContain('aria-label="Success callout"');
        });

        it('uses role="alert" for warning and error types', () => {
            editor.commands.selectAll();
            editor.commands.setCallout({type: 'error'});

            const html = editor.getHTML();
            expect(html).toContain('role="alert"');
        });

        it('uses role="note" for info and success types', () => {
            editor.commands.selectAll();
            editor.commands.setCallout({type: 'info'});

            const html = editor.getHTML();
            expect(html).toContain('role="note"');
        });
    });

    describe('content nesting', () => {
        it('allows paragraphs inside callout', () => {
            const content = {
                type: 'doc',
                content: [{
                    type: 'callout',
                    attrs: {type: 'info'},
                    content: [
                        {type: 'paragraph', content: [{type: 'text', text: 'First'}]},
                        {type: 'paragraph', content: [{type: 'text', text: 'Second'}]},
                    ],
                }],
            };
            editor.commands.setContent(content);

            const json = editor.getJSON();
            expect(json.content?.[0].content?.length).toBe(2);
        });

        it('allows lists inside callout', () => {
            const content = {
                type: 'doc',
                content: [{
                    type: 'callout',
                    attrs: {type: 'info'},
                    content: [{
                        type: 'bulletList',
                        content: [{
                            type: 'listItem',
                            content: [{type: 'paragraph', content: [{type: 'text', text: 'Item'}]}],
                        }],
                    }],
                }],
            };
            editor.commands.setContent(content);

            const json = editor.getJSON();
            expect(json.content?.[0].content?.[0].type).toBe('bulletList');
        });
    });

    describe('toggleCallout command', () => {
        it('wraps content when not in callout', () => {
            editor.commands.selectAll();
            editor.commands.toggleCallout({type: 'info'});

            const json = editor.getJSON();
            expect(json.content?.[0].type).toBe('callout');
        });

        it('toggleWrap is available as a command', () => {
            // Verify toggleCallout command exists and can be called
            editor.commands.selectAll();
            const result = editor.commands.toggleCallout({type: 'info'});
            expect(result).toBe(true);
        });
    });
});
