// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';

import {addUserIdsForStatusFetchingPoll} from 'mattermost-redux/actions/status_profile_polling';
import {Constants} from 'mattermost-redux/constants';

import * as Actions from 'actions/status_actions';
import mockStore from 'tests/test_store';

jest.mock('mattermost-redux/actions/users', () => ({
    getStatusesByIds: jest.fn(() => ({type: 'MOCK_GET_STATUSES_BY_IDS'})),
    makeGetProfilesInChannel: jest.fn(() => () => [
        {id: 'member_id1', username: 'member1'},
        {id: 'member_id2', username: 'member2'},
    ]),
}));

jest.mock('mattermost-redux/actions/status_profile_polling', () => ({
    addUserIdsForStatusFetchingPoll: jest.fn(() => ({type: 'MOCK_ADD_USER_IDS_FOR_STATUS_POLL'})),
}));

jest.mock('actions/emoji_actions', () => ({
    loadCustomEmojisForCustomStatusesByUserIds: jest.fn(() => ({type: 'MOCK_LOAD_CUSTOM_EMOJIS'})),
}));

describe('tests/mattermost_extended/guilded_status_sync', () => {
    const initialState = {
        entities: {
            general: {
                config: {
                    FeatureFlagGuildedChatLayout: 'true',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    other_user_id: {id: 'other_user_id', username: 'other_user', nickname: 'Other'},
                    member_id1: {id: 'member_id1', username: 'member1'},
                    member_id2: {id: 'member_id2', username: 'member2'},
                },
                profilesInChannel: {
                    channel_id1: ['member_id1', 'member_id2'],
                },
            },
            channels: {
                currentChannelId: 'channel_id1',
                channels: {
                    channel_id1: {id: 'channel_id1', name: 'channel1', team_id: 'team_id1', type: 'O'},
                    dm_channel_id: {id: 'dm_channel_id', name: 'current_user_id__other_user_id', type: 'D', last_post_at: 1000},
                },
                myMembers: {
                    channel_id1: {channel_id: 'channel_id1', user_id: 'current_user_id'},
                    dm_channel_id: {channel_id: 'dm_channel_id', user_id: 'current_user_id'},
                },
            },
            preferences: {
                myPreferences: {
                    'display_settings--guilded_chat_layout': {category: 'display_settings', name: 'guilded_chat_layout', value: 'true'},
                    [Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW + '--other_user_id']: {category: Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, name: 'other_user_id', value: 'true'},
                },
            },
            posts: {
                postsInChannel: {},
            },
        },
        views: {
            channel: {
                postVisibility: {channel_id1: 0},
            },
        },
    };

    test('addVisibleUsersInCurrentChannelAndSelfToStatusPoll should include DM list users and channel members in Guilded layout', () => {
        const state = cloneDeep(initialState);
        const testStore = mockStore(state);

        testStore.dispatch(Actions.addVisibleUsersInCurrentChannelAndSelfToStatusPoll());

        expect(addUserIdsForStatusFetchingPoll).toHaveBeenCalled();
        const calledWith = (addUserIdsForStatusFetchingPoll as jest.Mock).mock.calls[0][0];

        // Should include:
        // 1. Current user
        // 2. other_user_id (from DM list)
        // 3. member_id1, member_id2 (from channel members)
        expect(calledWith).toContain('current_user_id');
        expect(calledWith).toContain('other_user_id');
        expect(calledWith).toContain('member_id1');
        expect(calledWith).toContain('member_id2');
        expect(calledWith.length).toBe(4);
    });

    test('addVisibleUsersInCurrentChannelAndSelfToStatusPoll should NOT include channel members if Guilded layout is disabled', () => {
        const state = cloneDeep(initialState);
        state.entities.preferences.myPreferences['display_settings--guilded_chat_layout'].value = 'false';
        const testStore = mockStore(state);

        testStore.dispatch(Actions.addVisibleUsersInCurrentChannelAndSelfToStatusPoll());

        const calledWith = (addUserIdsForStatusFetchingPoll as jest.Mock).mock.calls[(addUserIdsForStatusFetchingPoll as jest.Mock).mock.calls.length - 1][0];

        // Should only include:
        // 1. Current user
        // 2. other_user_id (from standard direct show preferences)
        expect(calledWith).toContain('current_user_id');
        expect(calledWith).toContain('other_user_id');
        expect(calledWith).not.toContain('member_id1');
        expect(calledWith).not.toContain('member_id2');
        expect(calledWith.length).toBe(2);
    });
});
