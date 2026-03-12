// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import * as Selectors from 'mattermost-redux/selectors/entities/flagged_posts';
import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';

describe('selectors.entities.flaggedPosts', () => {
    const post1: Post = {
        id: 'post1',
        channel_id: 'channel1',
        create_at: 1000,
        update_at: 1000,
        edit_at: 0,
        delete_at: 0,
        is_pinned: false,
        user_id: 'user1',
        message: 'Test message 1',
        root_id: '',
        original_id: '',
        props: {},
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {
            embeds: [],
            emojis: [],
            files: [],
            images: {},
        },
        type: '',
    };

    const post2: Post = {
        id: 'post2',
        channel_id: 'channel1',
        create_at: 2000,
        update_at: 2000,
        edit_at: 0,
        delete_at: 0,
        is_pinned: false,
        user_id: 'user2',
        message: 'Test message 2',
        root_id: '',
        original_id: '',
        props: {},
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {
            embeds: [],
            emojis: [],
            files: [],
            images: {},
        },
        type: '',
    };

    const post3: Post = {
        id: 'post3',
        channel_id: 'channel2',
        create_at: 3000,
        update_at: 3000,
        edit_at: 0,
        delete_at: 0,
        is_pinned: false,
        user_id: 'user1',
        message: 'Test message 3',
        root_id: '',
        original_id: '',
        props: {},
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {
            embeds: [],
            emojis: [],
            files: [],
            images: {},
        },
        type: '',
    };

    describe('getFlaggedPostIds', () => {
        it('returns postIds from state', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: ['post1', 'post2', 'post3'],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                        isLoading: false,
                        isLoadingMore: false,
                    },
                },
            });

            expect(Selectors.getFlaggedPostIds(state as GlobalState)).toEqual([
                'post1',
                'post2',
                'post3',
            ]);
        });

        it('returns empty array when no flagged posts', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: [],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                        isLoading: false,
                        isLoadingMore: false,
                    },
                },
            });

            expect(Selectors.getFlaggedPostIds(state as GlobalState)).toEqual(
                [],
            );
        });
    });

    describe('getFlaggedPostsPage', () => {
        it('returns current page', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: [],
                        page: 2,
                        perPage: 20,
                        isEnd: false,
                        isLoading: false,
                        isLoadingMore: false,
                    },
                },
            });

            expect(Selectors.getFlaggedPostsPage(state as GlobalState)).toEqual(
                2,
            );
        });
    });

    describe('getIsFlaggedPostsEnd', () => {
        it('returns true when isEnd is true', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: [],
                        page: 0,
                        perPage: 20,
                        isEnd: true,
                        isLoading: false,
                        isLoadingMore: false,
                    },
                },
            });

            expect(
                Selectors.getIsFlaggedPostsEnd(state as GlobalState),
            ).toEqual(true);
        });

        it('returns false when isEnd is false', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: [],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                        isLoading: false,
                        isLoadingMore: false,
                    },
                },
            });

            expect(
                Selectors.getIsFlaggedPostsEnd(state as GlobalState),
            ).toEqual(false);
        });
    });

    describe('getIsFlaggedPostsLoading', () => {
        it('returns true when isLoading is true', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: [],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                        isLoading: true,
                        isLoadingMore: false,
                    },
                },
            });

            expect(
                Selectors.getIsFlaggedPostsLoading(state as GlobalState),
            ).toEqual(true);
        });

        it('returns false when isLoading is false', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: [],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                        isLoading: false,
                        isLoadingMore: false,
                    },
                },
            });

            expect(
                Selectors.getIsFlaggedPostsLoading(state as GlobalState),
            ).toEqual(false);
        });
    });

    describe('getIsFlaggedPostsLoadingMore', () => {
        it('returns true when isLoadingMore is true', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: [],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                        isLoading: false,
                        isLoadingMore: true,
                    },
                },
            });

            expect(
                Selectors.getIsFlaggedPostsLoadingMore(state as GlobalState),
            ).toEqual(true);
        });

        it('returns false when isLoadingMore is false', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: [],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                        isLoading: false,
                        isLoadingMore: false,
                    },
                },
            });

            expect(
                Selectors.getIsFlaggedPostsLoadingMore(state as GlobalState),
            ).toEqual(false);
        });
    });

    describe('getFlaggedPosts', () => {
        it('returns posts in order of postIds', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: ['post1', 'post2', 'post3'],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                        isLoading: false,
                        isLoadingMore: false,
                    },
                    posts: {
                        posts: {
                            post1,
                            post2,
                            post3,
                        },
                        postsInChannel: {},
                        postsInThread: {},
                    },
                },
            });

            const result = Selectors.getFlaggedPosts(state as GlobalState);
            expect(result).toHaveLength(3);
            expect(result[0]).toEqual(post1);
            expect(result[1]).toEqual(post2);
            expect(result[2]).toEqual(post3);
        });

        it('filters out missing posts', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: ['post1', 'missing_post', 'post3'],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                        isLoading: false,
                        isLoadingMore: false,
                    },
                    posts: {
                        posts: {
                            post1,
                            post3,
                        },
                        postsInChannel: {},
                        postsInThread: {},
                    },
                },
            });

            const result = Selectors.getFlaggedPosts(state as GlobalState);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(post1);
            expect(result[1]).toEqual(post3);
        });

        it('returns empty array when no flagged posts', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: [],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                        isLoading: false,
                        isLoadingMore: false,
                    },
                    posts: {
                        posts: {
                            post1,
                            post2,
                        },
                        postsInChannel: {},
                        postsInThread: {},
                    },
                },
            });

            const result = Selectors.getFlaggedPosts(state as GlobalState);
            expect(result).toEqual([]);
        });

        it('returns memoized result for identical state', () => {
            const state = deepFreezeAndThrowOnMutation({
                entities: {
                    flaggedPosts: {
                        postIds: ['post1', 'post2'],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                        isLoading: false,
                        isLoadingMore: false,
                    },
                    posts: {
                        posts: {
                            post1,
                            post2,
                        },
                        postsInChannel: {},
                        postsInThread: {},
                    },
                },
            });

            const result1 = Selectors.getFlaggedPosts(state as GlobalState);
            const result2 = Selectors.getFlaggedPosts(state as GlobalState);

            expect(result1).toBe(result2);
        });
    });
});
