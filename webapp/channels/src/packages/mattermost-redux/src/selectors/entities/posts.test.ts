// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostWithFormatData} from 'mattermost-redux/selectors/entities/posts';

import {Posts, Preferences} from 'mattermost-redux/constants';

import * as Selectors from 'mattermost-redux/selectors/entities/posts';

import {makeGetProfilesForReactions} from 'mattermost-redux/selectors/entities/users';

import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';

import {Post} from '@mattermost/types/posts';
import {Reaction} from '@mattermost/types/reactions';
import {GlobalState} from '@mattermost/types/store';

import TestHelper from '../../../test/test_helper';

import {UserProfile} from '@mattermost/types/users';

const p = (override: Partial<PostWithFormatData>) => Object.assign(TestHelper.getPostMock(override), override);

describe('Selectors.Posts', () => {
    const user1 = TestHelper.fakeUserWithId();
    const profiles: Record<string, UserProfile> = {};
    profiles[user1.id] = user1;

    const posts = {
        a: p({id: 'a', channel_id: '1', create_at: 1, highlight: false, user_id: user1.id}),
        b: p({id: 'b', channel_id: '1', create_at: 2, highlight: false, user_id: user1.id}),
        c: p({id: 'c', root_id: 'a', channel_id: '1', create_at: 3, highlight: false, user_id: 'b'}),
        d: p({id: 'd', root_id: 'b', channel_id: '1', create_at: 4, highlight: false, user_id: 'b'}),
        e: p({id: 'e', root_id: 'a', channel_id: '1', create_at: 5, highlight: false, user_id: 'b'}),
        f: p({id: 'f', channel_id: '2', create_at: 6, highlight: false, user_id: 'b'}),
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

    it('get posts in channel', () => {
        const post1 = {
            ...posts.a,
            isFirstReply: false,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
        };

        const post2 = {
            ...posts.b,
            isFirstReply: false,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: true,
            replyCount: 1,
            isCommentMention: false,
        };

        const post3 = {
            ...posts.c,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: false,
            commentedOnPost: posts.a,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
        };

        const post4 = {
            ...posts.d,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: posts.b,
            consecutivePostByUser: true,
            replyCount: 1,
            isCommentMention: false,
        };

        const post5 = {
            ...posts.e,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: posts.a,
            consecutivePostByUser: true,
            replyCount: 2,
            isCommentMention: false,
        };

        const getPostsInChannel = Selectors.makeGetPostsInChannel();
        expect(getPostsInChannel(testState, '1', 30)).toEqual([post5, post4, post3, post2, post1]);
    });

    it('get posts around post in channel', () => {
        const post1: PostWithFormatData = {
            ...posts.a,
            isFirstReply: false,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
            highlight: false,
        };

        const post2: PostWithFormatData = {
            ...posts.b,
            isFirstReply: false,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: true,
            replyCount: 1,
            isCommentMention: false,
            highlight: false,
        };

        const post3: PostWithFormatData = {
            ...posts.c,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: false,
            commentedOnPost: posts.a,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
            highlight: true,
        };

        const post4: PostWithFormatData = {
            ...posts.d,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: posts.b,
            consecutivePostByUser: true,
            replyCount: 1,
            isCommentMention: false,
            highlight: false,
        };

        const post5: PostWithFormatData = {
            ...posts.e,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: posts.a,
            consecutivePostByUser: true,
            replyCount: 2,
            isCommentMention: false,
            highlight: false,
        };

        const getPostsAroundPost = Selectors.makeGetPostsAroundPost();
        expect(getPostsAroundPost(testState, post3.id, '1')).toEqual([post5, post4, post3, post2, post1]);
    });

    it('get posts in channel with notify comments as any', () => {
        const userAny = TestHelper.fakeUserWithId();
        userAny.notify_props = {comments: 'any'} as UserProfile['notify_props'];
        const profilesAny: Record<string, UserProfile> = {};
        profilesAny[userAny.id] = userAny;

        const postsAny = {
            a: p({id: 'a', channel_id: '1', create_at: 1, highlight: false, user_id: userAny.id}),
            b: p({id: 'b', channel_id: '1', create_at: 2, highlight: false, user_id: 'b'}),
            c: p({id: 'c', root_id: 'a', channel_id: '1', create_at: 3, highlight: false, user_id: 'b'}),
            d: p({id: 'd', root_id: 'b', channel_id: '1', create_at: 4, highlight: false, user_id: userAny.id}),
            e: p({id: 'e', root_id: 'a', channel_id: '1', create_at: 5, highlight: false, user_id: 'b'}),
            f: p({id: 'f', root_id: 'b', channel_id: '1', create_at: 6, highlight: false, user_id: 'b'}),
            g: p({id: 'g', channel_id: '2', create_at: 7, highlight: false, user_id: 'b'}),
        };

        const testStateAny = deepFreezeAndThrowOnMutation({
            entities: {
                users: {
                    currentUserId: userAny.id,
                    profiles: profilesAny,
                },
                posts: {
                    posts: postsAny,
                    postsInChannel: {
                        1: [
                            {order: ['f', 'e', 'd', 'c', 'b', 'a'], recent: true},
                        ],
                        2: [
                            {order: ['g'], recent: true},
                        ],
                    },
                    postsInThread: {
                        a: ['c', 'e'],
                        b: ['d', 'f'],
                    },
                },
                preferences: {
                    myPreferences: {},
                },
            },
        });

        const post1: PostWithFormatData = {
            ...postsAny.a,
            isFirstReply: false,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
            highlight: false,
        };

        const post2: PostWithFormatData = {
            ...postsAny.b,
            isFirstReply: false,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: true,
            highlight: false,
        };

        const post3: PostWithFormatData = {
            ...postsAny.c,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: false,
            commentedOnPost: postsAny.a,
            consecutivePostByUser: true,
            replyCount: 2,
            isCommentMention: true,
            highlight: false,
        };

        const post4: PostWithFormatData = {
            ...postsAny.d,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: postsAny.b,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
            highlight: false,
        };

        const post5: PostWithFormatData = {
            ...postsAny.e,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: postsAny.a,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: true,
            highlight: false,
        };

        const post6: PostWithFormatData = {
            ...postsAny.f,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: postsAny.b,
            consecutivePostByUser: true,
            replyCount: 2,
            isCommentMention: true,
            highlight: false,
        };

        const getPostsInChannel = Selectors.makeGetPostsInChannel();
        expect(getPostsInChannel(testStateAny, '1', 30)).toEqual([post6, post5, post4, post3, post2, post1]);
    });

    it('get posts in channel with notify comments as root', () => {
        const userRoot = TestHelper.fakeUserWithId();
        userRoot.notify_props = {comments: 'root'} as UserProfile['notify_props'];
        const profilesRoot: Record<string, UserProfile> = {};
        profilesRoot[userRoot.id] = userRoot;

        const postsRoot = {
            a: p({id: 'a', channel_id: '1', create_at: 1, highlight: false, user_id: userRoot.id}),
            b: p({id: 'b', channel_id: '1', create_at: 2, highlight: false, user_id: 'b'}),
            c: p({id: 'c', root_id: 'a', channel_id: '1', create_at: 3, highlight: false, user_id: 'b'}),
            d: p({id: 'd', root_id: 'b', channel_id: '1', create_at: 4, highlight: false, user_id: userRoot.id}),
            e: p({id: 'e', root_id: 'a', channel_id: '1', create_at: 5, highlight: false, user_id: 'b'}),
            f: p({id: 'f', root_id: 'b', channel_id: '1', create_at: 6, highlight: false, user_id: 'b'}),
            g: p({id: 'g', channel_id: '2', create_at: 7, highlight: false, user_id: 'b'}),
        };

        const testStateRoot = deepFreezeAndThrowOnMutation({
            entities: {
                users: {
                    currentUserId: userRoot.id,
                    profiles: profilesRoot,
                },
                posts: {
                    posts: postsRoot,
                    postsInChannel: {
                        1: [
                            {order: ['f', 'e', 'd', 'c', 'b', 'a'], recent: true},
                        ],
                        2: [
                            {order: ['g'], recent: true},
                        ],
                    },
                    postsInThread: {
                        a: ['c', 'e'],
                        b: ['d', 'f'],
                    },
                },
                preferences: {
                    myPreferences: {},
                },
            },
        });

        const post1 = {
            ...postsRoot.a,
            isFirstReply: false,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
        };

        const post2 = {
            ...postsRoot.b,
            isFirstReply: false,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
        };

        const post3 = {
            ...postsRoot.c,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: false,
            commentedOnPost: postsRoot.a,
            consecutivePostByUser: true,
            replyCount: 2,
            isCommentMention: true,
        };

        const post4 = {
            ...postsRoot.d,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: postsRoot.b,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
        };

        const post5 = {
            ...postsRoot.e,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: postsRoot.a,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: true,
        };

        const post6 = {
            ...postsRoot.f,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: postsRoot.b,
            consecutivePostByUser: true,
            replyCount: 2,
            isCommentMention: false,
        };

        const getPostsInChannel = Selectors.makeGetPostsInChannel();
        expect(getPostsInChannel(testStateRoot, '1', 30)).toEqual([post6, post5, post4, post3, post2, post1]);
    });

    it('get posts in channel with notify comments as never', () => {
        const userNever = TestHelper.fakeUserWithId();
        userNever.notify_props = {comments: 'never'} as UserProfile['notify_props'];
        const profilesNever: Record<string, UserProfile> = {};
        profilesNever[userNever.id] = userNever;

        const postsNever = {
            a: p({id: 'a', channel_id: '1', create_at: 1, highlight: false, user_id: userNever.id}),
            b: p({id: 'b', channel_id: '1', create_at: 2, highlight: false, user_id: 'b'}),
            c: p({id: 'c', root_id: 'a', channel_id: '1', create_at: 3, highlight: false, user_id: 'b'}),
            d: p({id: 'd', root_id: 'b', channel_id: '1', create_at: 4, highlight: false, user_id: userNever.id}),
            e: p({id: 'e', root_id: 'a', channel_id: '1', create_at: 5, highlight: false, user_id: 'b'}),
            f: p({id: 'f', root_id: 'b', channel_id: '1', create_at: 6, highlight: false, user_id: 'b'}),
            g: p({id: 'g', channel_id: '2', create_at: 7, highlight: false, user_id: 'b'}),
        };

        const testStateNever = deepFreezeAndThrowOnMutation({
            entities: {
                users: {
                    currentUserId: userNever.id,
                    profiles: profilesNever,
                },
                posts: {
                    posts: postsNever,
                    postsInChannel: {
                        1: [
                            {order: ['f', 'e', 'd', 'c', 'b', 'a'], recent: true},
                        ],
                        2: [
                            {order: ['g'], recent: true},
                        ],
                    },
                    postsInThread: {
                        a: ['c', 'e'],
                        b: ['d', 'f'],
                    },
                },
                preferences: {
                    myPreferences: {},
                },
            },
        });

        const post1: PostWithFormatData = {
            ...postsNever.a,
            isFirstReply: false,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
            highlight: false,
        };

        const post2: PostWithFormatData = {
            ...postsNever.b,
            isFirstReply: false,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
            highlight: false,
        };

        const post3: PostWithFormatData = {
            ...postsNever.c,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: false,
            commentedOnPost: postsNever.a,
            consecutivePostByUser: true,
            replyCount: 2,
            isCommentMention: false,
            highlight: false,
        };

        const post4: PostWithFormatData = {
            ...postsNever.d,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: postsNever.b,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
            highlight: false,
        };

        const post5: PostWithFormatData = {
            ...postsNever.e,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: postsNever.a,
            consecutivePostByUser: false,
            replyCount: 2,
            isCommentMention: false,
            highlight: false,
        };

        const post6: PostWithFormatData = {
            ...postsNever.f,
            isFirstReply: true,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: postsNever.b,
            consecutivePostByUser: true,
            replyCount: 2,
            isCommentMention: false,
            highlight: false,
        };

        const getPostsInChannel = Selectors.makeGetPostsInChannel();
        expect(getPostsInChannel(testStateNever, '1', 30)).toEqual([post6, post5, post4, post3, post2, post1]);
    });

    it('gets posts around post in channel not adding ephemeral post to replyCount', () => {
        const userAny = TestHelper.fakeUserWithId();
        userAny.notify_props = {comments: 'any'} as UserProfile['notify_props'];
        const profilesAny: Record<string, UserProfile> = {};
        profilesAny[userAny.id] = userAny;

        const postsAny = {
            a: {id: 'a', channel_id: '1', create_at: 1, highlight: false, user_id: userAny.id},
            b: {id: 'b', root_id: 'a', channel_id: '1', create_at: 2, highlight: false, user_id: 'b'},
            c: {id: 'c', root_id: 'a', channel_id: '1', create_at: 3, highlight: false, user_id: 'b', type: Posts.POST_TYPES.EPHEMERAL},
            d: {id: 'd', channel_id: '2', create_at: 4, highlight: false, user_id: 'b'},
        };

        const testStateAny = deepFreezeAndThrowOnMutation({
            entities: {
                users: {
                    currentUserId: userAny.id,
                    profiles: profilesAny,
                },
                posts: {
                    posts: postsAny,
                    postsInChannel: {
                        1: [
                            {order: ['c', 'b', 'a'], recent: true},
                        ],
                        2: [
                            {order: ['d'], recent: true},
                        ],
                    },
                    postsInThread: {
                        a: ['b', 'c'],
                    },
                },
                preferences: {
                    myPreferences: {},
                },
            },
        });

        const post1 = {
            ...postsAny.a,
            isFirstReply: false,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 1,
            isCommentMention: false,
            highlight: true,
        };

        const post2 = {
            ...postsAny.b,
            isFirstReply: true,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 1,
            isCommentMention: true,
        };

        const post3 = {
            ...postsAny.c,
            isFirstReply: false,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 1,
            isCommentMention: true,
        };

        const getPostsAroundPost = Selectors.makeGetPostsAroundPost();
        expect(getPostsAroundPost(testStateAny, post1.id, '1')).toEqual([post3, post2, post1]);
    });

    it('gets posts in channel not adding ephemeral post to replyCount', () => {
        const userAny = TestHelper.fakeUserWithId();
        userAny.notify_props = {comments: 'any'} as UserProfile['notify_props'];
        const profilesAny: Record<string, UserProfile> = {};
        profilesAny[userAny.id] = userAny;

        const postsAny = {
            a: {id: 'a', channel_id: '1', create_at: 1, highlight: false, user_id: userAny.id},
            b: {id: 'b', root_id: 'a', channel_id: '1', create_at: 2, highlight: false, user_id: 'b', type: Posts.POST_TYPES.EPHEMERAL},
            c: {id: 'c', root_id: 'a', channel_id: '1', create_at: 3, highlight: false, user_id: 'b', state: Posts.POST_DELETED},
            d: {id: 'd', channel_id: '2', create_at: 4, highlight: false, user_id: 'b'},
        };

        const testStateAny = deepFreezeAndThrowOnMutation({
            entities: {
                users: {
                    currentUserId: userAny.id,
                    profiles: profilesAny,
                },
                posts: {
                    posts: postsAny,
                    postsInChannel: {
                        1: [
                            {order: ['c', 'b', 'a'], recent: true},
                        ],
                        2: [
                            {order: ['d'], recent: true},
                        ],
                    },
                    postsInThread: {
                        a: ['b', 'c'],
                    },
                },
                preferences: {
                    myPreferences: {},
                },
            },
        });

        const post1 = {
            ...postsAny.a,
            isFirstReply: false,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 0,
            isCommentMention: false,
        };

        const post2 = {
            ...postsAny.b,
            isFirstReply: true,
            isLastReply: false,
            previousPostIsComment: false,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 0,
            isCommentMention: true,
        };

        const post3 = {
            ...postsAny.c,
            isFirstReply: false,
            isLastReply: true,
            previousPostIsComment: true,
            commentedOnPost: undefined,
            consecutivePostByUser: false,
            replyCount: 0,
            isCommentMention: true,
        };

        const getPostsInChannel = Selectors.makeGetPostsInChannel();
        expect(getPostsInChannel(testStateAny, '1', 30)).toEqual([post3, post2, post1]);
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

    describe('getPostIdsAroundPost', () => {
        it('no posts around', () => {
            const getPostIdsAroundPost = Selectors.makeGetPostIdsAroundPost();

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

            expect(getPostIdsAroundPost(state, 'a', '1234')).toEqual(['a']);
        });

        it('posts around', () => {
            const getPostIdsAroundPost = Selectors.makeGetPostIdsAroundPost();

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

            expect(getPostIdsAroundPost(state, 'c', '1234')).toEqual(['a', 'b', 'c', 'd', 'e']);
        });

        it('posts before limit', () => {
            const getPostIdsAroundPost = Selectors.makeGetPostIdsAroundPost();

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

            expect(getPostIdsAroundPost(state, 'a', '1234', {postsBeforeCount: 2})).toEqual(['a', 'b', 'c']);
        });

        it('posts after limit', () => {
            const getPostIdsAroundPost = Selectors.makeGetPostIdsAroundPost();

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

            expect(getPostIdsAroundPost(state, 'e', '1234', {postsAfterCount: 3})).toEqual(['b', 'c', 'd', 'e']);
        });

        it('posts before/after limit', () => {
            const getPostIdsAroundPost = Selectors.makeGetPostIdsAroundPost();

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

            expect(getPostIdsAroundPost(state, 'c', '1234', {postsBeforeCount: 2, postsAfterCount: 1})).toEqual(['b', 'c', 'd', 'e']);
        });

        it('memoization', () => {
            const getPostIdsAroundPost = Selectors.makeGetPostIdsAroundPost();

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
            let previous = getPostIdsAroundPost(state, 'c', '1234');
            let now = getPostIdsAroundPost(state, 'c', '1234');
            expect(now).toEqual(['a', 'b', 'c', 'd', 'e']);
            expect(now).toBe(previous);

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

            previous = now;
            now = getPostIdsAroundPost(state, 'c', '1234');
            expect(now).toEqual(['a', 'b', 'c', 'd', 'e']);
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
            now = getPostIdsAroundPost(state, 'c', '1234');
            expect(now).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostIdsAroundPost(state, 'c', '1234');
            expect(now).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
            expect(now).toBe(previous);

            // Change of channel
            previous = now;
            now = getPostIdsAroundPost(state, 'i', 'abcd');
            expect(now).toEqual(['g', 'h', 'i', 'j', 'k', 'l']);
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostIdsAroundPost(state, 'i', 'abcd');
            expect(now).toEqual(['g', 'h', 'i', 'j', 'k', 'l']);
            expect(now).toBe(previous);

            // With limits
            previous = now;
            now = getPostIdsAroundPost(state, 'i', 'abcd', {postsBeforeCount: 2, postsAfterCount: 1});
            expect(now).toEqual(['h', 'i', 'j', 'k']);
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostIdsAroundPost(state, 'i', 'abcd', {postsBeforeCount: 2, postsAfterCount: 1}); // Note that the options object is a new object each time
            expect(now).toEqual(['h', 'i', 'j', 'k']);
            expect(now).toBe(previous);

            // Change of limits
            previous = now;
            now = getPostIdsAroundPost(state, 'i', 'abcd', {postsBeforeCount: 1, postsAfterCount: 2});
            expect(now).toEqual(['g', 'h', 'i', 'j']);
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostIdsAroundPost(state, 'i', 'abcd', {postsBeforeCount: 1, postsAfterCount: 2});
            expect(now).toEqual(['g', 'h', 'i', 'j']);
            expect(now).toBe(previous);

            // Change of post
            previous = now;
            now = getPostIdsAroundPost(state, 'j', 'abcd', {postsBeforeCount: 1, postsAfterCount: 2});
            expect(now).toEqual(['h', 'i', 'j', 'k']);
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostIdsAroundPost(state, 'j', 'abcd', {postsBeforeCount: 1, postsAfterCount: 2});
            expect(now).toEqual(['h', 'i', 'j', 'k']);
            expect(now).toBe(previous);

            // Change of posts past limit
            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        postsInChannel: {
                            ...state.entities.posts.postsInChannel,
                            abcd: [
                                {order: ['y', 'g', 'h', 'i', 'j', 'k', 'l', 'f', 'z'], recent: true},
                            ],
                        },
                    },
                },
            };
            previous = now;
            now = getPostIdsAroundPost(state, 'j', 'abcd', {postsBeforeCount: 1, postsAfterCount: 2});
            expect(now).toEqual(['h', 'i', 'j', 'k']);
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
            now = getPostIdsAroundPost(state, 'j', 'abcd', {postsBeforeCount: 1, postsAfterCount: 2});
            expect(now).toEqual(['i', 'h', 'j', 'l']);
            expect(now).not.toBe(previous);

            previous = now;
            now = getPostIdsAroundPost(state, 'j', 'abcd', {postsBeforeCount: 1, postsAfterCount: 2});
            expect(now).toEqual(['i', 'h', 'j', 'l']);
            expect(now).toBe(previous);
        });

        it('memoization with multiple selectors', () => {
            const getPostIdsAroundPost1 = Selectors.makeGetPostIdsAroundPost();
            const getPostIdsAroundPost2 = Selectors.makeGetPostIdsAroundPost();

            const state = {
                entities: {
                    posts: {
                        postsInChannel: {
                            1234: [
                                {order: ['a', 'b', 'c', 'd', 'e', 'f'], recent: true},
                            ],
                            abcd: [
                                {order: ['g', 'h', 'i'], recent: true},
                            ],
                        },
                    },
                },
            } as unknown as GlobalState;

            const previous1 = getPostIdsAroundPost1(state, 'c', '1234');
            const previous2 = getPostIdsAroundPost2(state, 'h', 'abcd', {postsBeforeCount: 1, postsAfterCount: 0});

            expect(previous1).not.toBe(previous2);

            const now1 = getPostIdsAroundPost1(state, 'c', '1234');
            const now2 = getPostIdsAroundPost2(state, 'i', 'abcd', {postsBeforeCount: 1, postsAfterCount: 0});

            expect(now1).toBe(previous1);
            expect(now2).not.toBe(previous2);
            expect(now1).not.toBe(now2);
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
                a: {id: 'a', channel_id: 'a', create_at: 1, highlight: false, user_id: 'a'},
                b: {id: 'b', root_id: 'a', channel_id: 'abcd', create_at: 3, highlight: false, user_id: 'b', state: Posts.POST_DELETED},
                c: {id: 'c', root_id: 'a', channel_id: 'abcd', create_at: 3, highlight: false, user_id: 'b', type: 'system_join_channel'},
                d: {id: 'd', root_id: 'a', channel_id: 'abcd', create_at: 3, highlight: false, user_id: 'b', type: Posts.POST_TYPES.EPHEMERAL},
                e: {id: 'e', channel_id: 'abcd', create_at: 4, highlight: false, user_id: 'b'},
            };
            const state = {
                entities: {
                    channels: {
                        currentChannelId: 'abcd',
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
                                    from_webhook: true,
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

describe('getCurrentUsersLatestPost', () => {
    const user1 = TestHelper.fakeUserWithId();
    const profiles: Record<string, UserProfile> = {};
    profiles[user1.id] = user1;
    it('no posts', () => {
        const noPosts = {};
        const state = {
            entities: {
                users: {
                    currentUserId: user1.id,
                    profiles,
                },
                posts: {
                    posts: noPosts,
                    postsInChannel: [],
                },
                preferences: {
                    myPreferences: {},
                },
                channels: {
                    currentChannelId: 'abcd',
                },
            },
        } as unknown as GlobalState;
        const actual = Selectors.getCurrentUsersLatestPost(state, '');

        expect(actual).toEqual(null);
    });

    it('return first post which user can edit', () => {
        const postsAny = {
            a: {id: 'a', channel_id: 'a', create_at: 1, highlight: false, user_id: 'a'},
            b: {id: 'b', root_id: 'a', channel_id: 'abcd', create_at: 3, highlight: false, user_id: 'b', state: Posts.POST_DELETED},
            c: {id: 'c', root_id: 'a', channel_id: 'abcd', create_at: 3, highlight: false, user_id: 'b', type: 'system_join_channel'},
            d: {id: 'd', root_id: 'a', channel_id: 'abcd', create_at: 3, highlight: false, user_id: 'b', type: Posts.POST_TYPES.EPHEMERAL},
            e: {id: 'e', channel_id: 'abcd', create_at: 4, highlight: false, user_id: 'c'},
            f: {id: 'f', channel_id: 'abcd', create_at: 4, highlight: false, user_id: user1.id},
        };
        const state = {
            entities: {
                users: {
                    currentUserId: user1.id,
                    profiles,
                },
                posts: {
                    posts: postsAny,
                    postsInChannel: {
                        abcd: [
                            {order: ['b', 'c', 'd', 'e', 'f'], recent: true},
                        ],
                    },
                    postsInThread: {},
                },
                preferences: {
                    myPreferences: {},
                },
                channels: {
                    currentChannelId: 'abcd',
                },
            },
        } as unknown as GlobalState;
        const actual = Selectors.getCurrentUsersLatestPost(state, '');

        expect(actual).toMatchObject(postsAny.f);
    });

    it('return first post which user can edit ignore pending and failed', () => {
        const postsAny = {
            a: {id: 'a', channel_id: 'a', create_at: 1, highlight: false, user_id: 'a'},
            b: {id: 'b', channel_id: 'abcd', create_at: 4, highlight: false, user_id: user1.id, pending_post_id: 'b'},
            c: {id: 'c', channel_id: 'abcd', create_at: 4, highlight: false, user_id: user1.id, failed: true},
            d: {id: 'd', root_id: 'a', channel_id: 'abcd', create_at: 3, highlight: false, user_id: 'b', type: Posts.POST_TYPES.EPHEMERAL},
            e: {id: 'e', channel_id: 'abcd', create_at: 4, highlight: false, user_id: 'c'},
            f: {id: 'f', channel_id: 'abcd', create_at: 4, highlight: false, user_id: user1.id},
        };
        const state = {
            entities: {
                users: {
                    currentUserId: user1.id,
                    profiles,
                },
                posts: {
                    posts: postsAny,
                    postsInChannel: {
                        abcd: [
                            {order: ['b', 'c', 'd', 'e', 'f'], recent: true},
                        ],
                    },
                    postsInThread: {},
                },
                preferences: {
                    myPreferences: {},
                },
                channels: {
                    currentChannelId: 'abcd',
                },
            },
        } as unknown as GlobalState;
        const actual = Selectors.getCurrentUsersLatestPost(state, '');

        expect(actual).toMatchObject(postsAny.f);
    });

    it('return first post which has rootId match', () => {
        const postsAny = {
            a: {id: 'a', channel_id: 'a', create_at: 1, highlight: false, user_id: 'a'},
            b: {id: 'b', root_id: 'a', channel_id: 'abcd', create_at: 3, highlight: false, user_id: 'b', state: Posts.POST_DELETED},
            c: {id: 'c', root_id: 'a', channel_id: 'abcd', create_at: 3, highlight: false, user_id: 'b', type: 'system_join_channel'},
            d: {id: 'd', root_id: 'a', channel_id: 'abcd', create_at: 3, highlight: false, user_id: 'b', type: Posts.POST_TYPES.EPHEMERAL},
            e: {id: 'e', channel_id: 'abcd', create_at: 4, highlight: false, user_id: 'c'},
            f: {id: 'f', root_id: 'e', channel_id: 'abcd', create_at: 4, highlight: false, user_id: user1.id},
        };
        const state = {
            entities: {
                users: {
                    currentUserId: user1.id,
                    profiles,
                },
                posts: {
                    posts: postsAny,
                    postsInChannel: {
                        abcd: [
                            {order: ['b', 'c', 'd', 'e', 'f'], recent: true},
                        ],
                    },
                    postsInThread: {},
                },
                preferences: {
                    myPreferences: {},
                },
                channels: {
                    currentChannelId: 'abcd',
                },
            },
        } as unknown as GlobalState;
        const actual = Selectors.getCurrentUsersLatestPost(state, 'e');

        expect(actual).toMatchObject(postsAny.f);
    });

    it('should not return posts outside of the recent block', () => {
        const postsAny = {
            a: {id: 'a', channel_id: 'a', create_at: 1, user_id: 'a'},
        };
        const state = {
            entities: {
                users: {
                    currentUserId: user1.id,
                    profiles,
                },
                posts: {
                    posts: postsAny,
                    postsInChannel: {
                        abcd: [
                            {order: ['a'], recent: false},
                        ],
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                channels: {
                    currentChannelId: 'abcd',
                },
            },
        } as unknown as GlobalState;
        const actual = Selectors.getCurrentUsersLatestPost(state, 'e');

        expect(actual).toEqual(null);
    });

    it('determine the sending posts', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: user1.id,
                    profiles,
                },
                posts: {
                    posts: {},
                    postsInChannel: {},
                    pendingPostIds: ['1', '2', '3'],
                },
                preferences: {
                    myPreferences: {},
                },
                channels: {
                    currentChannelId: 'abcd',
                },
            },
        } as unknown as GlobalState;

        expect(Selectors.isPostIdSending(state, '1')).toEqual(true);
        expect(Selectors.isPostIdSending(state, '2')).toEqual(true);
        expect(Selectors.isPostIdSending(state, '3')).toEqual(true);
        expect(Selectors.isPostIdSending(state, '4')).toEqual(false);
        expect(Selectors.isPostIdSending(state, '')).toEqual(false);
    });
});

describe('getExpandedLink', () => {
    it('should get the expanded link from the state', () => {
        const state = {
            entities: {
                posts: {
                    expandedURLs: {
                        a: 'b',
                        c: 'd',
                    },
                },
            },
        } as unknown as GlobalState;
        expect(Selectors.getExpandedLink(state, 'a')).toEqual('b');
        expect(Selectors.getExpandedLink(state, 'c')).toEqual('d');
    });

    it('should return undefined if it is not saved', () => {
        const state = {
            entities: {
                posts: {
                    expandedURLs: {
                        a: 'b',
                        c: 'd',
                    },
                },
            },
        } as unknown as GlobalState;
        expect(Selectors.getExpandedLink(state, 'b')).toEqual(undefined);
        expect(Selectors.getExpandedLink(state, '')).toEqual(undefined);
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
