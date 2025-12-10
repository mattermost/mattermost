// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ActivityEntry, Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {
    COMBINED_USER_ACTIVITY,
    combineUserActivitySystemPost,
    DATE_LINE,
    getDateForDateLine,
    getFirstPostId,
    getLastPostId,
    getLastPostIndex,
    getPostIdsForCombinedUserActivityPost,
    isCombinedUserActivityPost,
    isDateLine,
    makeAddDateSeparatorsForSearchResults,
    makeCombineUserActivityPosts,
    makeFilterPostsAndAddSeparators,
    makeGenerateCombinedPost,
    extractUserActivityData,
    START_OF_NEW_MESSAGES,
} from './post_list';

import TestHelper from '../../test/test_helper';
import {Posts, Preferences} from '../constants';

describe('makeFilterPostsAndAddSeparators', () => {
    const realDateNow = Date.now.bind(global.Date);

    beforeEach(() => {
        // Mock Date.now to return consistent values in tests
        // Use a realistic timestamp (Jan 1, 2024) to avoid timezone calculation issues
        global.Date.now = jest.fn(() => 1704067200000);
    });

    afterEach(() => {
        // Restore original Date.now
        global.Date.now = realDateNow;
    });

    it('filter join/leave posts', () => {
        const filterPostsAndAddSeparators = makeFilterPostsAndAddSeparators();
        const time = Date.now();
        const today = new Date(time);

        // Calculate expected date line after timezone adjustment
        // pushPostDateIfNeeded adjusts by (currentOffset - userTimezoneOffset)
        const currentOffset = today.getTimezoneOffset() * 60 * 1000;
        const expectedDateLine = time + currentOffset; // UTC user has 0 offset

        let state = {
            entities: {
                general: {
                    config: {
                        EnableJoinLeaveMessageByDefault: 'true',
                    },
                },
                posts: {
                    posts: {
                        1001: {id: '1001', create_at: time, type: ''},
                        1002: {id: '1002', create_at: time + 1, type: Posts.POST_TYPES.JOIN_CHANNEL},
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                users: {
                    currentUserId: '1234',
                    profiles: {
                        1234: {id: '1234', username: 'user', timezone: {useAutomaticTimezone: 'false', manualTimezone: 'UTC'}},
                    },
                },
            },
        } as unknown as GlobalState;
        const lastViewedAt = Number.POSITIVE_INFINITY;
        const postIds = ['1002', '1001'];
        const indicateNewMessages = true;

        // Defaults to show post
        let now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages});
        expect(now).toEqual([
            '1002',
            '1001',
            'date-' + expectedDateLine,
        ]);

        // Show join/leave posts
        state = {
            ...state,
            entities: {
                ...state.entities,
                preferences: {
                    ...state.entities.preferences,
                    myPreferences: {
                        ...state.entities.preferences.myPreferences,
                        [getPreferenceKey(Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_FILTER_JOIN_LEAVE)]: {
                            category: Preferences.CATEGORY_ADVANCED_SETTINGS,
                            name: Preferences.ADVANCED_FILTER_JOIN_LEAVE,
                            value: 'true',
                        },
                    } as GlobalState['entities']['preferences']['myPreferences'],
                },
            },
        };

        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages});
        expect(now).toEqual([
            '1002',
            '1001',
            'date-' + expectedDateLine,
        ]);

        // Hide join/leave posts
        state = {
            ...state,
            entities: {
                ...state.entities,
                preferences: {
                    ...state.entities.preferences,
                    myPreferences: {
                        ...state.entities.preferences.myPreferences,
                        [getPreferenceKey(Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_FILTER_JOIN_LEAVE)]: {
                            category: Preferences.CATEGORY_ADVANCED_SETTINGS,
                            name: Preferences.ADVANCED_FILTER_JOIN_LEAVE,
                            value: 'false',
                        },
                    } as GlobalState['entities']['preferences']['myPreferences'],
                },
            },
        };

        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages});
        expect(now).toEqual([
            '1001',
            'date-' + expectedDateLine,
        ]);

        // always show join/leave posts for the current user
        state = {
            ...state,
            entities: {
                ...state.entities,
                posts: {
                    ...state.entities.posts,
                    posts: {
                        ...state.entities.posts.posts,
                        1002: {id: '1002', create_at: time + 1, type: Posts.POST_TYPES.JOIN_CHANNEL, props: {username: 'user'}},
                    },
                },
            },
        } as unknown as GlobalState;

        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages});

        expect(now).toEqual([
            '1002',
            '1001',
            'date-' + expectedDateLine,
        ]);
    });

    it('should filter out already-expired burn-on-read posts', () => {
        const filterPostsAndAddSeparators = makeFilterPostsAndAddSeparators();
        const now = Date.now();
        const expiredTime = now - 60000; // 1 minute ago (expired)
        const futureTime = now + 60000; // 1 minute from now (not expired)

        const state = {
            entities: {
                general: {
                    config: {
                        EnableBurnOnRead: 'true',
                    },
                },
                posts: {
                    posts: {
                        1001: {id: '1001', create_at: now, type: '', user_id: 'user1'},
                        1002: {id: '1002', create_at: now + 1, type: Posts.POST_TYPES.BURN_ON_READ, metadata: {expire_at: expiredTime}, user_id: 'user2'},
                        1003: {id: '1003', create_at: now + 2, type: Posts.POST_TYPES.BURN_ON_READ, metadata: {expire_at: futureTime}, user_id: 'user3'},
                        1004: {id: '1004', create_at: now + 3, type: '', user_id: 'user4'},
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                users: {
                    currentUserId: '1234',
                    profiles: {
                        1234: {id: '1234', username: 'user', timezone: {useAutomaticTimezone: 'false', manualTimezone: 'UTC'}},
                    },
                },
            },
        } as unknown as GlobalState;

        const postIds = ['1004', '1003', '1002', '1001'];
        const lastViewedAt = Number.POSITIVE_INFINITY;
        const indicateNewMessages = false;

        const result = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages});

        // Should include: regular post 1004, non-expired burn post 1003, regular post 1001
        // Should exclude: expired burn post 1002
        expect(result).toContain('1001');
        expect(result).toContain('1003');
        expect(result).toContain('1004');
        expect(result).not.toContain('1002');
    });

    it('should include burn-on-read posts without expire_at prop', () => {
        const filterPostsAndAddSeparators = makeFilterPostsAndAddSeparators();
        const now = Date.now();

        const state = {
            entities: {
                general: {
                    config: {
                        EnableBurnOnRead: 'true',
                    },
                },
                posts: {
                    posts: {
                        1001: {id: '1001', create_at: now, type: Posts.POST_TYPES.BURN_ON_READ, user_id: 'user1'},
                        1002: {id: '1002', create_at: now + 1, type: Posts.POST_TYPES.BURN_ON_READ, user_id: 'user2'},
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                users: {
                    currentUserId: '1234',
                    profiles: {
                        1234: {id: '1234', username: 'user', timezone: {useAutomaticTimezone: 'false', manualTimezone: 'UTC'}},
                    },
                },
            },
        } as unknown as GlobalState;

        const postIds = ['1002', '1001'];
        const lastViewedAt = Number.POSITIVE_INFINITY;
        const indicateNewMessages = false;

        const result = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages});

        // Both posts should be included (no expire_at to filter on)
        expect(result).toContain('1001');
        expect(result).toContain('1002');
    });

    it('should filter out all burn-on-read posts when feature is disabled', () => {
        const filterPostsAndAddSeparators = makeFilterPostsAndAddSeparators();
        const now = Date.now();

        const state = {
            entities: {
                general: {
                    config: {
                        EnableBurnOnRead: 'false',
                    },
                },
                posts: {
                    posts: {
                        1001: {id: '1001', create_at: now, type: '', user_id: 'user1'},
                        1002: {id: '1002', create_at: now + 1, type: Posts.POST_TYPES.BURN_ON_READ, user_id: 'user2'},
                        1003: {id: '1003', create_at: now + 2, type: Posts.POST_TYPES.BURN_ON_READ, metadata: {expire_at: now + 60000}, user_id: 'user3'},
                        1004: {id: '1004', create_at: now + 3, type: '', user_id: 'user4'},
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                users: {
                    currentUserId: '1234',
                    profiles: {
                        1234: {id: '1234', username: 'user', timezone: {useAutomaticTimezone: 'false', manualTimezone: 'UTC'}},
                    },
                },
            },
        } as unknown as GlobalState;

        const postIds = ['1004', '1003', '1002', '1001'];
        const lastViewedAt = Number.POSITIVE_INFINITY;
        const indicateNewMessages = false;

        const result = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages});

        // Feature flag only controls creation, not display
        // Should include: regular posts (1001, 1004) AND unrevealed BoR post (1002)
        // Should exclude: ONLY expired BoR posts
        expect(result).toContain('1001');
        expect(result).toContain('1004');
        expect(result).toContain('1002'); // Unrevealed BoR post - SHOWS (feature flag doesn't affect display)
        expect(result).toContain('1003'); // Revealed BoR post (not expired yet) - SHOWS
    });

    it('new messages indicator', () => {
        const filterPostsAndAddSeparators = makeFilterPostsAndAddSeparators();
        const time = Date.now();
        const today = new Date(time);

        // Calculate expected date line after timezone adjustment
        const currentOffset = today.getTimezoneOffset() * 60 * 1000;
        const expectedDateLine = time + 1000 + currentOffset; // UTC user has 0 offset

        const state = {
            entities: {
                general: {
                    config: {},
                },
                posts: {
                    posts: {
                        1000: {id: '1000', create_at: time + 1000, type: ''},
                        1005: {id: '1005', create_at: time + 1005, type: ''},
                        1010: {id: '1010', create_at: time + 1010, type: ''},
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                users: {
                    currentUserId: '1234',
                    profiles: {
                        1234: {id: '1234', username: 'user', timezone: {useAutomaticTimezone: 'false', manualTimezone: 'UTC'}},
                    },
                },
            },
        } as unknown as GlobalState;

        const postIds = ['1010', '1005', '1000']; // Remember that we list the posts backwards

        // Do not show new messages indicator before all posts
        let now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt: 0, indicateNewMessages: true});
        expect(now).toEqual([
            '1010',
            '1005',
            '1000',
            'date-' + expectedDateLine,
        ]);

        now = filterPostsAndAddSeparators(state, {postIds, indicateNewMessages: true, lastViewedAt: 0});
        expect(now).toEqual([
            '1010',
            '1005',
            '1000',
            'date-' + expectedDateLine,
        ]);

        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt: time + 999, indicateNewMessages: false});
        expect(now).toEqual([
            '1010',
            '1005',
            '1000',
            'date-' + expectedDateLine,
        ]);

        // Show new messages indicator before all posts
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt: time + 999, indicateNewMessages: true});
        expect(now).toEqual([
            '1010',
            '1005',
            '1000',
            START_OF_NEW_MESSAGES + (time + 999),
            'date-' + expectedDateLine,
        ]);

        // Show indicator between posts
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt: time + 1003, indicateNewMessages: true});
        expect(now).toEqual([
            '1010',
            '1005',
            START_OF_NEW_MESSAGES + (time + 1003),
            '1000',
            'date-' + expectedDateLine,
        ]);

        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt: time + 1006, indicateNewMessages: true});
        expect(now).toEqual([
            '1010',
            START_OF_NEW_MESSAGES + (time + 1006),
            '1005',
            '1000',
            'date-' + expectedDateLine,
        ]);

        // Don't show indicator when all posts are read
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt: time + 1020});
        expect(now).toEqual([
            '1010',
            '1005',
            '1000',
            'date-' + expectedDateLine,
        ]);
    });
});

