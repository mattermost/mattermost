// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import Image from '@tiptap/extension-image';
import {Mention} from '@tiptap/extension-mention';
import {Table} from '@tiptap/extension-table';
import {TableCell} from '@tiptap/extension-table-cell';
import {TableHeader} from '@tiptap/extension-table-header';
import {TableRow} from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
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

        it('detects task lists with checked items', () => {
            const text = '- [x] Completed task\n- [ ] Pending task';
            expect(looksLikeMarkdown(text)).toBe(true);
        });

        it('detects task lists with unchecked items only', () => {
            const text = '- [ ] First task\n- [ ] Second task';
            expect(looksLikeMarkdown(text)).toBe(true);
        });

        it('detects task list with single item', () => {
            const text = '- [x] Single completed task';
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
                TaskList,
                TaskItem.configure({nested: true}),
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

    describe('skip conditions', () => {
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

        it('respects size limit (64KB)', () => {
            const largeText = '```\n' + 'x'.repeat(65 * 1024) + '\n```';
            const handled = simulatePaste(largeText);
            expect(handled).toBe(false);
        });
    });

    describe('security', () => {
        /* eslint-disable no-script-url */
        it('removes links with javascript: URLs via sanitize option', () => {
            // marked's sanitize option completely removes links with dangerous protocols
            const handled = simulatePaste('![img](https://example.com/x.png)\n[click](javascript:alert(1))');
            expect(handled).toBe(true);

            const html = editor.getHTML();

            // The link is completely removed by marked's sanitize option
            expect(html).not.toContain('javascript:');
            expect(html).not.toContain('click'); // Link text is also removed
            // The safe image is preserved
            expect(html).toContain('example.com/x.png');
        });

        it('blocks javascript: URLs in image src', () => {
            // Images with dangerous URLs are caught by our regex sanitization
            const handled = simulatePaste('# Header\n![xss](javascript:alert(1))');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).not.toContain('javascript:');
        });
        /* eslint-enable no-script-url */

        it('removes links with data: URLs via sanitize option', () => {
            // marked's sanitize option completely removes links with dangerous protocols
            const handled = simulatePaste('![img](https://example.com/x.png)\n[click](data:text/html,<script>)');
            expect(handled).toBe(true);

            const html = editor.getHTML();

            // The link is completely removed by marked's sanitize option
            expect(html).not.toContain('data:text');
            expect(html).not.toContain('<script>');
        });

        it('blocks data: URLs in image src', () => {
            // Images with dangerous URLs are caught by our regex sanitization
            const handled = simulatePaste('# Header\n![xss](data:image/svg+xml,<svg onload=alert(1)>)');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).not.toContain('data:image');
        });

        it('escapes HTML embedded in markdown', () => {
            // marked's sanitize option escapes HTML tags in markdown input
            // Need 2+ markdown signals for detection (header + link)
            const handled = simulatePaste('# Title\nHello <img src=x onerror=alert(1)> world\n[link](https://example.com)');
            expect(handled).toBe(true);

            const html = editor.getHTML();

            // The dangerous HTML is escaped - angle brackets become &lt; and &gt;
            // This means the img tag is rendered as text, not executed
            expect(html).toContain('&lt;img');
            expect(html).toContain('&gt;');

            // The img should NOT be rendered as an actual img element with onerror attribute
            expect(html).not.toMatch(/<img[^>]*onerror/);
        });
    });

    describe('code fence protection', () => {
        it('does NOT convert @mentions inside code blocks', () => {
            const handled = simulatePaste('```bash\nnpm install -g @openai/codex\n```');
            expect(handled).toBe(true);

            const html = editor.getHTML();
            expect(html).toContain('<code');
            expect(html).not.toContain('data-type="mention"');
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
            expect(html).toContain('<code');
            expect(html).not.toContain('data-type="mention"');
            expect(html).toContain('@openai');
        });
    });
});
