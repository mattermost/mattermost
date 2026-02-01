// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import Image from '@tiptap/extension-image';
import {Mention} from '@tiptap/extension-mention';
import {Table} from '@tiptap/extension-table';
import {TableCell} from '@tiptap/extension-table-cell';
import {TableHeader} from '@tiptap/extension-table-header';
import {TableRow} from '@tiptap/extension-table-row';
import StarterKit from '@tiptap/starter-kit';

import {looksLikeMarkdown, PasteMarkdownExtension} from './paste_markdown_extension';

describe('looksLikeMarkdown', () => {
    describe('strong signals (single match = true)', () => {
        it('detects fenced code blocks', () => {
            const text = '```javascript\nconst x = 1;\n```';
            expect(looksLikeMarkdown(text)).toBe(true);
        });

        it('detects tables', () => {
            const text = '| Header |\n|--------|\n| Cell |';
            expect(looksLikeMarkdown(text)).toBe(true);
        });

        it('detects images', () => {
            const text = '![alt text](https://example.com/image.png)';
            expect(looksLikeMarkdown(text)).toBe(true);
        });
    });

    describe('medium signals (need 2+)', () => {
        it('converts headers + links (2 signals)', () => {
            const text = '# Header\n\n[link](url)';
            expect(looksLikeMarkdown(text)).toBe(true);
        });

        it('converts bold + list (2 signals)', () => {
            const text = '**bold text**\n- list item';
            expect(looksLikeMarkdown(text)).toBe(true);
        });

        it('does NOT convert bold alone (1 signal)', () => {
            const text = '**bold text**';
            expect(looksLikeMarkdown(text)).toBe(false);
        });

        it('does NOT convert single header (1 signal)', () => {
            const text = '# Just a header';
            expect(looksLikeMarkdown(text)).toBe(false);
        });
    });

    describe('skip conditions', () => {
        it('skips text shorter than 5 chars', () => {
            expect(looksLikeMarkdown('```')).toBe(false);
        });

        it('skips text starting with <', () => {
            const text = '<div>Some HTML content</div>';
            expect(looksLikeMarkdown(text)).toBe(false);
        });

        it('skips plain text', () => {
            const text = 'Hello world, this is just plain text without any markdown.';
            expect(looksLikeMarkdown(text)).toBe(false);
        });
    });
});

