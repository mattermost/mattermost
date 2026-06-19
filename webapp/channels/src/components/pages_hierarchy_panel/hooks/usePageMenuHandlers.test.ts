// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react';

import type {Page} from '@mattermost/types/wikis';

import {ModalIdentifiers} from 'utils/constants';

import {usePageMenuHandlers} from './usePageMenuHandlers';

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
    useDispatch: () => mockDispatch,
    useSelector: (selector: any) => selector({
        entities: {
            users: {
                currentUserId: 'current-user-id',
            },
        },
    }),
}));

jest.mock('react-intl', () => ({
    ...jest.requireActual('react-intl'),
    useIntl: () => ({
        formatMessage: ({defaultMessage}: {defaultMessage: string}) => defaultMessage,
    }),
}));

jest.mock('actions/pages', () => ({
    createPage: jest.fn(),
    deletePage: jest.fn(),
    duplicatePage: jest.fn(),
    fetchChannelWikis: jest.fn(),
    fetchPages: jest.fn(),
    movePageToWiki: jest.fn(),
    updatePage: jest.fn(),
}));

jest.mock('actions/page_drafts', () => ({
    removePageDraft: jest.fn(),
    savePageDraft: jest.fn(),
}));

jest.mock('actions/views/pages_hierarchy', () => ({
    expandAncestors: jest.fn(),
}));

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn((params) => ({type: 'OPEN_MODAL', ...params})),
    closeModal: jest.fn((modalId) => ({type: 'CLOSE_MODAL', modalId})),
}));

describe('usePageMenuHandlers - Rename functionality', () => {
    const makePage = (overrides: Partial<Page> = {}): Page => ({
        id: 'page1',
        wiki_id: 'wiki123',
        parent_id: '',
        type: 'page',
        title: '',
        body: '',
        search_text: '',
        user_id: 'user123',
        last_modified_by: '',
        sort_order: 0,
        create_at: 1234567890,
        update_at: 1234567990,
        edit_at: 0,
        delete_at: 0,
        original_id: '',
        has_effective_view_restriction: false,
        has_local_edit_restriction: false,
        properties: {},
        pending_file_ids: [],
        ...overrides,
    });

    const mockPages: Page[] = [
        makePage({id: 'page1', title: 'Original Page Title'}),
        makePage({id: 'page2', title: ''}),
    ];

    const baseProps = {
        wikiId: 'wiki123',
        channelId: 'channel123',
        pages: mockPages,
        drafts: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should initialize with pageToRename as null', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        expect(result.current.pageToRename).toBeNull();
        expect(result.current.renamingPage).toBe(false);
    });

    test('should open rename modal via modal manager when handleRename is called', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleRename('page1');
        });

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.PAGE_RENAME,
                dialogProps: expect.objectContaining({
                    initialValue: 'Original Page Title',
                }),
            }),
        );
        expect(result.current.pageToRename).toEqual({
            pageId: 'page1',
            currentTitle: 'Original Page Title',
        });
    });

    test('should use empty string as title when props.title is missing', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleRename('page2');
        });

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.PAGE_RENAME,
                dialogProps: expect.objectContaining({
                    initialValue: '',
                }),
            }),
        );
        expect(result.current.pageToRename).toEqual({
            pageId: 'page2',
            currentTitle: '',
        });
    });

    test('should use empty string as title when both props.title and message are missing', () => {
        const pageWithoutTitle: Page = {
            ...mockPages[0],
            id: 'page3',
            title: '',
        };
        const propsWithUntitledPage = {
            ...baseProps,
            pages: [...mockPages, pageWithoutTitle],
        };

        const {result} = renderHook(() => usePageMenuHandlers(propsWithUntitledPage));

        act(() => {
            result.current.handleRename('page3');
        });

        expect(result.current.pageToRename).toEqual({
            pageId: 'page3',
            currentTitle: '',
        });
    });

    test('should not open rename modal when page is not found', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleRename('nonexistent-page');
        });

        expect(mockDispatch).not.toHaveBeenCalled();
        expect(result.current.pageToRename).toBeNull();
    });

    test('should not open rename modal when wikiId is missing', () => {
        const propsWithoutWiki = {
            ...baseProps,
            wikiId: '',
        };
        const {result} = renderHook(() => usePageMenuHandlers(propsWithoutWiki));

        act(() => {
            result.current.handleRename('page1');
        });

        expect(mockDispatch).not.toHaveBeenCalled();
        expect(result.current.pageToRename).toBeNull();
    });
});

