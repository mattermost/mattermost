// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react';

import {Client4} from 'mattermost-redux/client';

import * as PageActions from 'actions/pages';

import useImageAI, {extractFileIdFromSrc} from './use_image_ai';

// Mock dependencies
jest.mock('react-redux', () => ({
    useDispatch: () => jest.fn((action) => {
        if (typeof action === 'function') {
            return action(jest.fn(), () => ({}), undefined);
        }
        return action;
    }),
}));

jest.mock('react-intl', () => ({
    useIntl: () => ({
        formatMessage: ({defaultMessage}: {defaultMessage: string}) => defaultMessage,
    }),
    defineMessages: (messages: Record<string, unknown>) => messages,
    defineMessage: (message: Record<string, unknown>) => message,
}));

jest.mock('actions/pages');

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        extractImageText: jest.fn(),
    },
}));

const mockCreatePage = PageActions.createPage as jest.MockedFunction<typeof PageActions.createPage>;
const mockPublishPageDraft = PageActions.publishPageDraft as jest.MockedFunction<typeof PageActions.publishPageDraft>;
const mockExtractImageText = Client4.extractImageText as jest.MockedFunction<typeof Client4.extractImageText>;

describe('useImageAI', () => {
    const defaultProps = {
        wikiId: 'wiki-123',
        currentPageId: 'page-123',
        currentPageTitle: 'Test Page',
        agentId: 'agent-123',
    };

    const createMockImageElement = (src = '/api/v4/files/file123') => {
        const img = document.createElement('img');
        img.setAttribute('src', src);
        return img;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockCreatePage.mockReturnValue(() => Promise.resolve({data: 'draft-123'}) as any);
        mockPublishPageDraft.mockReturnValue(() => Promise.resolve({data: {id: 'published-page-123'}}) as any);
        mockExtractImageText.mockResolvedValue('Extracted text from image');
    });

    describe('extractFileIdFromSrc', () => {
        test('should extract file ID from standard file URL', () => {
            expect(extractFileIdFromSrc('/api/v4/files/abc123')).toBe('abc123');
        });

        test('should extract file ID from preview URL', () => {
            expect(extractFileIdFromSrc('/api/v4/files/abc123/preview')).toBe('abc123');
        });

        test('should extract file ID from thumbnail URL', () => {
            expect(extractFileIdFromSrc('/api/v4/files/abc123/thumbnail')).toBe('abc123');
        });

        test('should return null for non-Mattermost URLs', () => {
            expect(extractFileIdFromSrc('https://example.com/image.png')).toBeNull();
        });

        test('should return null for empty string', () => {
            expect(extractFileIdFromSrc('')).toBeNull();
        });

        test('should return null for data URLs', () => {
            expect(extractFileIdFromSrc('data:image/png;base64,abc123')).toBeNull();
        });
    });

    describe('initial state', () => {
        test('should return initial state', () => {
            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
            ));

            expect(result.current.showExtractionDialog).toBe(false);
            expect(result.current.showCompletionDialog).toBe(false);
            expect(result.current.actionType).toBeNull();
            expect(result.current.isProcessing).toBe(false);
            expect(result.current.progress).toBe('');
            expect(result.current.createdPageId).toBeNull();
            expect(result.current.createdPageTitle).toBe('');
        });
    });

    describe('handleImageAIAction', () => {
        test('should not process when wikiId is empty', async () => {
            const {result} = renderHook(() => useImageAI(
                '',
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
            ));

            const mockImage = createMockImageElement();

            await act(async () => {
                await result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.showExtractionDialog).toBe(false);
            expect(mockCreatePage).not.toHaveBeenCalled();
        });

        test('should not process when image has no src', async () => {
            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
            ));

            const mockImage = document.createElement('img');

            await act(async () => {
                await result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.showExtractionDialog).toBe(false);
        });

        test('should not process when image is not a Mattermost file', async () => {
            const mockSetServerError = jest.fn();
            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
                undefined,
                mockSetServerError,
            ));

            const mockImage = createMockImageElement('https://example.com/image.png');

            await act(async () => {
                await result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.showExtractionDialog).toBe(false);
            expect(mockSetServerError).toHaveBeenCalledWith(
                expect.objectContaining({
                    server_error_id: 'image_ai_not_mattermost_file',
                }),
            );
        });

        test('should not process when no agentId is provided', async () => {
            const mockSetServerError = jest.fn();
            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                null,
                true,
                undefined,
                mockSetServerError,
            ));

            const mockImage = createMockImageElement();

            await act(async () => {
                await result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.showExtractionDialog).toBe(false);
            expect(mockSetServerError).toHaveBeenCalledWith(
                expect.objectContaining({
                    server_error_id: 'image_ai_no_agent',
                }),
            );
        });

        test('should show extraction dialog and set processing state when action starts', async () => {
            jest.useFakeTimers();

            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
            ));

            const mockImage = createMockImageElement();

            act(() => {
                result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.showExtractionDialog).toBe(true);
            expect(result.current.isProcessing).toBe(true);
            expect(result.current.actionType).toBe('extract_handwriting');
            expect(result.current.progress).not.toBe('');

            jest.useRealTimers();
        });

        test('should set actionType for describe_image', async () => {
            jest.useFakeTimers();

            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
            ));

            const mockImage = createMockImageElement();

            act(() => {
                result.current.handleImageAIAction('describe_image', mockImage);
            });

            expect(result.current.actionType).toBe('describe_image');
            expect(result.current.isProcessing).toBe(true);

            jest.useRealTimers();
        });

        test('should call extractImageText API with correct parameters', async () => {
            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
            ));

            const mockImage = createMockImageElement('/api/v4/files/testfile123');

            await act(async () => {
                await result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(mockExtractImageText).toHaveBeenCalledWith(
                defaultProps.agentId,
                'testfile123',
                'extract_handwriting',
            );
        });

        test('should complete extraction and show completion dialog', async () => {
            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
            ));

            const mockImage = createMockImageElement();

            await act(async () => {
                await result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.showExtractionDialog).toBe(false);
            expect(result.current.showCompletionDialog).toBe(true);
            expect(result.current.isProcessing).toBe(false);
            expect(result.current.createdPageId).toBe('published-page-123');
            expect(result.current.createdPageTitle).toContain('Handwriting');
        });

        test('should handle API extraction errors', async () => {
            const mockSetServerError = jest.fn();
            mockExtractImageText.mockRejectedValue(new Error('API extraction failed'));

            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
                undefined,
                mockSetServerError,
            ));

            const mockImage = createMockImageElement();

            await act(async () => {
                await result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.showExtractionDialog).toBe(false);
            expect(result.current.showCompletionDialog).toBe(false);
            expect(result.current.isProcessing).toBe(false);
            expect(mockSetServerError).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'API extraction failed',
                }),
            );
        });

        test('should handle page creation errors', async () => {
            const mockSetServerError = jest.fn();
            const error = new Error('Failed to create page');

            mockCreatePage.mockReturnValue(() => Promise.resolve({error}) as any);

            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
                undefined,
                mockSetServerError,
            ));

            const mockImage = createMockImageElement();

            await act(async () => {
                await result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.showExtractionDialog).toBe(false);
            expect(result.current.showCompletionDialog).toBe(false);
            expect(result.current.isProcessing).toBe(false);
            expect(mockSetServerError).toHaveBeenCalled();
        });

        test('should not start new action while processing', async () => {
            jest.useFakeTimers();

            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
            ));

            const mockImage = createMockImageElement();

            act(() => {
                result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.isProcessing).toBe(true);
            expect(result.current.actionType).toBe('extract_handwriting');

            act(() => {
                result.current.handleImageAIAction('describe_image', mockImage);
            });

            expect(result.current.actionType).toBe('extract_handwriting');

            jest.useRealTimers();
        });
    });

    describe('cancelExtraction', () => {
        test('should close extraction dialog and reset processing state', async () => {
            jest.useFakeTimers();

            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
            ));

            const mockImage = createMockImageElement();

            act(() => {
                result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.showExtractionDialog).toBe(true);
            expect(result.current.isProcessing).toBe(true);

            act(() => {
                result.current.cancelExtraction();
            });

            expect(result.current.showExtractionDialog).toBe(false);
            expect(result.current.isProcessing).toBe(false);
            expect(result.current.progress).toBe('');

            jest.useRealTimers();
        });
    });

    describe('goToCreatedPage', () => {
        test('should call onPageCreated callback', async () => {
            const mockOnPageCreated = jest.fn();

            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
                mockOnPageCreated,
            ));

            const mockImage = createMockImageElement();

            await act(async () => {
                await result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.createdPageId).toBe('published-page-123');

            act(() => {
                result.current.goToCreatedPage();
            });

            expect(mockOnPageCreated).toHaveBeenCalledWith('published-page-123');
            expect(result.current.showCompletionDialog).toBe(false);
            expect(result.current.createdPageId).toBeNull();
        });
    });

    describe('stayOnCurrentPage', () => {
        test('should close completion dialog without navigation', async () => {
            const mockOnPageCreated = jest.fn();

            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
                mockOnPageCreated,
            ));

            const mockImage = createMockImageElement();

            await act(async () => {
                await result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.showCompletionDialog).toBe(true);

            act(() => {
                result.current.stayOnCurrentPage();
            });

            expect(mockOnPageCreated).not.toHaveBeenCalled();
            expect(result.current.showCompletionDialog).toBe(false);
            expect(result.current.createdPageId).toBeNull();
            expect(result.current.actionType).toBeNull();
        });
    });

    describe('page title generation', () => {
        test('should generate title with page name for handwriting', async () => {
            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
            ));

            const mockImage = createMockImageElement();

            await act(async () => {
                await result.current.handleImageAIAction('extract_handwriting', mockImage);
            });

            expect(result.current.createdPageTitle).toContain('Handwriting');
            expect(result.current.createdPageTitle).toContain('Test Page');
        });

        test('should generate title with page name for describe_image', async () => {
            const {result} = renderHook(() => useImageAI(
                defaultProps.wikiId,
                defaultProps.currentPageId,
                defaultProps.currentPageTitle,
                defaultProps.agentId,
                true,
            ));

            const mockImage = createMockImageElement();

            await act(async () => {
                await result.current.handleImageAIAction('describe_image', mockImage);
            });

            expect(result.current.createdPageTitle).toContain('Description');
            expect(result.current.createdPageTitle).toContain('Test Page');
        });
    });
});