describe('makeAddDateSeparatorsForSearchResults', () => {
    it('should add date separators for posts on different days', () => {
        const addDateSeparatorsForSearchResults = makeAddDateSeparatorsForSearchResults();
        const time = Date.now();
        const today = new Date(time);
        const yesterday = new Date(time - (24 * 60 * 60 * 1000));
        const dayBeforeYesterday = new Date(time - (2 * 24 * 60 * 60 * 1000));

        const posts = [
            TestHelper.getPostMock({id: 'post1', create_at: today.getTime()}),
            TestHelper.getPostMock({id: 'post2', create_at: yesterday.getTime()}),
            TestHelper.getPostMock({id: 'post3', create_at: dayBeforeYesterday.getTime()}),
        ];
        const state = {
            entities: {
                users: {
                    currentUserId: '1234',
                    profiles: {
                        1234: {id: '1234', username: 'user', timezone: {useAutomaticTimezone: 'false', manualTimezone: 'UTC'}},
                    },
                },
            },
        } as unknown as GlobalState;

        const result = addDateSeparatorsForSearchResults(state, posts);

        expect(result).toHaveLength(6);
        expect(result[0]).toBe('date-' + today.getTime());
        expect(result[1]).toBe(posts[0]);
        expect(result[2]).toBe('date-' + yesterday.getTime());
        expect(result[3]).toBe(posts[1]);
        expect(result[4]).toBe('date-' + dayBeforeYesterday.getTime());
        expect(result[5]).toBe(posts[2]);
    });

    it('should not add date separators for posts on the same day', () => {
        const addDateSeparatorsForSearchResults = makeAddDateSeparatorsForSearchResults();
        const time = Date.now();
        const today = new Date(time);

        const posts = [
            TestHelper.getPostMock({id: 'post1', create_at: today.getTime()}),
            TestHelper.getPostMock({id: 'post2', create_at: today.getTime() + 1000}),
            TestHelper.getPostMock({id: 'post3', create_at: today.getTime() + 2000}),
        ];
        const state = {
            entities: {
                users: {
                    currentUserId: '1234',
                    profiles: {
                        1234: {id: '1234', username: 'user', timezone: {useAutomaticTimezone: 'false', manualTimezone: 'UTC'}},
                    },
                },
            },
        } as unknown as GlobalState;

        const result = addDateSeparatorsForSearchResults(state, posts);

        expect(result).toHaveLength(4);
        expect(result[0]).toBe('date-' + today.getTime());
        expect(result[1]).toBe(posts[0]);
        expect(result[2]).toBe(posts[1]);
        expect(result[3]).toBe(posts[2]);
    });

    it('should handle timezone conversion correctly', () => {
        const addDateSeparatorsForSearchResults = makeAddDateSeparatorsForSearchResults();

        const todayTimestamp = 1704067200000;
        const todayTimestampInAmericaNewYork = 1704049200000;

        const posts = [
            TestHelper.getPostMock({id: 'post1', create_at: todayTimestampInAmericaNewYork}),
            TestHelper.getPostMock({id: 'post2', create_at: todayTimestamp}),
        ];
        const state = {
            entities: {
                users: {
                    currentUserId: '1234',
                    profiles: {
                        1234: {id: '1234', username: 'user', timezone: {useAutomaticTimezone: 'false', manualTimezone: 'America/New_York'}},
                    },
                },
            },
        } as unknown as GlobalState;

        const result = addDateSeparatorsForSearchResults(state, posts);

        expect(result).toHaveLength(3);
        expect(result[0]).toBe('date-1704031200000');
        expect(result[1]).toBe(posts[0]);
        expect(result[2]).toBe(posts[1]);
    });

    it('should handle posts with no timezone information', () => {
        const addDateSeparatorsForSearchResults = makeAddDateSeparatorsForSearchResults();
        const time = Date.now();
        const today = new Date(time);
        const yesterday = new Date(time - (24 * 60 * 60 * 1000));

        const posts = [
            TestHelper.getPostMock({id: 'post1', create_at: today.getTime()}),
            TestHelper.getPostMock({id: 'post2', create_at: yesterday.getTime()}),
        ];
        const state = {
            entities: {
                users: {
                    currentUserId: '1234',
                    profiles: {
                        1234: {id: '1234', username: 'user', timezone: {useAutomaticTimezone: 'false', manualTimezone: 'UTC'}},
                    },
                },
            },
        } as unknown as GlobalState;

        const result = addDateSeparatorsForSearchResults(state, posts);

        expect(result).toHaveLength(4);
        expect(result[0]).toBe('date-' + today.getTime());
        expect(result[1]).toBe(posts[0]);
        expect(result[2]).toBe('date-' + yesterday.getTime());
        expect(result[3]).toBe(posts[1]);
    });

    it('should handle single post correctly', () => {
        const addDateSeparatorsForSearchResults = makeAddDateSeparatorsForSearchResults();
        const time = Date.now();
        const today = new Date(time);

        const posts = [
            TestHelper.getPostMock({id: 'post1', create_at: today.getTime()}),
        ];
        const state = {
            entities: {
                users: {
                    currentUserId: '1234',
                    profiles: {
                        1234: {id: '1234', username: 'user', timezone: {useAutomaticTimezone: 'false', manualTimezone: 'UTC'}},
                    },
                },
            },
        } as unknown as GlobalState;

        const result = addDateSeparatorsForSearchResults(state, posts);

        expect(result).toHaveLength(2);
        expect(result[0]).toBe('date-' + today.getTime());
        expect(result[1]).toBe(posts[0]);
    });

    it('should handle posts spanning multiple days correctly', () => {
        const addDateSeparatorsForSearchResults = makeAddDateSeparatorsForSearchResults();
        const time = Date.now();
        const today = new Date(time);
        const yesterday = new Date(time - (24 * 60 * 60 * 1000));
        const dayBeforeYesterday = new Date(time - (2 * 24 * 60 * 60 * 1000));
        const threeDaysAgo = new Date(time - (3 * 24 * 60 * 60 * 1000));

        const posts = [
            TestHelper.getPostMock({id: 'post1', create_at: today.getTime()}),
            TestHelper.getPostMock({id: 'post2', create_at: today.getTime() + 1000}),
            TestHelper.getPostMock({id: 'post3', create_at: yesterday.getTime()}),
            TestHelper.getPostMock({id: 'post4', create_at: yesterday.getTime() + 1000}),
            TestHelper.getPostMock({id: 'post5', create_at: dayBeforeYesterday.getTime()}),
            TestHelper.getPostMock({id: 'post6', create_at: threeDaysAgo.getTime()}),
        ];
        const state = {
            entities: {
                users: {
                    currentUserId: '1234',
                    profiles: {
                        1234: {id: '1234', username: 'user', timezone: {useAutomaticTimezone: 'false', manualTimezone: 'UTC'}},
                    },
                },
            },
        } as unknown as GlobalState;

        const result = addDateSeparatorsForSearchResults(state, posts);

        expect(result).toHaveLength(10);
        expect(result[0]).toBe('date-' + today.getTime());
        expect(result[1]).toBe(posts[0]);
        expect(result[2]).toBe(posts[1]);
        expect(result[3]).toBe('date-' + yesterday.getTime());
        expect(result[4]).toBe(posts[2]);
        expect(result[5]).toBe(posts[3]);
        expect(result[6]).toBe('date-' + dayBeforeYesterday.getTime());
        expect(result[7]).toBe(posts[4]);
        expect(result[8]).toBe('date-' + threeDaysAgo.getTime());
        expect(result[9]).toBe(posts[5]);
    });
});