describe('usePageMenuHandlers - Delete functionality', () => {
    const mockPages: Page[] = [
        {
            id: 'page1',
            wiki_id: 'wiki123',
            parent_id: '',
            type: 'page',
            title: 'Page Title',
            body: '',
            search_text: '',
            user_id: 'user123',
            last_modified_by: '',
            sort_order: 0,
            create_at: 1234567890,
            update_at: 1234567990,
            edit_at: 0,
            delete_at: 0,
            original_id: '',
            has_effective_view_restriction: false,
            has_local_edit_restriction: false,
            properties: {},
            pending_file_ids: [],
        },
    ];

    const baseProps = {
        wikiId: 'wiki123',
        channelId: 'channel123',
        pages: mockPages,
        drafts: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should open delete modal via modal manager when handleDelete is called', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleDelete('page1');
        });

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.PAGE_DELETE,
                dialogProps: expect.objectContaining({
                    pageTitle: 'Page Title',
                    childCount: 0,
                }),
            }),
        );
        expect(result.current.pageToDelete).toEqual({
            page: mockPages[0],
            childCount: 0,
        });
    });

    test('should not open delete modal when page is not found', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleDelete('nonexistent-page');
        });

        expect(mockDispatch).not.toHaveBeenCalled();
        expect(result.current.pageToDelete).toBeNull();
    });
});

describe('usePageMenuHandlers - Create functionality', () => {
    const baseProps = {
        wikiId: 'wiki123',
        channelId: 'channel123',
        pages: [],
        drafts: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should open create modal via modal manager when handleCreateRootPage is called', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleCreateRootPage();
        });

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.PAGE_CREATE,
            }),
        );
    });

    test('should open create child modal via modal manager when handleCreateChild is called', () => {
        const mockPages: Page[] = [
            {
                id: 'parent-page',
                wiki_id: 'wiki123',
                parent_id: '',
                type: 'page',
                title: 'Parent Page',
                body: '',
                search_text: '',
                user_id: 'user123',
                last_modified_by: '',
                sort_order: 0,
                create_at: 1234567890,
                update_at: 1234567990,
                edit_at: 0,
                delete_at: 0,
                original_id: '',
                has_effective_view_restriction: false,
                has_local_edit_restriction: false,
                properties: {},
                pending_file_ids: [],
            },
        ];

        const propsWithPages = {
            ...baseProps,
            pages: mockPages,
        };

        const {result} = renderHook(() => usePageMenuHandlers(propsWithPages));

        act(() => {
            result.current.handleCreateChild('parent-page');
        });

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.PAGE_CREATE,
            }),
        );
        expect(result.current.createPageParent).toEqual({
            id: 'parent-page',
            title: 'Parent Page',
        });
    });
});

describe('usePageMenuHandlers - Move functionality', () => {
    const mockPages: Page[] = [
        {
            id: 'page1',
            wiki_id: 'wiki123',
            parent_id: '',
            type: 'page',
            title: 'Page Title',
            body: '',
            search_text: '',
            user_id: 'user123',
            last_modified_by: '',
            sort_order: 0,
            create_at: 1234567890,
            update_at: 1234567990,
            edit_at: 0,
            delete_at: 0,
            original_id: '',
            has_effective_view_restriction: false,
            has_local_edit_restriction: false,
            properties: {},
            pending_file_ids: [],
        },
    ];

    const baseProps = {
        wikiId: 'wiki123',
        channelId: 'channel123',
        pages: mockPages,
        drafts: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatch.mockResolvedValue({data: []});
    });

    test('should open move modal via modal manager when handleMove is called', async () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        await act(async () => {
            await result.current.handleMove('page1');
        });

        expect(mockDispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                modalId: ModalIdentifiers.PAGE_MOVE,
                dialogProps: expect.objectContaining({
                    pageId: 'page1',
                    pageTitle: 'Page Title',
                    hasChildren: false,
                }),
            }),
        );
        expect(result.current.pageToMove).toEqual({
            pageId: 'page1',
            pageTitle: 'Page Title',
            hasChildren: false,
        });
    });

    test('should not open move modal when page is not found', async () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        await act(async () => {
            await result.current.handleMove('nonexistent-page');
        });

        expect(result.current.pageToMove).toBeNull();
    });
});
