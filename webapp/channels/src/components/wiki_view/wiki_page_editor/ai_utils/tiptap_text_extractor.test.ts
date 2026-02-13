// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    extractTextChunks,
    combineChunksForAI,
    splitAIResponse,
    batchChunks,
    estimateTokens,
    cloneDocument,
} from './tiptap_text_extractor';
import type {TipTapDoc} from './types';

describe('tiptap_text_extractor', () => {
    describe('extractTextChunks', () => {
        it('should extract text from simple paragraph', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Hello world'},
                        ],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks).toHaveLength(1);
            expect(result.chunks[0].text).toBe('Hello world');
            expect(result.chunks[0].nodeType).toBe('paragraph');
            expect(result.chunks[0].path).toEqual([0]);
            expect(result.totalCharacters).toBe(11);
        });

        it('should extract text from multiple paragraphs', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'First paragraph'}],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Second paragraph'}],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks).toHaveLength(2);
            expect(result.chunks[0].text).toBe('First paragraph');
            expect(result.chunks[0].path).toEqual([0]);
            expect(result.chunks[1].text).toBe('Second paragraph');
            expect(result.chunks[1].path).toEqual([1]);
        });

        it('should extract text from headings', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'heading',
                        attrs: {level: 1, id: 'title'},
                        content: [{type: 'text', text: 'Main Title'}],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks).toHaveLength(1);
            expect(result.chunks[0].text).toBe('Main Title');
            expect(result.chunks[0].nodeType).toBe('heading');
            expect(result.chunks[0].nodeAttrs?.level).toBe(1);
        });

        it('should skip code blocks completely', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Before code'}],
                    },
                    {
                        type: 'codeBlock',
                        content: [{type: 'text', text: 'const x = 1;'}],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'After code'}],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks).toHaveLength(2);
            expect(result.chunks[0].text).toBe('Before code');
            expect(result.chunks[1].text).toBe('After code');
            expect(result.skippedNodeCount).toBe(1);
            expect(result.skippedNodeTypes).toContain('codeBlock');
        });

        it('should skip images', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Text before'}],
                    },
                    {
                        type: 'image',
                        attrs: {src: '/api/v4/files/abc123', alt: 'test image'},
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Text after'}],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks).toHaveLength(2);
            expect(result.skippedNodeTypes).toContain('image');
        });

        it('should extract text from table cells', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Before table'}],
                    },
                    {
                        type: 'table',
                        content: [
                            {
                                type: 'tableRow',
                                content: [
                                    {
                                        type: 'tableCell',
                                        content: [
                                            {
                                                type: 'paragraph',
                                                content: [{type: 'text', text: 'Cell 1'}],
                                            },
                                        ],
                                    },
                                    {
                                        type: 'tableCell',
                                        content: [
                                            {
                                                type: 'paragraph',
                                                content: [{type: 'text', text: 'Cell 2'}],
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                type: 'tableRow',
                                content: [
                                    {
                                        type: 'tableHeader',
                                        content: [
                                            {
                                                type: 'paragraph',
                                                content: [{type: 'text', text: 'Header 1'}],
                                            },
                                        ],
                                    },
                                    {
                                        type: 'tableHeader',
                                        content: [
                                            {
                                                type: 'paragraph',
                                                content: [{type: 'text', text: 'Header 2'}],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'After table'}],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks).toHaveLength(6);
            expect(result.chunks[0].text).toBe('Before table');
            expect(result.chunks[1].text).toBe('Cell 1');
            expect(result.chunks[2].text).toBe('Cell 2');
            expect(result.chunks[3].text).toBe('Header 1');
            expect(result.chunks[4].text).toBe('Header 2');
            expect(result.chunks[5].text).toBe('After table');
            expect(result.skippedNodeTypes).not.toContain('table');
        });

        it('should extract text from nested lists', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'bulletList',
                        content: [
                            {
                                type: 'listItem',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{type: 'text', text: 'Item 1'}],
                                    },
                                ],
                            },
                            {
                                type: 'listItem',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{type: 'text', text: 'Item 2'}],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks).toHaveLength(2);
            expect(result.chunks[0].text).toBe('Item 1');
            expect(result.chunks[1].text).toBe('Item 2');
        });

        it('should preserve bold marks with positions', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Normal '},
                            {type: 'text', text: 'bold', marks: [{type: 'bold'}]},
                            {type: 'text', text: ' text'},
                        ],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks).toHaveLength(1);
            expect(result.chunks[0].text).toBe('Normal bold text');
            expect(result.chunks[0].marks).toHaveLength(1);
            expect(result.chunks[0].marks[0].type).toBe('bold');
            expect(result.chunks[0].marks[0].from).toBe(7);
            expect(result.chunks[0].marks[0].to).toBe(11);
        });

        it('should preserve link marks with href', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Click '},
                            {
                                type: 'text',
                                text: 'here',
                                marks: [{type: 'link', attrs: {href: 'https://example.com'}}],
                            },
                            {type: 'text', text: ' for more'},
                        ],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks[0].marks).toHaveLength(1);
            expect(result.chunks[0].marks[0].type).toBe('link');
            expect(result.chunks[0].marks[0].attrs?.href).toBe('https://example.com');
        });

        it('should handle hard breaks', () => {
            const doc: TipTapDoc = {
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

            const result = extractTextChunks(doc);

            expect(result.chunks[0].text).toBe('Line 1\nLine 2');
            expect(result.chunks[0].hardBreakPositions).toEqual([6]);
        });

        it('should handle empty paragraphs', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Has content'}],
                    },
                    {
                        type: 'paragraph',
                        content: [],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Also has content'}],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks).toHaveLength(2);
            expect(result.chunks[0].text).toBe('Has content');
            expect(result.chunks[1].text).toBe('Also has content');
        });

        it('should handle blockquotes', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'blockquote',
                        content: [{type: 'text', text: 'Quoted text'}],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks).toHaveLength(1);
            expect(result.chunks[0].text).toBe('Quoted text');
            expect(result.chunks[0].nodeType).toBe('blockquote');
        });

        it('should handle callout blocks', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'callout',
                        attrs: {type: 'info'},
                        content: [{type: 'text', text: 'Important note'}],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks).toHaveLength(1);
            expect(result.chunks[0].text).toBe('Important note');
            expect(result.chunks[0].nodeType).toBe('callout');
        });

        it('should consolidate adjacent marks of same type', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'This ', marks: [{type: 'bold'}]},
                            {type: 'text', text: 'is ', marks: [{type: 'bold'}]},
                            {type: 'text', text: 'bold', marks: [{type: 'bold'}]},
                        ],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            expect(result.chunks[0].marks).toHaveLength(1);
            expect(result.chunks[0].marks[0].from).toBe(0);
            expect(result.chunks[0].marks[0].to).toBe(12);
        });

        it('should protect URLs and adjust link mark positions to match placeholder length', () => {
            // This tests the fix for scrambled URLs in translation:
            // When a URL is replaced with a placeholder, the link mark positions
            // must be adjusted to match the placeholder text, not the original URL.
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Visit '},
                            {
                                type: 'text',
                                text: 'https://example.com/path',
                                marks: [{type: 'link', attrs: {href: 'https://example.com/path'}}],
                            },
                            {type: 'text', text: ' for more info'},
                        ],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            // The URL should be replaced with a placeholder
            expect(result.chunks[0].protectedUrls).toHaveLength(1);
            expect(result.chunks[0].protectedUrls?.[0].original).toBe('https://example.com/path');
            expect(result.chunks[0].protectedUrls?.[0].placeholder).toBe('⟦URL:0⟧');

            // Text should contain the placeholder, not the URL
            expect(result.chunks[0].text).toContain('⟦URL:0⟧');
            expect(result.chunks[0].text).not.toContain('https://example.com');

            // The link mark positions should match the placeholder in the text
            const linkMark = result.chunks[0].marks.find((m) => m.type === 'link');
            expect(linkMark).toBeDefined();

            // Verify the mark positions cover exactly the placeholder
            const placeholder = '⟦URL:0⟧';
            const textBeforeUrl = 'Visit ';
            expect(linkMark!.from).toBe(textBeforeUrl.length);
            expect(linkMark!.to).toBe(textBeforeUrl.length + placeholder.length);

            // Verify the text at the mark positions is the placeholder
            const markedText = result.chunks[0].text.slice(linkMark!.from, linkMark!.to);
            expect(markedText).toBe(placeholder);
        });

        it('should adjust mark positions for text after protected URL', () => {
            // Tests that marks after the URL are correctly shifted
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'See '},
                            {
                                type: 'text',
                                text: 'https://example.com',
                                marks: [{type: 'link', attrs: {href: 'https://example.com'}}],
                            },
                            {type: 'text', text: ' and '},
                            {type: 'text', text: 'bold text', marks: [{type: 'bold'}]},
                        ],
                    },
                ],
            };

            const result = extractTextChunks(doc);

            // Find the bold mark
            const boldMark = result.chunks[0].marks.find((m) => m.type === 'bold');
            expect(boldMark).toBeDefined();

            // The bold mark should be correctly positioned in the placeholder text
            // Original: "See https://example.com and bold text"
            // With placeholder: "See ⟦URL:0⟧ and bold text"
            const expectedText = 'See ⟦URL:0⟧ and bold text';
            expect(result.chunks[0].text).toBe(expectedText);

            // The bold text starts at position after "See ⟦URL:0⟧ and "
            const markedBoldText = result.chunks[0].text.slice(boldMark!.from, boldMark!.to);
            expect(markedBoldText).toBe('bold text');
        });
    });

    describe('combineChunksForAI', () => {
        it('should combine chunks with separator', () => {
            const chunks = [
                {path: [0], nodeType: 'paragraph', text: 'First', marks: [], hardBreakPositions: []},
                {path: [1], nodeType: 'paragraph', text: 'Second', marks: [], hardBreakPositions: []},
            ];

            const result = combineChunksForAI(chunks);

            expect(result).toBe('First\n\nSecond');
        });

        it('should use custom separator', () => {
            const chunks = [
                {path: [0], nodeType: 'paragraph', text: 'First', marks: [], hardBreakPositions: []},
                {path: [1], nodeType: 'paragraph', text: 'Second', marks: [], hardBreakPositions: []},
            ];

            const result = combineChunksForAI(chunks, '|||');

            expect(result).toBe('First|||Second');
        });
    });

    describe('splitAIResponse', () => {
        it('should split response by separator', () => {
            const response = 'First\n\nSecond';

            const result = splitAIResponse(response);

            expect(result).toEqual(['First', 'Second']);
        });

        it('should handle custom separator', () => {
            const response = 'First|||Second|||Third';

            const result = splitAIResponse(response, '|||');

            expect(result).toEqual(['First', 'Second', 'Third']);
        });
    });

    describe('estimateTokens', () => {
        it('should estimate tokens at ~4 chars per token', () => {
            const text = 'Hello world'; // 11 chars

            const result = estimateTokens(text);

            expect(result).toBe(3); // ceil(11/4) = 3
        });

        it('should handle empty string', () => {
            const result = estimateTokens('');

            expect(result).toBe(0);
        });
    });

    describe('batchChunks', () => {
        it('should batch chunks within token limit', () => {
            const chunks = [
                {path: [0], nodeType: 'paragraph', text: 'A'.repeat(100), marks: [], hardBreakPositions: []},
                {path: [1], nodeType: 'paragraph', text: 'B'.repeat(100), marks: [], hardBreakPositions: []},
                {path: [2], nodeType: 'paragraph', text: 'C'.repeat(100), marks: [], hardBreakPositions: []},
            ];

            // Each chunk is ~25 tokens, max 50 tokens per batch = 2 chunks per batch
            const result = batchChunks(chunks, 50);

            expect(result).toHaveLength(2);
            expect(result[0]).toHaveLength(2);
            expect(result[1]).toHaveLength(1);
        });

        it('should put large chunks in their own batch', () => {
            const chunks = [
                {path: [0], nodeType: 'paragraph', text: 'A'.repeat(1000), marks: [], hardBreakPositions: []},
                {path: [1], nodeType: 'paragraph', text: 'B'.repeat(100), marks: [], hardBreakPositions: []},
            ];

            // First chunk is 250 tokens, exceeds max of 100
            const result = batchChunks(chunks, 100);

            expect(result).toHaveLength(2);
            expect(result[0]).toHaveLength(1);
            expect(result[1]).toHaveLength(1);
        });

        it('should handle empty input', () => {
            const result = batchChunks([], 100);

            expect(result).toEqual([]);
        });
    });

    describe('cloneDocument', () => {
        it('should create a deep clone', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Original'}],
                    },
                ],
            };

            const clone = cloneDocument(doc);

            // Modify clone
            if (clone.content[0].content) {
                clone.content[0].content[0].text = 'Modified';
            }

            // Original should be unchanged
            expect(doc.content[0].content?.[0].text).toBe('Original');
            expect(clone.content[0].content?.[0].text).toBe('Modified');
        });
    });
});
