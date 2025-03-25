// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import * as ReactRedux from 'react-redux';

import {Client4} from 'mattermost-redux/client';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {useUser} from './useUser';

describe('useUser', () => {
    const user1 = TestHelper.getUserMock({id: 'user1'});
    const user2 = TestHelper.getUserMock({id: 'user2'});

    describe('useUser with fake dispatch', () => {
        const dispatchMock = jest.fn();

        beforeAll(() => {
            jest.spyOn(ReactRedux, 'useDispatch').mockImplementation(() => dispatchMock);
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        test("should return the user if they're already in the store", () => {
            const {result} = renderHookWithContext(
                () => useUser('user1'),
                {
                    entities: {
                        users: {
                            profiles: {
                                user1,
                            },
                        },
                    },
                },
            );

            expect(result.current).toBe(user1);
            expect(dispatchMock).not.toHaveBeenCalled();
        });

        test("should fetch the user if they're not in the store", () => {
            const {result} = renderHookWithContext(
                () => useUser('user1'),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should only attempt to fetch the user once regardless of how many times the hook is used', () => {
            const {result, rerender} = renderHookWithContext(
                () => useUser('user1'),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            for (let i = 0; i < 10; i++) {
                rerender();
            }

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);
        });

        test('should attempt to fetch different users if the user changes', () => {
            let userId = 'user1';
            const {result, rerender} = renderHookWithContext(
                () => useUser(userId),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            userId = 'user2';
            rerender();

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test("should only attempt to fetch each user once when they aren't loaded", () => {
            let userId = 'user1';
            const {result, replaceStoreState, rerender} = renderHookWithContext(
                () => useUser(userId),
            );

            // Initial state without user1 loaded
            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Simulate the response to loading user1
            replaceStoreState({
                entities: {
                    users: {
                        profiles: {
                            user1,
                        },
                    },
                },
            });

            expect(result.current).toBe(user1);
            expect(dispatchMock).toHaveBeenCalledTimes(1);

            // Switch to user2
            userId = 'user2';

            rerender();

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(2);

            // Simulate the response to loading user2
            replaceStoreState({
                entities: {
                    users: {
                        profiles: {
                            user1,
                            user2,
                        },
                    },
                },
            });

            expect(result.current).toBe(user2);
            expect(dispatchMock).toHaveBeenCalledTimes(2);

            // Switch back to user1 which has already been loaded
            userId = 'user1';

            rerender();

            expect(result.current).toBe(user1);
            expect(dispatchMock).toHaveBeenCalledTimes(2);
        });

        test("shouldn't attempt to load anything when given an empty user ID", () => {
            const {result} = renderHookWithContext(
                () => useUser(''),
            );

            expect(result.current).toBe(undefined);
            expect(dispatchMock).toHaveBeenCalledTimes(0);
        });
    });

    describe('with real dispatch', () => {
        beforeAll(() => {
            Client4.setUrl('http://localhost:8065');
        });

        test("should only attempt to fetch each user once when they aren't loaded", async () => {
            const user1Mock = nock(Client4.getBaseRoute()).
                post('/users/ids', [user1.id]).
                once().
                reply(200, [user1]);
            const user2Mock = nock(Client4.getBaseRoute()).
                post('/users/ids', [user2.id]).
                once().
                reply(200, [user2]);

            let userId = 'user1';
            const {result, rerender, waitForNextUpdate} = renderHookWithContext(
                () => useUser(userId),
            );

            // Initial state without user1 loaded
            expect(result.current).toEqual(undefined);
            expect(user1Mock.isDone()).toBe(false);
            expect(user2Mock.isDone()).toBe(false);

            // Wait for the response with user1
            await waitForNextUpdate();

            expect(user1Mock.isDone()).toBe(true);
            expect(user2Mock.isDone()).toBe(false);
            expect(result.current).toEqual(user1);

            // Switch to user2
            userId = 'user2';
            rerender();

            expect(result.current).toEqual(undefined);

            // Wait for the response with user2
            await waitForNextUpdate();

            expect(user1Mock.isDone()).toBe(true);
            expect(user2Mock.isDone()).toBe(true);
            expect(result.current).toEqual(user2);

            // Switch back to user1 which has already been loaded
            userId = 'user1';
            rerender();

            expect(result.current).toEqual(user1);

            // We know there's no second call because nock is set to only mock the first request for each user
        });

        test('should batch multiple requests to fetch users', async () => {
            const mock = nock(Client4.getBaseRoute()).
                post('/users/ids', [user1.id, user2.id]).
                once().
                reply(200, [user1, user2]);

            const {result, waitForNextUpdate} = renderHookWithContext(
                () => {
                    return [
                        useUser('user1'),
                        useUser('user2'),
                    ];
                },
            );

            // Initial state without user1 loaded
            expect(result.current).toEqual([undefined, undefined]);
            expect(mock.isDone()).toBe(false);

            // Wait for the response
            await waitForNextUpdate();

            expect(result.current).toEqual([user1, user2]);
            expect(mock.isDone()).toBe(true);
        });
    });
});
