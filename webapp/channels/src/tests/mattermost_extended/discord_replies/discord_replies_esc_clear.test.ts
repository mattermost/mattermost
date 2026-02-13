// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';

import {clearPendingReplies} from 'actions/views/discord_replies';
import {ActionTypes, Preferences} from 'utils/constants';
import mockStore from 'tests/test_store';

describe('tests/mattermost_extended/discord_replies/discord_replies_esc_clear', () => {
    const channelId1 = 'channel_id_1';

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
                pendingReplies: [],
                channelPendingReplies: {},
            },
        },
    };

    test('clearPendingReplies action dispatches correctly in global mode', () => {
        const state = cloneDeep(baseState);
        const store = mockStore(state);

        store.dispatch(clearPendingReplies());

        const actions = store.getActions();
        const action = actions.find((a) => a.type === ActionTypes.DISCORD_REPLY_CLEAR_PENDING);
        
        expect(action).toBeDefined();
        expect(action.channelId).toBeUndefined();
        expect(action.clearAll).toBeUndefined();
    });

    test('clearPendingReplies action dispatches correctly in channel-specific mode', () => {
        const state = cloneDeep(baseState);
        state.entities.preferences.myPreferences = {
            [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.CHANNEL_SPECIFIC_REPLIES}`]: {
                category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                name: Preferences.CHANNEL_SPECIFIC_REPLIES,
                value: 'true',
            },
        };
        const store = mockStore(state);

        store.dispatch(clearPendingReplies());

        const actions = store.getActions();
        const action = actions.find((a) => a.type === ActionTypes.DISCORD_REPLY_CLEAR_PENDING);
        
        expect(action).toBeDefined();
        expect(action.channelId).toBe(channelId1);
        expect(action.clearAll).toBeUndefined();
    });

    test('Verify the action type and payload structure', () => {
        const state = cloneDeep(baseState);
        const store = mockStore(state);

        store.dispatch(clearPendingReplies());
        const action = store.getActions()[0];

        // Ensure strict structure
        expect(action).toEqual({
            type: ActionTypes.DISCORD_REPLY_CLEAR_PENDING,
            channelId: undefined,
        });
    });
});
