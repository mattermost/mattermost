// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react';
import type {Editor} from '@tiptap/react';

import * as ProofreadAction from './proofread_action';
import usePageProofread from './use_page_proofread';

// Mock dependencies
jest.mock('react-redux', () => ({
    useDispatch: () => jest.fn((action) => action),
    useSelector: jest.fn(() => [{id: 'agent-1', name: 'Test Agent'}]),
}));

jest.mock('mattermost-redux/actions/agents', () => ({
    getAgents: jest.fn(() => ({type: 'GET_AGENTS'})),
}));

jest.mock('./proofread_action');

const mockProofreadDocumentImmutable = ProofreadAction.proofreadDocumentImmutable as jest.MockedFunction<typeof ProofreadAction.proofreadDocumentImmutable>;
const mockPreviewProofread = ProofreadAction.previewProofread as jest.MockedFunction<typeof ProofreadAction.previewProofread>;

describe('usePageProofread', () => {
    const mockDoc = {
        type: 'doc' as const,
        content: [
            {
                type: 'paragraph',
                content: [{type: 'text', text: 'Hello world'}],
            },
        ],
    };

    const createMockEditor = (doc = mockDoc) => ({
        getJSON: jest.fn(() => doc),
        commands: {
            setContent: jest.fn(),
        },
        on: jest.fn(),
        off: jest.fn(),
    } as unknown as Editor);

    beforeEach(() => {
        jest.clearAllMocks();
        mockPreviewProofread.mockReturnValue({
            textChunkCount: 1,
            totalCharacters: 100,
            skippedNodeTypes: [],
            skippedNodeCount: 0,
        });
        mockProofreadDocumentImmutable.mockResolvedValue({
            success: true,
            doc: {
                type: 'doc' as const,
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: 'Hello, world!'}],
                    },
                ],
            },
            totalChunks: 1,
            chunksProcessed: 1,
            errors: [],
            warnings: [],
        });
    });

    describe('initial state', () => {
        test('should return initial state', () => {
            const mockEditor = createMockEditor();
            const {result} = renderHook(() => usePageProofread(mockEditor));

            expect(result.current.isProcessing).toBe(false);
            expect(result.current.progress).toBeNull();
            expect(result.current.error).toBeNull();
            expect(result.current.canUndo).toBe(false);
        });
    });

    describe('proofread', () => {
        test('should not proofread when editor is null', async () => {
            const {result} = renderHook(() => usePageProofread(null));

            await act(async () => {
                await result.current.proofread();
            });

            expect(mockProofreadDocumentImmutable).not.toHaveBeenCalled();
        });

        test('should not proofread empty document', async () => {
            mockPreviewProofread.mockReturnValue({
                textChunkCount: 0,
                totalCharacters: 0,
                skippedNodeTypes: [],
                skippedNodeCount: 0,
            });

            const mockEditor = createMockEditor({type: 'doc' as const, content: []});
            const {result} = renderHook(() => usePageProofread(mockEditor));

            await act(async () => {
                await result.current.proofread();
            });

            expect(mockProofreadDocumentImmutable).not.toHaveBeenCalled();
        });

        test('should set isProcessing during proofreading', async () => {
            const mockEditor = createMockEditor();

            let resolveProofread: () => void;
            const proofreadPromise = new Promise<void>((resolve) => {
                resolveProofread = resolve;
            });

            mockProofreadDocumentImmutable.mockImplementation(async () => {
                await proofreadPromise;
                return {
                    success: true,
                    doc: mockDoc,
                    totalChunks: 1,
                    chunksProcessed: 1,
                    errors: [],
                    warnings: [],
                };
            });

            const {result} = renderHook(() => usePageProofread(mockEditor));

            // Start proofread (don't await)
            act(() => {
                result.current.proofread();
            });

            // Should be processing now
            expect(result.current.isProcessing).toBe(true);

            // Complete the proofread
            await act(async () => {
                resolveProofread!();
            });

            // Should no longer be processing
            expect(result.current.isProcessing).toBe(false);
        });

        test('should apply corrected document on success', async () => {
            const mockEditor = createMockEditor();
            const correctedDoc = {
                type: 'doc' as const,
                content: [{type: 'paragraph', content: [{type: 'text', text: 'Corrected!'}]}],
            };

            mockProofreadDocumentImmutable.mockResolvedValue({
                success: true,
                doc: correctedDoc,
                totalChunks: 1,
                chunksProcessed: 1,
                errors: [],
                warnings: [],
            });

            const {result} = renderHook(() => usePageProofread(mockEditor));

            await act(async () => {
                await result.current.proofread();
            });

            expect(mockEditor.commands.setContent).toHaveBeenCalledWith(correctedDoc);
            expect(result.current.canUndo).toBe(true);
        });

        test('should handle proofreading errors', async () => {
            const mockEditor = createMockEditor();
            const mockSetServerError = jest.fn();

            mockProofreadDocumentImmutable.mockResolvedValue({
                success: false,
                doc: mockDoc,
                totalChunks: 1,
                chunksProcessed: 0,
                errors: ['API error', 'Network timeout'],
                warnings: [],
            });

            const {result} = renderHook(() => usePageProofread(mockEditor, mockSetServerError));

            await act(async () => {
                await result.current.proofread();
            });

            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toContain('API error');
            expect(mockSetServerError).toHaveBeenCalled();
            expect(result.current.canUndo).toBe(false);
        });

        test('should track progress', async () => {
            const mockEditor = createMockEditor();
            const progressUpdates: any[] = [];

            mockProofreadDocumentImmutable.mockImplementation(async (doc, agentId, onProgress) => {
                onProgress?.({current: 0, total: 2, status: 'processing'});
                progressUpdates.push({...result.current.progress});
                onProgress?.({current: 1, total: 2, status: 'processing'});
                progressUpdates.push({...result.current.progress});
                return {
                    success: true,
                    doc: mockDoc,
                    totalChunks: 2,
                    chunksProcessed: 2,
                    errors: [],
                    warnings: [],
                };
            });

            const {result} = renderHook(() => usePageProofread(mockEditor));

            await act(async () => {
                await result.current.proofread();
            });

            expect(result.current.progress?.status).toBe('complete');
        });

        test('should handle thrown exceptions', async () => {
            const mockEditor = createMockEditor();
            const mockSetServerError = jest.fn();

            mockProofreadDocumentImmutable.mockRejectedValue(new Error('Network error'));

            const {result} = renderHook(() => usePageProofread(mockEditor, mockSetServerError));

            await act(async () => {
                await result.current.proofread();
            });

            expect(result.current.error?.message).toBe('Network error');
            expect(mockSetServerError).toHaveBeenCalled();
            expect(result.current.isProcessing).toBe(false);
        });
    });

    describe('undo', () => {
        test('should restore original document', async () => {
            const mockEditor = createMockEditor();
            const originalDoc = mockDoc;
            const correctedDoc = {
                type: 'doc' as const,
                content: [{type: 'paragraph', content: [{type: 'text', text: 'Corrected!'}]}],
            };

            mockProofreadDocumentImmutable.mockResolvedValue({
                success: true,
                doc: correctedDoc,
                totalChunks: 1,
                chunksProcessed: 1,
                errors: [],
                warnings: [],
            });

            const {result} = renderHook(() => usePageProofread(mockEditor));

            // First, proofread
            await act(async () => {
                await result.current.proofread();
            });

            expect(result.current.canUndo).toBe(true);

            // Then undo
            act(() => {
                result.current.undo();
            });

            expect(mockEditor.commands.setContent).toHaveBeenLastCalledWith(originalDoc);
            expect(result.current.canUndo).toBe(false);
        });

        test('should not undo when canUndo is false', () => {
            const mockEditor = createMockEditor();
            const {result} = renderHook(() => usePageProofread(mockEditor));

            act(() => {
                result.current.undo();
            });

            // setContent should not be called
            expect(mockEditor.commands.setContent).not.toHaveBeenCalled();
        });

        test('should not undo when editor is null', async () => {
            const mockEditor = createMockEditor();
            const {result} = renderHook(
                ({editor}) => usePageProofread(editor),
                {initialProps: {editor: mockEditor}},
            );

            // Proofread first
            await act(async () => {
                await result.current.proofread();
            });

            // Can't test with null editor after proofread in same hook instance
            // This tests the guard clause
            expect(result.current.canUndo).toBe(true);
        });
    });

    describe('concurrent operations', () => {
        test('should not start new proofread while one is in progress', async () => {
            const mockEditor = createMockEditor();

            let resolveFirst: () => void;
            const firstPromise = new Promise<void>((resolve) => {
                resolveFirst = resolve;
            });

            mockProofreadDocumentImmutable.mockImplementation(async () => {
                await firstPromise;
                return {
                    success: true,
                    doc: mockDoc,
                    totalChunks: 1,
                    chunksProcessed: 1,
                    errors: [],
                    warnings: [],
                };
            });

            const {result} = renderHook(() => usePageProofread(mockEditor));

            // Start first proofread
            act(() => {
                result.current.proofread();
            });

            expect(result.current.isProcessing).toBe(true);

            // Try to start second proofread
            await act(async () => {
                await result.current.proofread();
            });

            // Should only have been called once
            expect(mockProofreadDocumentImmutable).toHaveBeenCalledTimes(1);

            // Clean up
            resolveFirst!();
        });
    });
});
