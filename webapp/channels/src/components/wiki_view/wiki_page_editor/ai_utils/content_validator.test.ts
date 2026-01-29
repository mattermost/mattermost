// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    validateDocument,
    validateAIResponse,
    countNodeTypes,
    quickSanityCheck,
} from './content_validator';
import type {TipTapDoc} from './types';

describe('content_validator', () => {
    describe('validateDocument', () => {
        it('should validate identical documents', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Hello'}],
                    },
                ],
            };

            const result = validateDocument(doc, doc);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect added nodes', () => {
            const original: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Hello'}],
                    },
                ],
            };

            const modified: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Hello'}],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'New paragraph'}],
                    },
                ],
            };

            const result = validateDocument(original, modified);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('paragraph'))).toBe(true);
        });

        it('should detect removed nodes', () => {
            const original: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'First'}],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Second'}],
                    },
                ],
            };

            const modified: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'First'}],
                    },
                ],
            };

            const result = validateDocument(original, modified);

            expect(result.valid).toBe(false);
        });

        it('should detect modified code blocks', () => {
            const original: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'codeBlock',
                        content: [{type: 'text', text: 'const x = 1;'}],
                    },
                ],
            };

            const modified: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'codeBlock',
                        content: [{type: 'text', text: 'const x = 2;'}],
                    },
                ],
            };

            const result = validateDocument(original, modified);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('codeBlock'))).toBe(true);
        });

        it('should detect modified images', () => {
            const original: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'image',
                        attrs: {src: '/api/v4/files/abc', alt: 'Original'},
                    },
                ],
            };

            const modified: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'image',
                        attrs: {src: '/api/v4/files/abc', alt: 'Modified'},
                    },
                ],
            };

            const result = validateDocument(original, modified);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('image'))).toBe(true);
        });

        it('should allow text changes in paragraphs', () => {
            const original: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Original text'}],
                    },
                ],
            };

            const modified: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Modified text'}],
                    },
                ],
            };

            const result = validateDocument(original, modified);

            // Node counts should match (1 paragraph, 1 text in each)
            expect(result.valid).toBe(true);
        });

        it('should detect new node types', () => {
            const original: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Hello'}],
                    },
                ],
            };

            const modified: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Hello'}],
                    },
                    {
                        type: 'codeBlock',
                        content: [{type: 'text', text: 'new code'}],
                    },
                ],
            };

            const result = validateDocument(original, modified);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('codeBlock'))).toBe(true);
        });
    });

    describe('validateAIResponse', () => {
        it('should accept minor changes', () => {
            const original = 'Hello wrold. How are you?';
            const ai = 'Hello world. How are you?';

            const result = validateAIResponse(original, ai);

            expect(result.valid).toBe(true);
        });

        it('should reject dramatic sentence count changes', () => {
            const original = 'One sentence.';
            const ai = 'First. Second. Third. Fourth. Fifth.';

            const result = validateAIResponse(original, ai);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Sentence count');
        });

        it('should reject added code blocks', () => {
            const original = 'Some text without code';
            const ai = 'Some text with ```code```';

            const result = validateAIResponse(original, ai);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('code block');
        });

        it('should reject dramatic length changes', () => {
            const original = 'Short';
            const ai = 'A'.repeat(100);

            const result = validateAIResponse(original, ai);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('length changed');
        });

        it('should allow code blocks if original had them', () => {
            const original = 'Text with ```code```';
            const ai = 'Text with ```corrected code```';

            const result = validateAIResponse(original, ai);

            expect(result.valid).toBe(true);
        });

        it('should handle empty strings', () => {
            const result = validateAIResponse('', '');

            expect(result.valid).toBe(true);
        });
    });

    describe('countNodeTypes', () => {
        it('should count all node types', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'First'}],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Second'}],
                    },
                    {
                        type: 'heading',
                        attrs: {level: 1},
                        content: [{type: 'text', text: 'Title'}],
                    },
                ],
            };

            const counts = countNodeTypes(doc);

            expect(counts.doc).toBe(1);
            expect(counts.paragraph).toBe(2);
            expect(counts.heading).toBe(1);
            expect(counts.text).toBe(3);
        });

        it('should count nested nodes', () => {
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
                                        content: [{type: 'text', text: 'Item'}],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const counts = countNodeTypes(doc);

            expect(counts.bulletList).toBe(1);
            expect(counts.listItem).toBe(1);
            expect(counts.paragraph).toBe(1);
        });
    });

    describe('quickSanityCheck', () => {
        it('should pass valid document', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Hello'}],
                    },
                ],
            };

            const result = quickSanityCheck(doc);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect non-doc root', () => {
            const doc = {
                type: 'paragraph',
                content: [{type: 'text', text: 'Hello'}],
            } as unknown as TipTapDoc;

            const result = quickSanityCheck(doc);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('doc'))).toBe(true);
        });

        it('should detect missing content array', () => {
            const doc = {
                type: 'doc',
            } as TipTapDoc;

            const result = quickSanityCheck(doc);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('content'))).toBe(true);
        });

        it('should detect text node without text', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text'}], // Missing text property
                    },
                ],
            };

            const result = quickSanityCheck(doc);

            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.includes('text'))).toBe(true);
        });

        it('should handle empty document', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [],
            };

            const result = quickSanityCheck(doc);

            expect(result.valid).toBe(true);
        });
    });
});
