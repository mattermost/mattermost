// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CollapsedThreads} from '@mattermost/types/config';
import type {UserProfile} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';

import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

import SwitchChannelProvider from './switch_channel_provider';

const latestPost = TestHelper.getPostMock({
    id: 'latest_post_id',
    user_id: 'current_user_id',
    message: 'test msg',
    channel_id: 'other_gm_channel',
    create_at: Date.now(),
});

jest.mock('mattermost-redux/client', () => {
    const original = jest.requireActual('mattermost-redux/client');

    return {
        ...original,
        Client4: {
            ...original.Client4,
            autocompleteUsers: jest.fn().mockResolvedValue([]),
        },
    };
});

jest.mock('mattermost-redux/actions/channels', () => ({
    ...jest.requireActual('mattermost-redux/actions/channels'),
    searchAllChannels: () => jest.fn().mockResolvedValue(Promise.resolve({
        data: [{
            id: 'channel_other_user1',
            type: 'O',
            name: 'other_user',
            display_name: 'other_user',
            delete_at: 0,
            team_id: 'currentTeamId',
        },
        ],
    })),
}));

describe('components/SwitchChannelProvider', () => {
    const defaultState = {
        entities: {
            general: {
                config: {},
            },
            channels: {
                myMembers: {
                    current_channel_id: {
                        channel_id: 'current_channel_id',
                        user_id: 'current_user_id',
                    },
                    direct_other_user: {
                        channel_id: 'direct_other_user',
                        user_id: 'current_user_id',
                        roles: 'channel_role',
                        last_viewed_at: 10,
                    },
                    channel_other_user: {
                        channel_id: 'channel_other_user',
                    },
                },
                channels: {
                    direct_other_user: TestHelper.getChannelMock({
                        id: 'direct_other_user',
                        name: 'current_user_id__other_user',
                    }),
                },
                messageCounts: {
                    direct_other_user: {
                        root: 2,
                        total: 2,
                    },
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
                    'group_channel_show--other_gm_channel': {
                        category: 'group_channel_show',
                        value: 'true',
                        name: 'other_gm_channel',
                        user_id: 'current_user_id',
                    },
                },
            },
            users: {
                profiles: {
                    current_user_id: TestHelper.getUserMock({roles: 'system_role'}),
                    other_user1: TestHelper.getUserMock({
                        id: 'other_user1',
                        username: 'other_user1',
                    }),
                },
                currentUserId: 'current_user_id',
                profilesInChannel: {
                    current_user_id: new Set(['user_1']),
                },
            },
            teams: {
                currentTeamId: 'currentTeamId',
                teams: {
                    currentTeamId: TestHelper.getTeamMock({
                        id: 'currentTeamId',
                        display_name: 'test',
                        type: 'O',
                        delete_at: 0,
                    }),
                },
            },
            posts: {
                posts: {
                    [latestPost.id]: latestPost,
                },
                postsInChannel: {
                    other_gm_channel: [
                        {order: [latestPost.id], recent: true},
                    ],
                },
                postsInThread: {},
            },
        },
    };

    it('should change name on wrapper to be unique with same name user channel and public channel', () => {
        const switchProvider = new SwitchChannelProvider();
        const store = mockStore(defaultState);
        switchProvider.store = store;

        const users = [
            TestHelper.getUserMock({
                id: 'other_user',
                username: 'other_user',
            }),
        ];
        const channels = [{
            id: 'channel_other_user',
            type: 'O',
            name: 'other_user',
            display_name: 'other_user',
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'direct_other_user',
            type: 'D',
            name: 'current_user_id__other_user',
            display_name: 'other_user',
            update_at: 0,
            delete_at: 0,
        }];
        const searchText = 'other';

        switchProvider.startNewRequest('');
        const result = switchProvider.formatList(searchText, channels, users);

        const set = new Set(result.terms);
        expect(set.size).toEqual(result.items.length);

        const set2 = new Set(result.items.map((o) => {
            if ('channel' in o) {
                return o.channel.name;
            }

            return null;
        }));
        expect(set2.size).toEqual(1);
        expect(result.items.length).toEqual(2);
    });

    it('should change name on wrapper to be unique with same name user in channel and public channel', () => {
        const switchProvider = new SwitchChannelProvider();
        const store = mockStore(defaultState);
        switchProvider.store = store;

        const users = [
            TestHelper.getUserMock({
                id: 'other_user',
                username: 'other_user',
            })];
        const channels = [{
            id: 'channel_other_user',
            type: 'O',
            name: 'other_user',
            display_name: 'other_user',
            update_at: 0,
            delete_at: 0,
        }];
        const searchText = 'other';

        switchProvider.startNewRequest('');
        const result = switchProvider.formatList(searchText, channels, users);

        const set = new Set(result.terms);
        expect(set.size).toEqual(result.items.length);

        const set2 = new Set(result.items.map((o) => {
            if ('channel' in o) {
                return o.channel.name;
            }

            return null;
        }));
        expect(set2.size).toEqual(1);
        expect(result.items.length).toEqual(2);
    });

    it('should not fail if nothing matches', () => {
        const switchProvider = new SwitchChannelProvider();
        const store = mockStore(defaultState);
        switchProvider.store = store;

        const users: UserProfile[] = [];
        const channels = [{
            id: 'channel_other_user',
            type: 'O',
            name: 'other_user',
            display_name: 'other_user',
            update_at: 0,
            delete_at: 0,
        },
        {
            id: 'direct_other_user',
            type: 'D',
            name: 'current_user_id__other_user',
            display_name: 'other_user',
            update_at: 0,
            delete_at: 0,
        }];
        const searchText = 'something else';

        switchProvider.startNewRequest('');
        const results = switchProvider.formatList(searchText, channels, users);

        expect(results.terms.length).toEqual(0);
        expect(results.items.length).toEqual(0);
    });

    it('should correctly format the display name depending on the preferences', () => {
        const switchProvider = new SwitchChannelProvider();

        const user = TestHelper.getUserMock({
            id: 'id',
            username: 'username',
            first_name: 'fn',
            last_name: 'ln',
        });

        const channel = TestHelper.getChannelMock({
            id: 'channel_id',
        });

        let res = switchProvider.userWrappedChannel(user, channel);
        expect(res.channel.display_name).toEqual('fn ln');

        const store = mockStore({
            entities: {
                general: {
                    config: {},
                },
                channels: {
                    myMembers: {
                        current_channel_id: {
                            channel_id: 'current_channel_id',
                            user_id: 'current_user_id',
                            roles: 'channel_role',
                            mention_count: 1,
                            msg_count: 9,
                        },
                    },
                },
                preferences: {
                    myPreferences: {
                        'display_settings--name_format': {
                            category: 'display_settings',
                            name: 'name_format',
                            user_id: 'current_user_id',
                            value: 'full_name',
                        },
                    },
                },
                users: {
                    profiles: {
                        current_user_id: {roles: 'system_role'},
                    },
                    currentUserId: 'current_user_id',
                    profilesInChannel: {
                        current_user_id: new Set(['user_1']),
                    },
                },
            },
        });
        switchProvider.store = store;

        res = switchProvider.userWrappedChannel(user, channel);
        expect(res.channel.display_name).toEqual('fn ln');
    });

    it('should sort results in aplhabetical order', () => {
        const channels = [
            TestHelper.getChannelMock({
                id: 'channel_other_user',
                type: 'O',
                name: 'blah_other_user',
                display_name: 'blah_other_user',
                delete_at: 0,
            }),
            TestHelper.getChannelMock({
                id: 'direct_other_user1',
                type: 'D',
                name: 'current_user_id__other_user1',
                display_name: 'other_user1',
                delete_at: 0,
            }),
            TestHelper.getChannelMock({
                id: 'direct_other_user2',
                type: 'D',
                name: 'current_user_id__other_user2',
                display_name: 'other_user2',
                delete_at: 0,
            }),
        ];

        const users = [
            TestHelper.getUserMock({
                id: 'other_user2',
                username: 'other_user2',
            }),
            TestHelper.getUserMock({
                id: 'other_user1',
                username: 'other_user1',
            }),
        ];

        const modifiedState = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    channels: {
                        ...defaultState.entities.channels.channels,
                        [channels[0].id]: channels[0],
                        [channels[1].id]: channels[1],
                        [channels[2].id]: channels[2],
                    },
                    myMembers: {
                        current_channel_id: {
                            channel_id: 'current_channel_id',
                            user_id: 'current_user_id',
                            roles: 'channel_role',
                            mention_count: 1,
                            msg_count: 9,
                        },
                        channel_other_user: {},
                        direct_other_user1: {},
                        direct_other_user2: {},
                    },
                },
                users: {
                    ...defaultState.entities.users,
                    profiles: {
                        ...defaultState.entities.users.profiles,
                        [users[0].id]: users[0],
                        [users[1].id]: users[1],
                    },
                },
            },
        };

        const switchProvider = new SwitchChannelProvider();
        const store = mockStore(modifiedState);
        switchProvider.store = store;

        const searchText = 'other';

        switchProvider.startNewRequest('');
        const results = switchProvider.formatList(searchText, channels, users);

        const expectedOrder = [
            'other_user1',
            'other_user2',
            'channel_other_user',
        ];

        expect(results.terms).toEqual(expectedOrder);
    });

    it('should sort results based on last_viewed_at order followed by alphabetical andomit users not in members', () => {
        const users = [
            TestHelper.getUserMock({
                id: 'other_user1',
                username: 'other_user1',
            }),
            TestHelper.getUserMock({
                id: 'other_user2',
                username: 'other_user2',
            }),
            TestHelper.getUserMock({
                id: 'other_user3',
                username: 'other_user3',
            }),
            TestHelper.getUserMock({
                id: 'other_user4',
                username: 'other_user4',
            }),
        ];

        const channels = [
            TestHelper.getChannelMock({
                id: 'channel_other_user',
                type: 'O',
                name: 'blah_other_user',
                display_name: 'blah_other_user',
                delete_at: 0,
            }),
            TestHelper.getChannelMock({
                id: 'direct_other_user1',
                type: 'D',
                name: 'current_user_id__other_user1',
                display_name: 'other_user1',
                delete_at: 0,
            }),
            TestHelper.getChannelMock({
                id: 'direct_other_user2',
                type: 'D',
                name: 'current_user_id__other_user2',
                display_name: 'other_user2',
                delete_at: 0,
            }),
            TestHelper.getChannelMock({
                id: 'direct_other_user4',
                type: 'D',
                name: 'current_user_id__other_user4',
                display_name: 'other_user4',
                delete_at: 0,
            }),
        ];

        const modifiedState = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    channels: {
                        ...defaultState.entities.channels.channels,
                        [channels[0].id]: channels[0],
                        [channels[1].id]: channels[1],
                        [channels[2].id]: channels[2],
                        [channels[3].id]: channels[3],
                    },
                    myMembers: {
                        current_channel_id: {
                            channel_id: 'current_channel_id',
                            user_id: 'current_user_id',
                            roles: 'channel_role',
                            mention_count: 1,
                            msg_count: 9,
                            last_viewed_at: 1,
                        },
                        direct_other_user1: {
                            channel_id: 'direct_other_user1',
                            msg_count: 1,
                            last_viewed_at: 2,
                        },
                        direct_other_user4: {
                            channel_id: 'direct_other_user4',
                            msg_count: 1,
                            last_viewed_at: 3,
                        },
                        channel_other_user: {},
                    },
                },
                users: {
                    ...defaultState.entities.users,
                    profiles: {
                        ...defaultState.entities.users.profiles,
                        [users[0].id]: users[0],
                        [users[1].id]: users[1],
                        [users[2].id]: users[2],
                        [users[3].id]: users[3],
                    },
                },
            },
        };

        const switchProvider = new SwitchChannelProvider();
        const store = mockStore(modifiedState);
        switchProvider.store = store;

        const searchText = 'other';

        switchProvider.startNewRequest('');
        const results = switchProvider.formatList(searchText, channels, users);

        const expectedOrder = [
            'other_user4',
            'other_user1',
            'channel_other_user',
        ];

        expect(results.terms).toEqual(expectedOrder);
    });

    it('should start with GM before channels and DM"s with last_viewed_at', async () => {
        const modifiedState = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    myMembers: {
                        current_channel_id: {
                            channel_id: 'current_channel_id',
                            user_id: 'current_user_id',
                            roles: 'channel_role',
                            mention_count: 1,
                            msg_count: 9,
                        },
                        other_gm_channel: {
                            channel_id: 'other_gm_channel',
                            msg_count: 1,
                            last_viewed_at: 3,
                        },
                        other_user1: {},
                    },
                    channels: {
                        channel_other_user: {
                            id: 'channel_other_user',
                            type: 'O' as const,
                            name: 'other_user',
                            display_name: 'other_user',
                            delete_at: 0,
                            team_id: 'currentTeamId',
                        },
                        other_gm_channel: {
                            id: 'other_gm_channel',
                            type: 'G' as const,
                            name: 'other_gm_channel',
                            delete_at: 0,
                            display_name: 'other_gm_channel',
                        },
                        other_user1: {
                            id: 'other_user1',
                            type: 'D' as const,
                            name: 'current_user_id__other_user1',
                            display_name: 'current_user_id__other_user1',
                        },
                    },
                },
            },
        };

        const switchProvider = new SwitchChannelProvider();
        const store = mockStore(modifiedState);
        switchProvider.store = store;

        const searchText = 'other';
        const resultsCallback = jest.fn();

        switchProvider.startNewRequest('');
        await switchProvider.fetchUsersAndChannels(searchText, resultsCallback);
        const expectedOrder = [
            'other_gm_channel',
            'other_user1',
            'channel_other_user1',
        ];

        expect(resultsCallback).toBeCalledWith(expect.objectContaining({
            terms: expectedOrder,
        }));
    });

    it('should start with DM (user name with dot) before GM"s if both DM & GM have last_viewed_at irrespective of value of last_viewed_at', async () => {
        const modifiedState = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    myMembers: {
                        current_channel_id: {
                            channel_id: 'current_channel_id',
                            user_id: 'current_user_id',
                            roles: 'channel_role',
                            mention_count: 1,
                            msg_count: 9,
                        },
                        other_gm_channel: {
                            channel_id: 'other_gm_channel',
                            msg_count: 1,
                            last_viewed_at: 3,
                        },
                        other_user1: {
                            last_viewed_at: 4,
                        },
                    },
                    channels: {
                        channel_other_user: {
                            id: 'channel_other_user',
                            type: 'O' as const,
                            name: 'other_user',
                            display_name: 'other_user',
                            delete_at: 0,
                            team_id: 'currentTeamId',
                        },
                        other_gm_channel: {
                            id: 'other_gm_channel',
                            type: 'G' as const,
                            name: 'other_gm_channel',
                            delete_at: 0,
                            display_name: 'other.user1, other.user2',
                        },
                        other_user1: {
                            id: 'other_user1',
                            type: 'D' as const,
                            name: 'current_user_id__other_user1',
                            display_name: 'other user1',
                        },
                    },
                },
                users: {
                    profiles: {
                        current_user_id: {roles: 'system_role'},
                        other_user1: {
                            id: 'other_user1',
                            display_name: 'other user1',
                            username: 'other.user1',
                        },
                    },
                    currentUserId: 'current_user_id',
                    profilesInChannel: {
                        current_user_id: new Set(['user_1']),
                    },
                },
            },
        };

        const switchProvider = new SwitchChannelProvider();
        const store = mockStore(modifiedState);
        switchProvider.store = store;
        const searchText = 'other.';
        const resultsCallback = jest.fn();

        switchProvider.startNewRequest('');
        await switchProvider.fetchUsersAndChannels(searchText, resultsCallback);
        const expectedOrder = [
            'other_user1',
            'other_gm_channel',
        ];

        expect(resultsCallback).toBeCalledWith(expect.objectContaining({
            terms: expectedOrder,
        }));
    });

    it('GM should not be first result as it is hidden in LHS', async () => {
        const modifiedState = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                preferences: {
                    ...defaultState.entities.preferences,
                    myPreferences: {
                        'display_settings--name_format': {
                            category: 'display_settings',
                            name: 'name_format',
                            user_id: 'current_user_id',
                            value: 'username',
                        },
                        'group_channel_show--other_gm_channel': {
                            category: 'group_channel_show',
                            value: 'false',
                            name: 'other_gm_channel',
                            user_id: 'current_user_id',
                        },
                    },
                },
                channels: {
                    ...defaultState.entities.channels,
                    myMembers: {
                        current_channel_id: {
                            channel_id: 'current_channel_id',
                            user_id: 'current_user_id',
                            roles: 'channel_role',
                            mention_count: 1,
                            msg_count: 9,
                        },
                        other_gm_channel: {
                            channel_id: 'other_gm_channel',
                            msg_count: 1,
                            last_viewed_at: 3,
                        },
                        other_user1: {},
                    },
                    channels: {
                        channel_other_user: {
                            id: 'channel_other_user',
                            type: 'O' as const,
                            name: 'other_user',
                            display_name: 'other_user',
                            delete_at: 0,
                            team_id: 'currentTeamId',
                        },
                        other_gm_channel: {
                            id: 'other_gm_channel',
                            type: 'G' as const,
                            name: 'other_gm_channel',
                            delete_at: 0,
                            display_name: 'other_gm_channel',
                        },
                        other_user1: {
                            id: 'other_user1',
                            type: 'D' as const,
                            name: 'current_user_id__other_user1',
                            display_name: 'current_user_id__other_user1',
                        },
                    },
                    channelsInTeam: {
                        '': new Set(['other_gm_channel']),
                    },
                },
            },
        };

        const switchProvider = new SwitchChannelProvider();
        const store = mockStore(modifiedState);
        switchProvider.store = store;
        const searchText = 'other';
        const resultsCallback = jest.fn();

        switchProvider.startNewRequest('');
        await switchProvider.fetchUsersAndChannels(searchText, resultsCallback);
        const expectedOrder = [
            'other_user1',
            'other_gm_channel',
            'channel_other_user1',
        ];
        expect(resultsCallback).toBeCalledWith(expect.objectContaining({
            terms: expectedOrder,
        }));
    });

    it('Should match GM even with space in search term', () => {
        const modifiedState = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    myMembers: {
                        current_channel_id: {
                            channel_id: 'current_channel_id',
                            user_id: 'current_user_id',
                            roles: 'channel_role',
                            mention_count: 1,
                            msg_count: 9,
                            last_viewed_at: 1,
                        },
                        direct_other_user1: {
                            channel_id: 'direct_other_user1',
                            msg_count: 1,
                            last_viewed_at: 2,
                        },
                        other_gm_channel: {
                            channel_id: 'other_gm_channel',
                            msg_count: 1,
                            last_viewed_at: 3,
                        },
                    },
                    channels: {
                        other_gm_channel: TestHelper.getChannelMock({
                            id: 'other_gm_channel',
                            type: 'G',
                            name: 'other_gm_channel',
                            delete_at: 0,
                            display_name: 'other_gm_channel',
                        }),
                        other_user1: TestHelper.getChannelMock({
                            id: 'other_user1',
                            type: 'D',
                            name: 'current_user_id__other_user1',
                            display_name: 'current_user_id__other_user1',
                        }),
                    },
                    channelsInTeam: {
                        '': new Set(['other_gm_channel']),
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
                        'group_channel_show--other_gm_channel': {
                            category: 'group_channel_show',
                            value: 'true',
                            name: 'other_gm_channel',
                            user_id: 'current_user_id',
                        },
                    },
                },
            },
        };

        const switchProvider = new SwitchChannelProvider();
        const store = mockStore(modifiedState);
        switchProvider.store = store;

        const users = [
            TestHelper.getUserMock({
                id: 'other_user1',
                username: 'other_user1',
            }),
        ];

        const channels = [{
            id: 'other_gm_channel',
            msg_count: 1,
            last_viewed_at: 3,
            type: 'G',
            name: 'other_gm_channel',
            delete_at: 0,
            update_at: 0,
            display_name: 'other_user1, current_user_id',
        }];

        const searchText = 'other current';

        switchProvider.startNewRequest('');
        const results = switchProvider.formatList(searchText, channels, users);

        const expectedOrder = [
            'other_gm_channel',
        ];

        expect(results.terms).toEqual(expectedOrder);
    });

    it('should filter out channels belonging to archived teams', async () => {
        const modifiedState = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    myMembers: {
                        channel_1: {},
                        channel_2: {},
                    },
                    channels: {
                        channel_1: TestHelper.getChannelMock({
                            id: 'channel_1',
                            type: 'O',
                            name: 'channel_1',
                            display_name: 'channel 1',
                            delete_at: 0,
                            team_id: 'currentTeamId',
                        }),
                        channel_2: TestHelper.getChannelMock({
                            id: 'channel_2',
                            type: 'O',
                            name: 'channel_2',
                            display_name: 'channel 2',
                            delete_at: 0,
                            team_id: 'archivedTeam',
                        }),
                    },
                },
            },
        };

        const switchProvider = new SwitchChannelProvider();
        const store = mockStore(modifiedState);
        switchProvider.store = store;
        const searchText = 'chan';
        const resultsCallback = jest.fn();

        switchProvider.startNewRequest('');
        await switchProvider.fetchUsersAndChannels(searchText, resultsCallback);
        const channelsFromActiveTeams = [
            'channel_1',
        ];

        expect(resultsCallback).toBeCalledWith(expect.objectContaining({
            terms: channelsFromActiveTeams,
        }));
    });

    it('Should show threads as the first item in the list if search term matches', async () => {
        const modifiedState = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                general: {
                    config: {
                        CollapsedThreads: CollapsedThreads.DEFAULT_OFF,
                    },
                },
                threads: {
                    countsIncludingDirect: {
                        currentTeamId: {
                            total: 0,
                            total_unread_threads: 0,
                            total_unread_mentions: 0,
                        },
                    },
                    counts: {
                        currentTeamId: {
                            total: 0,
                            total_unread_threads: 0,
                            total_unread_mentions: 0,
                        },
                    },
                },
                preferences: {
                    ...defaultState.entities.preferences,
                    myPreferences: {
                        ...defaultState.entities.preferences.myPreferences,
                        [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.COLLAPSED_REPLY_THREADS}`]: {
                            value: 'on',
                        },
                    },
                },
                channels: {
                    ...defaultState.entities.channels,
                    myMembers: {
                        current_channel_id: {
                            channel_id: 'current_channel_id',
                            user_id: 'current_user_id',
                            roles: 'channel_role',
                            mention_count: 1,
                            msg_count: 9,
                        },
                        thread_gm_channel: {
                            channel_id: 'thread_gm_channel',
                            msg_count: 1,
                            last_viewed_at: 3,
                        },
                        thread_user1: {},
                    },
                    channels: {
                        thread_gm_channel: {
                            id: 'thread_gm_channel',
                            type: 'G' as const,
                            name: 'thread_gm_channel',
                            delete_at: 0,
                            display_name: 'thread_gm_channel',
                        },
                    },
                    channelsInTeam: {
                        '': new Set(['thread_gm_channel']),
                    },
                },
            },
        };

        const switchProvider = new SwitchChannelProvider();
        const store = mockStore(modifiedState);
        switchProvider.store = store;
        const searchText = 'thread';
        const resultsCallback = jest.fn();

        switchProvider.startNewRequest(searchText);
        await switchProvider.fetchUsersAndChannels(searchText, resultsCallback);
        const expectedOrder = [
            'threads',
            'thread_gm_channel',
        ];

        expect(resultsCallback).toBeCalledWith(expect.objectContaining({
            terms: expectedOrder,
        }));
    });
});