describe('makeCombineUserActivityPosts', () => {
    test('should do nothing if no post IDs are provided', () => {
        const combineUserActivityPosts = makeCombineUserActivityPosts();

        const postIds: string[] = [];
        const state = {
            entities: {
                posts: {
                    posts: {},
                },
            },
        } as unknown as GlobalState;

        const result = combineUserActivityPosts(state, postIds);

        expect(result).toBe(postIds);
        expect(result).toEqual([]);
    });

    test('should do nothing if there are no user activity posts', () => {
        const combineUserActivityPosts = makeCombineUserActivityPosts();

        const postIds = deepFreeze([
            'post1',
            START_OF_NEW_MESSAGES,
            'post2',
            DATE_LINE + '1001',
            'post3',
            DATE_LINE + '1000',
        ]);
        const state = {
            entities: {
                posts: {
                    posts: {
                        post1: {id: 'post1'},
                        post2: {id: 'post2'},
                        post3: {id: 'post3'},
                    },
                },
            },
        } as unknown as GlobalState;

        const result = combineUserActivityPosts(state, postIds);

        expect(result).toBe(postIds);
    });

    test('should combine adjacent user activity posts', () => {
        const combineUserActivityPosts = makeCombineUserActivityPosts();

        const postIds = deepFreeze([
            'post1',
            'post2',
            'post3',
        ]);
        const state = {
            entities: {
                posts: {
                    posts: {
                        post1: {id: 'post1', type: Posts.POST_TYPES.JOIN_CHANNEL},
                        post2: {id: 'post2', type: Posts.POST_TYPES.LEAVE_CHANNEL},
                        post3: {id: 'post3', type: Posts.POST_TYPES.ADD_TO_CHANNEL},
                    },
                },
            },
        } as unknown as GlobalState;

        const result = combineUserActivityPosts(state, postIds);

        expect(result).not.toBe(postIds);
        expect(result).toEqual([
            COMBINED_USER_ACTIVITY + 'post1_post2_post3',
        ]);
    });

    test('should "combine" a single activity post', () => {
        const combineUserActivityPosts = makeCombineUserActivityPosts();

        const postIds = deepFreeze([
            'post1',
            'post2',
            'post3',
        ]);
        const state = {
            entities: {
                posts: {
                    posts: {
                        post1: {id: 'post1'},
                        post2: {id: 'post2', type: Posts.POST_TYPES.LEAVE_CHANNEL},
                        post3: {id: 'post3'},
                    },
                },
            },
        } as unknown as GlobalState;

        const result = combineUserActivityPosts(state, postIds);

        expect(result).not.toBe(postIds);
        expect(result).toEqual([
            'post1',
            COMBINED_USER_ACTIVITY + 'post2',
            'post3',
        ]);
    });

    test('should not combine with regular messages', () => {
        const combineUserActivityPosts = makeCombineUserActivityPosts();

        const postIds = deepFreeze([
            'post1',
            'post2',
            'post3',
            'post4',
            'post5',
        ]);
        const state = {
            entities: {
                posts: {
                    posts: {
                        post1: {id: 'post1', type: Posts.POST_TYPES.JOIN_CHANNEL},
                        post2: {id: 'post2', type: Posts.POST_TYPES.JOIN_CHANNEL},
                        post3: {id: 'post3'},
                        post4: {id: 'post4', type: Posts.POST_TYPES.ADD_TO_CHANNEL},
                        post5: {id: 'post5', type: Posts.POST_TYPES.ADD_TO_CHANNEL},
                    },
                },
            },
        } as unknown as GlobalState;

        const result = combineUserActivityPosts(state, postIds);

        expect(result).not.toBe(postIds);
        expect(result).toEqual([
            COMBINED_USER_ACTIVITY + 'post1_post2',
            'post3',
            COMBINED_USER_ACTIVITY + 'post4_post5',
        ]);
    });

    test('should not combine with other system messages', () => {
        const combineUserActivityPosts = makeCombineUserActivityPosts();

        const postIds = deepFreeze([
            'post1',
            'post2',
            'post3',
        ]);
        const state = {
            entities: {
                posts: {
                    posts: {
                        post1: {id: 'post1', type: Posts.POST_TYPES.JOIN_CHANNEL},
                        post2: {id: 'post2', type: Posts.POST_TYPES.PURPOSE_CHANGE},
                        post3: {id: 'post3', type: Posts.POST_TYPES.ADD_TO_CHANNEL},
                    },
                },
            },
        } as unknown as GlobalState;

        const result = combineUserActivityPosts(state, postIds);

        expect(result).not.toBe(postIds);
        expect(result).toEqual([
            COMBINED_USER_ACTIVITY + 'post1',
            'post2',
            COMBINED_USER_ACTIVITY + 'post3',
        ]);
    });

    test('should not combine across non-post items', () => {
        const combineUserActivityPosts = makeCombineUserActivityPosts();

        const postIds = deepFreeze([
            'post1',
            START_OF_NEW_MESSAGES,
            'post2',
            'post3',
            DATE_LINE + '1001',
            'post4',
        ]);
        const state = {
            entities: {
                posts: {
                    posts: {
                        post1: {id: 'post1', type: Posts.POST_TYPES.JOIN_CHANNEL},
                        post2: {id: 'post2', type: Posts.POST_TYPES.LEAVE_CHANNEL},
                        post3: {id: 'post3', type: Posts.POST_TYPES.ADD_TO_CHANNEL},
                        post4: {id: 'post4', type: Posts.POST_TYPES.JOIN_CHANNEL},
                    },
                },
            },
        } as unknown as GlobalState;

        const result = combineUserActivityPosts(state, postIds);

        expect(result).not.toBe(postIds);
        expect(result).toEqual([
            COMBINED_USER_ACTIVITY + 'post1',
            START_OF_NEW_MESSAGES,
            COMBINED_USER_ACTIVITY + 'post2_post3',
            DATE_LINE + '1001',
            COMBINED_USER_ACTIVITY + 'post4',
        ]);
    });

    test('should not combine more than 100 posts', () => {
        const combineUserActivityPosts = makeCombineUserActivityPosts();

        const postIds: string[] = [];
        const posts: Record<string, Post> = {};
        for (let i = 0; i < 110; i++) {
            const postId = `post${i}`;

            postIds.push(postId);
            posts[postId] = TestHelper.getPostMock({id: postId, type: Posts.POST_TYPES.JOIN_CHANNEL});
        }

        const state = {
            entities: {
                posts: {
                    posts,
                },
            },
        } as unknown as GlobalState;

        const result = combineUserActivityPosts(state, postIds);

        expect(result).toHaveLength(2);
    });
});

