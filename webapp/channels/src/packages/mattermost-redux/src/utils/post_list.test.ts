// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import {Post} from '@mattermost/types/posts';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';
import {Posts, Preferences} from '../constants';
import TestHelper from '../../test/test_helper';

import {
    COMBINED_USER_ACTIVITY,
    combineUserActivitySystemPost,
    comparePostTypes,
    DATE_LINE,
    getDateForDateLine,
    getFirstPostId,
    getLastPostId,
    getLastPostIndex,
    getPostIdsForCombinedUserActivityPost,
    isCombinedUserActivityPost,
    isDateLine,
    makeCombineUserActivityPosts,
    makeFilterPostsAndAddSeparators,
    makeGenerateCombinedPost,
    postTypePriority,
    START_OF_NEW_MESSAGES,
} from './post_list';

describe('makeFilterPostsAndAddSeparators', () => {
    it('filter join/leave posts', () => {
        const filterPostsAndAddSeparators = makeFilterPostsAndAddSeparators();
        const time = Date.now();
        const today = new Date(time);

        let state = {
            entities: {
                general: {
                    config: {},
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
                        1234: {id: '1234', username: 'user'},
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
            'date-' + today.getTime(),
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
            'date-' + today.getTime(),
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
            'date-' + today.getTime(),
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
            'date-' + today.getTime(),
        ]);
    });

    it('new messages indicator', () => {
        const filterPostsAndAddSeparators = makeFilterPostsAndAddSeparators();
        const time = Date.now();
        const today = new Date(time);

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
                        1234: {id: '1234', username: 'user'},
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
            'date-' + (today.getTime() + 1000),
        ]);

        now = filterPostsAndAddSeparators(state, {postIds, indicateNewMessages: true, lastViewedAt: 0});
        expect(now).toEqual([
            '1010',
            '1005',
            '1000',
            'date-' + (today.getTime() + 1000),
        ]);

        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt: time + 999, indicateNewMessages: false});
        expect(now).toEqual([
            '1010',
            '1005',
            '1000',
            'date-' + (today.getTime() + 1000),
        ]);

        // Show new messages indicator before all posts
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt: time + 999, indicateNewMessages: true});
        expect(now).toEqual([
            '1010',
            '1005',
            '1000',
            START_OF_NEW_MESSAGES,
            'date-' + (today.getTime() + 1000),
        ]);

        // Show indicator between posts
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt: time + 1003, indicateNewMessages: true});
        expect(now).toEqual([
            '1010',
            '1005',
            START_OF_NEW_MESSAGES,
            '1000',
            'date-' + (today.getTime() + 1000),
        ]);

        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt: time + 1006, indicateNewMessages: true});
        expect(now).toEqual([
            '1010',
            START_OF_NEW_MESSAGES,
            '1005',
            '1000',
            'date-' + (today.getTime() + 1000),
        ]);

        // Don't show indicator when all posts are read
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt: time + 1020});
        expect(now).toEqual([
            '1010',
            '1005',
            '1000',
            'date-' + (today.getTime() + 1000),
        ]);
    });

    it('memoization', () => {
        const filterPostsAndAddSeparators = makeFilterPostsAndAddSeparators();
        const time = Date.now();
        const today = new Date(time);
        const tomorrow = new Date((24 * 60 * 60 * 1000) + today.getTime());

        // Posts 7 hours apart so they should appear on multiple days
        const initialPosts = {
            1001: {id: '1001', create_at: time, type: ''},
            1002: {id: '1002', create_at: time + 5, type: ''},
            1003: {id: '1003', create_at: time + 10, type: ''},
            1004: {id: '1004', create_at: tomorrow, type: ''},
            1005: {id: '1005', create_at: tomorrow as any + 5, type: ''},
            1006: {id: '1006', create_at: tomorrow as any + 10, type: Posts.POST_TYPES.JOIN_CHANNEL},
        };
        let state = {
            entities: {
                general: {
                    config: {},
                },
                posts: {
                    posts: initialPosts,
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_FILTER_JOIN_LEAVE)]: {
                            category: Preferences.CATEGORY_ADVANCED_SETTINGS,
                            name: Preferences.ADVANCED_FILTER_JOIN_LEAVE,
                            value: 'true',
                        },
                    },
                },
                users: {
                    currentUserId: '1234',
                    profiles: {
                        1234: {id: '1234', username: 'user'},
                    },
                },
            },
        } as unknown as GlobalState;

        let postIds = [
            '1006',
            '1004',
            '1003',
            '1001',
        ];
        let lastViewedAt = initialPosts['1001'].create_at + 1;

        let now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages: true});
        expect(now).toEqual([
            '1006',
            '1004',
            'date-' + tomorrow.getTime(),
            '1003',
            START_OF_NEW_MESSAGES,
            '1001',
            'date-' + today.getTime(),
        ]);

        // No changes
        let prev = now;
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages: true});
        expect(now).toEqual(prev);
        expect(now).toEqual([
            '1006',
            '1004',
            'date-' + tomorrow.getTime(),
            '1003',
            START_OF_NEW_MESSAGES,
            '1001',
            'date-' + today.getTime(),
        ]);

        // lastViewedAt changed slightly
        lastViewedAt = initialPosts['1001'].create_at + 2;

        prev = now;
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages: true});
        expect(now).toEqual(prev);
        expect(now).toEqual([
            '1006',
            '1004',
            'date-' + tomorrow.getTime(),
            '1003',
            START_OF_NEW_MESSAGES,
            '1001',
            'date-' + today.getTime(),
        ]);

        // lastViewedAt changed a lot
        lastViewedAt = initialPosts['1003'].create_at + 1;

        prev = now;
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages: true});
        expect(now).not.toEqual(prev);
        expect(now).toEqual([
            '1006',
            '1004',
            START_OF_NEW_MESSAGES,
            'date-' + tomorrow.getTime(),
            '1003',
            '1001',
            'date-' + today.getTime(),
        ]);

        prev = now;
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages: true});
        expect(now).toEqual(prev);
        expect(now).toEqual([
            '1006',
            '1004',
            START_OF_NEW_MESSAGES,
            'date-' + tomorrow.getTime(),
            '1003',
            '1001',
            'date-' + today.getTime(),
        ]);

        // postIds changed, but still shallowly equal
        postIds = [...postIds];

        prev = now;
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages: true});
        expect(now).toEqual(prev);
        expect(now).toEqual([
            '1006',
            '1004',
            START_OF_NEW_MESSAGES,
            'date-' + tomorrow.getTime(),
            '1003',
            '1001',
            'date-' + today.getTime(),
        ]);

        // Post changed, not in postIds
        state = {
            ...state,
            entities: {
                ...state.entities,
                posts: {
                    ...state.entities.posts,
                    posts: {
                        ...state.entities.posts.posts,
                        1007: {id: '1007', create_at: 7 * 60 * 60 * 7 * 1000},
                    },
                },
            },
        } as unknown as GlobalState;

        prev = now;
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages: true});
        expect(now).toEqual(prev);
        expect(now).toEqual([
            '1006',
            '1004',
            START_OF_NEW_MESSAGES,
            'date-' + tomorrow.getTime(),
            '1003',
            '1001',
            'date-' + today.getTime(),
        ]);

        // Post changed, in postIds
        state = {
            ...state,
            entities: {
                ...state.entities,
                posts: {
                    ...state.entities.posts,
                    posts: {
                        ...state.entities.posts.posts,
                        1006: {...state.entities.posts.posts['1006'], message: 'abcd'},
                    },
                },
            },
        };

        prev = now;
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages: true});
        expect(now).toEqual(prev);
        expect(now).toEqual([
            '1006',
            '1004',
            START_OF_NEW_MESSAGES,
            'date-' + tomorrow.getTime(),
            '1003',
            '1001',
            'date-' + today.getTime(),
        ]);

        // Filter changed
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
                    } as unknown as GlobalState['entities']['preferences']['myPreferences'],
                },
            },
        };

        prev = now;
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages: true});
        expect(now).not.toEqual(prev);
        expect(now).toEqual([
            '1004',
            START_OF_NEW_MESSAGES,
            'date-' + tomorrow.getTime(),
            '1003',
            '1001',
            'date-' + today.getTime(),
        ]);

        prev = now;
        now = filterPostsAndAddSeparators(state, {postIds, lastViewedAt, indicateNewMessages: true});
        expect(now).toEqual(prev);
        expect(now).toEqual([
            '1004',
            START_OF_NEW_MESSAGES,
            'date-' + tomorrow.getTime(),
            '1003',
            '1001',
            'date-' + today.getTime(),
        ]);
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

    describe('memoization', () => {
        const initialPostIds = ['post1', 'post2'];
        const initialState = {
            entities: {
                posts: {
                    posts: {
                        post1: {id: 'post1', type: Posts.POST_TYPES.JOIN_CHANNEL},
                        post2: {id: 'post2', type: Posts.POST_TYPES.JOIN_CHANNEL},
                    },
                },
            },
        } as unknown as GlobalState;

        test('should not recalculate when nothing has changed', () => {
            const combineUserActivityPosts = makeCombineUserActivityPosts();

            expect(combineUserActivityPosts.recomputations()).toBe(0);

            combineUserActivityPosts(initialState, initialPostIds);

            expect(combineUserActivityPosts.recomputations()).toBe(1);

            combineUserActivityPosts(initialState, initialPostIds);

            expect(combineUserActivityPosts.recomputations()).toBe(1);
        });

        test('should recalculate when the post IDs change', () => {
            const combineUserActivityPosts = makeCombineUserActivityPosts();

            let postIds = initialPostIds;
            combineUserActivityPosts(initialState, postIds);

            expect(combineUserActivityPosts.recomputations()).toBe(1);

            postIds = ['post1'];
            combineUserActivityPosts(initialState, postIds);

            expect(combineUserActivityPosts.recomputations()).toBe(2);
        });

        test('should not recalculate when an unrelated state change occurs', () => {
            const combineUserActivityPosts = makeCombineUserActivityPosts();

            let state = initialState;
            combineUserActivityPosts(state, initialPostIds);

            expect(combineUserActivityPosts.recomputations()).toBe(1);

            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        selectedPostId: 'post2',
                    },
                },
            };
            combineUserActivityPosts(state, initialPostIds);

            expect(combineUserActivityPosts.recomputations()).toBe(1);
        });

        test('should not recalculate if an unrelated post changes', () => {
            const combineUserActivityPosts = makeCombineUserActivityPosts();

            let state = initialState;
            const initialResult = combineUserActivityPosts(state, initialPostIds);

            expect(combineUserActivityPosts.recomputations()).toBe(1);

            // An unrelated post changed
            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        posts: {
                            ...state.entities.posts.posts,
                            post3: TestHelper.getPostMock({id: 'post3'}),
                        },
                    },
                },
            };
            const result = combineUserActivityPosts(state, initialPostIds);

            // The selector didn't recalculate so the result didn't change
            expect(combineUserActivityPosts.recomputations()).toBe(1);
            expect(result).toBe(initialResult);
        });

        test('should return the same result when a post changes in a way that doesn\'t affect the result', () => {
            const combineUserActivityPosts = makeCombineUserActivityPosts();

            let state = initialState;
            const initialResult = combineUserActivityPosts(state, initialPostIds);

            expect(combineUserActivityPosts.recomputations()).toBe(1);

            // One of the posts was updated, but post type didn't change
            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        posts: {
                            ...state.entities.posts.posts,
                            post2: {...state.entities.posts.posts.post2, update_at: 1234},
                        },
                    },
                },
            };
            let result = combineUserActivityPosts(state, initialPostIds);

            // The selector recalculated but is still returning the same array
            expect(combineUserActivityPosts.recomputations()).toBe(2);
            expect(result).toBe(initialResult);

            // One of the posts changed type
            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        posts: {
                            ...state.entities.posts.posts,
                            post2: {...state.entities.posts.posts.post2, type: ''},
                        },
                    },
                },
            };
            result = combineUserActivityPosts(state, initialPostIds);

            // The selector recalculated, and the result changed
            expect(combineUserActivityPosts.recomputations()).toBe(3);
            expect(result).not.toBe(initialResult);
        });
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
        expect(getFirstPostId([START_OF_NEW_MESSAGES, 'post2', 'post3', 'post4'])).toBe('post2');
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
        expect(getLastPostId(['post2', 'post3', 'post4', START_OF_NEW_MESSAGES])).toBe('post4');
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
        expect(getLastPostIndex(['post2', 'post3', 'post4', START_OF_NEW_MESSAGES])).toBe(2);
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
                    allUserIds: ['user2', 'user3', 'user1'],
                    allUsernames: [],
                    messageData: [
                        {
                            postType: Posts.POST_TYPES.JOIN_CHANNEL,
                            userIds: ['user1'],
                        },
                        {
                            postType: Posts.POST_TYPES.ADD_TO_CHANNEL,
                            userIds: ['user2', 'user3'],
                            actorId: 'user1',
                        },
                    ],
                },
            },
            system_post_ids: ['post1', 'post2', 'post3'],
            type: Posts.POST_TYPES.COMBINED_USER_ACTIVITY,
            user_activity_posts: [
                state.entities.posts.posts.post1,
                state.entities.posts.posts.post2,
                state.entities.posts.posts.post3,
            ],
            user_id: '',
            metadata: {},
        });
    });

    describe('memoization', () => {
        const initialState = {
            entities: {
                posts: {
                    posts: {
                        post1: {id: 'post1'},
                        post2: {id: 'post2'},
                    },
                },
            },
        } as unknown as GlobalState;
        const initialCombinedId = 'user-activity-post1_post2';

        test('should not recalculate when called twice with the same ID', () => {
            const generateCombinedPost = makeGenerateCombinedPost();

            expect((generateCombinedPost as any).recomputations()).toBe(0);

            generateCombinedPost(initialState, initialCombinedId);

            expect((generateCombinedPost as any).recomputations()).toBe(1);

            generateCombinedPost(initialState, initialCombinedId);

            expect((generateCombinedPost as any).recomputations()).toBe(1);
        });

        test('should recalculate when called twice with different IDs', () => {
            const generateCombinedPost = makeGenerateCombinedPost();

            expect((generateCombinedPost as any).recomputations()).toBe(0);

            let combinedId = initialCombinedId;
            generateCombinedPost(initialState, combinedId);

            expect((generateCombinedPost as any).recomputations()).toBe(1);

            combinedId = 'user-activity-post2';
            generateCombinedPost(initialState, combinedId);

            expect((generateCombinedPost as any).recomputations()).toBe(2);
        });

        test('should not recalculate when a different post changes', () => {
            const generateCombinedPost = makeGenerateCombinedPost();

            expect((generateCombinedPost as any).recomputations()).toBe(0);

            let state = initialState;
            generateCombinedPost(state, initialCombinedId);

            expect((generateCombinedPost as any).recomputations()).toBe(1);

            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        posts: {
                            ...state.entities.posts.posts,
                            post3: TestHelper.getPostMock({id: 'post3'}),
                        },
                    },
                },
            };
            generateCombinedPost(state, initialCombinedId);

            expect((generateCombinedPost as any).recomputations()).toBe(1);
        });

        test('should recalculate when one of the included posts change', () => {
            const generateCombinedPost = makeGenerateCombinedPost();

            expect((generateCombinedPost as any).recomputations()).toBe(0);

            let state = initialState;
            generateCombinedPost(state, initialCombinedId);

            expect((generateCombinedPost as any).recomputations()).toBe(1);

            state = {
                ...state,
                entities: {
                    ...state.entities,
                    posts: {
                        ...state.entities.posts,
                        posts: {
                            ...state.entities.posts.posts,
                            post2: TestHelper.getPostMock({id: 'post2', update_at: 1234}),
                        },
                    },
                },
            };
            generateCombinedPost(state, initialCombinedId);

            expect((generateCombinedPost as any).recomputations()).toBe(2);
        });
    });
});

