// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Full Markdown Round-Trip Tests
 *
 * Tests the complete cycle: markdown → paste into TipTap → export back to markdown
 *
 * Uses a comprehensive fixture that covers ALL markdown features:
 * - Headings (h1-h4)
 * - Code blocks with languages (bash, js, python, ts)
 * - Tables with inline code
 * - Horizontal rules
 * - Ordered lists, bullet lists, task lists
 * - Blockquotes (simple + with formatting)
 * - Bold, italic, strikethrough, inline code
 * - Bold+italic combined
 * - Links and images
 * - @mentions and ~channel mentions
 * - Unicode and emoji
 * - Nested lists
 */

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
import marked from 'marked';

import {convertTaskListsToTipTapFormat} from 'components/wiki_view/wiki_page_editor/paste_markdown_extension';

import {
    COMPREHENSIVE_MARKDOWN,
    COMPREHENSIVE_TIPTAP_DOC,
    EXPECTED_MARKDOWN_ELEMENTS,
    FORBIDDEN_MARKDOWN_ELEMENTS,
} from './test_fixtures/comprehensive_markdown';
import {tiptapToMarkdown} from './tiptap_to_markdown';

// Simulate the paste handler's HTML conversion
function markdownToHtml(markdown: string): string {
    let html = marked(markdown) as string;

    // Convert code block language class prefix from marked to TipTap format
    // marked outputs: <pre><code class="lang-bash">
    // TipTap expects: <pre><code class="language-bash">
    html = html.replace(
        /<code class="lang-([^"]+)">/g,
        '<code class="language-$1">',
    );

    // Convert task lists from marked format to TipTap format
    // marked outputs: <li>[x] text</li>
    // TipTap expects: <li data-type="taskItem" data-checked="true">text</li>
    html = convertTaskListsToTipTapFormat(html);

    return html;
}

describe('Full Markdown Round-Trip', () => {
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
            ],
            content: '<p></p>',
        });
    });

    afterEach(() => {
        editor.destroy();
    });

    // Helper to perform round-trip: markdown → HTML → TipTap → markdown
    function roundTrip(markdown: string): string {
        const html = markdownToHtml(markdown);
        editor.commands.setContent(html);
        const doc = editor.getJSON();
        const result = tiptapToMarkdown(doc);
        return result.markdown;
    }

    it('preserves all markdown elements through paste → export round-trip', () => {
        const output = roundTrip(COMPREHENSIVE_MARKDOWN);

        // Verify all expected elements are present
        for (const element of EXPECTED_MARKDOWN_ELEMENTS) {
            expect(output).toContain(element);
        }

        // Verify no forbidden elements appear
        for (const forbidden of FORBIDDEN_MARKDOWN_ELEMENTS) {
            expect(output).not.toContain(forbidden);
        }
    });

    it('exports comprehensive TipTap doc to correct markdown', () => {
        editor.commands.setContent(COMPREHENSIVE_TIPTAP_DOC);
        const doc = editor.getJSON();
        const result = tiptapToMarkdown(doc);

        // Verify all expected elements are present
        for (const element of EXPECTED_MARKDOWN_ELEMENTS) {
            expect(result.markdown).toContain(element);
        }

        // Verify no forbidden elements appear
        for (const forbidden of FORBIDDEN_MARKDOWN_ELEMENTS) {
            expect(result.markdown).not.toContain(forbidden);
        }
    });
});