describe('isDateLine', () => {
    test('should correctly identify date line items', () => {
        expect(isDateLine('')).toBe(false);
        expect(isDateLine('date')).toBe(false);
        expect(isDateLine('date-')).toBe(true);
        expect(isDateLine('date-0')).toBe(true);
        expect(isDateLine('date-1531152392')).toBe(true);
        expect(isDateLine('date-1531152392-index')).toBe(true);
    });
});

describe('getDateForDateLine', () => {
    test('should get date correctly without suffix', () => {
        expect(getDateForDateLine('date-1234')).toBe(1234);
    });

    test('should get date correctly with suffix', () => {
        expect(getDateForDateLine('date-1234-suffix')).toBe(1234);
    });
});

describe('isCombinedUserActivityPost', () => {
    test('should correctly identify combined user activity posts', () => {
        expect(isCombinedUserActivityPost('post1')).toBe(false);
        expect(isCombinedUserActivityPost('date-1234')).toBe(false);
        expect(isCombinedUserActivityPost('user-activity-post1')).toBe(true);
        expect(isCombinedUserActivityPost('user-activity-post1_post2')).toBe(true);
        expect(isCombinedUserActivityPost('user-activity-post1_post2_post4')).toBe(true);
    });
});

describe('getPostIdsForCombinedUserActivityPost', () => {
    test('should get IDs correctly', () => {
        expect(getPostIdsForCombinedUserActivityPost('user-activity-post1_post2_post3')).toEqual(['post1', 'post2', 'post3']);
    });
});

