// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import * as ReactRedux from 'react-redux';

import {Client4} from 'mattermost-redux/client';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {usePost} from './usePost';

describe('usePost', () => {
    const post1 = TestHelper.getPostMock({id: 'post1'});
    const post2 = TestHelper.getPostMock({id: 'post2'});

    describe('with fake dispatch', () => {
        const dispatchMock = jest.fn();

        beforeAll(() => {
            jest.spyOn(ReactRedux, 'useDispatch').mockImplementation(() => dispatchMock);
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        test("should return the post if it's already in the store", () => {
            const {result} = renderHookWithContext(
                () => usePost('post1'),
                {
                    entities: {
                        posts: {
                            posts: {
                                post1,
                            },
                        },
                    },
                },
            );

            expect(result.current).toBe(post1);
            expect(dispatchMock).not.toHaveBeenCalled();
        });

        test("should fetch the post if it's not in the store", () => {
            const {result} = renderHookWithContext(
                () => usePost('post1'),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should only attempt to fetch the post once regardless of how many times the hook is used', () => {
            const {result, rerender} = renderHookWithContext(
                () => usePost('post1'),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            for (let i = 0; i < 10; i++) {
                rerender();
            }

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should attempt to fetch different posts if the post ID changes', () => {
            let postId = 'post1';
            const {result, rerender} = renderHookWithContext(
                () => usePost(postId),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            postId = 'post2';
            rerender();

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test("should only attempt to fetch each post once when they aren't loaded", () => {
            let postId = 'post1';
            const {result, replaceStoreState, rerender} = renderHookWithContext(
                () => usePost(postId),
            );

            // Initial state without post1 loaded
            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate the response to loading post1
            replaceStoreState({
                entities: {
                    posts: {
                        posts: {
                            post1,
                        },
                    },
                },
            });

            expect(result.current).toBe(post1);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Switch to post2
            postId = 'post2';

            rerender();

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(2);

            // Simulate the response to loading post2
            replaceStoreState({
                entities: {
                    posts: {
                        posts: {
                            post1,
                            post2,
                        },
                    },
                },
            });

            expect(result.current).toBe(post2);
            expect(dispatchMock).toHaveBeenCalledTimes(2);

            // Switch back to post1 which has already been loaded
            postId = 'post1';

            rerender();

            expect(result.current).toBe(post1);
            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test("shouldn't attempt to load anything when given an empty post ID", () => {
            const {result} = renderHookWithContext(
                () => usePost(''),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(0);
        });
    });

    describe('with real dispatch', () => {
        beforeAll(() => {
            Client4.setUrl('http://localhost:8065');
        });

        test("should only attempt to fetch each post once when they aren't loaded", async () => {
            const post1Mock = nock(Client4.getBaseRoute()).
                post('/posts/ids', [post1.id]).
                once().
                reply(200, [post1]);
            const post2Mock = nock(Client4.getBaseRoute()).
                post('/posts/ids', [post2.id]).
                once().
                reply(200, [post2]);

            let postId = 'post1';
            const {result, rerender, waitForNextUpdate} = renderHookWithContext(
                () => usePost(postId),
            );

            // Initial state without post1 loaded
            expect(result.current).toEqual(undefined);
            expect(post1Mock.isDone()).toBe(false);
            expect(post2Mock.isDone()).toBe(false);

            // Wait for the response with post1

            await waitForNextUpdate();

            expect(post1Mock.isDone()).toBe(true);
            expect(post2Mock.isDone()).toBe(false);
            expect(result.current).toEqual(post1);

            // Switch to post2
            postId = 'post2';
            rerender();

            expect(result.current).toEqual(undefined);

            // Wait for the response with post2
            await waitForNextUpdate();

            expect(post1Mock.isDone()).toBe(true);
            expect(post2Mock.isDone()).toBe(true);
            expect(result.current).toEqual(post2);

            // Switch back to post1 which has already been loaded
            postId = 'post1';
            rerender();

            expect(result.current).toEqual(post1);

            // We know there's no second call because nock is set to only mock the first request for each post
        });

        test('should batch multiple requests to fetch posts', async () => {
            const mock = nock(Client4.getBaseRoute()).
                post('/posts/ids', [post1.id, post2.id]).
                once().
                reply(200, [post1, post2]);

            const {result, waitForNextUpdate} = renderHookWithContext(
                () => {
                    return [
                        usePost('post1'),
                        usePost('post2'),
                    ];
                },
            );

            // Initial state without post1 loaded
            expect(result.current).toEqual([undefined, undefined]);
            expect(mock.isDone()).toBe(false);

            // Wait for the response
            await waitForNextUpdate();

            expect(result.current).toEqual([post1, post2]);
            expect(mock.isDone()).toBe(true);
        });
    });
});
