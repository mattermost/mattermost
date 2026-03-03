// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook, act} from '@testing-library/react';

// Mock all external modules BEFORE they're imported by usePageComments
jest.mock('mattermost-redux/selectors/entities/posts', () => ({
    getPost: jest.fn(),
}));

jest.mock('selectors/wiki_rhs', () => ({
    getWikiRhsWikiId: jest.fn(),
    getFocusedInlineCommentId: jest.fn(),
}));

jest.mock('actions/pages', () => ({
    createPageComment: jest.fn(),
    createPageCommentReply: jest.fn(),
}));

jest.mock('actions/views/create_page_comment', () => ({
    submitPageComment: jest.fn(),
}));

jest.mock('react-redux', () => ({
    useDispatch: () => jest.fn((action) => {
        if (typeof action === 'function') {
            return action();
        }
        return action;
    }),
    useSelector: (selector: any) => selector(),
}));

// Import after mocks are set up
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {createPageComment, createPageCommentReply} from 'actions/pages';
import {submitPageComment} from 'actions/views/create_page_comment';
import {getWikiRhsWikiId, getFocusedInlineCommentId} from 'selectors/wiki_rhs';

import {usePageComments} from './usePageComments';

const mockGetPost = getPost as jest.MockedFunction<typeof getPost>;
const mockGetWikiRhsWikiId = getWikiRhsWikiId as jest.MockedFunction<typeof getWikiRhsWikiId>;
const mockGetFocusedInlineCommentId = getFocusedInlineCommentId as jest.MockedFunction<typeof getFocusedInlineCommentId>;
const mockCreatePageComment = createPageComment as jest.MockedFunction<typeof createPageComment>;
const mockCreatePageCommentReply = createPageCommentReply as jest.MockedFunction<typeof createPageCommentReply>;
const mockSubmitPageComment = submitPageComment as jest.MockedFunction<typeof submitPageComment>;

describe('usePageComments', () => {
    const pageId = 'page123';
    const wikiId = 'wiki123';
    const parentCommentId = 'comment123';

    const mockPage = {
        id: pageId,
        type: 'page',
        channel_id: 'channel123',
        props: {title: 'Test Page'},
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockGetPost.mockReturnValue(mockPage as any);
        mockGetWikiRhsWikiId.mockReturnValue(wikiId);
        mockGetFocusedInlineCommentId.mockReturnValue(null);
    });

    test('should return page from selector', () => {
        const {result} = renderHook(() => usePageComments(pageId));

        expect(result.current.page).toEqual(mockPage);
    });

    test('should return wikiId from selector', () => {
        const {result} = renderHook(() => usePageComments(pageId));

        expect(result.current.wikiId).toBe(wikiId);
    });

    test('should return focusedInlineCommentId from selector', () => {
        mockGetFocusedInlineCommentId.mockReturnValue(parentCommentId);

        const {result} = renderHook(() => usePageComments(pageId));

        expect(result.current.focusedInlineCommentId).toBe(parentCommentId);
    });

    describe('createComment', () => {
        test('should dispatch createPageComment action', async () => {
            mockCreatePageComment.mockReturnValue(jest.fn(() => Promise.resolve({data: {id: 'newComment'}})) as any);

            const {result} = renderHook(() => usePageComments(pageId));

            await act(async () => {
                await result.current.createComment('Test comment message');
            });

            expect(mockCreatePageComment).toHaveBeenCalledWith(wikiId, pageId, 'Test comment message');
        });

        test('should return error when wikiId is not found', async () => {
            mockGetWikiRhsWikiId.mockReturnValue(null as any);

            const {result} = renderHook(() => usePageComments(pageId));

            let response: any;
            await act(async () => {
                response = await result.current.createComment('Test message');
            });

            expect(response.error).toBeDefined();
            expect(response.error.message).toBe('Wiki ID not found');
            expect(mockCreatePageComment).not.toHaveBeenCalled();
        });
    });

    describe('createReply', () => {
        test('should dispatch createPageCommentReply action', async () => {
            mockCreatePageCommentReply.mockReturnValue(jest.fn(() => Promise.resolve({data: {id: 'newReply'}})) as any);

            const {result} = renderHook(() => usePageComments(pageId));

            await act(async () => {
                await result.current.createReply(parentCommentId, 'Test reply message');
            });

            expect(mockCreatePageCommentReply).toHaveBeenCalledWith(wikiId, pageId, parentCommentId, 'Test reply message');
        });

        test('should return error when wikiId is not found', async () => {
            mockGetWikiRhsWikiId.mockReturnValue(null as any);

            const {result} = renderHook(() => usePageComments(pageId));

            let response: any;
            await act(async () => {
                response = await result.current.createReply(parentCommentId, 'Test message');
            });

            expect(response.error).toBeDefined();
            expect(mockCreatePageCommentReply).not.toHaveBeenCalled();
        });
    });

    describe('submitComment', () => {
        test('should dispatch submitPageComment action', async () => {
            mockSubmitPageComment.mockReturnValue(jest.fn(() => Promise.resolve({data: {}})) as any);

            const {result} = renderHook(() => usePageComments(pageId));

            const mockDraft = {message: 'Test draft'};
            const mockAfterSubmit = jest.fn();

            await act(async () => {
                await result.current.submitComment(mockDraft as any, mockAfterSubmit);
            });

            expect(mockSubmitPageComment).toHaveBeenCalledWith(pageId, mockDraft, mockAfterSubmit);
        });
    });

    describe('createCommentOrReply', () => {
        test('should create comment when no focused inline comment', async () => {
            mockGetFocusedInlineCommentId.mockReturnValue(null);
            mockCreatePageComment.mockReturnValue(jest.fn(() => Promise.resolve({data: {}})) as any);

            const {result} = renderHook(() => usePageComments(pageId));

            await act(async () => {
                await result.current.createCommentOrReply('Test message');
            });

            expect(mockCreatePageComment).toHaveBeenCalledWith(wikiId, pageId, 'Test message');
            expect(mockCreatePageCommentReply).not.toHaveBeenCalled();
        });

        test('should create reply when there is a focused inline comment', async () => {
            mockGetFocusedInlineCommentId.mockReturnValue(parentCommentId);
            mockCreatePageCommentReply.mockReturnValue(jest.fn(() => Promise.resolve({data: {}})) as any);

            const {result} = renderHook(() => usePageComments(pageId));

            await act(async () => {
                await result.current.createCommentOrReply('Test reply');
            });

            expect(mockCreatePageCommentReply).toHaveBeenCalledWith(wikiId, pageId, parentCommentId, 'Test reply');
            expect(mockCreatePageComment).not.toHaveBeenCalled();
        });
    });
});