describe('PasteMarkdownExtension', () => {
    let editor: Editor;
    let channelMentionExtension: ReturnType<typeof Mention.extend>;

    beforeEach(() => {
        // Create channel mention extension for testing
        channelMentionExtension = Mention.extend({
            name: 'channelMention',
        });

        editor = new Editor({
            extensions: [
                StarterKit,
                Image,
                Table.configure({resizable: false}),
                TableRow,
                TableHeader,
                TableCell,
                Mention.configure({
                    HTMLAttributes: {class: 'mention'},
                }),
                channelMentionExtension.configure({
                    HTMLAttributes: {class: 'channel-mention'},
                }),
                PasteMarkdownExtension,
            ],
            content: '<p></p>',
        });
    });

    afterEach(() => {
        editor.destroy();
    });

    // Helper to simulate paste event
    function simulatePaste(text: string, hasHtml = false, hasFiles = false): boolean {
        const clipboardData = {
            types: hasHtml ? ['text/plain', 'text/html'] : ['text/plain'],
            files: hasFiles ? [{name: 'file.txt'}] : [],
            getData: (type: string) => (type === 'text/plain' ? text : ''),
        } as unknown as DataTransfer;

        const event = {
            clipboardData,
            preventDefault: jest.fn(),
        } as unknown as ClipboardEvent;

        // Get the plugin and call handlePaste directly
        const plugins = editor.state.plugins;
        const pastePlugin = plugins.find((p) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const key = (p as any).key;
            return key && String(key).includes('pasteMarkdown');
        });

        if (!pastePlugin) {
            return false;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const props = (pastePlugin as any).props;
        if (props?.handlePaste) {
            return props.handlePaste(editor.view, event);
        }

        return false;
    }

    describe('Phase 1: Core conversion', () => {
        it('converts fenced code blocks', () => {
            const handled = simulatePaste('```javascript\nconst x = 1;\n```');
            expect(handled).toBe(true);

            const json = editor.getJSON();
            const codeBlock = json.content?.find((n) => n.type === 'codeBlock');
            expect(codeBlock).toBeDefined();
        });

        it('converts tables', () => {
            const handled = simulatePaste('| A | B |\n|---|---|\n| 1 | 2 |');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).toMatch(/<table/);
            expect(html).toContain('<th');
            expect(html).toContain('<td');
        });

        it('converts images', () => {
            const handled = simulatePaste('![alt](https://example.com/img.png)');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).toContain('<img');
            expect(html).toContain('src="https://example.com/img.png"');
        });

        it('skips HTML pastes', () => {
            const handled = simulatePaste('```code```', true);
            expect(handled).toBe(false);
        });

        it('skips file pastes', () => {
            const handled = simulatePaste('```code```', false, true);
            expect(handled).toBe(false);
        });

        it('skips plain text without markdown', () => {
            const handled = simulatePaste('Hello world, just plain text.');
            expect(handled).toBe(false);
        });

        it('skips when cursor in code block', () => {
            // Set content to a code block and position cursor inside
            editor.commands.setContent({
                type: 'doc',
                content: [{
                    type: 'codeBlock',
                    attrs: {language: 'javascript'},
                    content: [{type: 'text', text: 'existing code'}],
                }],
            });
            editor.commands.focus('start');

            const handled = simulatePaste('```new code```');
            expect(handled).toBe(false);
        });

        /* eslint-disable no-script-url */
        it('blocks javascript: URLs', () => {
            const handled = simulatePaste('![img](https://example.com/x.png)\n[click](javascript:alert(1))');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).toContain('href="#blocked"');
            expect(html).not.toContain('javascript:');
        });
        /* eslint-enable no-script-url */

        it('blocks data: URLs', () => {
            const handled = simulatePaste('![img](https://example.com/x.png)\n[click](data:text/html,<script>)');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).toContain('href="#blocked"');
            expect(html).not.toContain('data:text');
        });

        it('respects size limit (64KB)', () => {
            const largeText = '```\n' + 'x'.repeat(65 * 1024) + '\n```';
            const handled = simulatePaste(largeText);
            expect(handled).toBe(false);
        });
    });

    describe('Phase 2: Medium signals', () => {
        it('converts headers + links (2 medium signals)', () => {
            const handled = simulatePaste('# Title\n\n[link](https://example.com)');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).toContain('<h1>');
            expect(html).toContain('<a');
        });

        it('does NOT convert bold alone (1 signal)', () => {
            const handled = simulatePaste('**just bold**');
            expect(handled).toBe(false);
        });

        it('converts unordered list + blockquote (2 signals)', () => {
            const handled = simulatePaste('- item 1\n- item 2\n\n> quoted text');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).toContain('<ul>');
            expect(html).toContain('<blockquote>');
        });
    });

    describe('Phase 2: Mentions', () => {
        it('converts @john to mention node', () => {
            const handled = simulatePaste('![img](https://x.com/a.png)\nHello @john!');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).toContain('data-type="mention"');
            expect(html).toContain('data-id="john"');
            expect(html).toContain('@john');
        });

        it('converts ~channel to channelMention node', () => {
            const handled = simulatePaste('![img](https://x.com/a.png)\nCheck ~town-square for updates');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).toContain('data-type="channelMention"');
            expect(html).toContain('data-id="town-square"');
        });

        it('handles multiple mentions', () => {
            const handled = simulatePaste('![img](https://x.com/a.png)\nHey @alice and @bob, check ~general');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).toContain('data-id="alice"');
            expect(html).toContain('data-id="bob"');
            expect(html).toContain('data-id="general"');
        });

        it('excludes email@company.com from mentions', () => {
            const handled = simulatePaste('![img](https://x.com/a.png)\nContact email@company.com');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).not.toContain('data-type="mention"');
            expect(html).toContain('email@company.com');
        });

        it('ignores uppercase @JOHN (server uses lowercase)', () => {
            const handled = simulatePaste('![img](https://x.com/a.png)\nHello @JOHN');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).not.toContain('data-id="JOHN"');
            expect(html).toContain('@JOHN');
        });

        it('handles mentions with dots and underscores', () => {
            const handled = simulatePaste('![img](https://x.com/a.png)\nHey @john.doe and @jane_smith');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).toContain('data-id="john.doe"');
            expect(html).toContain('data-id="jane_smith"');
        });

        it('does NOT convert @mentions inside code blocks', () => {
            const handled = simulatePaste('```bash\nnpm install -g @openai/codex\n```');
            expect(handled).toBe(true);

            const html = editor.getHTML();

            // Should have a code block
            expect(html).toContain('<code');

            // Should NOT have any mention nodes
            expect(html).not.toContain('data-type="mention"');

            // The @openai should be preserved as plain text inside code
            expect(html).toContain('@openai');
        });

        it('does NOT convert @mentions inside inline code', () => {
            const handled = simulatePaste('```bash\n# Install: npm install -g @anthropic/gemini-cli\n```');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).not.toContain('data-type="mention"');
            expect(html).toContain('@anthropic');
        });

        it('converts @mentions outside code blocks but not inside', () => {
            const handled = simulatePaste('Hey @john, run this:\n```bash\nnpm install @openai/codex\n```');
            expect(handled).toBe(true);

            const html = editor.getHTML();

            // @john outside code should be a mention
            expect(html).toContain('data-id="john"');

            // @openai inside code should NOT be a mention
            const mentionCount = (html.match(/data-type="mention"/g) || []).length;
            expect(mentionCount).toBe(1);
        });

        it('does NOT convert @mentions inside single-backtick inline code', () => {
            const handled = simulatePaste('![img](https://x.com/a.png)\nRun `npm install @openai/codex` to install');
            expect(handled).toBe(true);

            const html = editor.getHTML();

            // Should have inline code
            expect(html).toContain('<code');

            // Should NOT have any mention nodes
            expect(html).not.toContain('data-type="mention"');

            // The @openai should be preserved as plain text
            expect(html).toContain('@openai');
        });
    });
});
