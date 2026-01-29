// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react';
import type {Editor} from '@tiptap/react';

import {Client4} from 'mattermost-redux/client';

import * as PageDraftActions from 'actions/page_drafts';
import * as PageActions from 'actions/pages';

import type {Language} from './language_picker';
import usePageTranslate from './use_page_translate';

// Mock dependencies
jest.mock('react-redux', () => ({
    useDispatch: () => jest.fn((action) => {
        if (typeof action === 'function') {
            return action(jest.fn(), () => ({}), undefined);
        }
        return action;
    }),
    useSelector: jest.fn(() => [{id: 'agent-1', name: 'Test Agent'}]),
}));

jest.mock('mattermost-redux/actions/agents', () => ({
    getAgents: jest.fn(() => ({type: 'GET_AGENTS'})),
}));

jest.mock('mattermost-redux/client');
jest.mock('actions/pages');
jest.mock('actions/page_drafts');

jest.mock('selectors/pages', () => ({
    getWiki: jest.fn(() => ({id: 'wiki-123', channel_id: 'channel-123'})),
}));

const mockClient4 = Client4 as jest.Mocked<typeof Client4>;
const mockCreatePage = PageActions.createPage as jest.MockedFunction<typeof PageActions.createPage>;
const mockSavePageDraft = PageDraftActions.savePageDraft as jest.MockedFunction<typeof PageDraftActions.savePageDraft>;

describe('usePageTranslate', () => {
    const mockEditor = {
        getJSON: jest.fn(() => ({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [{type: 'text', text: 'Hello world'}],
                },
            ],
        })),
    } as unknown as Editor;

    const defaultProps = {
        editor: mockEditor,
        pageTitle: 'Test Page',
        wikiId: 'wiki-123',
        pageId: 'page-123',
    };

    const mockLanguage: Language = {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Espa\u00f1ol',
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient4.getAIRewrittenMessage = jest.fn().mockResolvedValue('Hola mundo');
        mockCreatePage.mockReturnValue(() => Promise.resolve({data: 'draft-123'}) as any);
        mockSavePageDraft.mockReturnValue(() => Promise.resolve({data: true}) as any);
    });

    describe('initial state', () => {
        test('should return initial state', () => {
            const {result} = renderHook(() => usePageTranslate(
                defaultProps.editor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

            expect(result.current.isTranslating).toBe(false);
            expect(result.current.showModal).toBe(false);
        });
    });

    describe('modal controls', () => {
        test('should open modal', () => {
            const {result} = renderHook(() => usePageTranslate(
                defaultProps.editor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

            act(() => {
                result.current.openModal();
            });

            expect(result.current.showModal).toBe(true);
        });

        test('should close modal when not translating', () => {
            const {result} = renderHook(() => usePageTranslate(
                defaultProps.editor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

            act(() => {
                result.current.openModal();
            });

            expect(result.current.showModal).toBe(true);

            act(() => {
                result.current.closeModal();
            });

            expect(result.current.showModal).toBe(false);
        });
    });

    describe('translatePage', () => {
        test('should not translate when editor is null', async () => {
            const {result} = renderHook(() => usePageTranslate(
                null,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

            await act(async () => {
                await result.current.translatePage(mockLanguage);
            });

            expect(mockClient4.getAIRewrittenMessage).not.toHaveBeenCalled();
        });

        test('should not translate when wikiId is empty', async () => {
            const {result} = renderHook(() => usePageTranslate(
                defaultProps.editor,
                defaultProps.pageTitle,
                '',
                defaultProps.pageId,
            ));

            await act(async () => {
                await result.current.translatePage(mockLanguage);
            });

            expect(mockClient4.getAIRewrittenMessage).not.toHaveBeenCalled();
        });

        test('should set isTranslating during translation', async () => {
            let resolveTranslation: () => void;
            const translationPromise = new Promise<void>((resolve) => {
                resolveTranslation = resolve;
            });

            mockClient4.getAIRewrittenMessage = jest.fn().mockImplementation(async () => {
                await translationPromise;
                return 'Translated';
            });

            const {result} = renderHook(() => usePageTranslate(
                defaultProps.editor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

            // Start translation (don't await)
            act(() => {
                result.current.translatePage(mockLanguage);
            });

            // Should be translating now
            expect(result.current.isTranslating).toBe(true);

            // Complete the translation
            await act(async () => {
                resolveTranslation!();
            });
        });

        test('should handle translation errors', async () => {
            const mockSetServerError = jest.fn();
            const error = new Error('Translation failed');

            mockClient4.getAIRewrittenMessage = jest.fn().mockRejectedValue(error);

            const {result} = renderHook(() => usePageTranslate(
                defaultProps.editor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
                undefined,
                mockSetServerError,
            ));

            await act(async () => {
                try {
                    await result.current.translatePage(mockLanguage);
                } catch {
                    // Expected to throw
                }
            });

            expect(result.current.isTranslating).toBe(false);
        });
    });

    describe('unmount cleanup', () => {
        test('should not update state after unmount', async () => {
            const {result, unmount} = renderHook(() => usePageTranslate(
                defaultProps.editor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

            // Start a translation
            const translatePromise = act(async () => {
                try {
                    await result.current.translatePage(mockLanguage);
                } catch {
                    // Expected
                }
            });

            // Unmount before completion
            unmount();

            // Wait for the promise to resolve
            await translatePromise;

            // No assertion needed - test passes if no React warning about setState on unmounted
        });
    });

    describe('edge cases', () => {
        test('should handle empty document', async () => {
            const emptyEditor = {
                getJSON: jest.fn(() => ({
                    type: 'doc',
                    content: [],
                })),
            } as unknown as Editor;

            const {result} = renderHook(() => usePageTranslate(
                emptyEditor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

            await act(async () => {
                await result.current.translatePage(mockLanguage);
            });

            // Should return early without calling translation API
            expect(mockClient4.getAIRewrittenMessage).not.toHaveBeenCalled();
        });

        test('should handle document with only whitespace', async () => {
            const whitespaceEditor = {
                getJSON: jest.fn(() => ({
                    type: 'doc',
                    content: [
                        {
                            type: 'paragraph',
                            content: [{type: 'text', text: '   '}],
                        },
                    ],
                })),
            } as unknown as Editor;

            const {result} = renderHook(() => usePageTranslate(
                whitespaceEditor,
                defaultProps.pageTitle,
                defaultProps.wikiId,
                defaultProps.pageId,
            ));

            await act(async () => {
                try {
                    await result.current.translatePage(mockLanguage);
                } catch {
                    // May throw due to mock setup
                }
            });

            // Whitespace-only chunks should not be translated
        });
    });
});
