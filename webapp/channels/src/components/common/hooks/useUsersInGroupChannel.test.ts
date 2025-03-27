// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {Client4} from 'mattermost-redux/client';
import {General} from 'mattermost-redux/constants';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderHookWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {useUsersInGroupChannel} from './useUsersInGroupChannel';

describe('useUsersInGroupChannel', () => {
    const user1 = TestHelper.getUserMock({id: 'user1', username: 'user-a'});
    const user2 = TestHelper.getUserMock({id: 'user2', username: 'user-b'});
    const user3 = TestHelper.getUserMock({id: 'user3', username: 'user-c'});

    const groupChannel1 = TestHelper.getChannelMock({
        id: 'groupChannel1',
        type: General.GM_CHANNEL,
    });
    const groupChannel2 = TestHelper.getChannelMock({
        id: 'groupChannel2',
        type: General.GM_CHANNEL,
    });
    const groupChannel3 = TestHelper.getChannelMock({
        id: 'groupChannel3',
        type: General.GM_CHANNEL,
    });

    beforeAll(() => {
        Client4.setUrl('http://localhost:8065');
    });

    test('should fetch users for group channels only if they are not currently loaded for those channels', async () => {
        const mock = nock(Client4.getBaseRoute()).
            post('/users/group_channels', [groupChannel2.id, groupChannel3.id]).
            reply(200, {
                [groupChannel2.id]: [user1, user3],
                [groupChannel3.id]: [user1, user2, user3],
            });

        const {result, waitForNextUpdate} = renderHookWithContext(
            () => [
                useUsersInGroupChannel(groupChannel1.id),
                useUsersInGroupChannel(groupChannel2.id),
                useUsersInGroupChannel(groupChannel3.id),
            ],
            {
                entities: {
                    channels: {
                        channels: {
                            groupChannel1,
                            groupChannel2,
                            groupChannel3,
                        },
                    },
                    users: {
                        profiles: {
                            user1,
                            user2,
                        },
                        profilesInChannel: {
                            [groupChannel1.id]: new Set([user1.id, user2.id]),
                        },
                    },
                },
            },
        );

        expect(result.current).toEqual([
            [user1, user2],
            undefined,
            undefined,
        ]);

        // Wait for the request to complete and return the profiles in the other two group channels
        await waitForNextUpdate();

        expect(mock.isDone()).toBe(true);
        expect(result.current).toEqual([
            [user1, user2],
            [user1, user3],
            [user1, user2, user3],
        ]);
    });

    describe('memoization', () => {
        const testState = {
            entities: {
                channels: {
                    channels: {
                        groupChannel1,
                        groupChannel2,
                    },
                },
                users: {
                    profiles: {
                        user1,
                        user2,
                        user3,
                    },
                    profilesInChannel: {
                        [groupChannel1.id]: new Set([user1.id, user2.id]),
                        [groupChannel2.id]: new Set([user1.id, user3.id]),
                    },
                },
            },
        };

        describe('with a single instance', () => {
            test('should memoize results properly unless the store data changes', () => {
                const {result, replaceStoreState, rerender} = renderHookWithContext(
                    useUsersInGroupChannel,
                    testState,
                    {
                        initialProps: groupChannel1.id,
                    },
                );

                const firstResult = result.current;

                expect(firstResult).toEqual([user1, user2]);

                // Rerendering without changing anything should return the same array as before
                rerender();

                const secondResult = result.current;

                expect(firstResult).toBe(secondResult);

                // Modifying user2 should cause a new array to be returned
                const modifiedUser2 = {...user2, username: 'user-two'};
                replaceStoreState(mergeObjects(
                    testState,
                    {
                        entities: {
                            users: {
                                profiles: {
                                    user2: modifiedUser2,
                                },
                            },
                        },
                    },
                ));

                const thirdResult = result.current;

                expect(thirdResult).not.toBe(firstResult);
                expect(thirdResult).toEqual([user1, modifiedUser2]);
            });

            test('should update results when changing channels', () => {
                const {result, rerender} = renderHookWithContext(
                    useUsersInGroupChannel,
                    testState,
                    {
                        initialProps: groupChannel1.id,
                    },
                );

                const firstResult = result.current;

                expect(firstResult).toEqual([user1, user2]);

                // Rerendering without changing anything should return the same array as before
                rerender();

                const secondResult = result.current;

                expect(firstResult).toBe(secondResult);

                // Changing channels should cause a new array to be returned
                rerender(groupChannel2.id);

                const thirdResult = result.current;

                expect(thirdResult).not.toBe(firstResult);
                expect(thirdResult).toEqual([user1, user3]);
            });
        });

        describe('with multiple instances', () => {
            test('should memoize results properly unless the store data changes', () => {
                const {result, replaceStoreState, rerender} = renderHookWithContext(
                    ([channelId1, channelId2]) => [
                        useUsersInGroupChannel(channelId1),
                        useUsersInGroupChannel(channelId2),
                    ],
                    testState,
                    {
                        initialProps: [groupChannel1.id, groupChannel2.id],
                    },
                );

                const firstResult = result.current;

                expect(firstResult).toEqual([
                    [user1, user2],
                    [user1, user3],
                ]);

                // Rerendering without changing anything should return the same arrays as before
                rerender();

                const secondResult = result.current;

                expect(firstResult[0]).toBe(secondResult[0]);
                expect(firstResult[1]).toBe(secondResult[1]);

                // Modifying user2 should cause updated arrays to be returned
                const modifiedUser2 = {...user2, username: 'user-two'};
                replaceStoreState(mergeObjects(
                    testState,
                    {
                        entities: {
                            users: {
                                profiles: {
                                    user2: modifiedUser2,
                                },
                            },
                        },
                    },
                ));

                const thirdResult = result.current;

                expect(thirdResult[0]).not.toBe(firstResult[0]);
                expect(thirdResult[0]).toEqual([user1, modifiedUser2]);

                // Ideally, the second array would be the same as before, but the selector used doesn't handle that
                expect(thirdResult[1]).not.toBe(firstResult[1]);
                expect(thirdResult[1]).toEqual(firstResult[1]);
            });

            test('should update results when changing channels', () => {
                const {result, rerender} = renderHookWithContext(
                    ([channelId1, channelId2]) => [
                        useUsersInGroupChannel(channelId1),
                        useUsersInGroupChannel(channelId2),
                    ],
                    testState,
                    {
                        initialProps: [groupChannel1.id, groupChannel1.id],
                    },
                );

                const firstResult = result.current;

                expect(firstResult).toEqual([
                    [user1, user2],
                    [user1, user2],
                ]);
                expect(firstResult[0]).not.toBe(firstResult[1]);

                // Rerendering without changing anything should return the same arrays as before
                rerender([groupChannel1.id, groupChannel1.id]);

                const secondResult = result.current;

                expect(firstResult[0]).toBe(secondResult[0]);
                expect(firstResult[1]).toBe(secondResult[1]);

                // Changing one of the channels should cause a new array to be returned for that one, but the other
                // should stay the same
                rerender([groupChannel1.id, groupChannel2.id]);

                const thirdResult = result.current;

                expect(thirdResult[0]).toBe(firstResult[0]);
                expect(thirdResult[1]).not.toBe(firstResult[1]);
                expect(thirdResult[1]).toEqual([user1, user3]);

                // Changing the other channel should cause a new array to be returned for that one, but the other should
                // stay the same
                rerender([groupChannel2.id, groupChannel2.id]);

                const fourthResult = result.current;

                expect(fourthResult[0]).not.toBe(firstResult[0]);
                expect(fourthResult[0]).toEqual([user1, user3]);
                expect(fourthResult[1]).toBe(thirdResult[1]);
            });
        });
    });
});
