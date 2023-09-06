// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {Channel} from '@mattermost/types/channels';
import type {Role} from '@mattermost/types/roles';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import {
    searchMoreChannels,
    addUsersToChannel,
    openDirectChannelToUserId,
    openGroupChannelToUserIds,
    loadChannelsForCurrentUser, fetchChannelsAndMembers,
} from 'actions/channel_actions';
import {CHANNELS_AND_CHANNEL_MEMBERS_PER_PAGE} from 'actions/channel_queries';
import {loadProfilesForSidebar} from 'actions/user_actions';
import configureStore from 'store';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import mockStore from 'tests/test_store';

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
                current_channel_id: {
                    id: 'current_channel_id',
                    name: 'default-name',
                    display_name: 'Default',
                    delete_at: 0,
                    type: 'O',
                    team_id: 'team_id',
                },
                current_user_id__existingId: {
                    id: 'current_user_id__existingId',
                    name: 'current_user_id__existingId',
                    display_name: 'Default',
                    delete_at: 0,
                    type: '0',
                    team_id: 'team_id',
                },
            },
            channelsInTeam: {
                'team-id': ['current_channel_id'],
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
                    displayName: 'Team 1',
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
            config: {PostEditTimeLimit: -1},
        },
    },
};

const realDateNow = Date.now;

