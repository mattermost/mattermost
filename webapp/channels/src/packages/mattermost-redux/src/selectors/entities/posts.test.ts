// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {Reaction} from '@mattermost/types/reactions';
import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import {Posts, Preferences} from 'mattermost-redux/constants';
import * as Selectors from 'mattermost-redux/selectors/entities/posts';
import {makeGetProfilesForReactions} from 'mattermost-redux/selectors/entities/users';
import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';

import TestHelper from '../../../test/test_helper';

const p = (override: Partial<Post>) => TestHelper.getPostMock(override);

describe('Selectors.Posts', () => {
    const user1 = TestHelper.fakeUserWithId();
    const profiles: Record<string, UserProfile> = {};
    profiles[user1.id] = user1;

    const posts = {
        a: p({id: 'a', channel_id: '1', create_at: 1, user_id: user1.id}),
        b: p({id: 'b', channel_id: '1', create_at: 2, user_id: user1.id}),
        c: p({id: 'c', root_id: 'a', channel_id: '1', create_at: 3, user_id: 'b'}),
        d: p({id: 'd', root_id: 'b', channel_id: '1', create_at: 4, user_id: 'b'}),
        e: p({id: 'e', root_id: 'a', channel_id: '1', create_at: 5, user_id: 'b'}),
        f: p({id: 'f', channel_id: '2', create_at: 6, user_id: 'b'}),
    };

    const reaction1 = {user_id: user1.id, emoji_name: '+1'} as Reaction;
    const reactionA = {[reaction1.user_id + '-' + reaction1.emoji_name]: reaction1};
    const reactions = {
        a: reactionA,
    };

    const testState = deepFreezeAndThrowOnMutation({
        entities: {
            general: {
                config: {
                    EnableJoinLeaveMessageByDefault: 'true',
                },
            },
            users: {
                currentUserId: user1.id,
                profiles,
            },
            posts: {
                posts,
                postsInChannel: {
                    1: [
                        {order: ['e', 'd', 'c', 'b', 'a'], recent: true},
                    ],
                    2: [
                        {order: ['f'], recent: true},
                    ],
                },
                postsInThread: {
                    a: ['c', 'e'],
                    b: ['d'],
                },
                reactions,
            },
            preferences: {
                myPreferences: {},
            },
        },
    });

    it('should return single post with no children', () => {
        const getPostsForThread = Selectors.makeGetPostsForThread();

        expect(getPostsForThread(testState, 'f')).toEqual([posts.f]);
    });

    it('should return post with children', () => {
        const getPostsForThread = Selectors.makeGetPostsForThread();

        expect(getPostsForThread(testState, 'a')).toEqual([posts.e, posts.c, posts.a]);
    });

    it('should return memoized result for identical rootId', () => {
        const getPostsForThread = Selectors.makeGetPostsForThread();

        const result = getPostsForThread(testState, 'a');

        expect(result).toEqual(getPostsForThread(testState, 'a'));
    });

    it('should return memoized result for multiple selectors with different props', () => {
        const getPostsForThread1 = Selectors.makeGetPostsForThread();
        const getPostsForThread2 = Selectors.makeGetPostsForThread();

        const result1 = getPostsForThread1(testState, 'a');
        const result2 = getPostsForThread2(testState, 'b');

        expect(result1).toEqual(getPostsForThread1(testState, 'a'));
        expect(result2).toEqual(getPostsForThread2(testState, 'b'));
    });

    it('should return reactions for post', () => {
        const getReactionsForPost = Selectors.makeGetReactionsForPost();
        expect(getReactionsForPost(testState, posts.a.id)).toEqual(reactionA);
    });

    it('should return profiles for reactions', () => {
        const getProfilesForReactions = makeGetProfilesForReactions();
        expect(getProfilesForReactions(testState, [reaction1])).toEqual([user1]);
    });

    it('get current history item', () => {
        const testState1 = deepFreezeAndThrowOnMutation({
            entities: {
                posts: {
                    messagesHistory: {
                        messages: ['test1', 'test2', 'test3'],
                        index: {
                            post: 1,
                            comment: 2,
                        },
                    },
                },
            },
        });

        const testState2 = deepFreezeAndThrowOnMutation({
            entities: {
                posts: {
                    messagesHistory: {
                        messages: ['test1', 'test2', 'test3'],
                        index: {
                            post: 0,
                            comment: 0,
                        },
                    },
                },
            },
        });

        const testState3 = deepFreezeAndThrowOnMutation({
            entities: {
                posts: {
                    messagesHistory: {
                        messages: [],
                        index: {
                            post: -1,
                            comment: -1,
                        },
                    },
                },
            },
        });

        const getHistoryMessagePost = Selectors.makeGetMessageInHistoryItem(Posts.MESSAGE_TYPES.POST as 'post');
        const getHistoryMessageComment = Selectors.makeGetMessageInHistoryItem(Posts.MESSAGE_TYPES.COMMENT as 'comment');
        expect(getHistoryMessagePost(testState1)).toEqual('test2');
        expect(getHistoryMessageComment(testState1)).toEqual('test3');
        expect(getHistoryMessagePost(testState2)).toEqual('test1');
        expect(getHistoryMessageComment(testState2)).toEqual('test1');
        expect(getHistoryMessagePost(testState3)).toEqual('');
        expect(getHistoryMessageComment(testState3)).toEqual('');
    });

    describe('getPostIdsForThread', () => {
        const user1 = TestHelper.fakeUserWithId();
        const profiles: Record<string, UserProfile> = {};
        profiles[user1.id] = user1;

        it('single post', () => {
            const getPostIdsForThread = Selectors.makeGetPostIdsForThread();

            const state = {
                entities: {
                    general: {
                        config: {},
                    },
                    users: {
                        currentUserId: user1.id,
                        profiles,
                    },
                    preferences: {
                        myPreferences: {},
                    },
                    posts: {
                        posts: {
                            1001: {id: '1001', create_at: 1001},
                            1002: {id: '1002', create_at: 1002, root_id: '1001'},
                            1003: {id: '1003', create_at: 1003},
                            1004: {id: '1004', create_at: 1004, root_id: '1001'},
                            1005: {id: '1005', create_at: 1005},
                        },
                        postsInThread: {
                            1001: ['1002', '1004'],
                        },
                    },
                },
            } as unknown as GlobalState;
            const expected = ['1005'];

            expect(getPostIdsForThread(state, '1005')).toEqual(expected);
        });

        it('thread', () => {
            const getPostIdsForThread = Selectors.makeGetPostIdsForThread();

            const state = {
                entities: {
                    general: {
                        config: {},
                    },
                    users: {
                        currentUserId: user1.id,
                        profiles,
                    },
                    preferences: {
                        myPreferences: {},
                    },
                    posts: {
                        posts: {
                            1001: {id: '1001', create_at: 1001},
                            1002: {id: '1002', create_at: 1002, root_id: '1001'},
                            1003: {id: '1003', create_at: 1003},
                            1004: {id: '1004', create_at: 1004, root_id: '1001'},
                            1005: {id: '1005', create_at: 1005},
                        },
                        postsInThread: {
                            1001: ['1002', '1004'],
                        },
                    },
                },
            } as unknown as GlobalState;
            const expected = ['1004', '1002', '1001'];

            expect(getPostIdsForThread(state, '1001')).toEqual(expected);
        });

        it('memoization', () => {
            const getPostIdsForThread = Selectors.makeGetPostIdsForThread();

            let state = {
                entities: {
                    general: {
                        config: {},
                    },
                    users: {
                        currentUserId: user1.id,
                        profiles,
                    },
                    preferences: {
                        myPreferences: {},
                    },
                    posts: {
                        posts: {
                            1001: {id: '1001', create_at: 1001},
                            1002: {id: '1002', create_at: 1002, root_id: '1001'},
                            1003: {id: '1003', create_at: 1003},
                            1004: {id: '1004', create_at: 1004, root_id: '1001'},
                            1005: {id: '1005', create_at: 1005},
                        },
                        postsInThread: {
                            1001: ['1002', '1004'],
                        },
                    },
                },
            } as unknown as GlobalState;

            // One post, no changes
            let previous = getPostIdsForThread(state, '1005');
            let now = getPostIdsForThread(state, '1005');
            expect(now).toEqual(['1005']);
            expect(now).toBe(previous);

            // One post, unrelated changes
            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        posts: {
                            ...state.entities.posts.posts,
                            1006: p({id: '1006', create_at: 1006, root_id: '1003'}),
                        },
                        postsInThread: {
                            ...state.entities.posts.postsInThread,
                            1003: ['1006'],
                        },
                    },
                },
            };

            previous = now;
            now = getPostIdsForThread(state, '1005');
            expect(now).toEqual(['1005']);
            expect(now).toBe(previous);

            // One post, changes to post
            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        posts: {
                            ...state.entities.posts.posts,
                            1005: p({id: '1005', create_at: 1005, update_at: 1006}),
                        },
                        postsInThread: state.entities.posts.postsInThread,
                    },
                },
            };

            previous = now;
            now = getPostIdsForThread(state, '1005');
            expect(now).toEqual(['1005']);
            expect(now).toBe(previous);

            // Change of thread
            previous = now;
            now = getPostIdsForThread(state, '1001');
            expect(now).toEqual(['1004', '1002', '1001']);
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostIdsForThread(state, '1001');
            expect(now).toBe(previous);

            // New post in thread
            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        posts: {
                            ...state.entities.posts.posts,
                            1007: p({id: '1007', create_at: 1007, root_id: '1001'}),
                        },
                        postsInThread: {
                            ...state.entities.posts.postsInThread,
                            1001: [...state.entities.posts.postsInThread['1001'], '1007'],
                        },
                    },
                },
            };

            previous = now;
            now = getPostIdsForThread(state, '1001');
            expect(now).toEqual(['1007', '1004', '1002', '1001']);
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostIdsForThread(state, '1001');
            expect(now).toEqual(['1007', '1004', '1002', '1001']);
            expect(now).toBe(previous);
        });

        it('memoization with multiple selectors', () => {
            const getPostIdsForThread1 = Selectors.makeGetPostIdsForThread();
            const getPostIdsForThread2 = Selectors.makeGetPostIdsForThread();

            const state = {
                entities: {
                    general: {
                        config: {},
                    },
                    users: {
                        currentUserId: user1.id,
                        profiles,
                    },
                    preferences: {
                        myPreferences: {},
                    },
                    posts: {
                        posts: {
                            1001: {id: '1001', create_at: 1001},
                            1002: {id: '1002', create_at: 1002, root_id: '1001'},
                            1003: {id: '1003', create_at: 1003},
                            1004: {id: '1004', create_at: 1004, root_id: '1001'},
                            1005: {id: '1005', create_at: 1005},
                        },
                        postsInThread: {
                            1001: ['1002', '1004'],
                        },
                    },
                },
            } as unknown as GlobalState;

            let now1 = getPostIdsForThread1(state, '1001');
            let now2 = getPostIdsForThread2(state, '1001');
            expect(now1).not.toBe(now2);
            expect(now1).toEqual(now2);

            let previous1 = now1;
            now1 = getPostIdsForThread1(state, '1001');
            expect(now1).toEqual(previous1);

            const previous2 = now2;
            now2 = getPostIdsForThread2(state, '1003');
            expect(now2).not.toEqual(previous2);
            expect(now1).not.toEqual(now2);

            previous1 = now1;
            now1 = getPostIdsForThread1(state, '1001');
            expect(now1).toEqual(previous1);
        });
    });

    describe('makeGetPostsChunkAroundPost', () => {
        it('no posts around', () => {
            const getPostsChunkAroundPost = Selectors.makeGetPostsChunkAroundPost();

            const state = {
                entities: {
                    posts: {
                        postsInChannel: {
                            1234: [
                                {order: ['a'], recent: true},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(getPostsChunkAroundPost(state, 'a', '1234')).toEqual({order: ['a'], recent: true});
        });

        it('posts around', () => {
            const getPostsChunkAroundPost = Selectors.makeGetPostsChunkAroundPost();

            const state = {
                entities: {
                    posts: {
                        postsInChannel: {
                            1234: [
                                {order: ['a', 'b', 'c', 'd', 'e'], recent: true},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(getPostsChunkAroundPost(state, 'c', '1234')).toEqual({order: ['a', 'b', 'c', 'd', 'e'], recent: true});
        });

        it('no matching posts', () => {
            const getPostsChunkAroundPost = Selectors.makeGetPostsChunkAroundPost();

            const state = {
                entities: {
                    posts: {
                        postsInChannel: {
                            1234: [
                                {order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(getPostsChunkAroundPost(state, 'noChunk', '1234')).toEqual(undefined);
        });

        it('memoization', () => {
            const getPostsChunkAroundPost = Selectors.makeGetPostsChunkAroundPost();

            let state = {
                entities: {
                    posts: {
                        postsInChannel: {
                            1234: [
                                {order: ['a', 'b', 'c', 'd', 'e'], recent: true},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            // No limit, no changes
            let previous = getPostsChunkAroundPost(state, 'c', '1234');

            // Changes to posts in another channel
            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        postsInChannel: {
                            ...state.entities.posts.postsInChannel,
                            abcd: [
                                {order: ['g', 'h', 'i', 'j', 'k', 'l'], recent: true},
                            ],
                        },
                    },
                },
            };

            let now = getPostsChunkAroundPost(state, 'c', '1234');
            expect(now).toEqual({order: ['a', 'b', 'c', 'd', 'e'], recent: true});
            expect(now).toBe(previous);

            // Changes to posts in this channel
            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        postsInChannel: {
                            ...state.entities.posts.postsInChannel,
                            1234: [
                                {order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true},
                            ],
                        },
                    },
                },
            };

            previous = now;
            now = getPostsChunkAroundPost(state, 'c', '1234');
            expect(now).toEqual({order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true});
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostsChunkAroundPost(state, 'c', '1234');
            expect(now).toEqual({order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true});
            expect(now).toBe(previous);

            // Change of channel
            previous = now;
            now = getPostsChunkAroundPost(state, 'i', 'abcd');
            expect(now).toEqual({order: ['g', 'h', 'i', 'j', 'k', 'l'], recent: true});
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostsChunkAroundPost(state, 'i', 'abcd');
            expect(now).toEqual({order: ['g', 'h', 'i', 'j', 'k', 'l'], recent: true});
            expect(now).toBe(previous);

            // Change of post in the chunk
            previous = now;
            now = getPostsChunkAroundPost(state, 'j', 'abcd');
            expect(now).toEqual({order: ['g', 'h', 'i', 'j', 'k', 'l'], recent: true});
            expect(now).toBe(previous);

            // Change of post order
            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        postsInChannel: {
                            ...state.entities.posts.postsInChannel,
                            abcd: [
                                {order: ['y', 'g', 'i', 'h', 'j', 'l', 'k', 'z'], recent: true},
                            ],
                        },
                    },
                },
            };

            previous = now;
            now = getPostsChunkAroundPost(state, 'j', 'abcd');
            expect(now).toEqual({order: ['y', 'g', 'i', 'h', 'j', 'l', 'k', 'z'], recent: true});
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostsChunkAroundPost(state, 'j', 'abcd');
            expect(now).toEqual({order: ['y', 'g', 'i', 'h', 'j', 'l', 'k', 'z'], recent: true});
            expect(now).toBe(previous);
        });
    });
    describe('getRecentPostsChunkInChannel', () => {
        it('Should return as recent chunk exists', () => {
            const state = {
                entities: {
                    posts: {
                        postsInChannel: {
                            1234: [
                                {order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            const recentPostsChunkInChannel = Selectors.getRecentPostsChunkInChannel(state, '1234');
            expect(recentPostsChunkInChannel).toEqual({order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true});
        });

        it('Should return undefined as recent chunk does not exists', () => {
            const state = {
                entities: {
                    posts: {
                        postsInChannel: {
                            1234: [
                                {order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: false},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            const recentPostsChunkInChannel = Selectors.getRecentPostsChunkInChannel(state, '1234');
            expect(recentPostsChunkInChannel).toEqual(undefined);
        });
    });

    describe('getOldestPostsChunkInChannel', () => {
        it('Should return as oldest chunk exists', () => {
            const state = {
                entities: {
                    posts: {
                        postsInChannel: {
                            1234: [
                                {order: ['a', 'b', 'c', 'd', 'e', 'f'], oldest: true, recent: true},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            const oldestPostsChunkInChannel = Selectors.getOldestPostsChunkInChannel(state, '1234');
            expect(oldestPostsChunkInChannel).toEqual({order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true, oldest: true});
        });

        it('Should return undefined as recent chunk does not exists', () => {
            const state = {
                entities: {
                    posts: {
                        postsInChannel: {
                            1234: [
                                {order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: false, oldest: false},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            const oldestPostsChunkInChannel = Selectors.getOldestPostsChunkInChannel(state, '1234');
            expect(oldestPostsChunkInChannel).toEqual(undefined);
        });
    });

    describe('getPostsChunkInChannelAroundTime', () => {
        it('getPostsChunkInChannelAroundTime', () => {
            const state = {
                entities: {
                    posts: {
                        posts: {
                            e: {id: 'e', create_at: 1010},
                            j: {id: 'j', create_at: 1001},
                            a: {id: 'a', create_at: 1020},
                            f: {id: 'f', create_at: 1010},
                        },
                        postsInChannel: {
                            1234: [
                                {order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true},
                                {order: ['e', 'f', 'g', 'h', 'i', 'j'], recent: false},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            const postsChunkInChannelAroundTime1 = Selectors.getPostsChunkInChannelAroundTime(state, '1234', 1011);
            expect(postsChunkInChannelAroundTime1).toEqual({order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true});

            const postsChunkInChannelAroundTime2 = Selectors.getPostsChunkInChannelAroundTime(state, '1234', 1002);
            expect(postsChunkInChannelAroundTime2).toEqual({order: ['e', 'f', 'g', 'h', 'i', 'j'], recent: false});

            const postsChunkInChannelAroundTime3 = Selectors.getPostsChunkInChannelAroundTime(state, '1234', 1010);
            expect(postsChunkInChannelAroundTime3).toEqual({order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true});

            const postsChunkInChannelAroundTime4 = Selectors.getPostsChunkInChannelAroundTime(state, '1234', 1020);
            expect(postsChunkInChannelAroundTime4).toEqual({order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true});
        });
    });

    describe('getUnreadPostsChunk', () => {
        it('should return recent chunk even if the timstamp is greater than the last post', () => {
            const state = {
                entities: {
                    posts: {
                        posts: {
                            e: {id: 'e', create_at: 1010},
                            j: {id: 'j', create_at: 1001},
                            a: {id: 'a', create_at: 1020},
                            f: {id: 'f', create_at: 1010},
                        },
                        postsInChannel: {
                            1234: [
                                {order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true},
                                {order: ['e', 'f', 'g', 'h', 'i', 'j'], recent: false},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            const unreadPostsChunk = Selectors.getUnreadPostsChunk(state, '1234', 1030);
            expect(unreadPostsChunk).toEqual({order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true});
        });

        it('should return a not recent chunk based on the timestamp', () => {
            const state = {
                entities: {
                    posts: {
                        posts: {
                            e: {id: 'e', create_at: 1010},
                            j: {id: 'j', create_at: 1001},
                            a: {id: 'a', create_at: 1020},
                            f: {id: 'f', create_at: 1010},
                        },
                        postsInChannel: {
                            1234: [
                                {order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true},
                                {order: ['e', 'f', 'g', 'h', 'i', 'j'], recent: false},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            const unreadPostsChunk = Selectors.getUnreadPostsChunk(state, '1234', 1002);
            expect(unreadPostsChunk).toEqual({order: ['e', 'f', 'g', 'h', 'i', 'j'], recent: false});
        });

        it('should return recent chunk if it is an empty array', () => {
            const state = {
                entities: {
                    posts: {
                        posts: {},
                        postsInChannel: {
                            1234: [
                                {order: [], recent: true},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            const unreadPostsChunk = Selectors.getUnreadPostsChunk(state, '1234', 1002);
            expect(unreadPostsChunk).toEqual({order: [], recent: true});
        });

        it('should return oldest chunk if timstamp greater than the oldest post', () => {
            const state = {
                entities: {
                    posts: {
                        posts: {
                            a: {id: 'a', create_at: 1001},
                            b: {id: 'b', create_at: 1002},
                            c: {id: 'c', create_at: 1003},
                        },
                        postsInChannel: {
                            1234: [
                                {order: ['a', 'b', 'c'], recent: true, oldest: true},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            const unreadPostsChunk = Selectors.getUnreadPostsChunk(state, '1234', 1000);
            expect(unreadPostsChunk).toEqual({order: ['a', 'b', 'c'], recent: true, oldest: true});
        });
    });

    describe('getPostsForIds', () => {
        it('selector', () => {
            const getPostsForIds = Selectors.makeGetPostsForIds();

            const testPosts: Record<string, Post> = {
                1000: p({id: '1000'}),
                1001: p({id: '1001'}),
                1002: p({id: '1002'}),
                1003: p({id: '1003'}),
                1004: p({id: '1004'}),
            };
            const state = {
                entities: {
                    posts: {
                        posts: testPosts,
                    },
                },
            } as unknown as GlobalState;

            const postIds = ['1000', '1002', '1003'];

            const actual = getPostsForIds(state, postIds);
            expect(actual.length).toEqual(3);
            expect(actual[0]).toEqual(testPosts[postIds[0]]);
            expect(actual[1]).toEqual(testPosts[postIds[1]]);
            expect(actual[2]).toEqual(testPosts[postIds[2]]);
        });

        it('memoization', () => {
            const getPostsForIds = Selectors.makeGetPostsForIds();

            const testPosts: Record<string, Post> = {
                1000: p({id: '1000'}),
                1001: p({id: '1001'}),
                1002: p({id: '1002'}),
                1003: p({id: '1003'}),
                1004: p({id: '1004'}),
            };
            let state = {
                entities: {
                    posts: {
                        posts: {
                            ...testPosts,
                        },
                    },
                },
            } as unknown as GlobalState;
            let postIds = ['1000', '1002', '1003'];

            let now = getPostsForIds(state, postIds);
            expect(now).toEqual([testPosts['1000'], testPosts['1002'], testPosts['1003']]);

            // No changes
            let previous = now;
            now = getPostsForIds(state, postIds);
            expect(now).toEqual([testPosts['1000'], testPosts['1002'], testPosts['1003']]);
            expect(now).toBe(previous);

            // New, identical ids
            postIds = ['1000', '1002', '1003'];

            previous = now;
            now = getPostsForIds(state, postIds);
            expect(now).toEqual([testPosts['1000'], testPosts['1002'], testPosts['1003']]);
            expect(now).toBe(previous);

            // New posts, no changes to ones in ids
            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        posts: {
                            ...state.entities.posts.posts,
                        },
                    },
                },
            };

            previous = now;
            now = getPostsForIds(state, postIds);
            expect(now).toEqual([testPosts['1000'], testPosts['1002'], testPosts['1003']]);
            expect(now).toBe(previous);

            // New ids
            postIds = ['1001', '1002', '1004'];

            previous = now;
            now = getPostsForIds(state, postIds);
            expect(now).toEqual([testPosts['1001'], testPosts['1002'], testPosts['1004']]);
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostsForIds(state, postIds);
            expect(now).toEqual([testPosts['1001'], testPosts['1002'], testPosts['1004']]);
            expect(now).toBe(previous);

            // New posts, changes to ones in ids
            const newPost = p({id: '1002', message: 'abcd'});
            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        posts: {
                            ...state.entities.posts.posts,
                            [newPost.id]: newPost,
                        },
                    },
                },
            };

            previous = now;
            now = getPostsForIds(state, postIds);
            expect(now).toEqual([testPosts['1001'], newPost, testPosts['1004']]);
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostsForIds(state, postIds);
            expect(now).toEqual([testPosts['1001'], newPost, testPosts['1004']]);
            expect(now).toBe(previous);
        });
    });

    describe('getMostRecentPostIdInChannel', () => {
        it('system messages visible', () => {
            const testPosts = {
                1000: {id: '1000', type: 'system_join_channel'},
                1001: {id: '1001', type: 'system_join_channel'},
                1002: {id: '1002'},
                1003: {id: '1003'},
            };
            const state = {
                entities: {
                    general: {
                        config: {
                            EnableJoinLeaveMessageByDefault: 'true',
                        },
                    },
                    posts: {
                        posts: testPosts,
                        postsInChannel: {
                            channelId: [
                                {order: ['1000', '1001', '1002', '1003'], recent: true},
                            ],
                        },
                    },
                    preferences: {
                        myPreferences: {
                            [`${Preferences.CATEGORY_ADVANCED_SETTINGS}--${Preferences.ADVANCED_FILTER_JOIN_LEAVE}`]: {value: 'true'},
                        },
                    },
                },
            } as unknown as GlobalState;

            const postId = Selectors.getMostRecentPostIdInChannel(state, 'channelId');
            expect(postId).toBe('1000');
        });

        it('system messages hidden', () => {
            const testPosts = {
                1000: {id: '1000', type: 'system_join_channel'},
                1001: {id: '1001', type: 'system_join_channel'},
                1002: {id: '1002'},
                1003: {id: '1003'},
            };
            const state = {
                entities: {
                    general: {
                        config: {
                            EnableJoinLeaveMessageByDefault: 'true',
                        },
                    },
                    posts: {
                        posts: testPosts,
                        postsInChannel: {
                            channelId: [
                                {order: ['1000', '1001', '1002', '1003'], recent: true},
                            ],
                        },
                    },
                    preferences: {
                        myPreferences: {
                            [`${Preferences.CATEGORY_ADVANCED_SETTINGS}--${Preferences.ADVANCED_FILTER_JOIN_LEAVE}`]: {value: 'false'},
                        },
                    },
                },
            } as unknown as GlobalState;

            const postId = Selectors.getMostRecentPostIdInChannel(state, 'channelId');
            expect(postId).toEqual('1002');
        });
    });

    describe('getLatestReplyablePostId', () => {
        it('no posts', () => {
            const state = {
                entities: {
                    channels: {
                        currentChannelId: 'abcd',
                    },
                    general: {
                        config: {
                            EnableJoinLeaveMessageByDefault: 'true',
                        },
                    },
                    posts: {
                        posts: {},
                        postsInChannel: [],
                    },
                    preferences: {
                        myPreferences: {},
                    },
                    users: {
                        profiles: {},
                    },
                },
            } as unknown as GlobalState;
            const actual = Selectors.getLatestReplyablePostId(state);

            expect(actual).toEqual('');
        });

        it('return first post which dosent have POST_DELETED state', () => {
            const postsAny = {
                a: {id: 'a', channel_id: 'a', create_at: 1, user_id: 'a'},
                b: {id: 'b', root_id: 'a', channel_id: 'abcd', create_at: 3, user_id: 'b', state: Posts.POST_DELETED},
                c: {id: 'c', root_id: 'a', channel_id: 'abcd', create_at: 3, user_id: 'b', type: 'system_join_channel'},
                d: {id: 'd', root_id: 'a', channel_id: 'abcd', create_at: 3, user_id: 'b', type: Posts.POST_TYPES.EPHEMERAL},
                e: {id: 'e', channel_id: 'abcd', create_at: 4, user_id: 'b'},
            };
            const state = {
                entities: {
                    channels: {
                        currentChannelId: 'abcd',
                    },
                    general: {
                        config: {
                            EnableJoinLeaveMessageByDefault: 'true',
                        },
                    },
                    posts: {
                        posts: postsAny,
                        postsInChannel: {
                            abcd: [
                                {order: ['b', 'c', 'd', 'e'], recent: true},
                            ],
                        },
                    },
                    preferences: {
                        myPreferences: {},
                    },
                    users: {
                        profiles: {},
                    },
                },
            } as unknown as GlobalState;
            const actual = Selectors.getLatestReplyablePostId(state);

            expect(actual).toEqual(postsAny.e.id);
        });
    });

    describe('makeIsPostCommentMention', () => {
        const currentUser = {
            ...testState.entities.users.profiles[user1.id],
            notify_props: {
                comments: 'any',
            },
        };

        const modifiedState = {
            ...testState,
            entities: {
                ...testState.entities,
                users: {
                    ...testState.entities.users,
                    profiles: {
                        ...testState.entities.users.profiles,
                        [user1.id]: currentUser,
                    },
                },
            },
        };

        const isPostCommentMention = Selectors.makeIsPostCommentMention();

        it('Should return true as root post is by the current user', () => {
            expect(isPostCommentMention(modifiedState, 'e')).toEqual(true);
        });

        it('Should return false as post is not from currentUser', () => {
            expect(isPostCommentMention(modifiedState, 'b')).toEqual(false);
        });

        it('Should return true as post is from webhook but user created rootPost', () => {
            const modifiedWbhookPostState = {
                ...modifiedState,
                entities: {
                    ...modifiedState.entities,
                    posts: {
                        ...modifiedState.entities.posts,
                        posts: {
                            ...modifiedState.entities.posts.posts,
                            e: {
                                ...modifiedState.entities.posts.posts.e,
                                props: {
                                    from_webhook: 'true',
                                },
                                user_id: user1.id,
                            },
                        },
                    },
                },
            };

            expect(isPostCommentMention(modifiedWbhookPostState, 'e')).toEqual(true);
        });

        it('Should return true as user commented in the thread', () => {
            const modifiedThreadState = {
                ...modifiedState,
                entities: {
                    ...modifiedState.entities,
                    posts: {
                        ...modifiedState.entities.posts,
                        posts: {
                            ...modifiedState.entities.posts.posts,
                            a: {
                                ...modifiedState.entities.posts.posts.a,
                                user_id: 'b',
                            },
                            c: {
                                ...modifiedState.entities.posts.posts.c,
                                user_id: user1.id,
                            },
                        },
                    },
                },
            };

            expect(isPostCommentMention(modifiedThreadState, 'e')).toEqual(true);
        });

        it('Should return false as user commented in the thread but notify_props is for root only', () => {
            const modifiedCurrentUserForNotifyProps = {
                ...testState.entities.users.profiles[user1.id],
                notify_props: {
                    comments: 'root',
                },
            };

            const modifiedStateForRoot = {
                ...modifiedState,
                entities: {
                    ...modifiedState.entities,
                    posts: {
                        ...modifiedState.entities.posts,
                        posts: {
                            ...modifiedState.entities.posts.posts,
                            a: {
                                ...modifiedState.entities.posts.posts.a,
                                user_id: 'not current',
                            },
                            c: {
                                ...modifiedState.entities.posts.posts.c,
                                user_id: user1.id,
                            },
                        },
                    },
                    users: {
                        ...modifiedState.entities.users,
                        profiles: {
                            ...modifiedState.entities.users.profiles,
                            [user1.id]: modifiedCurrentUserForNotifyProps,
                        },
                    },
                },
            };

            expect(isPostCommentMention(modifiedStateForRoot, 'e')).toEqual(false);
        });

        it('Should return false as user created root post', () => {
            const modifiedCurrentUserForNotifyProps = {
                ...testState.entities.users.profiles[user1.id],
                notify_props: {
                    comments: 'root',
                },
            };

            const modifiedStateForRoot = {
                ...modifiedState,
                entities: {
                    ...modifiedState.entities,
                    users: {
                        ...modifiedState.entities.users,
                        profiles: {
                            ...modifiedState.entities.users.profiles,
                            [user1.id]: modifiedCurrentUserForNotifyProps,
                        },
                    },
                },
            };

            expect(isPostCommentMention(modifiedStateForRoot, 'e')).toEqual(true);
        });
    });
});

describe('getPostIdsInCurrentChannel', () => {
    test('should return null when channel is not loaded', () => {
        const state = {
            entities: {
                channels: {
                    currentChannelId: 'channel1',
                },
                posts: {
                    postsInChannel: {},
                },
            },
        } as unknown as GlobalState;

        const postIds = Selectors.getPostIdsInCurrentChannel(state);

        expect(postIds).toBe(null);
    });

    test('should return null when recent posts are not loaded', () => {
        const state = {
            entities: {
                channels: {
                    currentChannelId: 'channel1',
                },
                posts: {
                    postsInChannel: {
                        channel1: [
                            {order: ['post1', 'post2']},
                        ],
                    },
                },
            },
        } as unknown as GlobalState;

        const postIds = Selectors.getPostIdsInCurrentChannel(state);

        expect(postIds).toBe(null);
    });

    test('should return post order from recent block', () => {
        const state = {
            entities: {
                channels: {
                    currentChannelId: 'channel1',
                },
                posts: {
                    postsInChannel: {
                        channel1: [
                            {order: ['post1', 'post2'], recent: true},
                        ],
                    },
                },
            },
        } as unknown as GlobalState;

        const postIds = Selectors.getPostIdsInCurrentChannel(state);

        expect(postIds).toBe(state.entities.posts.postsInChannel.channel1[0].order);
    });
});

describe('getPostsInCurrentChannel', () => {
    test('should return null when channel is not loaded', () => {
        const state = {
            entities: {
                channels: {
                    currentChannelId: 'channel1',
                },
                general: {
                    config: {
                        EnableJoinLeaveMessageByDefault: 'true',
                    },
                },
                posts: {
                    posts: {},
                    postsInChannel: {},
                    postsInThread: {},
                },
                preferences: {
                    myPreferences: {
                        [`${Preferences.CATEGORY_ADVANCED_SETTINGS}--${Preferences.ADVANCED_FILTER_JOIN_LEAVE}`]: {value: 'true'},
                    },
                },
                users: {
                    profiles: {},
                },
            },
        } as unknown as GlobalState;

        const postIds = Selectors.getPostsInCurrentChannel(state);

        expect(postIds).toEqual(null);
    });

    test('should return null when recent posts are not loaded', () => {
        const post1 = {id: 'post1'};
        const post2 = {id: 'post2'};

        const state = {
            entities: {
                channels: {
                    currentChannelId: 'channel1',
                },
                general: {
                    config: {
                        EnableJoinLeaveMessageByDefault: 'true',
                    },
                },
                posts: {
                    posts: {
                        post1,
                        post2,
                    },
                    postsInChannel: {
                        channel1: [
                            {order: ['post1', 'post2']},
                        ],
                    },
                    postsInThread: {},
                },
                preferences: {
                    myPreferences: {
                        [`${Preferences.CATEGORY_ADVANCED_SETTINGS}--${Preferences.ADVANCED_FILTER_JOIN_LEAVE}`]: {value: 'true'},
                    },
                },
                users: {
                    profiles: {},
                },
            },
        } as unknown as GlobalState;

        const postIds = Selectors.getPostsInCurrentChannel(state);

        expect(postIds).toEqual(null);
    });

    test('should return post order from recent block', () => {
        const post1 = {id: 'post1'};
        const post2 = {id: 'post2'};

        const state = {
            entities: {
                channels: {
                    currentChannelId: 'channel1',
                },
                general: {
                    config: {
                        EnableJoinLeaveMessageByDefault: 'true',
                    },
                },
                posts: {
                    posts: {
                        post1,
                        post2,
                    },
                    postsInChannel: {
                        channel1: [
                            {order: ['post1', 'post2'], recent: true},
                        ],
                    },
                    postsInThread: {},
                },
                preferences: {
                    myPreferences: {
                        [`${Preferences.CATEGORY_ADVANCED_SETTINGS}--${Preferences.ADVANCED_FILTER_JOIN_LEAVE}`]: {value: 'true'},
                    },
                },
                users: {
                    profiles: {},
                },
            },
        } as unknown as GlobalState;

        const postIds = Selectors.getPostsInCurrentChannel(state);

        expect(postIds).toMatchObject([post1, post2]);
    });
});

describe('makeGetProfilesForThread', () => {
    it('should return profiles for threads in the right order and exclude current user', () => {
        const getProfilesForThread = Selectors.makeGetProfilesForThread();
        const user1 = {id: 'user1', update_at: 1000};
        const user2 = {id: 'user2', update_at: 1000};
        const user3 = {id: 'user3', update_at: 1000};

        const state = {
            entities: {
                general: {
                    config: {
                        EnableJoinLeaveMessageByDefault: 'true',
                    },
                },
                posts: {
                    posts: {
                        1001: {id: '1001', create_at: 1001, user_id: 'user1'},
                        1002: {id: '1002', create_at: 1002, root_id: '1001', user_id: 'user2'},
                        1003: {id: '1003', create_at: 1003},
                        1004: {id: '1004', create_at: 1004, root_id: '1001', user_id: 'user3'},
                        1005: {id: '1005', create_at: 1005},
                    },
                    postsInThread: {
                        1001: ['1002', '1004'],
                    },
                },
                users: {
                    profiles: {
                        user1,
                        user2,
                        user3,
                    },
                    currentUserId: 'user1',
                },
                preferences: {
                    myPreferences: {},
                },
            },
        } as unknown as GlobalState;

        expect(getProfilesForThread(state, '1001')).toEqual([user3, user2]);
    });

    it('should return empty array if profiles data does not exist', () => {
        const getProfilesForThread = Selectors.makeGetProfilesForThread();
        const user2 = {id: 'user2', update_at: 1000};

        const state = {
            entities: {
                general: {
                    config: {
                        EnableJoinLeaveMessageByDefault: 'true',
                    },
                },
                posts: {
                    posts: {
                        1001: {id: '1001', create_at: 1001, user_id: 'user1'},
                    },
                    postsInThread: {
                        1001: [],
                    },
                },
                users: {
                    profiles: {
                        user2,
                    },
                    currentUserId: 'user2',
                },
                preferences: {
                    myPreferences: {},
                },
            },
        } as unknown as GlobalState;

        expect(getProfilesForThread(state, '1001')).toEqual([]);
    });
});
