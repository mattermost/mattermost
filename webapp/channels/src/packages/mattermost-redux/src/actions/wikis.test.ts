// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WikiTypes, PostTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';

import {
    getWiki,
    getChannelWikis,
    createWiki,
    updateWiki,
    deleteWiki,
    getPages,
    getPage,
    deletePage,
    getPageComments,
    getPageVersionHistory,
    savePageDraft,
    deletePageDraft,
} from './wikis';

// Mock Client4
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getWiki: jest.fn(),
        getChannelWikis: jest.fn(),
        createWiki: jest.fn(),
        updateWiki: jest.fn(),
        deleteWiki: jest.fn(),
        getPages: jest.fn(),
        getPage: jest.fn(),
        deletePage: jest.fn(),
        getPageComments: jest.fn(),
        getPageVersionHistory: jest.fn(),
        savePageDraft: jest.fn(),
        deletePageDraft: jest.fn(),
    },
}));

// Mock error helpers
jest.mock('./helpers', () => ({
    forceLogoutIfNecessary: jest.fn(),
}));

jest.mock('./errors', () => ({
    logError: jest.fn(() => ({type: 'LOG_ERROR'})),
    LogErrorBarMode: {Always: 'always'},
}));

const mockClient = Client4 as jest.Mocked<typeof Client4>;