describe('getFirstPostId', () => {
    test('should return the first item if it is a post', () => {
        expect(getFirstPostId(['post1', 'post2', 'post3'])).toBe('post1');
    });

    test('should return the first ID from a combined post', () => {
        expect(getFirstPostId(['user-activity-post2_post3', 'post4', 'user-activity-post5_post6'])).toBe('post2');
    });

    test('should skip date separators', () => {
        expect(getFirstPostId(['date-1234', 'user-activity-post1_post2', 'post3', 'post4', 'date-1000'])).toBe('post1');
    });

    test('should skip the new message line', () => {
        expect(getFirstPostId([START_OF_NEW_MESSAGES + '1234', 'post2', 'post3', 'post4'])).toBe('post2');
    });
});

describe('getLastPostId', () => {
    test('should return the last item if it is a post', () => {
        expect(getLastPostId(['post1', 'post2', 'post3'])).toBe('post3');
    });

    test('should return the last ID from a combined post', () => {
        expect(getLastPostId(['user-activity-post2_post3', 'post4', 'user-activity-post5_post6'])).toBe('post6');
    });

    test('should skip date separators', () => {
        expect(getLastPostId(['date-1234', 'user-activity-post1_post2', 'post3', 'post4', 'date-1000'])).toBe('post4');
    });

    test('should skip the new message line', () => {
        expect(getLastPostId(['post2', 'post3', 'post4', START_OF_NEW_MESSAGES + '1234'])).toBe('post4');
    });
});

describe('getLastPostIndex', () => {
    test('should return index of last post for list of all regular posts', () => {
        expect(getLastPostIndex(['post1', 'post2', 'post3'])).toBe(2);
    });

    test('should return index of last combined post', () => {
        expect(getLastPostIndex(['user-activity-post2_post3', 'post4', 'user-activity-post5_post6'])).toBe(2);
    });

    test('should skip date separators and return index of last post', () => {
        expect(getLastPostIndex(['date-1234', 'user-activity-post1_post2', 'post3', 'post4', 'date-1000'])).toBe(3);
    });

    test('should skip the new message line and return index of last post', () => {
        expect(getLastPostIndex(['post2', 'post3', 'post4', START_OF_NEW_MESSAGES + '1234'])).toBe(2);
    });
});

