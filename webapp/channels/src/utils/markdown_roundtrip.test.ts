// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Markdown Round-Trip Tests
 *
 * Tests the full cycle: markdown → TipTap → markdown
 *
 * Known Issues Traced from Production Bug:
 * 1. Code block language lost (e.g., ```bash becomes ```)
 * 2. Tables get extra newlines between rows
 * 3. Escaped periods in ordered lists (1\. instead of 1.)
 * 4. Consecutive lines without blank line get merged
 * 5. Page title prepended with includeTitle option
 */

import {
    tiptapToMarkdown,
    sanitizeCodeLanguage,
    sanitizeFilename,
    escapeMarkdownText,
    extractFileId,
    getFileExtension,
} from './tiptap_to_markdown';

describe('Markdown Round-Trip Preservation', () => {
    describe('code blocks with language', () => {
        it('should preserve code block language in export', () => {
            // TipTap document with bash code block
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'codeBlock',
                        attrs: {language: 'bash'},
                        content: [{type: 'text', text: 'npm install'}],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Should preserve language hint
            expect(result.markdown).toContain('```bash');
            expect(result.markdown).toContain('npm install');
            expect(result.markdown).toContain('```');
        });

        it('should preserve javascript code block language', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'codeBlock',
                        attrs: {language: 'javascript'},
                        content: [{type: 'text', text: 'const x = 1;'}],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('```javascript');
        });

        it('should handle code block without language', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'codeBlock',
                        attrs: {},
                        content: [{type: 'text', text: 'plain code'}],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Should have ``` without language
            expect(result.markdown).toMatch(/```\n/);
        });
    });

    describe('tables', () => {
        it('should export tables without extra newlines in cells', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'table',
                        content: [
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'MCP'}]}]},
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Purpose'}]}]},
                                ],
                            },
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'seq-server'}]}]},
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'Sequential thinking'}]}]},
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Tables should be compact without extra newlines
            const lines = result.markdown.split('\n').filter((line) => line.trim());

            // Should have: header row, separator, data row
            expect(lines.length).toBeGreaterThanOrEqual(3);

            // Each table row should be on one line
            expect(result.markdown).toMatch(/\| MCP \| Purpose \|/);
            expect(result.markdown).toMatch(/\| --- \| --- \|/);
            expect(result.markdown).toMatch(/\| seq-server \| Sequential thinking \|/);

            // Should NOT have cell content on separate lines
            expect(result.markdown).not.toMatch(/\|\s*\n\s*MCP/);
        });

        it('should handle table with inline formatting', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'table',
                        content: [
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Name'}]}]},
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Code'}]}]},
                                ],
                            },
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'bold'}], text: 'Bold'}]}]},
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'code'}], text: 'inline'}]}]},
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('**Bold**');
            expect(result.markdown).toContain('`inline`');
        });
    });

    describe('ordered lists', () => {
        it('should export ordered lists without escaped periods', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'orderedList',
                        attrs: {start: 1},
                        content: [
                            {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'First item'}]}]},
                            {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Second item'}]}]},
                            {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Third item'}]}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Should have unescaped periods
            expect(result.markdown).toContain('1. First item');
            expect(result.markdown).toContain('2. Second item');
            expect(result.markdown).toContain('3. Third item');

            // Should NOT have escaped periods
            expect(result.markdown).not.toContain('1\\.');
            expect(result.markdown).not.toContain('2\\.');
            expect(result.markdown).not.toContain('3\\.');
        });
    });

    describe('paragraphs and line breaks', () => {
        it('should separate paragraphs with blank lines', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'paragraph', content: [{type: 'text', text: 'First paragraph'}]},
                    {type: 'paragraph', content: [{type: 'text', text: 'Second paragraph'}]},
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Paragraphs should be separated by blank line
            expect(result.markdown).toMatch(/First paragraph\n\nSecond paragraph/);
        });

        it('should handle hard breaks within paragraph', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Line 1'},
                            {type: 'hardBreak'},
                            {type: 'text', text: 'Line 2'},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Hard break should be "  \n" (two spaces + newline)
            expect(result.markdown).toContain('Line 1  \nLine 2');
        });
    });

    describe('title handling', () => {
        it('should prepend title when includeTitle is true', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'paragraph', content: [{type: 'text', text: 'Content'}]},
                ],
            };

            const result = tiptapToMarkdown(doc, {title: 'My Page', includeTitle: true});

            expect(result.markdown).toMatch(/^# My Page\n\n/);
            expect(result.markdown).toContain('Content');
        });

        it('should not prepend title when includeTitle is false', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'paragraph', content: [{type: 'text', text: 'Content'}]},
                ],
            };

            const result = tiptapToMarkdown(doc, {title: 'My Page', includeTitle: false});

            expect(result.markdown).not.toContain('# My Page');
        });
    });

    describe('callouts', () => {
        it('should export info callout', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'callout',
                        attrs: {type: 'info'},
                        content: [
                            {type: 'paragraph', content: [{type: 'text', text: 'This is important information.'}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('> **Info**');
            expect(result.markdown).toContain('This is important information.');
        });

        it('should export warning callout', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'callout',
                        attrs: {type: 'warning'},
                        content: [
                            {type: 'paragraph', content: [{type: 'text', text: 'Be careful!'}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('> **Warning**');
            expect(result.markdown).toContain('Be careful!');
        });

        it('should export error callout', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'callout',
                        attrs: {type: 'error'},
                        content: [
                            {type: 'paragraph', content: [{type: 'text', text: 'Something went wrong.'}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('> **Error**');
            expect(result.markdown).toContain('Something went wrong.');
        });

        it('should export success callout', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'callout',
                        attrs: {type: 'success'},
                        content: [
                            {type: 'paragraph', content: [{type: 'text', text: 'Operation completed!'}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('> **Success**');
            expect(result.markdown).toContain('Operation completed!');
        });

        it('should export callout with multiple paragraphs', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'callout',
                        attrs: {type: 'info'},
                        content: [
                            {type: 'paragraph', content: [{type: 'text', text: 'First paragraph.'}]},
                            {type: 'paragraph', content: [{type: 'text', text: 'Second paragraph.'}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('First paragraph.');
            expect(result.markdown).toContain('Second paragraph.');
        });
    });

    describe('blockquotes', () => {
        it('should export simple blockquote', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'blockquote',
                        content: [
                            {type: 'paragraph', content: [{type: 'text', text: 'To be or not to be.'}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('> To be or not to be.');
        });

        it('should export blockquote with multiple paragraphs', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'blockquote',
                        content: [
                            {type: 'paragraph', content: [{type: 'text', text: 'First line of quote.'}]},
                            {type: 'paragraph', content: [{type: 'text', text: 'Second line of quote.'}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('First line of quote.');
            expect(result.markdown).toContain('Second line of quote.');
        });

        it('should export blockquote with formatting', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'blockquote',
                        content: [
                            {
                                type: 'paragraph',
                                content: [
                                    {type: 'text', marks: [{type: 'bold'}], text: 'Important'},
                                    {type: 'text', text: ': This is '},
                                    {type: 'text', marks: [{type: 'italic'}], text: 'emphasized'},
                                    {type: 'text', text: '.'},
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('**Important**');
            expect(result.markdown).toContain('*emphasized*');
        });

        it('should export blockquote with list inside', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'blockquote',
                        content: [
                            {type: 'paragraph', content: [{type: 'text', text: 'Key points:'}]},
                            {
                                type: 'bulletList',
                                content: [
                                    {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Point 1'}]}]},
                                    {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Point 2'}]}]},
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('Key points:');
            expect(result.markdown).toContain('Point 1');
            expect(result.markdown).toContain('Point 2');
        });
    });

    describe('task lists', () => {
        it('should export task list with checked and unchecked items', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'taskList',
                        content: [
                            {type: 'taskItem', attrs: {checked: true}, content: [{type: 'paragraph', content: [{type: 'text', text: 'Completed task'}]}]},
                            {type: 'taskItem', attrs: {checked: false}, content: [{type: 'paragraph', content: [{type: 'text', text: 'Pending task'}]}]},
                            {type: 'taskItem', attrs: {checked: true}, content: [{type: 'paragraph', content: [{type: 'text', text: 'Another done'}]}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('- [x] Completed task');
            expect(result.markdown).toContain('- [ ] Pending task');
            expect(result.markdown).toContain('- [x] Another done');
        });

        it('should export task list with formatted text', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'taskList',
                        content: [
                            {
                                type: 'taskItem',
                                attrs: {checked: false},
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [
                                            {type: 'text', text: 'Review '},
                                            {type: 'text', marks: [{type: 'bold'}], text: 'PR #123'},
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('- [ ]');
            expect(result.markdown).toContain('Review');
            expect(result.markdown).toContain('**PR #123**');
        });
    });

    describe('horizontal rules', () => {
        it('should export horizontal rule', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'paragraph', content: [{type: 'text', text: 'Section 1'}]},
                    {type: 'horizontalRule'},
                    {type: 'paragraph', content: [{type: 'text', text: 'Section 2'}]},
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('Section 1');
            expect(result.markdown).toContain('---');
            expect(result.markdown).toContain('Section 2');
        });

        it('should export multiple horizontal rules', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Chapter 1'}]},
                    {type: 'horizontalRule'},
                    {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Chapter 2'}]},
                    {type: 'horizontalRule'},
                    {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Chapter 3'}]},
                ],
            };

            const result = tiptapToMarkdown(doc);

            const hrCount = (result.markdown.match(/---/g) || []).length;
            expect(hrCount).toBe(2);
        });
    });

    describe('images and media', () => {
        it('should export image with alt text', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'image', attrs: {src: 'https://example.com/logo.png', alt: 'Company Logo'}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('![Company Logo](https://example.com/logo.png)');
        });

        it('should export image without alt text', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'image', attrs: {src: 'https://example.com/image.jpg', alt: ''}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('![](https://example.com/image.jpg)');
        });
    });

    describe('mentions', () => {
        it('should export user mention', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Hey '},
                            {type: 'mention', attrs: {id: 'user123', label: 'johndoe'}},
                            {type: 'text', text: ', please review.'},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('@johndoe');
        });

        it('should export multiple mentions', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'CC: '},
                            {type: 'mention', attrs: {id: 'u1', label: 'alice'}},
                            {type: 'text', text: ' '},
                            {type: 'mention', attrs: {id: 'u2', label: 'bob'}},
                            {type: 'text', text: ' '},
                            {type: 'mention', attrs: {id: 'u3', label: 'charlie'}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('@alice');
            expect(result.markdown).toContain('@bob');
            expect(result.markdown).toContain('@charlie');
        });
    });

    describe('mixed inline formatting', () => {
        it('should export bold and italic combined', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', marks: [{type: 'bold'}, {type: 'italic'}], text: 'bold and italic'},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Could be ***text*** or **_text_** or similar
            expect(result.markdown).toContain('bold and italic');
        });

        it('should export strikethrough with bold', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', marks: [{type: 'strike'}, {type: 'bold'}], text: 'deleted important'},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('~~');
            expect(result.markdown).toContain('**');
            expect(result.markdown).toContain('deleted important');
        });

        it('should export inline code (not affected by other marks)', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Use the '},
                            {type: 'text', marks: [{type: 'code'}], text: 'npm install'},
                            {type: 'text', text: ' command.'},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('`npm install`');
        });
    });

    describe('edge cases', () => {
        it('should handle tables with empty cells', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'table',
                        content: [
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Name'}]}]},
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Value'}]}]},
                                ],
                            },
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'Item'}]}]},
                                    {type: 'tableCell', content: [{type: 'paragraph', content: []}]}, // Empty cell
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Table should still be valid with empty cell
            expect(result.markdown).toMatch(/\| Name \| Value \|/);
            expect(result.markdown).toMatch(/\| Item \|/);
        });

        it('should handle special characters that need escaping in table cells', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'table',
                        content: [
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Pattern'}]}]},
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Example'}]}]},
                                ],
                            },
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'a|b'}]}]},
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'x*y'}]}]},
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Content should be present (escaping may vary)
            expect(result.markdown).toContain('Pattern');
            expect(result.markdown).toContain('Example');
        });

        it('should handle nested blockquotes', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'blockquote',
                        content: [
                            {type: 'paragraph', content: [{type: 'text', text: 'Outer quote'}]},
                            {
                                type: 'blockquote',
                                content: [
                                    {type: 'paragraph', content: [{type: 'text', text: 'Inner quote'}]},
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('> Outer quote');
            expect(result.markdown).toContain('Inner quote');
        });

        it('should handle code block inside list item', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'bulletList',
                        content: [
                            {
                                type: 'listItem',
                                content: [
                                    {type: 'paragraph', content: [{type: 'text', text: 'Install:'}]},
                                    {
                                        type: 'codeBlock',
                                        attrs: {language: 'bash'},
                                        content: [{type: 'text', text: 'npm install'}],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('- Install:');
            expect(result.markdown).toContain('```bash');
            expect(result.markdown).toContain('npm install');
        });

        it('should handle deeply nested lists', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'bulletList',
                        content: [
                            {
                                type: 'listItem',
                                content: [
                                    {type: 'paragraph', content: [{type: 'text', text: 'Level 1'}]},
                                    {
                                        type: 'bulletList',
                                        content: [
                                            {
                                                type: 'listItem',
                                                content: [
                                                    {type: 'paragraph', content: [{type: 'text', text: 'Level 2'}]},
                                                    {
                                                        type: 'bulletList',
                                                        content: [
                                                            {
                                                                type: 'listItem',
                                                                content: [
                                                                    {type: 'paragraph', content: [{type: 'text', text: 'Level 3'}]},
                                                                ],
                                                            },
                                                        ],
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('Level 1');
            expect(result.markdown).toContain('Level 2');
            expect(result.markdown).toContain('Level 3');

            // Should have increasing indentation
            expect(result.markdown).toMatch(/-\s+Level 1/);
        });

        it('should handle link with formatted text', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                marks: [
                                    {type: 'link', attrs: {href: 'https://example.com'}},
                                    {type: 'bold'},
                                ],
                                text: 'Bold Link',
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Should have both link and bold formatting
            expect(result.markdown).toContain('example.com');
            expect(result.markdown).toContain('Bold Link');
        });

        it('should handle unicode and emoji', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'paragraph', content: [{type: 'text', text: 'Hello 世界 🎉'}]},
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('Hello 世界 🎉');
        });

        it('should handle text with markdown special characters', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'paragraph', content: [{type: 'text', text: 'Use *asterisks* and _underscores_ literally'}]},
                ],
            };

            const result = tiptapToMarkdown(doc);

            // The text should be present (may or may not be escaped depending on implementation)
            expect(result.markdown).toContain('asterisks');
            expect(result.markdown).toContain('underscores');
        });

        it('should handle table with links in cells', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'table',
                        content: [
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Resource'}]}]},
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Link'}]}]},
                                ],
                            },
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'Docs'}]}]},
                                    {
                                        type: 'tableCell',
                                        content: [
                                            {
                                                type: 'paragraph',
                                                content: [
                                                    {
                                                        type: 'text',
                                                        marks: [{type: 'link', attrs: {href: 'https://docs.example.com'}}],
                                                        text: 'View',
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('[View](https://docs.example.com)');
        });

        it('should handle multiple tables in document', () => {
            const doc = {
                type: 'doc',
                content: [
                    {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: 'Table 1'}]},
                    {
                        type: 'table',
                        content: [
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'A'}]}]},
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'B'}]}]},
                                ],
                            },
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: '1'}]}]},
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: '2'}]}]},
                                ],
                            },
                        ],
                    },
                    {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: 'Table 2'}]},
                    {
                        type: 'table',
                        content: [
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'X'}]}]},
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Y'}]}]},
                                ],
                            },
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: '3'}]}]},
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: '4'}]}]},
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('## Table 1');
            expect(result.markdown).toContain('| A | B |');
            expect(result.markdown).toContain('## Table 2');
            expect(result.markdown).toContain('| X | Y |');
        });
    });

    describe('complex document structure', () => {
        it('should handle document with multiple element types', () => {
            // Simulates the architecture.md document structure
            const doc = {
                type: 'doc',
                content: [
                    {type: 'heading', attrs: {level: 1}, content: [{type: 'text', text: 'Architecture'}]},
                    {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: 'Prerequisites'}]},
                    {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'CLI Tools'}]},
                    {
                        type: 'codeBlock',
                        attrs: {language: 'bash'},
                        content: [{type: 'text', text: 'npm install -g @openai/codex'}],
                    },
                    {type: 'heading', attrs: {level: 3}, content: [{type: 'text', text: 'MCP Servers'}]},
                    {
                        type: 'table',
                        content: [
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'MCP'}]}]},
                                    {type: 'tableHeader', content: [{type: 'paragraph', content: [{type: 'text', text: 'Purpose'}]}]},
                                ],
                            },
                            {
                                type: 'tableRow',
                                content: [
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', marks: [{type: 'code'}], text: 'seq-server'}]}]},
                                    {type: 'tableCell', content: [{type: 'paragraph', content: [{type: 'text', text: 'Sequential thinking'}]}]},
                                ],
                            },
                        ],
                    },
                    {type: 'horizontalRule'},
                    {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: 'Workflow'}]},
                    {
                        type: 'orderedList',
                        attrs: {start: 1},
                        content: [
                            {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Plan Creation'}]}]},
                            {type: 'listItem', content: [{type: 'paragraph', content: [{type: 'text', text: 'Implementation'}]}]},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Verify structure is preserved
            expect(result.markdown).toContain('# Architecture');
            expect(result.markdown).toContain('## Prerequisites');
            expect(result.markdown).toContain('### CLI Tools');
            expect(result.markdown).toContain('```bash');
            expect(result.markdown).toContain('npm install -g @openai/codex');
            expect(result.markdown).toContain('### MCP Servers');
            expect(result.markdown).toContain('| MCP | Purpose |');
            expect(result.markdown).toContain('`seq-server`');
            expect(result.markdown).toContain('---');
            expect(result.markdown).toContain('## Workflow');
            expect(result.markdown).toContain('1. Plan Creation');
            expect(result.markdown).toContain('2. Implementation');
        });
    });

    describe('security helper functions', () => {
        describe('sanitizeCodeLanguage', () => {
            it('should pass through valid language names', () => {
                expect(sanitizeCodeLanguage('bash')).toBe('bash');
                expect(sanitizeCodeLanguage('javascript')).toBe('javascript');
                expect(sanitizeCodeLanguage('c++')).toBe('c++');
                expect(sanitizeCodeLanguage('c-sharp')).toBe('c-sharp');
            });

            it('should strip special characters', () => {
                expect(sanitizeCodeLanguage('bash;alert(1)')).toBe('bashalert1');
                expect(sanitizeCodeLanguage('js<script>')).toBe('jsscript');
                expect(sanitizeCodeLanguage('py`rm -rf`')).toBe('pyrm-rf');
            });

            it('should truncate to 20 characters', () => {
                const longLang = 'abcdefghijklmnopqrstuvwxyz';
                expect(sanitizeCodeLanguage(longLang)).toBe('abcdefghijklmnopqrst');
                expect(sanitizeCodeLanguage(longLang).length).toBe(20);
            });

            it('should return empty string for undefined/empty input', () => {
                expect(sanitizeCodeLanguage(undefined)).toBe('');
                expect(sanitizeCodeLanguage('')).toBe('');
            });
        });

        describe('sanitizeFilename', () => {
            it('should pass through safe filenames', () => {
                expect(sanitizeFilename('document.pdf')).toBe('document.pdf');
                expect(sanitizeFilename('my-file_v2.docx')).toBe('my-file_v2.docx');
            });

            it('should remove path traversal sequences', () => {
                expect(sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd');
                expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('windowssystem32');
                expect(sanitizeFilename('file/../secret.txt')).toBe('filesecret.txt');
            });

            it('should remove invalid filesystem characters', () => {
                expect(sanitizeFilename('file<name>.txt')).toBe('filename.txt');
                expect(sanitizeFilename('doc:ument.pdf')).toBe('document.pdf');
                expect(sanitizeFilename('test"file".docx')).toBe('testfile.docx');
                expect(sanitizeFilename('path/to/file.txt')).toBe('pathtofile.txt');
                expect(sanitizeFilename('back\\slash.txt')).toBe('backslash.txt');
            });

            it('should return "file" for empty/whitespace input', () => {
                expect(sanitizeFilename('')).toBe('file');
                expect(sanitizeFilename('   ')).toBe('file');
            });

            it('should remove control characters', () => {
                expect(sanitizeFilename('file\x00name.txt')).toBe('filename.txt');
                expect(sanitizeFilename('test\x1ffile.pdf')).toBe('testfile.pdf');
            });
        });

        describe('escapeMarkdownText', () => {
            it('should escape backslashes', () => {
                expect(escapeMarkdownText('path\\to\\file')).toBe('path\\\\to\\\\file');
            });

            it('should escape markdown special characters', () => {
                expect(escapeMarkdownText('*asterisk*')).toBe('\\*asterisk\\*');
                expect(escapeMarkdownText('_underscore_')).toBe('\\_underscore\\_');
                expect(escapeMarkdownText('`backtick`')).toBe('\\`backtick\\`');
                expect(escapeMarkdownText('[bracket]')).toBe('\\[bracket\\]');
            });

            it('should escape HTML angle brackets', () => {
                expect(escapeMarkdownText('<script>')).toBe('&lt;script&gt;');
                expect(escapeMarkdownText('a > b < c')).toBe('a &gt; b &lt; c');
            });

            it('should return empty string for undefined/empty input', () => {
                expect(escapeMarkdownText(undefined)).toBe('');
                expect(escapeMarkdownText('')).toBe('');
            });
        });

        describe('extractFileId', () => {
            it('should extract file ID from MM file URL', () => {
                expect(extractFileId('/api/v4/files/abc123def456')).toBe('abc123def456');
                expect(extractFileId('/api/v4/files/xyz789')).toBe('xyz789');
            });

            it('should extract file ID from full URL with preview suffix', () => {
                expect(extractFileId('https://example.com/api/v4/files/file123/preview')).toBe('file123');
            });

            it('should return null for non-matching URLs', () => {
                expect(extractFileId('https://example.com/image.png')).toBeNull();
                expect(extractFileId('/files/abc123')).toBeNull();
                expect(extractFileId('')).toBeNull();
            });
        });

        describe('getFileExtension', () => {
            it('should extract extension from filename', () => {
                expect(getFileExtension('', 'document.pdf')).toBe('.pdf');
                expect(getFileExtension('', 'image.PNG')).toBe('.png');
                expect(getFileExtension('', 'archive.tar.gz')).toBe('.gz');
            });

            it('should extract extension from URL', () => {
                expect(getFileExtension('https://example.com/file.jpg')).toBe('.jpg');
                expect(getFileExtension('https://example.com/file.png?query=1')).toBe('.png');
            });

            it('should prefer filename over URL', () => {
                expect(getFileExtension('https://example.com/download', 'actual.docx')).toBe('.docx');
            });

            it('should return default .bin when no extension found', () => {
                expect(getFileExtension('/api/v4/files/abc123')).toBe('.bin');
                expect(getFileExtension('https://example.com/file', undefined)).toBe('.bin');
            });
        });
    });

    describe('video node handling', () => {
        it('should export video with MM file URL as local link', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'video',
                        attrs: {src: '/api/v4/files/vid123', title: 'Demo Video'},
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // When title is present, it's used as filename (sanitized) and label
            expect(result.markdown).toContain('[Demo Video](attachments/Demo Video)');
            expect(result.files).toHaveLength(1);
            expect(result.files[0].fileId).toBe('vid123');
        });

        it('should export video with MM file URL using fileId when no filename/title', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'video',
                        attrs: {src: '/api/v4/files/vid456'},
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // When no filename/title, uses fileId + extension for path
            expect(result.markdown).toContain('[video](attachments/vid456.bin)');
            expect(result.files).toHaveLength(1);
            expect(result.files[0].fileId).toBe('vid456');
        });

        it('should export video with external URL', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'video',
                        attrs: {src: 'https://example.com/video.mp4', title: 'External Video'},
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Note: For external videos, alt is used for label (not title), defaults to 'video'
            expect(result.markdown).toContain('[video](https://example.com/video.mp4)');
            expect(result.files).toHaveLength(0);
        });

        it('should export video with preserveFileUrls option', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'video',
                        attrs: {src: '/api/v4/files/vid456', title: 'Preserved Video'},
                    },
                ],
            };

            const result = tiptapToMarkdown(doc, {preserveFileUrls: true});

            expect(result.markdown).toContain('[Preserved Video](/api/v4/files/vid456)');
            expect(result.files).toHaveLength(0);
        });

        it('should use "video" as default label when no title', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'video',
                        attrs: {src: 'https://example.com/video.mp4'},
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('[video](https://example.com/video.mp4)');
        });
    });

    describe('file attachment handling', () => {
        it('should export file attachment with MM URL to local path', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'fileAttachment',
                        attrs: {
                            src: '/api/v4/files/doc123',
                            fileName: 'report.pdf',
                            fileId: 'doc123',
                        },
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('[report.pdf](attachments/report.pdf)');
            expect(result.files).toHaveLength(1);
            expect(result.files[0].fileId).toBe('doc123');
            expect(result.files[0].localPath).toBe('attachments/report.pdf');
        });

        it('should export file attachment with external URL', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'fileAttachment',
                        attrs: {
                            src: 'https://example.com/document.pdf',
                            fileName: 'external.pdf',
                        },
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('[external.pdf](https://example.com/document.pdf)');
            expect(result.files).toHaveLength(0);
        });

        it('should export file attachment with preserveFileUrls option', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'fileAttachment',
                        attrs: {
                            src: '/api/v4/files/doc456',
                            fileName: 'preserved.docx',
                        },
                    },
                ],
            };

            const result = tiptapToMarkdown(doc, {preserveFileUrls: true});

            expect(result.markdown).toContain('[preserved.docx](/api/v4/files/doc456)');
            expect(result.files).toHaveLength(0);
        });

        it('should sanitize filename in file attachment localPath', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'fileAttachment',
                        attrs: {
                            src: '/api/v4/files/mal123',
                            fileName: '../../../etc/passwd',
                        },
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // Display text shows original filename (escaped for markdown), but localPath is sanitized
            // The localPath should NOT contain path traversal
            expect(result.files[0].localPath).not.toContain('..');
            expect(result.files[0].localPath).toBe('attachments/etcpasswd');
        });

        it('should use fallback filename when empty', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'fileAttachment',
                        attrs: {
                            src: '/api/v4/files/empty123',
                            fileName: '',
                            filename: '',
                        },
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('[file]');
        });
    });

    describe('channel mentions', () => {
        it('should export channel mention with label', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Check '},
                            {type: 'channelMention', attrs: {id: 'ch123', label: 'town-square'}},
                            {type: 'text', text: ' for updates.'},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('~town-square');
        });

        it('should export channel mention with only id', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'channelMention', attrs: {id: 'general', label: null}},
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('~general');
        });
    });

    describe('imageResize node', () => {
        it('should export imageResize with width attribute', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'imageResize',
                                attrs: {
                                    src: 'https://example.com/image.png',
                                    alt: 'Resized Image',
                                    width: 300,
                                },
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            // imageResize should be exported as regular image markdown
            expect(result.markdown).toContain('![Resized Image](https://example.com/image.png)');
        });

        it('should export imageResize with MM file URL', () => {
            const doc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'imageResize',
                                attrs: {
                                    src: '/api/v4/files/img789',
                                    alt: 'MM Image',
                                    filename: 'screenshot.png',
                                },
                            },
                        ],
                    },
                ],
            };

            const result = tiptapToMarkdown(doc);

            expect(result.markdown).toContain('![MM Image](attachments/screenshot.png)');
            expect(result.files).toHaveLength(1);
            expect(result.files[0].fileId).toBe('img789');
        });
    });
});
