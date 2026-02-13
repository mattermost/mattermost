// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';

import discordRepliesReducer from 'reducers/views/discord_replies';
import {addPendingReply, removePendingReply, clearPendingReplies, clearAllPendingReplies} from 'actions/views/discord_replies';
import {getPendingReplies, hasPendingReplies, isPostPendingReply} from 'selectors/views/discord_replies';
import {ActionTypes, Preferences} from 'utils/constants';
import {UserTypes} from 'mattermost-redux/action_types';
import mockStore from 'tests/test_store';

describe('tests/mattermost_extended/discord_replies/discord_replies_channel_specific', () => {
    const postId1 = 'post_id_1';
    const postId2 = 'post_id_2';
    const channelId1 = 'channel_id_1';
    const channelId2 = 'channel_id_2';
    const userId = 'user_id_1';

    const mockReply = {
        post_id: postId1,
        user_id: userId,
        username: 'user1',
        nickname: 'User One',
        text: 'Reply text',
        has_image: false,
        has_video: false,
        file_categories: [],
    };

    const mockReply2 = {
        ...mockReply,
        post_id: postId2,
        text: 'Reply text 2',
    };

    const initialState = {
        pendingReplies: [],
        channelPendingReplies: {},
    };

    describe('Reducer tests', () => {
        test('channelPendingReplies reducer handles ADD with channelId', () => {
            const action = {
                type: ActionTypes.DISCORD_REPLY_ADD_PENDING,
                reply: mockReply,
                channelId: channelId1,
            };

            const newState = discordRepliesReducer(initialState, action);
            expect(newState.channelPendingReplies[channelId1]).toHaveLength(1);
            expect(newState.channelPendingReplies[channelId1][0]).toEqual(mockReply);
            expect(newState.pendingReplies).toHaveLength(0);
        });

        test('channelPendingReplies reducer handles REMOVE with channelId', () => {
            const startState = {
                ...initialState,
                channelPendingReplies: {
                    [channelId1]: [mockReply],
                },
            };

            const action = {
                type: ActionTypes.DISCORD_REPLY_REMOVE_PENDING,
                postId: postId1,
                channelId: channelId1,
            };

            const newState = discordRepliesReducer(startState, action);
            expect(newState.channelPendingReplies[channelId1]).toHaveLength(0);
        });

        test('channelPendingReplies reducer handles CLEAR with channelId', () => {
            const startState = {
                ...initialState,
                channelPendingReplies: {
                    [channelId1]: [mockReply],
                    [channelId2]: [mockReply2],
                },
            };

            const action = {
                type: ActionTypes.DISCORD_REPLY_CLEAR_PENDING,
                channelId: channelId1,
            };

            const newState = discordRepliesReducer(startState, action);
            expect(newState.channelPendingReplies[channelId1]).toHaveLength(0);
            expect(newState.channelPendingReplies[channelId2]).toHaveLength(1); // Should remain touched
        });

        test('channelPendingReplies reducer handles clearAll', () => {
            const startState = {
                ...initialState,
                channelPendingReplies: {
                    [channelId1]: [mockReply],
                    [channelId2]: [mockReply2],
                },
            };

            const action = {
                type: ActionTypes.DISCORD_REPLY_CLEAR_PENDING,
                clearAll: true,
            };

            const newState = discordRepliesReducer(startState, action);
            expect(newState.channelPendingReplies).toEqual({});
        });

        test('channelPendingReplies reducer ignores actions without channelId', () => {
            const action = {
                type: ActionTypes.DISCORD_REPLY_ADD_PENDING,
                reply: mockReply,
                // No channelId
            };

            const newState = discordRepliesReducer(initialState, action);
            expect(newState.channelPendingReplies).toEqual({});
        });

        test('pendingReplies reducer ignores actions WITH channelId', () => {
            const action = {
                type: ActionTypes.DISCORD_REPLY_ADD_PENDING,
                reply: mockReply,
                channelId: channelId1,
            };

            const newState = discordRepliesReducer(initialState, action);
            expect(newState.pendingReplies).toHaveLength(0);
        });

        test('pendingReplies reducer still handles actions without channelId (backward compat)', () => {
            const action = {
                type: ActionTypes.DISCORD_REPLY_ADD_PENDING,
                reply: mockReply,
            };

            const newState = discordRepliesReducer(initialState, action);
            expect(newState.pendingReplies).toHaveLength(1);
        });

        test('Both reducers clear on LOGOUT_SUCCESS', () => {
            const startState = {
                pendingReplies: [mockReply],
                channelPendingReplies: {
                    [channelId1]: [mockReply],
                },
            };

            const action = {type: UserTypes.LOGOUT_SUCCESS};

            const newState = discordRepliesReducer(startState, action);
            expect(newState.pendingReplies).toHaveLength(0);
            expect(newState.channelPendingReplies).toEqual({});
        });

        test('Toggle behavior works per-channel', () => {
            // Add first time
            let state = discordRepliesReducer(initialState, {
                type: ActionTypes.DISCORD_REPLY_ADD_PENDING,
                reply: mockReply,
                channelId: channelId1,
            });
            expect(state.channelPendingReplies[channelId1]).toHaveLength(1);

            // Add same post again (should remove)
            state = discordRepliesReducer(state, {
                type: ActionTypes.DISCORD_REPLY_ADD_PENDING,
                reply: mockReply,
                channelId: channelId1,
            });
            expect(state.channelPendingReplies[channelId1]).toHaveLength(0);
        });

        test('Max 10 replies per channel enforced', () => {
            let state = initialState;
            // Add 10 replies
            for (let i = 0; i < 10; i++) {
                state = discordRepliesReducer(state, {
                    type: ActionTypes.DISCORD_REPLY_ADD_PENDING,
                    reply: {...mockReply, post_id: `post_${i}`},
                    channelId: channelId1,
                });
            }
            expect(state.channelPendingReplies[channelId1]).toHaveLength(10);

            // Try adding 11th
            state = discordRepliesReducer(state, {
                type: ActionTypes.DISCORD_REPLY_ADD_PENDING,
                reply: {...mockReply, post_id: 'post_overflow'},
                channelId: channelId1,
            });
            expect(state.channelPendingReplies[channelId1]).toHaveLength(10); // Still 10
        });
    });

    describe('Selector tests', () => {
        const baseState = {
            entities: {
                preferences: {
                    myPreferences: {},
                },
                channels: {
                    currentChannelId: channelId1,
                },
            },
            views: {
                discordReplies: {
                    pendingReplies: [mockReply],
                    channelPendingReplies: {
                        [channelId1]: [mockReply2],
                        [channelId2]: [mockReply],
                    },
                },
            },
        };

        test('getPendingReplies returns global replies when channel_specific_replies preference is false', () => {
            const state = cloneDeep(baseState);
            state.entities.preferences.myPreferences = {
                [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.CHANNEL_SPECIFIC_REPLIES}`]: {
                    category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                    name: Preferences.CHANNEL_SPECIFIC_REPLIES,
                    value: 'false',
                },
            };

            const result = getPendingReplies(state);
            expect(result).toEqual([mockReply]);
        });

        test('getPendingReplies returns channel-scoped replies when preference is true', () => {
            const state = cloneDeep(baseState);
            state.entities.preferences.myPreferences = {
                [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.CHANNEL_SPECIFIC_REPLIES}`]: {
                    category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                    name: Preferences.CHANNEL_SPECIFIC_REPLIES,
                    value: 'true',
                },
            };

            const result = getPendingReplies(state);
            expect(result).toEqual([mockReply2]); // channelId1 replies
        });

        test('hasPendingReplies reflects the correct store based on preference', () => {
            const state = cloneDeep(baseState);
            // Enable channel specific
            state.entities.preferences.myPreferences = {
                [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.CHANNEL_SPECIFIC_REPLIES}`]: {
                    category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                    name: Preferences.CHANNEL_SPECIFIC_REPLIES,
                    value: 'true',
                },
            };

            // Current channel (channelId1) has replies
            expect(hasPendingReplies(state)).toBe(true);

            // Switch to channel without replies
            state.entities.channels.currentChannelId = 'empty_channel';
            expect(hasPendingReplies(state)).toBe(false);
        });

        test('isPostPendingReply works correctly in both modes', () => {
            const state = cloneDeep(baseState);

            // Global mode
            state.entities.preferences.myPreferences = {
                [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.CHANNEL_SPECIFIC_REPLIES}`]: {
                    category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                    name: Preferences.CHANNEL_SPECIFIC_REPLIES,
                    value: 'false',
                },
            };
            expect(isPostPendingReply(state, postId1)).toBe(true); // present in global
            expect(isPostPendingReply(state, postId2)).toBe(false); // only in channel-specific

            // Channel specific mode
            state.entities.preferences.myPreferences = {
                [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.CHANNEL_SPECIFIC_REPLIES}`]: {
                    category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                    name: Preferences.CHANNEL_SPECIFIC_REPLIES,
                    value: 'true',
                },
            };
            expect(isPostPendingReply(state, postId1)).toBe(false); // present in global, not channel 1
            expect(isPostPendingReply(state, postId2)).toBe(true); // present in channel 1
        });
    });

    describe('Action tests', () => {
        const baseActionState = {
            entities: {
                general: {
                    config: {FeatureFlagVideoLinkEmbed: 'false'},
                },
                users: {
                    profiles: {[userId]: {id: userId, username: 'user1'}},
                },
                posts: {
                    posts: {
                        [postId1]: {id: postId1, user_id: userId, message: 'test', metadata: {}},
                    },
                },
                channels: {
                    currentChannelId: channelId1,
                },
                preferences: {
                    myPreferences: {},
                },
            },
            views: {
                discordReplies: {
                    pendingReplies: [],
                    channelPendingReplies: {},
                },
            },
        };

        test('addPendingReply dispatches with channelId when preference is true', () => {
            const state = cloneDeep(baseActionState);
            state.entities.preferences.myPreferences = {
                [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.CHANNEL_SPECIFIC_REPLIES}`]: {
                    category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                    name: Preferences.CHANNEL_SPECIFIC_REPLIES,
                    value: 'true',
                },
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId1));

            const action = store.getActions().find((a) => a.type === ActionTypes.DISCORD_REPLY_ADD_PENDING);
            expect(action).toBeDefined();
            expect(action.channelId).toBe(channelId1);
        });

        test('addPendingReply dispatches without channelId when preference is false', () => {
            const state = cloneDeep(baseActionState);
            // Default preference is false/undefined
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId1));

            const action = store.getActions().find((a) => a.type === ActionTypes.DISCORD_REPLY_ADD_PENDING);
            expect(action).toBeDefined();
            expect(action.channelId).toBeUndefined();
        });

        test('removePendingReply includes channelId when in channel-specific mode', () => {
            const state = cloneDeep(baseActionState);
            state.entities.preferences.myPreferences = {
                [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.CHANNEL_SPECIFIC_REPLIES}`]: {
                    category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                    name: Preferences.CHANNEL_SPECIFIC_REPLIES,
                    value: 'true',
                },
            };
            const store = mockStore(state);

            store.dispatch(removePendingReply(postId1));

            const action = store.getActions().find((a) => a.type === ActionTypes.DISCORD_REPLY_REMOVE_PENDING);
            expect(action.channelId).toBe(channelId1);
        });

        test('clearPendingReplies includes channelId when in channel-specific mode', () => {
            const state = cloneDeep(baseActionState);
            state.entities.preferences.myPreferences = {
                [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.CHANNEL_SPECIFIC_REPLIES}`]: {
                    category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                    name: Preferences.CHANNEL_SPECIFIC_REPLIES,
                    value: 'true',
                },
            };
            const store = mockStore(state);

            store.dispatch(clearPendingReplies());

            const action = store.getActions().find((a) => a.type === ActionTypes.DISCORD_REPLY_CLEAR_PENDING);
            expect(action.channelId).toBe(channelId1);
        });

        test('clearAllPendingReplies dispatches with clearAll: true', () => {
            const store = mockStore(baseActionState);

            store.dispatch(clearAllPendingReplies());

            const action = store.getActions().find((a) => a.type === ActionTypes.DISCORD_REPLY_CLEAR_PENDING);
            expect(action.clearAll).toBe(true);
        });
    });
});