jest.mock('mattermost-redux/actions/channels', () => ({
    fetchMyChannelsAndMembersREST: (...args: any) => ({type: 'MOCK_FETCH_CHANNELS_AND_MEMBERS', args}),
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
    addChannelMember: (...args: any) => ({type: 'MOCK_ADD_CHANNEL_MEMBER', args}),
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

    test('searchMoreChannels', async () => {
        const testStore = await mockStore(initialState);

        const expectedActions = [{
            type: 'MOCK_SEARCH_CHANNELS',
            data: [{
                id: 'channel-id',
                name: 'channel-name',
                display_name: 'Channel',
                delete_at: 0,
                type: 'O',
            }],
        }];

        await testStore.dispatch(searchMoreChannels('', false, true));
        expect(testStore.getActions()).toEqual(expectedActions);
    });

    test('addUsersToChannel', async () => {
        const testStore = await mockStore(initialState);

        const expectedActions = [{
            type: 'MOCK_ADD_CHANNEL_MEMBER',
            args: ['testid', 'testuserid'],
        }];

        const fakeData = {
            channel: 'testid',
            userIds: ['testuserid'],
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

    describe('fetchChannelsAndMembers', () => {
        let role1: Role;
        let role2: Role;

        beforeAll(() => {
            TestHelper.initBasic(Client4);

            role1 = TestHelper.basicRoles?.system_admin as Role;
            role2 = TestHelper.basicRoles?.system_user as Role;
        });

        afterEach(() => {
            nock.cleanAll();
        });

        afterAll(() => {
            TestHelper.tearDown();
        });

        test('should throws error when response errors out', async () => {
            const store = configureStore();

            nock(Client4.getGraphQLUrl()).
                post('').reply(200, {
                    errors: [{message: 'some error'}],
                });

            const result = await store.dispatch(fetchChannelsAndMembers());

            expect(Object.keys(result)).toEqual(['error']);
        });

        test('should throws error when response is not correct', async () => {
            [null, undefined, {}].
                forEach(async (dataResponse) => {
                    const store = configureStore();

                    nock(Client4.getGraphQLUrl()).
                        post('').reply(200, {
                            data: dataResponse,
                        });

                    const result = await store.dispatch(fetchChannelsAndMembers());

                    expect(Object.keys(result)).toEqual(['error']);
                });
        });

        test('should throws not throw error when responses are empty', async () => {
            [[[], []], [[fakeGQLChannelWithId('team1')], []], [[], [fakeGQLChannelMember('user1', 'channel2', [role1])]]].
                forEach(async ([channelResponse, channelMemberResponse]) => {
                    const store = configureStore();

                    nock(Client4.getGraphQLUrl()).
                        post('').
                        reply(200, {
                            data: {
                                channels: [...channelResponse],
                                channelMembers: [...channelMemberResponse],
                            },
                        });

                    const result = await store.dispatch(fetchChannelsAndMembers());

                    expect(Object.keys(result)).not.toEqual(['error']);
                });
        });

        test('should return correct channels, channel members and roles when under max limit', async () => {
            const store = configureStore();

            const perPage = Math.floor(CHANNELS_AND_CHANNEL_MEMBERS_PER_PAGE / 2);

            const channels = [];
            for (let i = 1; i <= perPage; i++) {
                channels.push(fakeGQLChannelWithId(`team${i}`));
            }

            const channelMembers = [];
            for (let i = 1; i <= perPage; i++) {
                channelMembers.push(fakeGQLChannelMember('user1', `channel${i}`, [role1]));
            }

            nock(Client4.getGraphQLUrl()).
                post('').
                reply(200, {
                    data: {
                        channels: [...channels],
                        channelMembers: [...channelMembers],
                    },
                });

            const result = await store.dispatch(fetchChannelsAndMembers());

            expect(result.data.channels.length).toEqual(perPage);
            expect(result.data.channelMembers.length).toEqual(perPage);

            // Since we added a single role to each channel member, we should have as many roles as channel members
            expect(result.data.roles.length).toEqual(perPage);
        });

        test('should return correct channels, channel members, roles when responses span across multiple pages', async () => {
            const store = configureStore();

            const p1Page = CHANNELS_AND_CHANNEL_MEMBERS_PER_PAGE;
            const p2Page = CHANNELS_AND_CHANNEL_MEMBERS_PER_PAGE;
            const p3Page = Math.floor(CHANNELS_AND_CHANNEL_MEMBERS_PER_PAGE / 2);
            const responsesPerPage = [p1Page, p2Page, p3Page];
            const totalNumOfResponses = p1Page + p2Page + p3Page;

            const channelsResponsePages: any[][] = [];
            const channelMembersResponsePages: any[][] = [];

            responsesPerPage.forEach((responsePerPage, i) => {
                const channelResponsePerPage = [];
                const channelMemberResponsePerPage = [];
                for (let j = 1; j <= responsePerPage; j++) {
                    const channel = fakeGQLChannelWithId(`team${i}_${j}`);
                    channelResponsePerPage.push(channel);

                    const random0or1 = Math.round(Math.random());
                    channelMemberResponsePerPage.push(fakeGQLChannelMember('user1', `channel${i}_${j}`, random0or1 === 0 ? [role1, role2] : [role2]));
                }

                channelsResponsePages.push(channelResponsePerPage);
                channelMembersResponsePages.push(channelMemberResponsePerPage);
            });

            responsesPerPage.forEach((_, i) => {
                nock(Client4.getGraphQLUrl()).
                    post('').
                    reply(200, {
                        data: {
                            channels: [...channelsResponsePages[i]],
                            channelMembers: [...channelMembersResponsePages[i]],
                        },
                    });
            });

            const result = await store.dispatch(fetchChannelsAndMembers());
            expect(result.data.channels.length).toEqual(totalNumOfResponses);
            expect(result.data.channelMembers.length).toEqual(totalNumOfResponses);
        });

        test('should error out when pagination throws errors', async () => {
            const store = configureStore();

            const p1Page = CHANNELS_AND_CHANNEL_MEMBERS_PER_PAGE;
            const p2Page = CHANNELS_AND_CHANNEL_MEMBERS_PER_PAGE; // so that page 3 will throw an error

            const responsesPerPage = [p1Page, p2Page];

            const channelsResponsePages: any[][] = [];
            const channelMembersResponsePages: any[][] = [];

            responsesPerPage.forEach((responsePerPage, i) => {
                const channelResponsePerPage = [];
                const channelMemberResponsePerPage = [];
                for (let j = 1; j <= responsePerPage; j++) {
                    const channel = fakeGQLChannelWithId(`team${i}_${j}`);
                    channelResponsePerPage.push(channel);

                    const random0or1 = Math.round(Math.random());
                    channelMemberResponsePerPage.push(fakeGQLChannelMember('user1', `channel${i}_${j}`, random0or1 === 0 ? [role1, role2] : [role2]));
                }

                channelsResponsePages.push(channelResponsePerPage);
                channelMembersResponsePages.push(channelMemberResponsePerPage);
            });

            responsesPerPage.forEach((_, i) => {
                nock(Client4.getGraphQLUrl()).
                    post('').
                    reply(200, {
                        data: {
                            channels: [...channelsResponsePages[i]],
                            channelMembers: [...channelMembersResponsePages[i]],
                        },
                    });
            });

            // Last page will throw an error
            nock(Client4.getGraphQLUrl()).
                post('').
                reply(200, {
                    data: {},
                    errors: [{message: 'some error'}],
                });

            const result = await store.dispatch(fetchChannelsAndMembers());
            expect(Object.keys(result)).toEqual(['error']);
        });

        function fakeGQLChannelWithId(teamId: Team['id']) {
            return Object.assign(TestHelper.fakeChannelWithId(teamId), {
                team: {id: teamId},
            });
        }

        function fakeGQLChannelMember(userId: UserProfile['id'], channelId: Channel['id'], roles: Role[] = []) {
            return Object.assign(TestHelper.fakeChannelMember(userId, channelId), {
                channel: {
                    id: channelId,
                },
                user: {
                    id: userId,
                },
                roles: [...roles],
            });
        }
    });
});

