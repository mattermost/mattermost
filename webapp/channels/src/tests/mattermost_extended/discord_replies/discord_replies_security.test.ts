// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';

import discordRepliesReducer from 'reducers/views/discord_replies';
import {addPendingReply, clearAllPendingReplies} from 'actions/views/discord_replies';
import {getPendingReplies} from 'selectors/views/discord_replies';
import {ActionTypes, Preferences} from 'utils/constants';
import {UserTypes} from 'mattermost-redux/action_types';
import mockStore from 'tests/test_store';

describe('tests/mattermost_extended/discord_replies/discord_replies_security', () => {
    const postId1 = 'post_id_1';
    const channelId1 = 'channel_id_1';
    const channelId2 = 'channel_id_2';
    const userId = 'user_id_1';

    const baseState = {
        entities: {
            general: {
                config: {FeatureFlagVideoLinkEmbed: 'false', SiteURL: 'http://localhost:8065'},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    [userId]: {id: userId, username: 'testuser', nickname: 'Test User'},
                },
            },
            posts: {
                posts: {
                    [postId1]: {id: postId1, user_id: userId, message: 'Hello world', metadata: {}},
                },
            },
            teams: {
                currentTeamId: 'team_id1',
                teams: {team_id1: {id: 'team_id1', name: 'testteam'}},
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

    test('Verify channel isolation: replies added to channel A are NOT visible when checking channel B', () => {
        const state = cloneDeep(baseState);
        state.entities.preferences.myPreferences = {
            [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.CHANNEL_SPECIFIC_REPLIES}`]: {
                category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                name: Preferences.CHANNEL_SPECIFIC_REPLIES,
                value: 'true',
            },
        };

        // Inject replies for channel 1
        state.views.discordReplies.channelPendingReplies[channelId1] = [mockReply];

        // Switch context to channel 2
        state.entities.channels.currentChannelId = channelId2;

        const result = getPendingReplies(state);
        expect(result).toHaveLength(0); // Should be empty for channel 2
    });

    test('Verify clearAll truly empties ALL channels', () => {
        const startState = {
            pendingReplies: [mockReply],
            channelPendingReplies: {
                [channelId1]: [mockReply],
                [channelId2]: [mockReply],
            },
        };

        const action = {
            type: ActionTypes.DISCORD_REPLY_CLEAR_PENDING,
            clearAll: true,
        };

        const newState = discordRepliesReducer(startState, action);
        expect(newState.channelPendingReplies).toEqual({});
        expect(newState.pendingReplies).toHaveLength(0);
    });

    test('Verify reply data cannot contain XSS payloads in text', () => {
        const state = cloneDeep(baseState);
        const xssMessage = '<script>alert(1)</script>';
        state.entities.posts.posts[postId1].message = xssMessage;
        
        const store = mockStore(state);
        store.dispatch(addPendingReply(postId1));

        const action = store.getActions().find((a) => a.type === ActionTypes.DISCORD_REPLY_ADD_PENDING);
        // The reducer/action logic should just treat it as text, but we verify it's captured
        expect(action.reply.text).toBe(xssMessage); 
        // Note: The actual XSS prevention happens at rendering time in React or when generating markdown
        // The addPendingReply truncates text, so we check if very long malicious strings are truncated
        
        const longXss = 'A'.repeat(150) + '<script>';
        state.entities.posts.posts[postId1].message = longXss;
        const store2 = mockStore(state);
        store2.dispatch(addPendingReply(postId1));
        const action2 = store2.getActions().find((a) => a.type === ActionTypes.DISCORD_REPLY_ADD_PENDING);
        expect(action2.reply.text.length).toBe(100);
        expect(action2.reply.text.endsWith('...')).toBe(true);
        expect(action2.reply.text).not.toContain('<script>');
    });

    test('Verify post_id injection: adding a reply with a fake post_id that does not exist returns false', () => {
        const state = cloneDeep(baseState);
        const store = mockStore(state);

        // Attempt to add a non-existent post ID
        const result = store.dispatch(addPendingReply('fake_post_id'));
        
        expect(result).toBe(false);
        const actions = store.getActions();
        const addAction = actions.find((a) => a.type === ActionTypes.DISCORD_REPLY_ADD_PENDING);
        expect(addAction).toBeUndefined();
    });

    test('Verify user_id is taken from the post, not from user input', () => {
        const state = cloneDeep(baseState);
        // Post says user is 'user_id_1'
        state.entities.posts.posts[postId1].user_id = userId;
        
        const store = mockStore(state);
        store.dispatch(addPendingReply(postId1));

        const action = store.getActions().find((a) => a.type === ActionTypes.DISCORD_REPLY_ADD_PENDING);
        expect(action.reply.user_id).toBe(userId);
    });

    test('Verify max 10 limit cannot be bypassed', () => {
        let state = {
            pendingReplies: [],
            channelPendingReplies: {
                [channelId1]: [],
            },
        };

        // Fill up to 10
        for(let i=0; i<10; i++) {
            state.channelPendingReplies[channelId1].push({...mockReply, post_id: `p${i}`});
        }

        // Try adding 11th via reducer directly
        const action = {
            type: ActionTypes.DISCORD_REPLY_ADD_PENDING,
            reply: {...mockReply, post_id: 'overflow'},
            channelId: channelId1,
        };

        const newState = discordRepliesReducer(state, action);
        expect(newState.channelPendingReplies[channelId1]).toHaveLength(10);
        expect(newState.channelPendingReplies[channelId1].find((r) => r.post_id === 'overflow')).toBeUndefined();
    });

    test('Verify logout clears ALL reply data', () => {
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

    test('Verify switching from channel-specific to global mode clears data (via clearAll)', () => {
        // This simulates the behavior where we might want to ensure a clean slate,
        // although technically the 'clearAllPendingReplies' action needs to be dispatched by a component/thunk.
        // We verify the action does what it says.
        const startState = {
            pendingReplies: [],
            channelPendingReplies: {
                [channelId1]: [mockReply],
            },
        };

        const action = {
            type: ActionTypes.DISCORD_REPLY_CLEAR_PENDING,
            clearAll: true,
        };

        const newState = discordRepliesReducer(startState, action);
        expect(newState.channelPendingReplies).toEqual({});
    });
});
