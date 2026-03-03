// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react';
import type {Editor} from '@tiptap/react';

import * as ProofreadAction from './proofread_action';
import usePageProofread from './use_page_proofread';

// Mock dependencies
const mockDispatch = jest.fn((action: unknown): unknown => {
    if (typeof action === 'function') {
        return (action as (dispatch: typeof mockDispatch) => unknown)(mockDispatch);
    }
    return action;
});

jest.mock('react-redux', () => ({
    useDispatch: () => mockDispatch,
    useSelector: jest.fn(() => [{id: 'agent-1', name: 'Test Agent'}]),
}));

jest.mock('react-intl', () => ({
    useIntl: () => ({
        formatMessage: ({defaultMessage}: {defaultMessage: string}, values?: Record<string, string>) => {
            if (values?.title) {
                return defaultMessage.replace('{title}', values.title);
            }
            return defaultMessage;
        },
    }),
}));

jest.mock('mattermost-redux/actions/agents', () => ({
    getAgents: jest.fn(() => ({type: 'GET_AGENTS'})),
}));

jest.mock('actions/pages', () => ({
    createPage: jest.fn(() => () =>
        Promise.resolve({data: 'draft-123'}),
    ),
}));

jest.mock('actions/page_drafts', () => ({
    savePageDraft: jest.fn(() => () =>
        Promise.resolve({data: true}),
    ),
}));

jest.mock('selectors/pages', () => ({
    getWiki: jest.fn(() => ({id: 'wiki-123', channel_id: 'channel-123'})),
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

    const defaultProps = {
        editor: null as Editor | null,
        pageTitle: 'Test Page',
        wikiId: 'wiki-123',
        pageId: 'page-123',
        onPageCreated: jest.fn(),
        setServerError: jest.fn(),
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
            const {result} = renderHook(() => usePageProofread(
                mockEditor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
                defaultProps.onPageCreated,
            ));

            expect(result.current.isProcessing).toBe(false);
            expect(result.current.progress).toBeNull();
            expect(result.current.error).toBeNull();
        });
    });

    describe('proofread', () => {
        test('should not proofread when editor is null', async () => {
            const {result} = renderHook(() => usePageProofread(
                null,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

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
            const {result} = renderHook(() => usePageProofread(
                mockEditor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

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

            const {result} = renderHook(() => usePageProofread(
                mockEditor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

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

        test('should create draft page on success', async () => {
            const mockEditor = createMockEditor();
            const mockOnPageCreated = jest.fn();
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

            const {result} = renderHook(() => usePageProofread(
                mockEditor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
                mockOnPageCreated,
            ));

            await act(async () => {
                await result.current.proofread();
            });

            // Should have called onPageCreated with draft ID (not published page ID)
            expect(mockOnPageCreated).toHaveBeenCalledWith('draft-123');
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

            const {result} = renderHook(() => usePageProofread(
                mockEditor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
                undefined,
                mockSetServerError,
            ));

            await act(async () => {
                await result.current.proofread();
            });

            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toContain('API error');
            expect(mockSetServerError).toHaveBeenCalled();
        });

        test('should track progress', async () => {
            const mockEditor = createMockEditor();

            mockProofreadDocumentImmutable.mockImplementation(async (doc, agentId, onProgress) => {
                onProgress?.({current: 0, total: 2, status: 'processing'});
                onProgress?.({current: 1, total: 2, status: 'processing'});
                return {
                    success: true,
                    doc: mockDoc,
                    totalChunks: 2,
                    chunksProcessed: 2,
                    errors: [],
                    warnings: [],
                };
            });

            const {result} = renderHook(() => usePageProofread(
                mockEditor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

            await act(async () => {
                await result.current.proofread();
            });

            expect(result.current.progress?.status).toBe('complete');
        });

        test('should handle thrown exceptions', async () => {
            const mockEditor = createMockEditor();
            const mockSetServerError = jest.fn();

            mockProofreadDocumentImmutable.mockRejectedValue(new Error('Network error'));

            const {result} = renderHook(() => usePageProofread(
                mockEditor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
                undefined,
                mockSetServerError,
            ));

            await act(async () => {
                await result.current.proofread();
            });

            expect(result.current.error?.message).toBe('Network error');
            expect(mockSetServerError).toHaveBeenCalled();
            expect(result.current.isProcessing).toBe(false);
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

            const {result} = renderHook(() => usePageProofread(
                mockEditor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

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