describe('combineUserActivitySystemPost', () => {
    const PostTypes = Posts.POST_TYPES;

    it('should return null', () => {
        expect(Boolean(combineUserActivitySystemPost())).toBe(false);
        expect(Boolean(combineUserActivitySystemPost([]))).toBe(false);
    });

    const postAddToChannel1 = TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, user_id: 'user_id_1', props: {addedUserId: 'added_user_id_1', addedUsername: 'added_username_1'}});
    const postAddToChannel2 = TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, user_id: 'user_id_1', props: {addedUserId: 'added_user_id_2', addedUsername: 'added_username_2'}});
    const postAddToChannel3 = TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, user_id: 'user_id_1', props: {addedUserId: 'added_user_id_3', addedUsername: 'added_username_3'}});
    const postAddToChannel4 = TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, user_id: 'user_id_2', props: {addedUserId: 'added_user_id_4', addedUsername: 'added_username_4'}});
    const postAddToChannel5 = TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, user_id: 'user_id_1', props: {addedUsername: 'added_username_1'}});
    it('should match return for ADD_TO_CHANNEL', () => {
        const out1 = {
            allUserIds: ['added_user_id_1', 'user_id_1'],
            allUsernames: [],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_id_1']}],
        };
        expect(combineUserActivitySystemPost([postAddToChannel1])).toEqual(out1);

        const out2 = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'user_id_1'],
            allUsernames: [],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_id_1', 'added_user_id_2']}],
        };
        expect(combineUserActivitySystemPost([postAddToChannel1, postAddToChannel2])).toEqual(out2);

        const out3 = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3', 'user_id_1'],
            allUsernames: [],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3']}],
        };
        expect(combineUserActivitySystemPost([postAddToChannel1, postAddToChannel2, postAddToChannel3])).toEqual(out3);

        const out4 = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3', 'user_id_1', 'added_user_id_4', 'user_id_2'],
            allUsernames: [],
            messageData: [
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3']},
                {actorId: 'user_id_2', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_id_4']},
            ],
        };
        expect(combineUserActivitySystemPost([postAddToChannel1, postAddToChannel2, postAddToChannel3, postAddToChannel4])).toEqual(out4);

        const out5 = {
            allUserIds: ['user_id_1'],
            allUsernames: ['added_username_1'],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_username_1']}],
        };
        expect(combineUserActivitySystemPost([postAddToChannel5])).toEqual(out5);

        const out6 = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3', 'user_id_1', 'added_user_id_4', 'user_id_2'],
            allUsernames: ['added_username_1'],
            messageData: [
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_username_1', 'added_user_id_1', 'added_user_id_2', 'added_user_id_3']},
                {actorId: 'user_id_2', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_id_4']},
            ],
        };
        expect(combineUserActivitySystemPost([postAddToChannel1, postAddToChannel2, postAddToChannel3, postAddToChannel4, postAddToChannel5])).toEqual(out6);
    });

    it('should match return for ADD_TO_CHANNEL, backward compatibility with addedUsername', () => {
        const out1 = {
            allUserIds: ['user_id_1'],
            allUsernames: ['added_user_name_1'],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_name_1']}],
        };
        expect(combineUserActivitySystemPost([{...postAddToChannel1, props: {addedUsername: 'added_user_name_1'}}])).toEqual(out1);

        const out2 = {
            allUserIds: ['added_user_id_2', 'user_id_1'],
            allUsernames: ['added_user_name_1'],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_name_1', 'added_user_id_2']}],
        };
        expect(combineUserActivitySystemPost([{...postAddToChannel1, props: {addedUsername: 'added_user_name_1'}}, postAddToChannel2])).toEqual(out2);

        const out3 = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3', 'user_id_1', 'user_id_2'],
            allUsernames: ['added_user_name_4'],
            messageData: [
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3']},
                {actorId: 'user_id_2', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_name_4']},
            ],
        };
        expect(combineUserActivitySystemPost([postAddToChannel1, postAddToChannel2, postAddToChannel3, {...postAddToChannel4, props: {addedUsername: 'added_user_name_4'}}])).toEqual(out3);
    });

    const postAddToTeam1 = TestHelper.getPostMock({type: PostTypes.ADD_TO_TEAM, user_id: 'user_id_1', props: {addedUserId: 'added_user_id_1'}});
    const postAddToTeam2 = TestHelper.getPostMock({type: PostTypes.ADD_TO_TEAM, user_id: 'user_id_1', props: {addedUserId: 'added_user_id_2'}});
    const postAddToTeam3 = TestHelper.getPostMock({type: PostTypes.ADD_TO_TEAM, user_id: 'user_id_1', props: {addedUserId: 'added_user_id_3'}});
    const postAddToTeam4 = TestHelper.getPostMock({type: PostTypes.ADD_TO_TEAM, user_id: 'user_id_2', props: {addedUserId: 'added_user_id_4'}});
    it('should match return for ADD_TO_TEAM', () => {
        const out1 = {
            allUserIds: ['added_user_id_1', 'user_id_1'],
            allUsernames: [],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_id_1']}],
        };
        expect(combineUserActivitySystemPost([postAddToTeam1])).toEqual(out1);

        const out2 = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'user_id_1'],
            allUsernames: [],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_id_1', 'added_user_id_2']}],
        };
        expect(combineUserActivitySystemPost([postAddToTeam1, postAddToTeam2])).toEqual(out2);

        const out3 = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3', 'user_id_1'],
            allUsernames: [],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3']}],
        };
        expect(combineUserActivitySystemPost([postAddToTeam1, postAddToTeam2, postAddToTeam3])).toEqual(out3);

        const out4 = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3', 'user_id_1', 'added_user_id_4', 'user_id_2'],
            allUsernames: [],
            messageData: [
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3']},
                {actorId: 'user_id_2', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_id_4']},
            ],
        };
        expect(combineUserActivitySystemPost([postAddToTeam1, postAddToTeam2, postAddToTeam3, postAddToTeam4])).toEqual(out4);
    });

    it('should match return for ADD_TO_TEAM, backward compatibility with addedUsername', () => {
        const out1 = {
            allUserIds: ['user_id_1'],
            allUsernames: ['added_user_name_1'],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_name_1']}],
        };
        expect(combineUserActivitySystemPost([{...postAddToTeam1, props: {addedUsername: 'added_user_name_1'}}])).toEqual(out1);

        const out2 = {
            allUserIds: ['added_user_id_2', 'user_id_1'],
            allUsernames: ['added_user_name_1'],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_name_1', 'added_user_id_2']}],
        };
        expect(combineUserActivitySystemPost([{...postAddToTeam1, props: {addedUsername: 'added_user_name_1'}}, postAddToTeam2])).toEqual(out2);

        const out3 = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3', 'user_id_1', 'user_id_2'],
            allUsernames: ['added_user_name_4'],
            messageData: [
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3']},
                {actorId: 'user_id_2', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_name_4']},
            ],
        };
        expect(combineUserActivitySystemPost([postAddToTeam1, postAddToTeam2, postAddToTeam3, {...postAddToTeam4, props: {addedUsername: 'added_user_name_4'}}])).toEqual(out3);
    });

    const postJoinChannel1 = TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, user_id: 'user_id_1'});
    const postJoinChannel2 = TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, user_id: 'user_id_2'});
    const postJoinChannel3 = TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, user_id: 'user_id_3'});
    const postJoinChannel4 = TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, user_id: 'user_id_4'});
    it('should match return for JOIN_CHANNEL', () => {
        const out1 = {
            allUserIds: ['user_id_1'],
            allUsernames: [],
            messageData: [{postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1']}],
        };
        expect(combineUserActivitySystemPost([postJoinChannel1])).toEqual(out1);

        const out2 = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [{postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1', 'user_id_2']}],
        };
        expect(combineUserActivitySystemPost([postJoinChannel1, postJoinChannel2])).toEqual(out2);

        const out3 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3'],
            allUsernames: [],
            messageData: [{postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1', 'user_id_2', 'user_id_3']}],
        };
        expect(combineUserActivitySystemPost([postJoinChannel1, postJoinChannel2, postJoinChannel3])).toEqual(out3);

        const out4 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4'],
            allUsernames: [],
            messageData: [{postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4']}],
        };
        expect(combineUserActivitySystemPost([postJoinChannel1, postJoinChannel2, postJoinChannel3, postJoinChannel4])).toEqual(out4);
    });

    const postJoinTeam1 = TestHelper.getPostMock({type: PostTypes.JOIN_TEAM, user_id: 'user_id_1'});
    const postJoinTeam2 = TestHelper.getPostMock({type: PostTypes.JOIN_TEAM, user_id: 'user_id_2'});
    const postJoinTeam3 = TestHelper.getPostMock({type: PostTypes.JOIN_TEAM, user_id: 'user_id_3'});
    const postJoinTeam4 = TestHelper.getPostMock({type: PostTypes.JOIN_TEAM, user_id: 'user_id_4'});
    it('should match return for JOIN_TEAM', () => {
        const out1 = {
            allUserIds: ['user_id_1'],
            allUsernames: [],
            messageData: [{postType: PostTypes.JOIN_TEAM, userIds: ['user_id_1']}],
        };
        expect(combineUserActivitySystemPost([postJoinTeam1])).toEqual(out1);

        const out2 = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [{postType: PostTypes.JOIN_TEAM, userIds: ['user_id_1', 'user_id_2']}],
        };
        expect(combineUserActivitySystemPost([postJoinTeam1, postJoinTeam2])).toEqual(out2);

        const out3 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3'],
            allUsernames: [],
            messageData: [{postType: PostTypes.JOIN_TEAM, userIds: ['user_id_1', 'user_id_2', 'user_id_3']}],
        };
        expect(combineUserActivitySystemPost([postJoinTeam1, postJoinTeam2, postJoinTeam3])).toEqual(out3);

        const out4 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4'],
            allUsernames: [],
            messageData: [{postType: PostTypes.JOIN_TEAM, userIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4']}],
        };
        expect(combineUserActivitySystemPost([postJoinTeam1, postJoinTeam2, postJoinTeam3, postJoinTeam4])).toEqual(out4);
    });

    const postLeaveChannel1 = TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, user_id: 'user_id_1'});
    const postLeaveChannel2 = TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, user_id: 'user_id_2'});
    const postLeaveChannel3 = TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, user_id: 'user_id_3'});
    const postLeaveChannel4 = TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, user_id: 'user_id_4'});
    it('should match return for LEAVE_CHANNEL', () => {
        const out1 = {
            allUserIds: ['user_id_1'],
            allUsernames: [],
            messageData: [{postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']}],
        };
        expect(combineUserActivitySystemPost([postLeaveChannel1])).toEqual(out1);

        const out2 = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [{postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1', 'user_id_2']}],
        };
        expect(combineUserActivitySystemPost([postLeaveChannel1, postLeaveChannel2])).toEqual(out2);

        const out3 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3'],
            allUsernames: [],
            messageData: [{postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1', 'user_id_2', 'user_id_3']}],
        };
        expect(combineUserActivitySystemPost([postLeaveChannel1, postLeaveChannel2, postLeaveChannel3])).toEqual(out3);

        const out4 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4'],
            allUsernames: [],
            messageData: [{postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4']}],
        };
        expect(combineUserActivitySystemPost([postLeaveChannel1, postLeaveChannel2, postLeaveChannel3, postLeaveChannel4])).toEqual(out4);
    });

    const postLeaveTeam1 = TestHelper.getPostMock({type: PostTypes.LEAVE_TEAM, user_id: 'user_id_1'});
    const postLeaveTeam2 = TestHelper.getPostMock({type: PostTypes.LEAVE_TEAM, user_id: 'user_id_2'});
    const postLeaveTeam3 = TestHelper.getPostMock({type: PostTypes.LEAVE_TEAM, user_id: 'user_id_3'});
    const postLeaveTeam4 = TestHelper.getPostMock({type: PostTypes.LEAVE_TEAM, user_id: 'user_id_4'});
    it('should match return for LEAVE_TEAM', () => {
        const out1 = {
            allUserIds: ['user_id_1'],
            allUsernames: [],
            messageData: [{postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_1']}],
        };
        expect(combineUserActivitySystemPost([postLeaveTeam1])).toEqual(out1);

        const out2 = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [{postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_1', 'user_id_2']}],
        };
        expect(combineUserActivitySystemPost([postLeaveTeam1, postLeaveTeam2])).toEqual(out2);

        const out3 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3'],
            allUsernames: [],
            messageData: [{postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_1', 'user_id_2', 'user_id_3']}],
        };
        expect(combineUserActivitySystemPost([postLeaveTeam1, postLeaveTeam2, postLeaveTeam3])).toEqual(out3);

        const out4 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4'],
            allUsernames: [],
            messageData: [{postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4']}],
        };
        expect(combineUserActivitySystemPost([postLeaveTeam1, postLeaveTeam2, postLeaveTeam3, postLeaveTeam4])).toEqual(out4);
    });

    const postRemoveFromChannel1 = TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_CHANNEL, user_id: 'user_id_1', props: {removedUserId: 'removed_user_id_1'}});
    const postRemoveFromChannel2 = TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_CHANNEL, user_id: 'user_id_1', props: {removedUserId: 'removed_user_id_2'}});
    const postRemoveFromChannel3 = TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_CHANNEL, user_id: 'user_id_1', props: {removedUserId: 'removed_user_id_3'}});
    const postRemoveFromChannel4 = TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_CHANNEL, user_id: 'user_id_1', props: {removedUserId: 'removed_user_id_4'}});
    it('should match return for REMOVE_FROM_CHANNEL', () => {
        const out1 = {
            allUserIds: ['removed_user_id_1', 'user_id_1'],
            allUsernames: [],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.REMOVE_FROM_CHANNEL, userIds: ['removed_user_id_1']}],
        };
        expect(combineUserActivitySystemPost([postRemoveFromChannel1])).toEqual(out1);

        const out2 = {
            allUserIds: ['removed_user_id_1', 'removed_user_id_2', 'user_id_1'],
            allUsernames: [],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.REMOVE_FROM_CHANNEL, userIds: ['removed_user_id_1', 'removed_user_id_2']}],
        };
        expect(combineUserActivitySystemPost([postRemoveFromChannel1, postRemoveFromChannel2])).toEqual(out2);

        const out3 = {
            allUserIds: ['removed_user_id_1', 'removed_user_id_2', 'removed_user_id_3', 'user_id_1'],
            allUsernames: [],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.REMOVE_FROM_CHANNEL, userIds: ['removed_user_id_1', 'removed_user_id_2', 'removed_user_id_3']}],
        };
        expect(combineUserActivitySystemPost([postRemoveFromChannel1, postRemoveFromChannel2, postRemoveFromChannel3])).toEqual(out3);

        const out4 = {
            allUserIds: ['removed_user_id_1', 'removed_user_id_2', 'removed_user_id_3', 'removed_user_id_4', 'user_id_1'],
            allUsernames: [],
            messageData: [{actorId: 'user_id_1', postType: PostTypes.REMOVE_FROM_CHANNEL, userIds: ['removed_user_id_1', 'removed_user_id_2', 'removed_user_id_3', 'removed_user_id_4']}],
        };
        expect(combineUserActivitySystemPost([postRemoveFromChannel1, postRemoveFromChannel2, postRemoveFromChannel3, postRemoveFromChannel4])).toEqual(out4);
    });

    const postRemoveFromTeam1 = TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_TEAM, user_id: 'user_id_1'});
    const postRemoveFromTeam2 = TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_TEAM, user_id: 'user_id_2'});
    const postRemoveFromTeam3 = TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_TEAM, user_id: 'user_id_3'});
    const postRemoveFromTeam4 = TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_TEAM, user_id: 'user_id_4'});
    it('should match return for REMOVE_FROM_TEAM', () => {
        const out1 = {
            allUserIds: ['user_id_1'],
            allUsernames: [],
            messageData: [{postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_1']}],
        };
        expect(combineUserActivitySystemPost([postRemoveFromTeam1])).toEqual(out1);

        const out2 = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [{postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_1', 'user_id_2']}],
        };
        expect(combineUserActivitySystemPost([postRemoveFromTeam1, postRemoveFromTeam2])).toEqual(out2);

        const out3 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3'],
            allUsernames: [],
            messageData: [{postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_1', 'user_id_2', 'user_id_3']}],
        };
        expect(combineUserActivitySystemPost([postRemoveFromTeam1, postRemoveFromTeam2, postRemoveFromTeam3])).toEqual(out3);

        const out4 = {
            allUserIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4'],
            allUsernames: [],
            messageData: [{postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4']}],
        };
        expect(combineUserActivitySystemPost([postRemoveFromTeam1, postRemoveFromTeam2, postRemoveFromTeam3, postRemoveFromTeam4])).toEqual(out4);
    });

    it('should match return on combination', () => {
        const out1 = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'user_id_1'],
            allUsernames: [],
            messageData: [
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_id_1', 'added_user_id_2']},
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_id_1', 'added_user_id_2']},
            ],
        };
        expect(combineUserActivitySystemPost([postAddToChannel1, postAddToChannel2, postAddToTeam1, postAddToTeam2])).toEqual(out1);

        const out2 = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_TEAM, userIds: ['user_id_1', 'user_id_2']},
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1', 'user_id_2']},
            ],
        };
        expect(combineUserActivitySystemPost([postJoinChannel1, postJoinChannel2, postJoinTeam1, postJoinTeam2])).toEqual(out2);

        const out3 = {
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_1', 'user_id_2']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1', 'user_id_2']},
            ],
        };
        expect(combineUserActivitySystemPost([postLeaveChannel1, postLeaveChannel2, postLeaveTeam1, postLeaveTeam2])).toEqual(out3);

        const out4 = {
            allUserIds: ['removed_user_id_1', 'removed_user_id_2', 'user_id_1', 'user_id_2'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_1', 'user_id_2']},
                {actorId: 'user_id_1', postType: PostTypes.REMOVE_FROM_CHANNEL, userIds: ['removed_user_id_1', 'removed_user_id_2']},
            ],
        };
        expect(combineUserActivitySystemPost([postRemoveFromChannel1, postRemoveFromChannel2, postRemoveFromTeam1, postRemoveFromTeam2])).toEqual(out4);

        const out5 = {
            allUserIds: ['added_user_id_1', 'added_user_id_2', 'user_id_1', 'user_id_2', 'removed_user_id_1', 'removed_user_id_2'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1', 'user_id_2']},
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_id_1', 'added_user_id_2']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1', 'user_id_2']},
                {actorId: 'user_id_1', postType: PostTypes.REMOVE_FROM_CHANNEL, userIds: ['removed_user_id_1', 'removed_user_id_2']},
            ],
        };
        expect(combineUserActivitySystemPost([
            postAddToChannel1,
            postJoinChannel1,
            postLeaveChannel1,
            postRemoveFromChannel1,
            postAddToChannel2,
            postJoinChannel2,
            postLeaveChannel2,
            postRemoveFromChannel2,
        ])).toEqual(out5);

        const out6 = {
            allUserIds: ['added_user_id_3', 'user_id_1', 'added_user_id_4', 'user_id_2', 'user_id_3', 'user_id_4'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_TEAM, userIds: ['user_id_3', 'user_id_4']},
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_id_3']},
                {actorId: 'user_id_2', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_id_4']},
                {postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_3', 'user_id_4']},
                {postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_3', 'user_id_4']},
            ],
        };
        expect(combineUserActivitySystemPost([
            postAddToTeam3,
            postJoinTeam3,
            postLeaveTeam3,
            postRemoveFromTeam3,
            postAddToTeam4,
            postJoinTeam4,
            postLeaveTeam4,
            postRemoveFromTeam4,
        ])).toEqual(out6);

        const out7 = {
            allUserIds: ['added_user_id_3', 'added_user_id_1', 'added_user_id_2', 'user_id_1', 'added_user_id_4', 'user_id_2', 'user_id_3', 'user_id_4', 'removed_user_id_1', 'removed_user_id_2', 'removed_user_id_3', 'removed_user_id_4'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_TEAM, userIds: ['user_id_3', 'user_id_4', 'user_id_1', 'user_id_2']},
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_id_3', 'added_user_id_1', 'added_user_id_2']},
                {actorId: 'user_id_2', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_id_4']},
                {postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_3', 'user_id_4', 'user_id_1', 'user_id_2']},
                {postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_3', 'user_id_4', 'user_id_1', 'user_id_2']},
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4']},
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_id_1', 'added_user_id_2', 'added_user_id_3']},
                {actorId: 'user_id_2', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_id_4']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4']},
                {actorId: 'user_id_1', postType: PostTypes.REMOVE_FROM_CHANNEL, userIds: ['removed_user_id_1', 'removed_user_id_2', 'removed_user_id_3', 'removed_user_id_4']},
            ],
        };
        expect(combineUserActivitySystemPost([
            postAddToTeam3,
            postJoinTeam3,
            postLeaveTeam3,
            postRemoveFromTeam3,
            postAddToTeam4,
            postJoinTeam4,
            postLeaveTeam4,
            postRemoveFromTeam4,

            postAddToChannel1,
            postJoinChannel1,
            postLeaveChannel1,
            postRemoveFromChannel1,
            postAddToChannel2,
            postJoinChannel2,
            postLeaveChannel2,
            postRemoveFromChannel2,

            postAddToChannel3,
            postJoinChannel3,
            postLeaveChannel3,
            postRemoveFromChannel3,
            postAddToChannel4,
            postJoinChannel4,
            postLeaveChannel4,
            postRemoveFromChannel4,

            postAddToTeam1,
            postJoinTeam1,
            postLeaveTeam1,
            postRemoveFromTeam1,
            postAddToTeam2,
            postJoinTeam2,
            postLeaveTeam2,
            postRemoveFromTeam2,
        ])).toEqual(out7);

        const out8 = {
            allUserIds: ['added_user_id_3', 'user_id_1', 'user_id_3', 'added_user_id_1', 'removed_user_id_1'],
            allUsernames: [],
            messageData: [
                {postType: PostTypes.JOIN_TEAM, userIds: ['user_id_3']},
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_TEAM, userIds: ['added_user_id_3']},
                {postType: PostTypes.LEAVE_TEAM, userIds: ['user_id_3']},
                {postType: PostTypes.REMOVE_FROM_TEAM, userIds: ['user_id_3']},
                {postType: PostTypes.JOIN_CHANNEL, userIds: ['user_id_1']},
                {actorId: 'user_id_1', postType: PostTypes.ADD_TO_CHANNEL, userIds: ['added_user_id_1']},
                {postType: PostTypes.LEAVE_CHANNEL, userIds: ['user_id_1']},
                {actorId: 'user_id_1', postType: PostTypes.REMOVE_FROM_CHANNEL, userIds: ['removed_user_id_1']},
            ],
        };
        expect(combineUserActivitySystemPost([
            postAddToTeam3,
            postAddToTeam3,
            postJoinTeam3,
            postJoinTeam3,
            postLeaveTeam3,
            postLeaveTeam3,
            postRemoveFromTeam3,
            postRemoveFromTeam3,

            postAddToChannel1,
            postAddToChannel1,
            postJoinChannel1,
            postJoinChannel1,
            postLeaveChannel1,
            postLeaveChannel1,
            postRemoveFromChannel1,
            postRemoveFromChannel1,
        ])).toEqual(out8);
    });
});

