// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, waitFor} from '@testing-library/react';

import type {Post} from '@mattermost/types/posts';

// Mock all external modules BEFORE they're imported by usePageForComment
jest.mock('mattermost-redux/selectors/entities/pages', () => ({
    getPageById: jest.fn(),
}));

jest.mock('actions/pages', () => ({
    fetchPage: jest.fn(),
}));

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
    useDispatch: () => mockDispatch,
    useSelector: (selector: any) => selector(),
}));

// Import after mocks are set up
import {getPageById} from 'mattermost-redux/selectors/entities/pages';

import {fetchPage} from 'actions/pages';

import {usePageForComment, clearPendingPageFetchesForTests} from './usePageForComment';

const mockGetPageById = getPageById as jest.MockedFunction<typeof getPageById>;
const mockFetchPage = fetchPage as jest.MockedFunction<typeof fetchPage>;

const pageId = 'page123';
const wikiId = 'wiki123';

const makeComment = (overrides: Partial<Post> = {}): Post => ({
    id: 'comment1',
    type: 'page_comment',
    root_id: '',
    props: {page_id: pageId, wiki_id: wikiId},
    message: 'hi',
    create_at: 0,
    update_at: 0,
    edit_at: 0,
    delete_at: 0,
    is_pinned: false,
    user_id: 'u1',
    channel_id: 'c1',
    original_id: '',
    hashtags: '',
    pending_post_id: '',
    reply_count: 0,
    metadata: {embeds: [], emojis: [], files: [], images: {}},
    ...overrides,
} as unknown as Post);

const makePage = (): Post => ({
    id: pageId,
    type: 'page',
    channel_id: 'c1',
    props: {title: 'Test Page', wiki_id: wikiId},
} as unknown as Post);

describe('usePageForComment', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearPendingPageFetchesForTests();

        // fetchPage returns a thunk that resolves to {data}. We just return a promise
        // so .finally() can fire and clear the dedup entry.
        mockFetchPage.mockReturnValue((() => Promise.resolve({data: makePage()})) as any);
    });

    test('returns null when comment is null', () => {
        mockGetPageById.mockReturnValue(undefined);
        const {result} = renderHook(() => usePageForComment(null));
        expect(result.current).toBeNull();
        expect(mockFetchPage).not.toHaveBeenCalled();
    });

    test('returns null and does not fetch for a non-page-comment post', () => {
        mockGetPageById.mockReturnValue(undefined);
        const notComment = makeComment({type: 'custom_post' as any});
        const {result} = renderHook(() => usePageForComment(notComment));
        expect(result.current).toBeNull();
        expect(mockFetchPage).not.toHaveBeenCalled();
    });

    test('does not fetch when wiki_id is missing from comment props', () => {
        mockGetPageById.mockReturnValue(undefined);
        const comment = makeComment({props: {page_id: pageId} as any});
        renderHook(() => usePageForComment(comment));
        expect(mockFetchPage).not.toHaveBeenCalled();
    });

    test('returns the cached page without fetching when already loaded', () => {
        const page = makePage();
        mockGetPageById.mockReturnValue(page);
        const {result} = renderHook(() => usePageForComment(makeComment()));
        expect(result.current).toEqual(page);
        expect(mockFetchPage).not.toHaveBeenCalled();
    });

    test('dispatches fetchPage when page is not in store', () => {
        mockGetPageById.mockReturnValue(undefined);
        renderHook(() => usePageForComment(makeComment()));
        expect(mockFetchPage).toHaveBeenCalledWith(pageId, wikiId);
    });

    test('dedups concurrent fetches for the same pageId across mounted hooks', () => {
        mockGetPageById.mockReturnValue(undefined);

        // Keep the fetch pending so the dedup entry stays in the Set across both mounts.
        let resolveFetch: ((value: unknown) => void) | undefined;
        mockFetchPage.mockReturnValue((() => new Promise((resolve) => {
            resolveFetch = resolve;
        })) as any);

        renderHook(() => usePageForComment(makeComment()));
        renderHook(() => usePageForComment(makeComment({id: 'comment2'})));

        expect(mockFetchPage).toHaveBeenCalledTimes(1);

        // Cleanup: let the promise settle so the `.finally()` clears the entry.
        resolveFetch?.({data: makePage()});
    });

    test('clears pending entry after fetch settles so a later mount can refetch', async () => {
        mockGetPageById.mockReturnValue(undefined);

        // Capture the promise returned by fetchPage so we can await its settle
        // (and the hook's .finally() microtask) before mounting the second hook.
        let fetchPromise: Promise<unknown> | undefined;
        mockFetchPage.mockImplementation(() => {
            fetchPromise = Promise.resolve({data: makePage()});
            return fetchPromise as any;
        });

        const {unmount} = renderHook(() => usePageForComment(makeComment()));
        expect(mockFetchPage).toHaveBeenCalledTimes(1);

        await fetchPromise;
        await waitFor(() => {
            // `.finally()` callback runs after awaiters; waitFor drains it.
            renderHook(() => usePageForComment(makeComment({id: 'comment2'})));
            expect(mockFetchPage).toHaveBeenCalledTimes(2);
        });
        unmount();
    });
});
