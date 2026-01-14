// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Mock modules before imports
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

jest.mock('utils/page_utils', () => ({
    isPagePost: jest.fn(),
}));

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {createPageComment as createPageCommentAction, createPageCommentReply} from 'actions/pages';
import {getWikiRhsWikiId, getFocusedInlineCommentId} from 'selectors/wiki_rhs';

import {isPagePost} from 'utils/page_utils';

import {submitPageComment} from './create_page_comment';

const mockGetPost = getPost as jest.MockedFunction<typeof getPost>;
const mockGetWikiRhsWikiId = getWikiRhsWikiId as jest.MockedFunction<typeof getWikiRhsWikiId>;
const mockGetFocusedInlineCommentId = getFocusedInlineCommentId as jest.MockedFunction<typeof getFocusedInlineCommentId>;
const mockCreatePageComment = createPageCommentAction as jest.MockedFunction<typeof createPageCommentAction>;
const mockCreatePageCommentReply = createPageCommentReply as jest.MockedFunction<typeof createPageCommentReply>;
const mockIsPagePost = isPagePost as jest.MockedFunction<typeof isPagePost>;

describe('create_page_comment actions', () => {
    const pageId = 'page123';
    const wikiId = 'wiki123';
    const mockDraft = {message: 'Test comment', channelId: 'channel123'};

    const mockPage = {
        id: pageId,
        type: 'page',
        channel_id: 'channel123',
        props: {title: 'Test Page'},
    };

    const mockState = {};

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetPost.mockReturnValue(mockPage as any);
        mockGetWikiRhsWikiId.mockReturnValue(wikiId);
        mockGetFocusedInlineCommentId.mockReturnValue(null);
        mockIsPagePost.mockReturnValue(true);
    });

    describe('submitPageComment', () => {
        test('should return error when page is not found', async () => {
            mockGetPost.mockReturnValue(null as any);

            const dispatch = jest.fn();
            const getState = jest.fn((): any => mockState);

            const result = await submitPageComment(pageId, mockDraft as any)(dispatch, getState, undefined);

            expect(result.error).toBeDefined();
            expect((result.error as Error).message).toBe('Page not found');
        });

        test('should return error when post is not a page', async () => {
            mockIsPagePost.mockReturnValue(false);

            const dispatch = jest.fn();
            const getState = jest.fn((): any => mockState);

            const result = await submitPageComment(pageId, mockDraft as any)(dispatch, getState, undefined);

            expect(result.error).toBeDefined();
            expect((result.error as Error).message).toBe('Root post is not a page');
        });

        test('should return error when wikiId is not found', async () => {
            mockGetWikiRhsWikiId.mockReturnValue(null);

            const dispatch = jest.fn();
            const getState = jest.fn((): any => mockState);

            const result = await submitPageComment(pageId, mockDraft as any)(dispatch, getState, undefined);

            expect(result.error).toBeDefined();
            expect((result.error as Error).message).toBe('Wiki ID not found in RHS state');
        });

        test('should create page comment when no focused inline comment', async () => {
            mockCreatePageComment.mockReturnValue((() => Promise.resolve({data: {id: 'comment1'}})) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState, undefined);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const result = await submitPageComment(pageId, mockDraft as any)(dispatch, getState, undefined) as {created: boolean; error?: Error};

            expect(mockCreatePageComment).toHaveBeenCalledWith(wikiId, pageId, 'Test comment');
            expect(result.created).toBe(true);
            expect(result.error).toBeUndefined();
        });

        test('should create reply when focused inline comment exists', async () => {
            mockGetFocusedInlineCommentId.mockReturnValue('parentComment123');
            mockCreatePageCommentReply.mockReturnValue((() => Promise.resolve({data: {id: 'reply1'}})) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState, undefined);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const result = await submitPageComment(pageId, mockDraft as any)(dispatch, getState, undefined) as {created: boolean; error?: Error};

            expect(mockCreatePageCommentReply).toHaveBeenCalledWith(wikiId, pageId, 'parentComment123', 'Test comment');
            expect(mockCreatePageComment).not.toHaveBeenCalled();
            expect(result.created).toBe(true);
        });

        test('should call afterSubmit callback when provided', async () => {
            mockCreatePageComment.mockReturnValue((() => Promise.resolve({data: {id: 'comment1'}})) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState, undefined);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);
            const afterSubmit = jest.fn();

            await submitPageComment(pageId, mockDraft as any, afterSubmit)(dispatch, getState, undefined);

            expect(afterSubmit).toHaveBeenCalledWith({
                created: true,
                error: undefined,
            });
        });

        test('should return error when comment creation fails', async () => {
            const error = new Error('Failed to create comment');
            mockCreatePageComment.mockReturnValue((() => Promise.resolve({error})) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState, undefined);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);

            const result = await submitPageComment(pageId, mockDraft as any)(dispatch, getState, undefined) as {created: boolean; error?: Error};

            expect(result.created).toBe(false);
            expect(result.error).toBe(error);
        });

        test('should call afterSubmit with error when creation fails', async () => {
            const error = new Error('Failed');
            mockCreatePageComment.mockReturnValue((() => Promise.resolve({error})) as any);

            const dispatch: jest.Mock = jest.fn((action) => {
                if (typeof action === 'function') {
                    return action(dispatch, () => mockState, undefined);
                }
                return action;
            });
            const getState = jest.fn((): any => mockState);
            const afterSubmit = jest.fn();

            await submitPageComment(pageId, mockDraft as any, afterSubmit)(dispatch, getState, undefined);

            expect(afterSubmit).toHaveBeenCalledWith({
                created: false,
                error,
            });
        });
    });
});
