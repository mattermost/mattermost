// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {reassembleDocument, adjustMarkPositions} from './tiptap_reassembler';
import {extractTextChunks} from './tiptap_text_extractor';
import type {TipTapDoc} from './types';

describe('tiptap_reassembler', () => {
    describe('reassembleDocument', () => {
        it('should reassemble simple text change', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Hello wrold'}],
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);
            const aiTexts = ['Hello world'];

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);
            expect(result.chunksProcessed).toBe(1);
            expect(result.doc.content[0].content?.[0].text).toBe('Hello world');
        });

        it('should preserve marks after reassembly', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Normal '},
                            {type: 'text', text: 'boldd', marks: [{type: 'bold'}]},
                            {type: 'text', text: ' text'},
                        ],
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);
            const aiTexts = ['Normal bold text'];

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);
            const content = result.doc.content[0].content;
            expect(content).toBeDefined();

            // Find the bold text
            const boldNode = content?.find((node) =>
                node.marks?.some((m) => m.type === 'bold'),
            );
            expect(boldNode).toBeDefined();
            expect(boldNode?.text).toBe('bold');
        });

        it('should preserve link href', () => {
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
                        ],
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);
            const aiTexts = ['Click here'];

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);
            const linkNode = result.doc.content[0].content?.find((node) =>
                node.marks?.some((m) => m.type === 'link'),
            );
            expect(linkNode?.marks?.[0].attrs?.href).toBe('https://example.com');
        });

        it('should preserve hard breaks', () => {
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

            const {chunks} = extractTextChunks(doc);
            const aiTexts = ['Line one\nLine two'];

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);
            const content = result.doc.content[0].content;
            expect(content?.some((node) => node.type === 'hardBreak')).toBe(true);
        });

        it('should handle multiple paragraphs', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Frist paragraph'}],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Secnd paragraph'}],
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);
            const aiTexts = ['First paragraph', 'Second paragraph'];

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);
            expect(result.chunksProcessed).toBe(2);
            expect(result.doc.content[0].content?.[0].text).toBe('First paragraph');
            expect(result.doc.content[1].content?.[0].text).toBe('Second paragraph');
        });

        it('should preserve code blocks unchanged', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Before'}],
                    },
                    {
                        type: 'codeBlock',
                        content: [{type: 'text', text: 'const x = 1;'}],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'After'}],
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);
            const aiTexts = ['Modified before', 'Modified after'];

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);

            // Verify code block is unchanged
            const codeBlock = result.doc.content[1];
            expect(codeBlock.type).toBe('codeBlock');
            expect(codeBlock.content?.[0].text).toBe('const x = 1;');

            // Verify paragraphs are modified
            expect(result.doc.content[0].content?.[0].text).toBe('Modified before');
            expect(result.doc.content[2].content?.[0].text).toBe('Modified after');
        });

        it('should preserve images unchanged', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Caption'}],
                    },
                    {
                        type: 'image',
                        attrs: {src: '/api/v4/files/abc', alt: 'Test'},
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);
            const aiTexts = ['New caption'];

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);
            expect(result.doc.content[1].type).toBe('image');
            expect(result.doc.content[1].attrs?.src).toBe('/api/v4/files/abc');
        });

        it('should fail gracefully with mismatched chunk count', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'One'}],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Two'}],
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);
            const aiTexts = ['Only one response']; // Should be 2

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(false);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0]).toContain('mismatch');
        });

        it('should handle empty AI response', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Original text'}],
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);
            const aiTexts = [''];

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);
            expect(result.doc.content[0].content).toEqual([]);
        });

        it('should preserve nested list structure', () => {
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
                                        content: [{type: 'text', text: 'Itme 1'}],
                                    },
                                ],
                            },
                            {
                                type: 'listItem',
                                content: [
                                    {
                                        type: 'paragraph',
                                        content: [{type: 'text', text: 'Itme 2'}],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);
            const aiTexts = ['Item 1', 'Item 2'];

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);

            // Structure preserved
            expect(result.doc.content[0].type).toBe('bulletList');
            expect(result.doc.content[0].content?.[0].type).toBe('listItem');

            // Text corrected
            const item1Text = result.doc.content[0].content?.[0].content?.[0].content?.[0].text;
            expect(item1Text).toBe('Item 1');
        });

        it('should handle complex mixed marks', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {
                                type: 'text',
                                text: 'bold and italic',
                                marks: [{type: 'bold'}, {type: 'italic'}],
                            },
                        ],
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);
            const aiTexts = ['bold and italic'];

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);
            const marks = result.doc.content[0].content?.[0].marks;
            expect(marks?.length).toBe(2);
            expect(marks?.some((m) => m.type === 'bold')).toBe(true);
            expect(marks?.some((m) => m.type === 'italic')).toBe(true);
        });
    });

    describe('adjustMarkPositions', () => {
        it('should scale mark positions proportionally', () => {
            const marks = [
                {type: 'bold', from: 0, to: 10},
            ];

            // Original was 20 chars, new is 10 chars (half)
            const result = adjustMarkPositions(marks, 20, 10);

            expect(result[0].from).toBe(0);
            expect(result[0].to).toBe(5);
        });

        it('should handle no length change', () => {
            const marks = [
                {type: 'bold', from: 5, to: 10},
            ];

            const result = adjustMarkPositions(marks, 20, 20);

            expect(result[0].from).toBe(5);
            expect(result[0].to).toBe(10);
        });

        it('should handle empty original', () => {
            const marks = [
                {type: 'bold', from: 0, to: 5},
            ];

            const result = adjustMarkPositions(marks, 0, 10);

            expect(result[0].from).toBe(0);
            expect(result[0].to).toBe(5);
        });
    });

    describe('round-trip extraction and reassembly', () => {
        it('should produce identical document when AI makes no changes', () => {
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
                    {
                        type: 'codeBlock',
                        content: [{type: 'text', text: 'code()'}],
                    },
                    {
                        type: 'heading',
                        attrs: {level: 2, id: 'section'},
                        content: [{type: 'text', text: 'Section'}],
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);
            const aiTexts = chunks.map((c) => c.text); // No changes

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);

            // Verify structure preserved
            expect(result.doc.content).toHaveLength(3);
            expect(result.doc.content[1].type).toBe('codeBlock');
            expect(result.doc.content[1].content?.[0].text).toBe('code()');
            expect(result.doc.content[2].attrs?.level).toBe(2);
        });

        it('should correctly restore URL link after translation with different text length', () => {
            // This is the main test for the translation URL scrambling bug fix.
            // When translating text that contains a URL link, the URL should be
            // preserved exactly and the link mark should cover the entire URL.
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Visit '},
                            {
                                type: 'text',
                                text: 'https://example.com/path/to/page',
                                marks: [{type: 'link', attrs: {href: 'https://example.com/path/to/page'}}],
                            },
                            {type: 'text', text: ' for more information'},
                        ],
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);

            // Verify extraction creates a placeholder
            expect(chunks[0].text).toContain('⟦URL:0⟧');
            expect(chunks[0].protectedUrls?.[0].original).toBe('https://example.com/path/to/page');

            // Simulate AI translation (Spanish): shorter text before URL, different text after
            // The placeholder should be preserved
            const aiTexts = ['Visite ⟦URL:0⟧ para más información'];

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);

            // Find the link node in the result
            const content = result.doc.content[0].content;
            expect(content).toBeDefined();

            const linkNode = content?.find((node) =>
                node.marks?.some((m) => m.type === 'link'),
            );

            // The URL should be fully restored, not scrambled
            expect(linkNode).toBeDefined();
            expect(linkNode?.text).toBe('https://example.com/path/to/page');
            expect(linkNode?.marks?.[0].attrs?.href).toBe('https://example.com/path/to/page');

            // Verify the surrounding text is correctly translated
            const textNodes = content?.filter((node) => node.type === 'text') || [];
            const fullText = textNodes.map((n) => n.text).join('');
            expect(fullText).toBe('Visite https://example.com/path/to/page para más información');
        });

        it('should handle multiple URLs in translation', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [
                            {type: 'text', text: 'Check '},
                            {
                                type: 'text',
                                text: 'https://first.com',
                                marks: [{type: 'link', attrs: {href: 'https://first.com'}}],
                            },
                            {type: 'text', text: ' and '},
                            {
                                type: 'text',
                                text: 'https://second.com',
                                marks: [{type: 'link', attrs: {href: 'https://second.com'}}],
                            },
                        ],
                    },
                ],
            };

            const {chunks} = extractTextChunks(doc);

            // Both URLs should have placeholders
            expect(chunks[0].protectedUrls?.length).toBe(2);

            // Simulate translation preserving placeholders
            const aiTexts = ['Consulte ⟦URL:0⟧ y ⟦URL:1⟧'];

            const result = reassembleDocument(doc, chunks, aiTexts);

            expect(result.success).toBe(true);

            const content = result.doc.content[0].content;
            const linkNodes = content?.filter((node) =>
                node.marks?.some((m) => m.type === 'link'),
            ) || [];

            // Both URLs should be correctly restored
            expect(linkNodes.length).toBe(2);
            expect(linkNodes[0].text).toBe('https://first.com');
            expect(linkNodes[1].text).toBe('https://second.com');
        });
    });
});