describe('comparePostTypes', () => {
    const {
        JOIN_TEAM,
        ADD_TO_TEAM,
        LEAVE_TEAM,
        REMOVE_FROM_TEAM,
        JOIN_CHANNEL,
        ADD_TO_CHANNEL,
        LEAVE_CHANNEL,
        REMOVE_FROM_CHANNEL,
    } = Posts.POST_TYPES;

    const testCases = [
        [],
        [{postType: JOIN_TEAM}],
        [{postType: JOIN_TEAM}, {postType: ADD_TO_TEAM}],
        [{postType: ADD_TO_TEAM}, {postType: JOIN_TEAM}],
        [{postType: ADD_TO_TEAM}, {postType: ADD_TO_TEAM}, {postType: JOIN_TEAM}],
        [{postType: JOIN_TEAM}, {postType: ADD_TO_TEAM}, {postType: LEAVE_TEAM}, {postType: REMOVE_FROM_TEAM}],
        [{postType: REMOVE_FROM_TEAM}, {postType: LEAVE_TEAM}, {postType: ADD_TO_TEAM}, {postType: JOIN_TEAM}],
        [{postType: JOIN_CHANNEL}, {postType: ADD_TO_CHANNEL}, {postType: LEAVE_CHANNEL}, {postType: REMOVE_FROM_CHANNEL}],
        [{postType: REMOVE_FROM_CHANNEL}, {postType: LEAVE_CHANNEL}, {postType: ADD_TO_CHANNEL}, {postType: JOIN_CHANNEL}],
        [{postType: LEAVE_CHANNEL}, {postType: REMOVE_FROM_CHANNEL}, {postType: LEAVE_TEAM}, {postType: REMOVE_FROM_TEAM}],
        [{postType: LEAVE_TEAM}, {postType: REMOVE_FROM_TEAM}, {postType: LEAVE_CHANNEL}, {postType: REMOVE_FROM_CHANNEL}],
        [{postType: JOIN_CHANNEL}, {postType: LEAVE_CHANNEL}, {postType: JOIN_CHANNEL}, {postType: REMOVE_FROM_CHANNEL}, {postType: ADD_TO_CHANNEL}],
    ];

    for (const testCase of testCases) {
        let previousType = '';
        testCase.sort(comparePostTypes as any).forEach((sortedTestCase, index) => {
            it(`should sort post type correctly: ${previousType} should come first before ${sortedTestCase.postType}`, () => {
                if (index > 0) {
                    expect(postTypePriority[previousType] <= postTypePriority[sortedTestCase.postType]).toBeTruthy();
                }

                previousType = sortedTestCase.postType;
            });
        });
    }
});
