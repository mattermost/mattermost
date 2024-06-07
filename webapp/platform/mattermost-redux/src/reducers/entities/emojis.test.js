// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EmojiTypes, PostTypes} from 'mattermost-redux/action_types';
import {customEmoji as customEmojiReducer} from 'mattermost-redux/reducers/entities/emojis';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';

describe('reducers/entities/emojis', () => {
    describe('customEmoji', () => {
        describe('RECEIVED_CUSTOM_EMOJI', () => {
            test('should add new emojis', () => {
                let state = deepFreeze({});

                state = customEmojiReducer(state, {
                    type: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
                    data: {
                        id: 'emoji1',
                    },
                });

                expect(state).toEqual({
                    emoji1: {id: 'emoji1'},
                });

                state = customEmojiReducer(state, {
                    type: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
                    data: {
                        id: 'emoji2',
                    },
                });

                expect(state).toEqual({
                    emoji1: {id: 'emoji1'},
                    emoji2: {id: 'emoji2'},
                });
            });

            test('should return the original state if the emoji is already loaded', () => {
                const state = deepFreeze({
                    emoji1: {id: 'emoji1'},
                });

                const nextState = customEmojiReducer(state, {
                    type: EmojiTypes.RECEIVED_CUSTOM_EMOJI,
                    data: {
                        id: 'emoji1',
                    },
                });

                expect(state).toBe(nextState);
            });
        });

        describe('RECEIVED_CUSTOM_EMOJIS', () => {
            test('should add new emojis', () => {
                let state = deepFreeze({});

                state = customEmojiReducer(state, {
                    type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
                    data: [
                        {
                            id: 'emoji1',
                        },
                        {
                            id: 'emoji2',
                        },
                    ],
                });

                expect(state).toEqual({
                    emoji1: {id: 'emoji1'},
                    emoji2: {id: 'emoji2'},
                });

                state = customEmojiReducer(state, {
                    type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
                    data: [
                        {
                            id: 'emoji1',
                        },
                        {
                            id: 'emoji3',
                        },
                    ],
                });

                expect(state).toEqual({
                    emoji1: {id: 'emoji1'},
                    emoji2: {id: 'emoji2'},
                    emoji3: {id: 'emoji3'},
                });
            });

            test('should return the original state if emojis are already loaded', () => {
                const state = deepFreeze({
                    emoji1: {id: 'emoji1'},
                    emoji2: {id: 'emoji2'},
                });

                let nextState = customEmojiReducer(state, {
                    type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
                    data: [
                        {
                            id: 'emoji1',
                        },
                    ],
                });

                expect(state).toBe(nextState);

                nextState = customEmojiReducer(state, {
                    type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
                    data: [
                        {
                            id: 'emoji1',
                        },
                        {
                            id: 'emoji2',
                        },
                    ],
                });

                expect(state).toBe(nextState);
            });

            test('should return the original state if an empty array is received', () => {
                const state = deepFreeze({
                    emoji1: {id: 'emoji1'},
                    emoji2: {id: 'emoji2'},
                });

                const nextState = customEmojiReducer(state, {
                    type: EmojiTypes.RECEIVED_CUSTOM_EMOJIS,
                    data: [],
                });

                expect(state).toBe(nextState);
            });
        });

        const testForSinglePost = (actionType) => () => {
            it('no post metadata', () => {
                const state = deepFreeze({});
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                    },
                };

                const nextState = customEmojiReducer(state, action);

                expect(nextState).toBe(state);
            });

            it('no emojis in post metadata', () => {
                const state = deepFreeze({});
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                        metadata: {},
                    },
                };

                const nextState = customEmojiReducer(state, action);

                expect(nextState).toBe(state);
            });

            it('should save custom emojis', () => {
                const state = deepFreeze({});
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                        metadata: {
                            emojis: [{id: 'emoji1'}, {id: 'emoji2'}],
                        },
                    },
                };

                const nextState = customEmojiReducer(state, action);

                expect(nextState).not.toBe(state);
                expect(nextState).toEqual({
                    emoji1: {id: 'emoji1'},
                    emoji2: {id: 'emoji2'},
                });
            });

            it('should not save custom emojis that are already loaded', () => {
                const state = deepFreeze({
                    emoji1: {id: 'emoji1'},
                    emoji2: {id: 'emoji2'},
                });
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                        metadata: {
                            emojis: [{id: 'emoji1'}, {id: 'emoji2'}],
                        },
                    },
                };

                const nextState = customEmojiReducer(state, action);

                expect(nextState).toBe(state);
            });

            it('should handle a mix of custom emojis that are and are not loaded', () => {
                const state = deepFreeze({
                    emoji1: {id: 'emoji1'},
                });
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                        metadata: {
                            emojis: [{id: 'emoji1'}, {id: 'emoji2'}],
                        },
                    },
                };

                const nextState = customEmojiReducer(state, action);

                expect(nextState).not.toBe(state);
                expect(nextState).toEqual({
                    emoji1: {id: 'emoji1'},
                    emoji2: {id: 'emoji2'},
                });
            });
        };

        describe('RECEIVED_NEW_POST', testForSinglePost(PostTypes.RECEIVED_NEW_POST));
        describe('RECEIVED_POST', testForSinglePost(PostTypes.RECEIVED_POST));

        describe('RECEIVED_POSTS', () => {
            it('no post metadata', () => {
                const state = deepFreeze({});
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post: {
                                id: 'post',
                            },
                        },
                    },
                };

                const nextState = customEmojiReducer(state, action);

                expect(nextState).toBe(state);
            });

            it('no emojis in post metadata', () => {
                const state = deepFreeze({});
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post: {
                                id: 'post',
                                metadata: {},
                            },
                        },
                    },
                };

                const nextState = customEmojiReducer(state, action);

                expect(nextState).toBe(state);
            });

            it('should save custom emojis', () => {
                const state = deepFreeze({});
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post: {
                                id: 'post',
                                metadata: {
                                    emojis: [{id: 'emoji1'}, {id: 'emoji2'}],
                                },
                            },
                        },
                    },
                };

                const nextState = customEmojiReducer(state, action);

                expect(nextState).not.toBe(state);
                expect(nextState).toEqual({
                    emoji1: {id: 'emoji1'},
                    emoji2: {id: 'emoji2'},
                });
            });

            it('should not save custom emojis that are already loaded', () => {
                const state = deepFreeze({
                    emoji1: {id: 'emoji1'},
                    emoji2: {id: 'emoji2'},
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post: {
                                id: 'post',
                                metadata: {
                                    emojis: [{id: 'emoji1'}, {id: 'emoji2'}],
                                },
                            },
                        },
                    },
                };

                const nextState = customEmojiReducer(state, action);

                expect(nextState).toBe(state);
            });

            it('should handle a mix of custom emojis that are and are not loaded', () => {
                const state = deepFreeze({
                    emoji1: {id: 'emoji1'},
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post: {
                                id: 'post',
                                metadata: {
                                    emojis: [{id: 'emoji1'}, {id: 'emoji2'}],
                                },
                            },
                        },
                    },
                };

                const nextState = customEmojiReducer(state, action);

                expect(nextState).not.toBe(state);
                expect(nextState).toEqual({
                    emoji1: {id: 'emoji1'},
                    emoji2: {id: 'emoji2'},
                });
            });

            it('should save emojis from multiple posts', () => {
                const state = deepFreeze({
                    emoji1: {id: 'emoji1'},
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post1: {
                                id: 'post1',
                                metadata: {
                                    emojis: [{id: 'emoji1'}, {id: 'emoji2'}],
                                },
                            },
                            post2: {
                                id: 'post2',
                                metadata: {
                                    emojis: [{id: 'emoji1'}, {id: 'emoji3'}],
                                },
                            },
                        },
                    },
                };

                const nextState = customEmojiReducer(state, action);

                expect(nextState).not.toBe(state);
                expect(nextState).toEqual({
                    emoji1: {id: 'emoji1'},
                    emoji2: {id: 'emoji2'},
                    emoji3: {id: 'emoji3'},
                });
            });
        });
    });
});
