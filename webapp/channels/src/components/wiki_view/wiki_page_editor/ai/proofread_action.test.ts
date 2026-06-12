// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

import {RewriteAction} from 'components/advanced_text_editor/rewrite_action';

import {proofreadDocument, previewProofread} from './proofread_action';

import type {TipTapDoc} from '../ai_utils';

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getAIRewrittenMessage: jest.fn(),
    },
}));

describe('proofread_action', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('proofreadDocument', () => {
        it('should proofread a simple document', async () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Hello wrold'}],
                    },
                ],
            };

            (Client4.getAIRewrittenMessage as jest.Mock).mockResolvedValue('Hello world');

            const result = await proofreadDocument(doc, 'agent-123');

            expect(result.success).toBe(true);
            expect(result.chunksProcessed).toBe(1);
            expect(result.doc.content[0].content?.[0].text).toBe('Hello world');
            expect(Client4.getAIRewrittenMessage).toHaveBeenCalledWith(
                'agent-123',
                'Hello wrold',
                RewriteAction.FIX_SPELLING,
            );
        });

        it('should proofread multiple paragraphs', async () => {
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

            (Client4.getAIRewrittenMessage as jest.Mock).
                mockResolvedValueOnce('First paragraph').
                mockResolvedValueOnce('Second paragraph');

            const result = await proofreadDocument(doc, 'agent-123');

            expect(result.success).toBe(true);
            expect(result.chunksProcessed).toBe(2);
            expect(result.doc.content[0].content?.[0].text).toBe('First paragraph');
            expect(result.doc.content[1].content?.[0].text).toBe('Second paragraph');
        });

        it('should preserve code blocks unchanged', async () => {
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

            (Client4.getAIRewrittenMessage as jest.Mock).
                mockResolvedValueOnce('Before corrected').
                mockResolvedValueOnce('After corrected');

            const result = await proofreadDocument(doc, 'agent-123');

            expect(result.success).toBe(true);
            expect(result.doc.content[1].type).toBe('codeBlock');
            expect(result.doc.content[1].content?.[0].text).toBe('const x = 1;');
            expect(result.doc.content[0].content?.[0].text).toBe('Before corrected');
            expect(result.doc.content[2].content?.[0].text).toBe('After corrected');
        });

        it('should preserve images unchanged', async () => {
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

            (Client4.getAIRewrittenMessage as jest.Mock).mockResolvedValue('Caption corrected');

            const result = await proofreadDocument(doc, 'agent-123');

            expect(result.success).toBe(true);
            expect(result.doc.content[1].type).toBe('image');
            expect(result.doc.content[1].attrs?.src).toBe('/api/v4/files/abc');
        });

        it('should handle empty document', async () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [],
            };

            const result = await proofreadDocument(doc, 'agent-123');

            expect(result.success).toBe(true);
            expect(result.chunksProcessed).toBe(0);
            expect(result.warnings).toContain('No text content found to proofread');
            expect(Client4.getAIRewrittenMessage).not.toHaveBeenCalled();
        });

        it('should handle AI errors gracefully', async () => {
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
                ],
            };

            (Client4.getAIRewrittenMessage as jest.Mock).
                mockResolvedValueOnce('First corrected').
                mockRejectedValueOnce(new Error('AI service unavailable'));

            const result = await proofreadDocument(doc, 'agent-123');

            expect(result.success).toBe(true);
            expect(result.doc.content[0].content?.[0].text).toBe('First corrected');
            expect(result.doc.content[1].content?.[0].text).toBe('Second');
            expect(result.warnings.some((w) => w.includes('AI service unavailable'))).toBe(true);
        });

        it('should report progress', async () => {
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
                ],
            };

            (Client4.getAIRewrittenMessage as jest.Mock).mockResolvedValue('corrected');

            const progressUpdates: Array<{current: number; total: number; status: string}> = [];
            const onProgress = jest.fn((p) => progressUpdates.push(p));

            await proofreadDocument(doc, 'agent-123', onProgress);

            expect(onProgress).toHaveBeenCalled();
            expect(progressUpdates.some((p) => p.status === 'extracting')).toBe(true);
            expect(progressUpdates.some((p) => p.status === 'processing')).toBe(true);
            expect(progressUpdates.some((p) => p.status === 'complete')).toBe(true);
        });

        it('should preserve marks after proofreading', async () => {
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

            (Client4.getAIRewrittenMessage as jest.Mock).mockResolvedValue('Normal bold text');

            const result = await proofreadDocument(doc, 'agent-123');

            expect(result.success).toBe(true);
            const content = result.doc.content[0].content;
            const boldNode = content?.find((node) =>
                node.marks?.some((m) => m.type === 'bold'),
            );
            expect(boldNode).toBeDefined();
        });
    });

    describe('previewProofread', () => {
        it('should return text chunk count', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Hello'}],
                    },
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'World'}],
                    },
                ],
            };

            const preview = previewProofread(doc);

            expect(preview.textChunkCount).toBe(2);
            expect(preview.totalCharacters).toBe(10);
        });

        it('should report skipped node types', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Text'}],
                    },
                    {
                        type: 'codeBlock',
                        content: [{type: 'text', text: 'code'}],
                    },
                    {
                        type: 'image',
                        attrs: {src: '/test.png'},
                    },
                ],
            };

            const preview = previewProofread(doc);

            expect(preview.skippedNodeTypes).toContain('codeBlock');
            expect(preview.skippedNodeTypes).toContain('image');
            expect(preview.skippedNodeCount).toBe(2);
        });

        it('should handle empty document', () => {
            const doc: TipTapDoc = {
                type: 'doc',
                content: [],
            };

            const preview = previewProofread(doc);

            expect(preview.textChunkCount).toBe(0);
            expect(preview.totalCharacters).toBe(0);
        });
    });
});