describe('makeGenerateCombinedPost', () => {
    test('should output a combined post', () => {
        const generateCombinedPost = makeGenerateCombinedPost();

        const state = {
            entities: {
                posts: {
                    posts: {
                        post1: {
                            id: 'post1',
                            channel_id: 'channel1',
                            create_at: 1002,
                            delete_at: 0,
                            message: 'joe added to the channel by bill.',
                            props: {
                                addedUsername: 'joe',
                                addedUserId: 'user2',
                                username: 'bill',
                                userId: 'user1',
                            },
                            type: Posts.POST_TYPES.ADD_TO_CHANNEL,
                            user_id: 'user1',
                            metadata: {},
                        },
                        post2: {
                            id: 'post2',
                            channel_id: 'channel1',
                            create_at: 1001,
                            delete_at: 0,
                            message: 'alice added to the channel by bill.',
                            props: {
                                addedUsername: 'alice',
                                addedUserId: 'user3',
                                username: 'bill',
                                userId: 'user1',
                            },
                            type: Posts.POST_TYPES.ADD_TO_CHANNEL,
                            user_id: 'user1',
                            metadata: {},
                        },
                        post3: {
                            id: 'post3',
                            channel_id: 'channel1',
                            create_at: 1000,
                            delete_at: 0,
                            message: 'bill joined the channel.',
                            props: {
                                username: 'bill',
                                userId: 'user1',
                            },
                            type: Posts.POST_TYPES.JOIN_CHANNEL,
                            user_id: 'user1',
                            metadata: {},
                        },
                    },
                },
            },
        } as unknown as GlobalState;
        const combinedId = 'user-activity-post1_post2_post3';

        const result = generateCombinedPost(state, combinedId);

        expect(result).toMatchObject({
            id: combinedId,
            root_id: '',
            channel_id: 'channel1',
            create_at: 1000,
            delete_at: 0,
            message: 'joe added to the channel by bill.\nalice added to the channel by bill.\nbill joined the channel.',
            props: {
                messages: [
                    'joe added to the channel by bill.',
                    'alice added to the channel by bill.',
                    'bill joined the channel.',
                ],
                user_activity: {
                    allUserIds: ['user1', 'user3', 'user2'],
                    allUsernames: [
                        'alice',
                        'joe',
                    ],
                    messageData: [
                        {
                            postType: Posts.POST_TYPES.JOIN_CHANNEL,
                            userIds: ['user1'],
                        },
                        {
                            postType: Posts.POST_TYPES.ADD_TO_CHANNEL,
                            userIds: ['user3', 'user2'],
                            actorId: 'user1',
                        },
                    ],
                },
            },
            system_post_ids: ['post3', 'post2', 'post1'],
            type: Posts.POST_TYPES.COMBINED_USER_ACTIVITY,
            user_activity_posts: [
                state.entities.posts.posts.post3,
                state.entities.posts.posts.post2,
                state.entities.posts.posts.post1,
            ],
            user_id: '',
            metadata: {},
        });
    });
});
const PostTypes = Posts.POST_TYPES;
describe('extractUserActivityData', () => {
    const postAddToChannel: ActivityEntry = {
        postType: PostTypes.ADD_TO_CHANNEL,
        actorId: ['user_id_1'],
        userIds: ['added_user_id_1'],
        usernames: ['added_username_1'],
    };
    const postAddToTeam: ActivityEntry = {
        postType: PostTypes.ADD_TO_TEAM,
        actorId: ['user_id_1'],
        userIds: ['added_user_id_1', 'added_user_id_2'],
        usernames: ['added_username_1', 'added_username_2'],
    };
    const postLeaveChannel: ActivityEntry = {
        postType: PostTypes.LEAVE_CHANNEL,
        actorId: ['user_id_1'],
        userIds: [],
        usernames: [],
    };

    const postJoinChannel: ActivityEntry = {
        postType: PostTypes.JOIN_CHANNEL,
        actorId: ['user_id_1'],
        userIds: [],
        usernames: [],
    };

    const postRemoveFromChannel: ActivityEntry = {
        postType: PostTypes.REMOVE_FROM_CHANNEL,
        actorId: ['user_id_1'],
        userIds: ['removed_user_id_1'],
        usernames: ['removed_username_1'],
    };
    const postLeaveTeam: ActivityEntry = {
        postType: PostTypes.LEAVE_TEAM,
        actorId: ['user_id_1'],
        userIds: [],
        usernames: [],
    };

    const postJoinTeam: ActivityEntry = {
        postType: PostTypes.JOIN_TEAM,
        actorId: ['user_id_1'],
        userIds: [],
        usernames: [],
    };
    const postRemoveFromTeam: ActivityEntry = {
        postType: PostTypes.REMOVE_FROM_TEAM,
        actorId: ['user_id_1'],
        userIds: [],
        usernames: [],
    };
    it('should return empty activity when empty ', () => {
        expect(extractUserActivityData([])).toEqual({allUserIds: [], allUsernames: [], messageData: []});
    });
    it('should match return for JOIN_CHANNEL', () => {
        const userActivities = [postJoinChannel];
        const expectedOutput = {
            allUserIds: ['user_id_1'],
            allUsernames: [],
            messageData: [{postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1']}],
        };
        expect(extractUserActivityData(userActivities)).toEqual(expectedOutput);
        const postJoinChannel2: ActivityEntry = {
            postType: PostTypes.JOIN_CHANNEL,
            actorId: ['user_id_2', 'user_id_3', 'user_id_4', 'user_id_5'],
            userIds: [],
            usernames: [],
        };
        const expectedOutput2 = {
            allUserIds: ['user_id_2', 'user_id_3', 'user_id_4', 'user_id_5'],
            allUsernames: [],
            messageData: [{postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_2', 'user_id_3', 'user_id_4', 'user_id_5']}],
        };
        expect(extractUserActivityData([postJoinChannel2])).toEqual(expectedOutput2);
    });

    it('should return expected data for ADD_TO_CHANNEL', () => {
        const userActivities = [postAddToChannel];
        const expectedOutput = {
            allUserIds: ['added_user_id_1', 'user_id_1'],
            allUsernames: ['added_username_1'],
            messageData: [{postType: PostTypes.ADD_TO_CHANNEL, actorId: 'user_id_1', userIds: ['added_user_id_1']}],
        };
        expect(extractUserActivityData(userActivities)).toEqual(expectedOutput);
        const postAddToChannel2: ActivityEntry = {
            postType: PostTypes.ADD_TO_CHANNEL,
            actorId: ['user_id_2'],
            userIds: ['added_user_id_2', 'added_user_id_3', 'added_user_id_4'],
            usernames: ['added_username_2', 'added_username_3', 'added_username_4'],
        };
        const userActivities2 = [postAddToChannel, postAddToChannel2];
        const expectedOutput2 = {
            allUserIds: ['added_user_id_1', 'user_id_1', 'added_user_id_2', 'added_user_id_3', 'added_user_id_4', 'user_id_2'],
            allUsernames: ['added_username_1', 'added_username_2', 'added_username_3', 'added_username_4'],
            messageData: [
                {postType: PostTypes.ADD_TO_CHANNEL, actorId: 'user_id_1', userIds: ['added_user_id_1']},
                {postType: PostTypes.ADD_TO_CHANNEL, actorId: 'user_id_2', userIds: ['added_user_id_2', 'added_user_id_3', 'added_user_id_4']},
            ],
        };
        expect(extractUserActivityData(userActivities2)).toEqual(expectedOutput2);
    });

    it('should return expected data for ADD_TO_TEAM', () => {
        const userActivities = [postAddToTeam];
        const expectedOutput = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'user_id_1'],
            allUsernames: ['added_username_1', 'added_username_2'],
            messageData: [{postType: PostTypes.ADD_TO_TEAM, actorId: 'user_id_1', userIds: ['added_user_id_1', 'added_user_id_2']}],
        };
        expect(extractUserActivityData(userActivities)).toEqual(expectedOutput);
        const postAddToTeam2: ActivityEntry = {
            postType: PostTypes.ADD_TO_TEAM,
            actorId: ['user_id_2'],
            userIds: ['added_user_id_3', 'added_user_id_4'],
            usernames: ['added_username_3', 'added_username_4'],
        };
        const userActivities2 = [postAddToTeam, postAddToTeam2];
        const expectedOutput2 = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'user_id_1', 'added_user_id_3', 'added_user_id_4', 'user_id_2'],
            allUsernames: ['added_username_1', 'added_username_2', 'added_username_3', 'added_username_4'],
            messageData: [
                {postType: PostTypes.ADD_TO_TEAM, actorId: 'user_id_1', userIds: ['added_user_id_1', 'added_user_id_2']},
                {postType: PostTypes.ADD_TO_TEAM, actorId: 'user_id_2', userIds: ['added_user_id_3', 'added_user_id_4']},
            ],
        };
        expect(extractUserActivityData(userActivities2)).toEqual(expectedOutput2);
    });

    it('should return expected data for JOIN_TEAM', () => {
        const userActivities = [postJoinTeam];
        const expectedOutput = {
            allUserIds: ['user_id_1'],
            allUsernames: [],
            messageData: [{postType: PostTypes.JOIN_TEAM, userIds: ['user_id_1']}],
        };
        expect(extractUserActivityData(userActivities)).toEqual(expectedOutput);
        const postJoinTeam2: ActivityEntry = {
            postType: PostTypes.JOIN_TEAM,
            actorId: ['user_id_2', 'user_id_3', 'user_id_4', 'user_id_5'],
            userIds: [],
            usernames: [],
        };
        const userActivities2 = [postJoinTeam, postJoinTeam2];
        const expectedOutput2 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4', 'user_id_5'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_TEAM, userIds: ['user_id_1']},
                {postType: PostTypes.JOIN_TEAM, userIds: ['user_id_2', 'user_id_3', 'user_id_4', 'user_id_5']},
            ],
        };
        expect(extractUserActivityData(userActivities2)).toEqual(expectedOutput2);
    });

    it('should return expected data for LEAVE_CHANNEL', () => {
        const userActivities = [postLeaveChannel];
        const expectedOutput = {
            allUserIds: ['user_id_1'],
            allUsernames: [],
            messageData: [{postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']}],
        };
        expect(extractUserActivityData(userActivities)).toEqual(expectedOutput);

        const postLeaveChannel2: ActivityEntry = {
            postType: PostTypes.LEAVE_CHANNEL,
            actorId: ['user_id_2', 'user_id_3', 'user_id_4', 'user_id_5'],
            userIds: [],
            usernames: [],
        };
        const userActivities2 = [postLeaveChannel, postLeaveChannel2];
        const expectedOutput2 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4', 'user_id_5'],
            allUsernames: [],
            messageData: [

                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_2', 'user_id_3', 'user_id_4', 'user_id_5']},
            ],
        };
        expect(extractUserActivityData(userActivities2)).toEqual(expectedOutput2);
    });

    it('should return expected data for LEAVE_TEAM', () => {
        const userActivities = [postLeaveTeam];
        const expectedOutput = {
            allUserIds: ['user_id_1'],
            allUsernames: [],
            messageData: [{postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_1']}],
        };
        expect(extractUserActivityData(userActivities)).toEqual(expectedOutput);
        const postLeaveTeam2: ActivityEntry = {
            postType: PostTypes.LEAVE_TEAM,
            actorId: ['user_id_2', 'user_id_3', 'user_id_4', 'user_id_5'],
            userIds: [],
            usernames: [],
        };
        const userActivities2 = [postLeaveTeam, postLeaveTeam2];
        const expectedOutput2 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4', 'user_id_5'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_1']},
                {postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_2', 'user_id_3', 'user_id_4', 'user_id_5']},
            ],
        };
        expect(extractUserActivityData(userActivities2)).toEqual(expectedOutput2);
    });
    it('should return expected data for REMOVE_FROM_CHANNEL', () => {
        const userActivities = [postRemoveFromChannel];
        const expectedOutput = {
            allUserIds: ['removed_user_id_1', 'user_id_1'],
            allUsernames: ['removed_username_1'],
            messageData: [{postType: PostTypes.REMOVE_FROM_CHANNEL, actorId: 'user_id_1', userIds: ['removed_user_id_1']}],
        };
        expect(extractUserActivityData(userActivities)).toEqual(expectedOutput);

        const postRemoveFromChannel2: ActivityEntry = {
            postType: PostTypes.REMOVE_FROM_CHANNEL,
            actorId: ['user_id_2'],
            userIds: ['removed_user_id_2', 'removed_user_id_3', 'removed_user_id_4', 'removed_user_id_5'],
            usernames: ['removed_username_2', 'removed_username_3', 'removed_username_4', 'removed_username_5'],
        };
        const userActivities2 = [postRemoveFromChannel, postRemoveFromChannel2];
        const expectedOutput2 = {
            allUserIds: ['removed_user_id_1', 'user_id_1', 'removed_user_id_2', 'removed_user_id_3', 'removed_user_id_4', 'removed_user_id_5', 'user_id_2'],
            allUsernames: ['removed_username_1', 'removed_username_2', 'removed_username_3', 'removed_username_4', 'removed_username_5'],
            messageData: [
                {postType: PostTypes.REMOVE_FROM_CHANNEL, actorId: 'user_id_1', userIds: ['removed_user_id_1']},
                {postType: PostTypes.REMOVE_FROM_CHANNEL, actorId: 'user_id_2', userIds: ['removed_user_id_2', 'removed_user_id_3', 'removed_user_id_4', 'removed_user_id_5']},
            ],
        };
        expect(extractUserActivityData(userActivities2)).toEqual(expectedOutput2);
    });
    it('should return expected data for REMOVE_FROM_TEAM', () => {
        const userActivities = [postRemoveFromTeam];
        const expectedOutput = {
            allUserIds: ['user_id_1'],
            allUsernames: [],
            messageData: [{postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_1']}],
        };
        expect(extractUserActivityData(userActivities)).toEqual(expectedOutput);

        const postRemoveFromTeam2: ActivityEntry = {
            postType: PostTypes.REMOVE_FROM_TEAM,
            actorId: ['user_id_2', 'user_id_3', 'user_id_4', 'user_id_5'],
            userIds: [],
            usernames: [],
        };
        const userActivities2 = [postRemoveFromTeam, postRemoveFromTeam2];
        const expectedOutput2 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4', 'user_id_5'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_1']},
                {postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_2', 'user_id_3', 'user_id_4', 'user_id_5']},
            ],
        };
        expect(extractUserActivityData(userActivities2)).toEqual(expectedOutput2);
    });
    it('should return expected data for multiple post types', () => {
        const userActivities = [postAddToChannel, postAddToTeam, postJoinChannel, postJoinTeam, postLeaveChannel, postLeaveTeam, postRemoveFromChannel, postRemoveFromTeam];
        const expectedOutput = {
            allUserIds: ['added_user_id_1', 'user_id_1', 'added_user_id_2', 'removed_user_id_1'],
            allUsernames: ['added_username_1', 'added_username_2', 'removed_username_1'],
            messageData: [
                {postType: PostTypes.ADD_TO_CHANNEL, actorId: 'user_id_1', userIds: ['added_user_id_1']},
                {postType: PostTypes.ADD_TO_TEAM, actorId: 'user_id_1', userIds: ['added_user_id_1', 'added_user_id_2']},
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.JOIN_TEAM, userIds: ['user_id_1']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_1']},
                {postType: PostTypes.REMOVE_FROM_CHANNEL, actorId: 'user_id_1', userIds: ['removed_user_id_1']},
                {postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_1']},
            ],
        };
        expect(extractUserActivityData(userActivities)).toEqual(expectedOutput);
    });
});

