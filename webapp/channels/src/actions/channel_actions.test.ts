// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    addUsersToChannel,
    openDirectChannelToUserId,
    openGroupChannelToUserIds,
    loadChannelsForCurrentUser,
} from 'actions/channel_actions';
import {loadProfilesForSidebar} from 'actions/user_actions';

import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

const initialState = {
    entities: {
        channels: {
            currentChannelId: 'current_channel_id',
            myMembers: {
                current_channel_id: {
                    channel_id: 'current_channel_id',
                    user_id: 'current_user_id',
                    roles: 'channel_role',
                    mention_count: 1,
                    msg_count: 9,
                },
            },
            channels: {
                current_channel_id: TestHelper.getChannelMock({
                    id: 'current_channel_id',
                    name: 'default-name',
                    display_name: 'Default',
                    delete_at: 0,
                    type: 'O',
                    team_id: 'team_id',
                }),
                current_user_id__existingId: TestHelper.getChannelMock({
                    id: 'current_user_id__existingId',
                    name: 'current_user_id__existingId',
                    display_name: 'Default',
                    delete_at: 0,
                    type: 'O',
                    team_id: 'team_id',
                }),
            },
            channelsInTeam: {
                'team-id': new Set(['asdf']),
            },
            messageCounts: {
                current_channel_id: {total: 10},
                current_user_id__existingId: {total: 0},
            },
        },
        teams: {
            currentTeamId: 'team-id',
            teams: {
                'team-id': {
                    id: 'team_id',
                    name: 'team-1',
                    display_name: 'Team 1',
                },
            },
            myMembers: {
                'team-id': {roles: 'team_role'},
            },
        },
        users: {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_role'},
            },
        },
        preferences: {
            myPreferences: {
                'display_settings--name_format': {
                    category: 'display_settings',
                    name: 'name_format',
                    user_id: 'current_user_id',
                    value: 'username',
                },
            },
        },
        roles: {
            roles: {
                system_role: {
                    permissions: [],
                },
                team_role: {
                    permissions: [],
                },
                channel_role: {
                    permissions: [],
                },
            },
        },
        general: {
            license: {IsLicensed: 'false'},
            serverVersion: '5.4.0',
            config: {PostEditTimeLimit: '-1'},
        },
    },
};

const realDateNow = Date.now;

jest.mock('mattermost-redux/actions/channels', () => ({
    fetchChannelsAndMembers: (...args: any) => ({type: 'MOCK_FETCH_CHANNELS_AND_MEMBERS', args}),
    searchChannels: () => {
        return {
            type: 'MOCK_SEARCH_CHANNELS',
            data: [{
                id: 'channel-id',
                name: 'channel-name',
                display_name: 'Channel',
                delete_at: 0,
                type: 'O',
            }],
        };
    },
    addChannelMembers: (...args: any) => ({type: 'MOCK_ADD_CHANNEL_MEMBERS', args}),
    createDirectChannel: (...args: any) => ({type: 'MOCK_CREATE_DIRECT_CHANNEL', args}),
    createGroupChannel: (...args: any) => ({type: 'MOCK_CREATE_GROUP_CHANNEL', args}),
}));

jest.mock('actions/user_actions', () => ({
    loadNewDMIfNeeded: jest.fn(),
    loadNewGMIfNeeded: jest.fn(),
    loadProfilesForSidebar: jest.fn(),
}));

describe('Actions.Channel', () => {
    test('loadChannelsForCurrentUser', async () => {
        const testStore = await mockStore(initialState);

        const expectedActions = [{
            type: 'MOCK_FETCH_CHANNELS_AND_MEMBERS',
            args: ['team-id'],
        }];

        await testStore.dispatch(loadChannelsForCurrentUser());
        expect(testStore.getActions()).toEqual(expectedActions);
        expect(loadProfilesForSidebar).toHaveBeenCalledTimes(1);
    });

    test('addUsersToChannel', async () => {
        const testStore = await mockStore(initialState);

        const expectedActions = [{
            type: 'MOCK_ADD_CHANNEL_MEMBERS',
            args: ['testid', ['testuserid', 'testuserid2']],
        }];

        const fakeData = {
            channel: 'testid',
            userIds: ['testuserid', 'testuserid2'],
        };

        await testStore.dispatch(addUsersToChannel(fakeData.channel, fakeData.userIds));
        expect(testStore.getActions()).toEqual(expectedActions);
    });

    test('openDirectChannelToUserId Not Existing', async () => {
        const testStore = await mockStore(initialState);

        const expectedActions = [{
            type: 'MOCK_CREATE_DIRECT_CHANNEL',
            args: ['current_user_id', 'testid'],
        }];

        const fakeData = {
            userId: 'testid',
        };

        await testStore.dispatch(openDirectChannelToUserId(fakeData.userId));
        expect(testStore.getActions()).toEqual(expectedActions);
    });

    test('openDirectChannelToUserId Existing', async () => {
        Date.now = () => new Date(0).getMilliseconds();
        const testStore = await mockStore(initialState);
        const expectedActions = [
            {
                meta: {
                    batch: true,
                },
                payload: [
                    {
                        data: [
                            {
                                category: 'direct_channel_show',
                                name: 'existingId',
                                value: 'true',
                            },
                        ],
                        type: 'RECEIVED_PREFERENCES',
                    },
                    {
                        data: [
                            {
                                category: 'channel_open_time',
                                name: 'current_user_id__existingId',
                                value: '0',
                            },
                        ],
                        type: 'RECEIVED_PREFERENCES',
                    },
                ],
                type: 'BATCHING_REDUCER.BATCH',
            },
            {
                data: [
                    {
                        category: 'direct_channel_show',
                        name: 'existingId',
                        user_id: 'current_user_id',
                        value: 'true',
                    },
                    {
                        category: 'channel_open_time',
                        name: 'current_user_id__existingId',
                        user_id: 'current_user_id',
                        value: '0',
                    },
                ],
                type: 'RECEIVED_PREFERENCES',
            },
        ];
        const fakeData = {
            userId: 'existingId',
        };

        await testStore.dispatch(openDirectChannelToUserId(fakeData.userId));

        const doneActions = testStore.getActions();
        expect(doneActions).toEqual(expectedActions);
        Date.now = realDateNow;
    });

    test('openGroupChannelToUserIds', async () => {
        const testStore = await mockStore(initialState);

        const expectedActions = [{
            type: 'MOCK_CREATE_GROUP_CHANNEL',
            args: [['testuserid1', 'testuserid2']],
        }];

        const fakeData = {
            userIds: ['testuserid1', 'testuserid2'],
        };

        await testStore.dispatch(openGroupChannelToUserIds(fakeData.userIds));
        expect(testStore.getActions()).toEqual(expectedActions);
    });
});

