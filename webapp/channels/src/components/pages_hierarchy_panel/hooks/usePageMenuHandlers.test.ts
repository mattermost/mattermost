// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react';

import type {Post} from '@mattermost/types/posts';

import {usePageMenuHandlers} from './usePageMenuHandlers';

jest.mock('react-redux', () => ({
    useDispatch: () => jest.fn(),
    useSelector: (selector: any) => selector({
        entities: {
            users: {
                currentUserId: 'current-user-id',
            },
        },
    }),
}));

jest.mock('actions/pages', () => ({
    createPage: jest.fn(),
    deletePage: jest.fn(),
    duplicatePage: jest.fn(),
    loadChannelWikis: jest.fn(),
    loadPages: jest.fn(),
    movePageToWiki: jest.fn(),
    updatePage: jest.fn(),
}));

jest.mock('actions/page_drafts', () => ({
    removePageDraft: jest.fn(),
}));

jest.mock('actions/views/pages_hierarchy', () => ({
    expandAncestors: jest.fn(),
}));

describe('usePageMenuHandlers - Rename functionality', () => {
    const mockPages: Post[] = [
        {
            id: 'page1',
            create_at: 1234567890,
            update_at: 1234567990,
            delete_at: 0,
            edit_at: 0,
            is_pinned: false,
            user_id: 'user123',
            channel_id: 'channel123',
            root_id: '',
            original_id: '',
            message: '',
            type: '',
            page_parent_id: '',
            props: {
                title: 'Original Page Title',
            },
            hashtags: '',
            filenames: [],
            file_ids: [],
            pending_post_id: '',
            reply_count: 0,
            last_reply_at: 0,
            participants: null,
            metadata: {
                embeds: [],
                emojis: [],
                files: [],
                images: {},
            },
        },
        {
            id: 'page2',
            create_at: 1234567890,
            update_at: 1234567990,
            delete_at: 0,
            edit_at: 0,
            is_pinned: false,
            user_id: 'user123',
            channel_id: 'channel123',
            root_id: '',
            original_id: '',
            message: 'Fallback Title',
            type: '',
            page_parent_id: '',
            props: {},
            hashtags: '',
            filenames: [],
            file_ids: [],
            pending_post_id: '',
            reply_count: 0,
            last_reply_at: 0,
            participants: null,
            metadata: {
                embeds: [],
                emojis: [],
                files: [],
                images: {},
            },
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

    test('should initialize with rename modal closed', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        expect(result.current.showRenameModal).toBe(false);
        expect(result.current.pageToRename).toBeNull();
        expect(result.current.renamingPage).toBe(false);
    });

    test('should open rename modal with page title when handleRename is called', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleRename('page1');
        });

        expect(result.current.showRenameModal).toBe(true);
        expect(result.current.pageToRename).toEqual({
            pageId: 'page1',
            currentTitle: 'Original Page Title',
        });
    });

    test('should use message as fallback title when props.title is missing', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleRename('page2');
        });

        expect(result.current.showRenameModal).toBe(true);
        expect(result.current.pageToRename).toEqual({
            pageId: 'page2',
            currentTitle: 'Fallback Title',
        });
    });

    test('should use empty string as title when both props.title and message are missing', () => {
        const pageWithoutTitle: Post = {
            ...mockPages[0],
            id: 'page3',
            message: '',
            props: {},
        };
        const propsWithUntitledPage = {
            ...baseProps,
            pages: [...mockPages, pageWithoutTitle],
        };

        const {result} = renderHook(() => usePageMenuHandlers(propsWithUntitledPage));

        act(() => {
            result.current.handleRename('page3');
        });

        expect(result.current.showRenameModal).toBe(true);
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

        expect(result.current.showRenameModal).toBe(false);
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

        expect(result.current.showRenameModal).toBe(false);
        expect(result.current.pageToRename).toBeNull();
    });

    test('should allow opening rename modal for different page', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleRename('page1');
        });

        expect(result.current.showRenameModal).toBe(true);
        expect(result.current.pageToRename?.pageId).toBe('page1');

        // Close the modal first
        act(() => {
            result.current.handleCancelRename();
        });

        // Now open for a different page
        act(() => {
            result.current.handleRename('page2');
        });

        expect(result.current.showRenameModal).toBe(true);
        expect(result.current.pageToRename?.pageId).toBe('page2');
    });

    test('should close rename modal when handleCancelRename is called', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleRename('page1');
        });

        expect(result.current.showRenameModal).toBe(true);

        act(() => {
            result.current.handleCancelRename();
        });

        expect(result.current.showRenameModal).toBe(false);
        expect(result.current.pageToRename).toBeNull();
    });

    test('should call setShowRenameModal to close modal', () => {
        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleRename('page1');
        });

        expect(result.current.showRenameModal).toBe(true);

        act(() => {
            result.current.setShowRenameModal(false);
        });

        expect(result.current.showRenameModal).toBe(false);
    });

    test('should cleanup state after successful rename', async () => {
        const mockDispatch = jest.fn().mockResolvedValue({data: mockPages[0]});
        jest.spyOn(require('react-redux'), 'useDispatch').mockReturnValue(mockDispatch);

        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleRename('page1');
        });

        expect(result.current.pageToRename).not.toBeNull();

        await act(async () => {
            await result.current.handleConfirmRename('New Page Title');
        });

        expect(result.current.pageToRename).toBeNull();
    });

    test('should cleanup state after rename error', async () => {
        const mockDispatch = jest.fn().mockResolvedValue({error: {message: 'Rename failed'}});
        jest.spyOn(require('react-redux'), 'useDispatch').mockReturnValue(mockDispatch);

        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleRename('page1');
        });

        expect(result.current.pageToRename).not.toBeNull();

        await act(async () => {
            try {
                await result.current.handleConfirmRename('New Page Title');
            } catch (error) {
                // Expected error from handleConfirmRename throwing result.error
            }
        });

        expect(result.current.pageToRename).toBeNull();
    });

    test('should not proceed with rename when pageToRename is null', async () => {
        const mockDispatch = jest.fn();
        jest.spyOn(require('react-redux'), 'useDispatch').mockReturnValue(mockDispatch);

        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        await act(async () => {
            await result.current.handleConfirmRename('New Page Title');
        });

        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should not proceed with rename when wikiId is missing', async () => {
        const mockDispatch = jest.fn();
        jest.spyOn(require('react-redux'), 'useDispatch').mockReturnValue(mockDispatch);

        const propsWithoutWiki = {
            ...baseProps,
            wikiId: '',
        };
        const {result} = renderHook(() => usePageMenuHandlers(propsWithoutWiki));

        act(() => {
            // Manually set pageToRename to test the guard clause
            result.current.handleRename('page1');
        });

        await act(async () => {
            await result.current.handleConfirmRename('New Page Title');
        });

        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should reset renamingPage after operation completes', async () => {
        const mockDispatch = jest.fn().mockResolvedValue({data: mockPages[0]});
        jest.spyOn(require('react-redux'), 'useDispatch').mockReturnValue(mockDispatch);

        const {result} = renderHook(() => usePageMenuHandlers(baseProps));

        act(() => {
            result.current.handleRename('page1');
        });

        await act(async () => {
            await result.current.handleConfirmRename('New Page Title');
        });

        expect(result.current.renamingPage).toBe(false);
    });
});