describe('combineUserActivityData', () => {
    it('combineUserActivitySystemPost returns null when systemPosts is an empty array', () => {
        expect(combineUserActivitySystemPost([])).toBeFalsy();
    });
    it('correctly combine different post types and actorIds by order', () => {
        const postAddToChannel1 = TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, user_id: 'user_id_1', props: {addedUserId: 'added_user_id_1', addedUsername: 'added_username_1'}});
        const postAddToTeam1 = TestHelper.getPostMock({type: PostTypes.ADD_TO_TEAM, user_id: 'user_id_1', props: {addedUserId: 'added_user_id_1'}});
        const postJoinChannel1 = TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, user_id: 'user_id_1'});
        const postJoinTeam1 = TestHelper.getPostMock({type: PostTypes.JOIN_TEAM, user_id: 'user_id_1'});
        const postLeaveChannel1 = TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, user_id: 'user_id_1'});
        const postLeaveTeam1 = TestHelper.getPostMock({type: PostTypes.LEAVE_TEAM, user_id: 'user_id_1'});
        const postRemoveFromChannel1 = TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_CHANNEL, user_id: 'user_id_1', props: {removedUserId: 'removed_user_id_1', removedUsername: 'removed_username_1'}});
        const postRemoveFromTeam1 = TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_TEAM, user_id: 'user_id_1'});
        const posts = [postAddToChannel1, postAddToTeam1, postJoinChannel1, postJoinTeam1, postLeaveChannel1, postLeaveTeam1, postRemoveFromChannel1, postRemoveFromTeam1].reverse();
        const expectedOutput = {
            allUserIds: ['added_user_id_1', 'user_id_1', 'removed_user_id_1'],
            allUsernames: ['added_username_1', 'removed_username_1'],
            messageData: [
                {postType: PostTypes.ADD_TO_CHANNEL, actorId: 'user_id_1', userIds: ['added_user_id_1']},
                {postType: PostTypes.ADD_TO_TEAM, actorId: 'user_id_1', userIds: ['added_user_id_1']},
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.JOIN_TEAM, userIds: ['user_id_1']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_1']},
                {postType: PostTypes.REMOVE_FROM_CHANNEL, actorId: 'user_id_1', userIds: ['removed_user_id_1']},
                {postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);
    });
    it('correctly combine same post types', () => {
        const postAddToChannel1 = TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, user_id: 'user_id_1', props: {addedUserId: 'added_user_id_1', addedUsername: 'added_username_1'}});
        const postAddToChannel2 = TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, user_id: 'user_id_2', props: {addedUserId: 'added_user_id_2', addedUsername: 'added_username_2'}});
        const postAddToChannel3 = TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, user_id: 'user_id_3', props: {addedUserId: 'added_user_id_3', addedUsername: 'added_username_3'}});

        const posts = [postAddToChannel1, postAddToChannel2, postAddToChannel3].reverse();
        const expectedOutput = {
            allUserIds: ['added_user_id_1', 'user_id_1', 'added_user_id_2', 'user_id_2', 'added_user_id_3', 'user_id_3'],
            allUsernames: ['added_username_1', 'added_username_2', 'added_username_3'],
            messageData: [
                {postType: PostTypes.ADD_TO_CHANNEL, actorId: 'user_id_1', userIds: ['added_user_id_1']},
                {postType: PostTypes.ADD_TO_CHANNEL, actorId: 'user_id_2', userIds: ['added_user_id_2']},
                {postType: PostTypes.ADD_TO_CHANNEL, actorId: 'user_id_3', userIds: ['added_user_id_3']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);
    });
    it('correctly combine Join and Leave Posts', () => {
        const postJoinChannel1 = TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, user_id: 'user_id_1'});
        const postLeaveChannel1 = TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, user_id: 'user_id_1'});
        const postJoinChannel2 = TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, user_id: 'user_id_2'});
        const postLeaveChannel2 = TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, user_id: 'user_id_2'});
        const postJoinChannel3 = TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, user_id: 'user_id_3'});
        const postLeaveChannel3 = TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, user_id: 'user_id_3'});

        const post = [postJoinChannel1, postLeaveChannel1].reverse();
        const expectedOutput = {
            allUserIds: ['user_id_1'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_LEAVE_CHANNEL, userIds: ['user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost(post)).toEqual(expectedOutput);

        const post1 = [postJoinChannel1, postLeaveChannel1, postJoinChannel2, postLeaveChannel2, postJoinChannel3, postLeaveChannel3].reverse();
        const expectedOutput1 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_LEAVE_CHANNEL, userIds: ['user_id_1', 'user_id_2', 'user_id_3']},
            ],
        };
        expect(combineUserActivitySystemPost(post1)).toEqual(expectedOutput1);

        const post2 = [postJoinChannel1, postJoinChannel2, postJoinChannel3, postLeaveChannel1, postLeaveChannel2, postLeaveChannel3].reverse();
        const expectedOutput2 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_LEAVE_CHANNEL, userIds: ['user_id_1', 'user_id_2', 'user_id_3']},
            ],
        };
        expect(combineUserActivitySystemPost(post2)).toEqual(expectedOutput2);

        const post3 = [postJoinChannel1, postJoinChannel2, postLeaveChannel2, postLeaveChannel1, postJoinChannel3, postLeaveChannel3].reverse();
        const expectedOutput3 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_LEAVE_CHANNEL, userIds: ['user_id_1', 'user_id_2', 'user_id_3']},
            ],
        };
        expect(combineUserActivitySystemPost(post3)).toEqual(expectedOutput3);
    });
    it('should only partially combine mismatched join and leave posts', () => {
        const postJoinChannel1 = TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, user_id: 'user_id_1'});
        const postLeaveChannel1 = TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, user_id: 'user_id_1'});
        const postJoinChannel2 = TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, user_id: 'user_id_2'});
        const postLeaveChannel2 = TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, user_id: 'user_id_2'});

        let posts = [postJoinChannel1, postLeaveChannel1, postJoinChannel2].reverse();
        let expectedOutput = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_LEAVE_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_2']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);

        posts = [postJoinChannel1, postLeaveChannel1, postLeaveChannel2].reverse();
        expectedOutput = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_LEAVE_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_2']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);

        posts = [postJoinChannel1, postJoinChannel2, postLeaveChannel1].reverse();
        expectedOutput = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1', 'user_id_2']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);

        posts = [postJoinChannel1, postLeaveChannel2, postLeaveChannel1].reverse();
        expectedOutput = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_2', 'user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);

        posts = [postJoinChannel2, postJoinChannel1, postLeaveChannel1].reverse();
        expectedOutput = {
            allUserIds: ['user_id_2', 'user_id_1'],
            allUsernames: [],
            messageData: [

                // This case is arguably incorrect, but it's an edge case
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_2', 'user_id_1']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);

        posts = [postLeaveChannel2, postJoinChannel1, postLeaveChannel1].reverse();
        expectedOutput = {
            allUserIds: ['user_id_2', 'user_id_1'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_2']},
                {postType: PostTypes.JOIN_LEAVE_CHANNEL, userIds: ['user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);
    });
    it('should not combine join and leave posts with other actions in between', () => {
        const postJoinChannel1 = TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, user_id: 'user_id_1'});
        const postLeaveChannel1 = TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, user_id: 'user_id_1'});

        const postAddToChannel2 = TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, user_id: 'user_id_2', props: {addedUserId: 'added_user_id_1', addedUsername: 'added_username_1'}});
        const postAddToTeam2 = TestHelper.getPostMock({type: PostTypes.ADD_TO_TEAM, user_id: 'user_id_2', props: {addedUserId: 'added_user_id_1'}});
        const postJoinTeam2 = TestHelper.getPostMock({type: PostTypes.JOIN_TEAM, user_id: 'user_id_2'});
        const postLeaveTeam2 = TestHelper.getPostMock({type: PostTypes.LEAVE_TEAM, user_id: 'user_id_2'});
        const postRemoveFromChannel2 = TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_CHANNEL, user_id: 'user_id_2', props: {removedUserId: 'removed_user_id_1', removedUsername: 'removed_username_1'}});
        const postRemoveFromTeam2 = TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_TEAM, user_id: 'removed_user_id_1'});

        let posts = [postJoinChannel1, postAddToChannel2, postLeaveChannel1].reverse();
        let expectedOutput = {
            allUserIds: ['user_id_1', 'added_user_id_1', 'user_id_2'],
            allUsernames: ['added_username_1'],
            messageData: [
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.ADD_TO_CHANNEL, actorId: 'user_id_2', userIds: ['added_user_id_1']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);

        posts = [postJoinChannel1, postAddToTeam2, postLeaveChannel1].reverse();
        expectedOutput = {
            allUserIds: ['user_id_1', 'added_user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.ADD_TO_TEAM, actorId: 'user_id_2', userIds: ['added_user_id_1']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);

        posts = [postJoinChannel1, postJoinTeam2, postLeaveChannel1].reverse();
        expectedOutput = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.JOIN_TEAM, userIds: ['user_id_2']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);

        posts = [postJoinChannel1, postLeaveTeam2, postLeaveChannel1].reverse();
        expectedOutput = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_2']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);

        posts = [postJoinChannel1, postRemoveFromChannel2, postLeaveChannel1].reverse();
        expectedOutput = {
            allUserIds: ['user_id_1', 'removed_user_id_1', 'user_id_2'],
            allUsernames: ['removed_username_1'],
            messageData: [
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.REMOVE_FROM_CHANNEL, actorId: 'user_id_2', userIds: ['removed_user_id_1']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);

        posts = [postJoinChannel1, postRemoveFromTeam2, postLeaveChannel1].reverse();
        expectedOutput = {
            allUserIds: ['user_id_1', 'removed_user_id_1'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1']},
                {postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['removed_user_id_1']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost(posts)).toEqual(expectedOutput);
    });
});
