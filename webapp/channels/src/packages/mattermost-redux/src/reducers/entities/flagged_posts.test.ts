// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    FlaggedPostsTypes,
    PostTypes,
    PreferenceTypes,
    UserTypes,
} from 'mattermost-redux/action_types';
import {Preferences} from 'mattermost-redux/constants';
import reducer from 'mattermost-redux/reducers/entities/flagged_posts';

type FlaggedPostsState = ReturnType<typeof reducer>;

describe('reducers.entities.flaggedPosts', () => {
    describe('postIds', () => {
        it('initial state', () => {
            const inputState = undefined;
            const action = {type: 'testinit'};
            const expectedState: string[] = [];

            const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
            expect(actualState.postIds).toEqual(expectedState);
        });

        describe('FLAGGED_POSTS_RECEIVED', () => {
            it('first results received', () => {
                const inputState: string[] = [];
                const action = {
                    type: FlaggedPostsTypes.FLAGGED_POSTS_RECEIVED,
                    data: {
                        postIds: ['post1', 'post2', 'post3'],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                    },
                };
                const expectedState = ['post1', 'post2', 'post3'];

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toEqual(expectedState);
            });

            it('replaces existing results', () => {
                const inputState = ['old1', 'old2'];
                const action = {
                    type: FlaggedPostsTypes.FLAGGED_POSTS_RECEIVED,
                    data: {
                        postIds: ['new1', 'new2'],
                        page: 0,
                        perPage: 20,
                        isEnd: false,
                    },
                };
                const expectedState = ['new1', 'new2'];

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toEqual(expectedState);
            });
        });

        describe('FLAGGED_POSTS_MORE_RECEIVED', () => {
            it('appends new results', () => {
                const inputState = ['post1', 'post2'];
                const action = {
                    type: FlaggedPostsTypes.FLAGGED_POSTS_MORE_RECEIVED,
                    data: {
                        postIds: ['post3', 'post4'],
                        page: 1,
                        perPage: 20,
                        isEnd: false,
                    },
                };
                const expectedState = ['post1', 'post2', 'post3', 'post4'];

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toEqual(expectedState);
            });

            it('deduplicates when appending', () => {
                const inputState = ['post1', 'post2'];
                const action = {
                    type: FlaggedPostsTypes.FLAGGED_POSTS_MORE_RECEIVED,
                    data: {
                        postIds: ['post2', 'post3'],
                        page: 1,
                        perPage: 20,
                        isEnd: false,
                    },
                };
                const expectedState = ['post1', 'post2', 'post3'];

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toEqual(expectedState);
            });
        });

        describe('POST_REMOVED', () => {
            it('removes post from list', () => {
                const inputState = ['post1', 'post2', 'post3'];
                const action = {
                    type: PostTypes.POST_REMOVED,
                    data: {
                        id: 'post2',
                    },
                };
                const expectedState = ['post1', 'post3'];

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toEqual(expectedState);
            });

            it('returns same state when post not in list', () => {
                const inputState = ['post1', 'post2'];
                const action = {
                    type: PostTypes.POST_REMOVED,
                    data: {
                        id: 'post999',
                    },
                };

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toBe(inputState);
            });
        });

        describe('RECEIVED_PREFERENCES (flagging a post)', () => {
            it('prepends new flagged post', () => {
                const inputState = ['post2', 'post3'];
                const action = {
                    type: PreferenceTypes.RECEIVED_PREFERENCES,
                    data: [
                        {
                            category: Preferences.CATEGORY_FLAGGED_POST,
                            name: 'post1',
                            user_id: 'user1',
                            value: 'true',
                        },
                    ],
                };
                const expectedState = ['post1', 'post2', 'post3'];

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toEqual(expectedState);
            });

            it('does not duplicate already flagged post', () => {
                const inputState = ['post1', 'post2'];
                const action = {
                    type: PreferenceTypes.RECEIVED_PREFERENCES,
                    data: [
                        {
                            category: Preferences.CATEGORY_FLAGGED_POST,
                            name: 'post1',
                            user_id: 'user1',
                            value: 'true',
                        },
                    ],
                };

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toBe(inputState);
            });

            it('ignores non-flagged-post preferences', () => {
                const inputState = ['post1', 'post2'];
                const action = {
                    type: PreferenceTypes.RECEIVED_PREFERENCES,
                    data: [
                        {
                            category: 'theme',
                            name: 'some_pref',
                            user_id: 'user1',
                            value: 'some_value',
                        },
                    ],
                };

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toBe(inputState);
            });

            it('returns same state when data is empty', () => {
                const inputState = ['post1', 'post2'];
                const action = {
                    type: PreferenceTypes.RECEIVED_PREFERENCES,
                    data: null,
                };

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toBe(inputState);
            });
        });

        describe('DELETED_PREFERENCES (unflagging a post)', () => {
            it('removes unflagged post', () => {
                const inputState = ['post1', 'post2', 'post3'];
                const action = {
                    type: PreferenceTypes.DELETED_PREFERENCES,
                    data: [
                        {
                            category: Preferences.CATEGORY_FLAGGED_POST,
                            name: 'post2',
                            user_id: 'user1',
                            value: 'true',
                        },
                    ],
                };
                const expectedState = ['post1', 'post3'];

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toEqual(expectedState);
            });

            it('returns same state when post not in list', () => {
                const inputState = ['post1', 'post2'];
                const action = {
                    type: PreferenceTypes.DELETED_PREFERENCES,
                    data: [
                        {
                            category: Preferences.CATEGORY_FLAGGED_POST,
                            name: 'post999',
                            user_id: 'user1',
                            value: 'true',
                        },
                    ],
                };

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toBe(inputState);
            });

            it('ignores non-flagged-post preferences', () => {
                const inputState = ['post1', 'post2'];
                const action = {
                    type: PreferenceTypes.DELETED_PREFERENCES,
                    data: [
                        {
                            category: 'theme',
                            name: 'post1',
                            user_id: 'user1',
                            value: 'some_value',
                        },
                    ],
                };

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toBe(inputState);
            });

            it('returns same state when data is empty', () => {
                const inputState = ['post1', 'post2'];
                const action = {
                    type: PreferenceTypes.DELETED_PREFERENCES,
                    data: null,
                };

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toBe(inputState);
            });
        });

        describe('FLAGGED_POSTS_CLEAR', () => {
            it('clears postIds', () => {
                const inputState = ['post1', 'post2', 'post3'];
                const action = {
                    type: FlaggedPostsTypes.FLAGGED_POSTS_CLEAR,
                };

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toEqual([]);
            });
        });

        describe('LOGOUT_SUCCESS', () => {
            it('clears postIds on logout', () => {
                const inputState = ['post1', 'post2', 'post3'];
                const action = {
                    type: UserTypes.LOGOUT_SUCCESS,
                };

                const actualState = reducer({postIds: inputState} as unknown as FlaggedPostsState, action);
                expect(actualState.postIds).toEqual([]);
            });
        });
    });

    describe('page', () => {
        it('initial state', () => {
            const action = {type: 'testinit'};
            const actualState = reducer({page: undefined} as unknown as FlaggedPostsState, action);
            expect(actualState.page).toEqual(0);
        });

        it('updates on FLAGGED_POSTS_RECEIVED', () => {
            const action = {
                type: FlaggedPostsTypes.FLAGGED_POSTS_RECEIVED,
                data: {postIds: [], page: 0, perPage: 20, isEnd: false},
            };
            const actualState = reducer({page: 2} as unknown as FlaggedPostsState, action);
            expect(actualState.page).toEqual(0);
        });

        it('updates on FLAGGED_POSTS_MORE_RECEIVED', () => {
            const action = {
                type: FlaggedPostsTypes.FLAGGED_POSTS_MORE_RECEIVED,
                data: {postIds: [], page: 2, perPage: 20, isEnd: false},
            };
            const actualState = reducer({page: 1} as unknown as FlaggedPostsState, action);
            expect(actualState.page).toEqual(2);
        });

        it('resets on FLAGGED_POSTS_CLEAR', () => {
            const action = {type: FlaggedPostsTypes.FLAGGED_POSTS_CLEAR};
            const actualState = reducer({page: 5} as unknown as FlaggedPostsState, action);
            expect(actualState.page).toEqual(0);
        });

        it('resets on LOGOUT_SUCCESS', () => {
            const action = {type: UserTypes.LOGOUT_SUCCESS};
            const actualState = reducer({page: 5} as unknown as FlaggedPostsState, action);
            expect(actualState.page).toEqual(0);
        });
    });

    describe('perPage', () => {
        it('initial state defaults to 20', () => {
            const action = {type: 'testinit'};
            const actualState = reducer({perPage: undefined} as unknown as FlaggedPostsState, action);
            expect(actualState.perPage).toEqual(20);
        });

        it('updates on FLAGGED_POSTS_RECEIVED', () => {
            const action = {
                type: FlaggedPostsTypes.FLAGGED_POSTS_RECEIVED,
                data: {postIds: [], page: 0, perPage: 50, isEnd: false},
            };
            const actualState = reducer({perPage: 20} as unknown as FlaggedPostsState, action);
            expect(actualState.perPage).toEqual(50);
        });

        it('resets on LOGOUT_SUCCESS', () => {
            const action = {type: UserTypes.LOGOUT_SUCCESS};
            const actualState = reducer({perPage: 50} as unknown as FlaggedPostsState, action);
            expect(actualState.perPage).toEqual(20);
        });
    });

    describe('isEnd', () => {
        it('initial state', () => {
            const action = {type: 'testinit'};
            const actualState = reducer({isEnd: undefined} as unknown as FlaggedPostsState, action);
            expect(actualState.isEnd).toEqual(false);
        });

        it('sets to true on FLAGGED_POSTS_RECEIVED when isEnd is true', () => {
            const action = {
                type: FlaggedPostsTypes.FLAGGED_POSTS_RECEIVED,
                data: {postIds: [], page: 0, perPage: 20, isEnd: true},
            };
            const actualState = reducer({isEnd: false} as unknown as FlaggedPostsState, action);
            expect(actualState.isEnd).toEqual(true);
        });

        it('sets to false on FLAGGED_POSTS_RECEIVED when isEnd is false', () => {
            const action = {
                type: FlaggedPostsTypes.FLAGGED_POSTS_RECEIVED,
                data: {postIds: [], page: 0, perPage: 20, isEnd: false},
            };
            const actualState = reducer({isEnd: true} as unknown as FlaggedPostsState, action);
            expect(actualState.isEnd).toEqual(false);
        });

        it('updates on FLAGGED_POSTS_MORE_RECEIVED', () => {
            const action = {
                type: FlaggedPostsTypes.FLAGGED_POSTS_MORE_RECEIVED,
                data: {postIds: [], page: 1, perPage: 20, isEnd: true},
            };
            const actualState = reducer({isEnd: false} as unknown as FlaggedPostsState, action);
            expect(actualState.isEnd).toEqual(true);
        });

        it('resets on FLAGGED_POSTS_CLEAR', () => {
            const action = {type: FlaggedPostsTypes.FLAGGED_POSTS_CLEAR};
            const actualState = reducer({isEnd: true} as unknown as FlaggedPostsState, action);
            expect(actualState.isEnd).toEqual(false);
        });

        it('resets on LOGOUT_SUCCESS', () => {
            const action = {type: UserTypes.LOGOUT_SUCCESS};
            const actualState = reducer({isEnd: true} as unknown as FlaggedPostsState, action);
            expect(actualState.isEnd).toEqual(false);
        });
    });

    describe('isLoading', () => {
        it('initial state', () => {
            const action = {type: 'testinit'};
            const actualState = reducer({isLoading: undefined} as unknown as FlaggedPostsState, action);
            expect(actualState.isLoading).toEqual(false);
        });

        it('sets to true on FLAGGED_POSTS_REQUEST', () => {
            const action = {type: FlaggedPostsTypes.FLAGGED_POSTS_REQUEST};
            const actualState = reducer({isLoading: false} as unknown as FlaggedPostsState, action);
            expect(actualState.isLoading).toEqual(true);
        });

        it('sets to false on FLAGGED_POSTS_SUCCESS', () => {
            const action = {type: FlaggedPostsTypes.FLAGGED_POSTS_SUCCESS};
            const actualState = reducer({isLoading: true} as unknown as FlaggedPostsState, action);
            expect(actualState.isLoading).toEqual(false);
        });

        it('sets to false on FLAGGED_POSTS_FAILURE', () => {
            const action = {type: FlaggedPostsTypes.FLAGGED_POSTS_FAILURE};
            const actualState = reducer({isLoading: true} as unknown as FlaggedPostsState, action);
            expect(actualState.isLoading).toEqual(false);
        });

        it('resets on LOGOUT_SUCCESS', () => {
            const action = {type: UserTypes.LOGOUT_SUCCESS};
            const actualState = reducer({isLoading: true} as unknown as FlaggedPostsState, action);
            expect(actualState.isLoading).toEqual(false);
        });
    });

    describe('isLoadingMore', () => {
        it('initial state', () => {
            const action = {type: 'testinit'};
            const actualState = reducer({isLoadingMore: undefined} as unknown as FlaggedPostsState, action);
            expect(actualState.isLoadingMore).toEqual(false);
        });

        it('sets to true on FLAGGED_POSTS_MORE_REQUEST', () => {
            const action = {type: FlaggedPostsTypes.FLAGGED_POSTS_MORE_REQUEST};
            const actualState = reducer({isLoadingMore: false} as unknown as FlaggedPostsState, action);
            expect(actualState.isLoadingMore).toEqual(true);
        });

        it('sets to false on FLAGGED_POSTS_MORE_RECEIVED', () => {
            const action = {
                type: FlaggedPostsTypes.FLAGGED_POSTS_MORE_RECEIVED,
                data: {postIds: [], page: 1, perPage: 20, isEnd: false},
            };
            const actualState = reducer({isLoadingMore: true} as unknown as FlaggedPostsState, action);
            expect(actualState.isLoadingMore).toEqual(false);
        });

        it('sets to false on FLAGGED_POSTS_FAILURE', () => {
            const action = {type: FlaggedPostsTypes.FLAGGED_POSTS_FAILURE};
            const actualState = reducer({isLoadingMore: true} as unknown as FlaggedPostsState, action);
            expect(actualState.isLoadingMore).toEqual(false);
        });

        it('resets on LOGOUT_SUCCESS', () => {
            const action = {type: UserTypes.LOGOUT_SUCCESS};
            const actualState = reducer({isLoadingMore: true} as unknown as FlaggedPostsState, action);
            expect(actualState.isLoadingMore).toEqual(false);
        });
    });
});