describe('mattermost-redux/actions/wikis', () => {
    const mockWiki = {
        id: 'wiki123',
        channel_id: 'channel123',
        title: 'Test Wiki',
        description: 'Test description',
        create_at: 1000000000000,
        update_at: 1000000000000,
        delete_at: 0,
        creator_id: 'user123',
    } as any;

    const createMockDispatch = (): jest.Mock & {getActions: () => any[]} => {
        const actions: any[] = [];
        const dispatch: jest.Mock = jest.fn((action) => {
            if (typeof action === 'function') {
                return action(dispatch, () => ({
                    entities: {
                        wikis: {byId: {wiki123: mockWiki}},
                        posts: {posts: {}},
                    },
                }), undefined);
            }
            actions.push(action);
            return action;
        });
        (dispatch as any).getActions = () => actions;
        return dispatch as jest.Mock & {getActions: () => any[]};
    };

    const createMockGetState = (overrides = {}): jest.Mock => jest.fn((): any => ({
        entities: {
            wikis: {byId: {wiki123: mockWiki}},
            posts: {posts: {}},
        },
        ...overrides,
    }));

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getWiki', () => {
        test('should fetch and dispatch RECEIVED_WIKI', async () => {
            mockClient.getWiki.mockResolvedValue(mockWiki);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await getWiki('wiki123')(dispatch, getState, undefined);

            expect(result.data).toEqual(mockWiki);
            expect(dispatch.getActions()).toContainEqual({
                type: WikiTypes.RECEIVED_WIKI,
                data: mockWiki,
            });
        });

        test('should return error on failure', async () => {
            const error = new Error('Wiki not found');
            mockClient.getWiki.mockRejectedValue(error);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await getWiki('wiki123')(dispatch, getState, undefined);

            expect(result.error).toBe(error);
        });
    });

    describe('getChannelWikis', () => {
        test('should fetch and dispatch RECEIVED_WIKIS', async () => {
            const wikis = [mockWiki, {...mockWiki, id: 'wiki456'}];
            mockClient.getChannelWikis.mockResolvedValue(wikis);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await getChannelWikis('channel123')(dispatch, getState, undefined);

            expect(result.data).toEqual(wikis);
            expect(dispatch.getActions()).toContainEqual({
                type: WikiTypes.RECEIVED_WIKIS,
                data: wikis,
            });
        });

        test('should not dispatch when no wikis returned', async () => {
            mockClient.getChannelWikis.mockResolvedValue([]);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await getChannelWikis('channel123')(dispatch, getState, undefined);

            expect(result.data).toEqual([]);
            const receivedWikisActions = dispatch.getActions().filter((a: any) => a.type === WikiTypes.RECEIVED_WIKIS);
            expect(receivedWikisActions).toHaveLength(0);
        });
    });

    describe('createWiki', () => {
        test('should create wiki and dispatch RECEIVED_WIKI', async () => {
            mockClient.createWiki.mockResolvedValue(mockWiki);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await createWiki('channel123', 'Test Wiki')(dispatch, getState, undefined);

            expect(result.data).toEqual(mockWiki);
            expect(mockClient.createWiki).toHaveBeenCalledWith({
                channel_id: 'channel123',
                title: 'Test Wiki',
            });
        });
    });

    describe('updateWiki', () => {
        test('should update wiki and dispatch RECEIVED_WIKI', async () => {
            const updatedWiki = {...mockWiki, title: 'Updated Title'};
            mockClient.updateWiki.mockResolvedValue(updatedWiki);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await updateWiki(mockWiki)(dispatch, getState, undefined);

            expect(result.data).toEqual(updatedWiki);
        });
    });

    describe('deleteWiki', () => {
        test('should delete wiki and dispatch DELETED_WIKI', async () => {
            mockClient.deleteWiki.mockResolvedValue({status: 'OK'} as any);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await deleteWiki('wiki123')(dispatch, getState, undefined);

            expect(result.data).toBe(true);
            expect(dispatch.getActions()).toContainEqual({
                type: WikiTypes.DELETED_WIKI,
                data: {wikiId: 'wiki123', channelId: 'channel123'},
            });
        });
    });

    describe('getPages', () => {
        test('should fetch pages and dispatch actions', async () => {
            const pages = [
                {id: 'page1', type: 'page', message: ''},
                {id: 'page2', type: 'page', message: ''},
            ] as any[];
            mockClient.getPages.mockResolvedValue(pages);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await getPages('wiki123', 0, 60)(dispatch, getState, undefined);

            expect(result.data).toEqual(pages);
            expect(dispatch.getActions()).toContainEqual({
                type: WikiTypes.GET_PAGES_REQUEST,
                data: {wikiId: 'wiki123'},
            });
            expect(dispatch.getActions()).toContainEqual({
                type: WikiTypes.GET_PAGES_SUCCESS,
                data: {wikiId: 'wiki123', pages},
            });
        });

        test('should dispatch failure on error', async () => {
            const error = new Error('Server error');
            mockClient.getPages.mockRejectedValue(error);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await getPages('wiki123', 0, 60)(dispatch, getState, undefined);

            expect(result.error).toBe(error);
            const failureAction = dispatch.getActions().find((a: any) => a.type === WikiTypes.GET_PAGES_FAILURE);
            expect(failureAction).toBeDefined();
        });
    });

    describe('getPage', () => {
        test('should fetch page and dispatch RECEIVED_POST', async () => {
            const page = {
                id: 'page123',
                type: 'page',
                message: '{"type":"doc"}',
                props: {page_status: 'In Progress'},
            } as any;
            mockClient.getPage.mockResolvedValue(page);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await getPage('wiki123', 'page123')(dispatch, getState, undefined);

            expect(result.data).toEqual(page);
            expect(dispatch.getActions()).toContainEqual({
                type: PostTypes.RECEIVED_POST,
                data: page,
            });
            expect(dispatch.getActions()).toContainEqual({
                type: WikiTypes.RECEIVED_PAGE_STATUS,
                data: {postId: 'page123', status: 'In Progress'},
            });
        });
    });

    describe('deletePage', () => {
        test('should delete page and dispatch actions', async () => {
            mockClient.deletePage.mockResolvedValue({status: 'OK'} as any);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await deletePage('wiki123', 'page123')(dispatch, getState, undefined);

            expect(result.data).toBe(true);
            expect(dispatch.getActions()).toContainEqual({
                type: PostTypes.POST_DELETED,
                data: {id: 'page123'},
            });
            expect(dispatch.getActions()).toContainEqual({
                type: WikiTypes.DELETED_PAGE,
                data: {id: 'page123', wikiId: 'wiki123'},
            });
        });
    });

    describe('getPageComments', () => {
        test('should fetch comments and dispatch RECEIVED_POSTS', async () => {
            const comments = [
                {id: 'comment1', type: 'page_comment'},
                {id: 'comment2', type: 'page_comment'},
            ] as any[];
            mockClient.getPageComments.mockResolvedValue(comments);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await getPageComments('wiki123', 'page123')(dispatch, getState, undefined);

            expect(result.data).toEqual(comments);
            const receivedPostsAction = dispatch.getActions().find((a: any) => a.type === PostTypes.RECEIVED_POSTS);
            expect(receivedPostsAction).toBeDefined();
            expect(receivedPostsAction.data.posts).toEqual({
                comment1: comments[0],
                comment2: comments[1],
            });
        });

        test('should not dispatch when no comments returned', async () => {
            mockClient.getPageComments.mockResolvedValue([]);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await getPageComments('wiki123', 'page123')(dispatch, getState, undefined);

            expect(result.data).toEqual([]);
            const receivedPostsActions = dispatch.getActions().filter((a: any) => a.type === PostTypes.RECEIVED_POSTS);
            expect(receivedPostsActions).toHaveLength(0);
        });
    });

    describe('getPageVersionHistory', () => {
        test('should fetch version history', async () => {
            const versions = [
                {id: 'v1', update_at: 1000000100000},
                {id: 'v2', update_at: 1000000000000},
            ] as any[];
            mockClient.getPageVersionHistory.mockResolvedValue(versions);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await getPageVersionHistory('wiki123', 'page123')(dispatch, getState, undefined);

            expect(result.data).toEqual(versions);
        });
    });

    describe('savePageDraft', () => {
        test('should save page draft', async () => {
            const draft = {id: 'draft1', content: 'test'} as any;
            mockClient.savePageDraft.mockResolvedValue(draft);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await savePageDraft('wiki123', 'page123', 'content', 'title')(dispatch, getState, undefined);

            expect(result.data).toEqual(draft);
            expect(mockClient.savePageDraft).toHaveBeenCalledWith('wiki123', 'page123', 'content', 'title', undefined, undefined);
        });
    });

    describe('deletePageDraft', () => {
        test('should delete page draft', async () => {
            mockClient.deletePageDraft.mockResolvedValue({status: 'OK'} as any);

            const dispatch = createMockDispatch();
            const getState = createMockGetState();

            const result = await deletePageDraft('wiki123', 'page123')(dispatch, getState, undefined);

            expect(result.data).toBe(true);
        });
    });
});
