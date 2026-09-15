// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import {CollapsedThreads} from '@mattermost/types/config';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {General, Preferences} from 'mattermost-redux/constants';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';
import Constants, {StoragePrefixes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {WrappedChannel} from './switch_channel_provider';
import SwitchChannelProvider, {ConnectedSwitchChannelSuggestion, makeQuickSwitchSorter} from './switch_channel_provider';

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
        const result = switchProvider.formatGroup(searchText, channels, users);

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
        const result = switchProvider.formatGroup(searchText, channels, users);

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

    it('flags discoverable non-member private channels in the recent list for the request-to-join flow (MM-68764)', () => {
        const switchProvider = new SwitchChannelProvider();
        const store = mockStore({
            ...defaultState,
            entities: {
                ...defaultState.entities,
                general: {config: {FeatureFlagDiscoverableChannels: 'true'}},
                channels: {
                    ...defaultState.entities.channels,
                    joinRequests: {
                        myPendingByChannel: {},
                        byChannel: {},
                        countsByChannel: {},
                        myList: [],
                    },
                },
            },
        });
        switchProvider.store = store;

        const discoverableChannel = TestHelper.getChannelMock({
            id: 'discoverable_channel_id',
            type: 'P',
            name: 'discoverable-ops',
            display_name: 'Discoverable Ops',
            discoverable: true,
            delete_at: 0,
        });

        const wrapped = switchProvider.wrapChannels([discoverableChannel], Constants.MENTION_RECENT_CHANNELS);

        expect(wrapped).toHaveLength(1);
        expect(wrapped[0].discoverableNonMember).toBe(true);
        expect(wrapped[0].hasPendingJoinRequest).toBe(false);
    });

    it('marks a discoverable recent-list channel with a pending request so the row offers Withdraw', () => {
        const switchProvider = new SwitchChannelProvider();
        const store = mockStore({
            ...defaultState,
            entities: {
                ...defaultState.entities,
                general: {config: {FeatureFlagDiscoverableChannels: 'true'}},
                channels: {
                    ...defaultState.entities.channels,
                    joinRequests: {
                        myPendingByChannel: {
                            discoverable_channel_id: {
                                id: 'req1',
                                channel_id: 'discoverable_channel_id',
                                user_id: 'current_user_id',
                                message: '',
                                status: 'pending',
                                denial_reason: '',
                                create_at: 1,
                                update_at: 1,
                                reviewed_by: '',
                                reviewed_at: 0,
                            },
                        },
                        byChannel: {},
                        countsByChannel: {},
                        myList: [],
                    },
                },
            },
        });
        switchProvider.store = store;

        const discoverableChannel = TestHelper.getChannelMock({
            id: 'discoverable_channel_id',
            type: 'P',
            name: 'discoverable-ops',
            display_name: 'Discoverable Ops',
            discoverable: true,
            delete_at: 0,
        });

        const wrapped = switchProvider.wrapChannels([discoverableChannel], Constants.MENTION_RECENT_CHANNELS);

        expect(wrapped[0].discoverableNonMember).toBe(true);
        expect(wrapped[0].hasPendingJoinRequest).toBe(true);
    });

    it('does not flag discoverable channels when the feature flag is off', () => {
        const switchProvider = new SwitchChannelProvider();
        const store = mockStore({
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    joinRequests: {
                        myPendingByChannel: {},
                        byChannel: {},
                        countsByChannel: {},
                        myList: [],
                    },
                },
            },
        });
        switchProvider.store = store;

        const discoverableChannel = TestHelper.getChannelMock({
            id: 'discoverable_channel_id',
            type: 'P',
            name: 'discoverable-ops',
            display_name: 'Discoverable Ops',
            discoverable: true,
            delete_at: 0,
        });

        const wrapped = switchProvider.wrapChannels([discoverableChannel], Constants.MENTION_RECENT_CHANNELS);

        expect(wrapped[0].discoverableNonMember).toBeUndefined();
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
        const results = switchProvider.formatGroup(searchText, channels, users);

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
        const results = switchProvider.formatGroup(searchText, channels, users);

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
        const results = switchProvider.formatGroup(searchText, channels, users);

        const expectedOrder = [
            'other_user4',
            'other_user1',
            'channel_other_user',
        ];

        expect(results.terms).toEqual(expectedOrder);
    });

    it('should rank a group message the user has opened above a direct message they never have', async () => {
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

        // other_user1 has no last_viewed_at, so the group message the user has actually opened
        // outranks the never-messaged person even though a direct message wins within a band
        const expectedOrder = [
            'other_gm_channel',
            'other_user1',
            'channel_other_user1',
        ];

        expect(resultsCallback).toHaveBeenCalledWith(expect.objectContaining({
            groups: expect.arrayContaining([
                expect.objectContaining({
                    key: 'channels',
                    terms: expectedOrder,
                }),
            ]),
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

        expect(resultsCallback).toHaveBeenCalledWith(expect.objectContaining({
            groups: expect.arrayContaining([
                expect.objectContaining({
                    key: 'channels',
                    terms: expectedOrder,
                }),
            ]),
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
                        other_user1: {
                            channel_id: 'other_user1',
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

        // The DM and GM are in the same recency band, so the direct message leads and the hidden
        // group message is demoted below it rather than surfacing first
        const expectedOrder = [
            'other_user1',
            'other_gm_channel',
            'channel_other_user1',
        ];
        expect(resultsCallback).toHaveBeenCalledWith(expect.objectContaining({
            groups: expect.arrayContaining([
                expect.objectContaining({
                    key: 'channels',
                    terms: expectedOrder,
                }),
            ]),
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
        const results = switchProvider.formatGroup(searchText, channels, users);

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

        expect(resultsCallback).toHaveBeenCalledWith(expect.objectContaining({
            groups: expect.arrayContaining([
                expect.objectContaining({
                    key: 'channels',
                    terms: channelsFromActiveTeams,
                }),
            ]),
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

        expect(resultsCallback).toHaveBeenCalledWith(expect.objectContaining({
            groups: expect.arrayContaining([
                expect.objectContaining({
                    key: 'channels',
                    terms: expectedOrder,
                }),
            ]),
        }));
    });

    describe('Smart Email Search Functionality', () => {
        let switchProvider: SwitchChannelProvider;
        let store: any;
        let modifiedState: any;

        beforeEach(() => {
            const userWithEmail = TestHelper.getUserMock({
                id: 'user_with_email',
                username: 'testuser',
                email: 'prefix-search@domain1.org',
                first_name: 'Test',
                last_name: 'User',
            });

            const userWithCommonDomain = TestHelper.getUserMock({
                id: 'user_with_common_domain',
                username: 'anotheruser',
                email: 'different@domain2.org',
                first_name: 'Another',
                last_name: 'User',
            });

            modifiedState = {
                ...defaultState,
                entities: {
                    ...defaultState.entities,
                    users: {
                        ...defaultState.entities.users,
                        profiles: {
                            ...defaultState.entities.users.profiles,
                            [userWithEmail.id]: userWithEmail,
                            [userWithCommonDomain.id]: userWithCommonDomain,
                        },
                        profilesInChannel: {
                            ...defaultState.entities.users.profilesInChannel,
                            dm_channel_1: new Set([userWithEmail.id]),
                            dm_channel_2: new Set([userWithCommonDomain.id]),
                        },
                    },
                    channels: {
                        ...defaultState.entities.channels,
                        channels: {
                            ...defaultState.entities.channels.channels,
                            dm_channel_1: TestHelper.getChannelMock({
                                id: 'dm_channel_1',
                                type: 'D',
                                name: `current_user_id__${userWithEmail.id}`,
                                display_name: userWithEmail.username,
                            }),
                            dm_channel_2: TestHelper.getChannelMock({
                                id: 'dm_channel_2',
                                type: 'D',
                                name: `current_user_id__${userWithCommonDomain.id}`,
                                display_name: userWithCommonDomain.username,
                            }),
                        },
                        myMembers: {
                            ...defaultState.entities.channels.myMembers,
                            dm_channel_1: {
                                channel_id: 'dm_channel_1',
                                user_id: 'current_user_id',
                            },
                            dm_channel_2: {
                                channel_id: 'dm_channel_2',
                                user_id: 'current_user_id',
                            },
                        },
                        profilesInChannel: {
                            dm_channel_1: new Set([userWithEmail.id]),
                            dm_channel_2: new Set([userWithCommonDomain.id]),
                        },
                    },
                },
            };

            switchProvider = new SwitchChannelProvider();
            store = mockStore(modifiedState);
            switchProvider.store = store;
        });

        it('should match by email prefix when searching without @', () => {
            const channels = [
                modifiedState.entities.channels.channels.dm_channel_1,
                modifiedState.entities.channels.channels.dm_channel_2,
            ];
            const users = [
                modifiedState.entities.users.profiles.user_with_email,
                modifiedState.entities.users.profiles.user_with_common_domain,
            ];

            // These should work - searching by email prefix (before @)
            switchProvider.startNewRequest('');
            let results = switchProvider.formatGroup('prefix-search', channels, users);
            expect(results.items.length).toBe(2); // formatGroup processes both channels and users separately
            expect(results.items.some((item) => item.channel.id === 'dm_channel_1')).toBe(true);

            results = switchProvider.formatGroup('different', channels, users);
            expect(results.items.length).toBe(2); // formatGroup processes both channels and users separately
            expect(results.items.some((item) => item.channel.id === 'dm_channel_2')).toBe(true);
        });

        it('should match by full email when searching WITH @ symbol', () => {
            const channels = [
                modifiedState.entities.channels.channels.dm_channel_1,
                modifiedState.entities.channels.channels.dm_channel_2,
            ];
            const users = [
                modifiedState.entities.users.profiles.user_with_email,
                modifiedState.entities.users.profiles.user_with_common_domain,
            ];

            // These should work - searching by full email when @ is present
            switchProvider.startNewRequest('');
            let results = switchProvider.formatGroup('prefix-search@domain1.org', channels, users);
            expect(results.items.length).toBe(2); // formatGroup processes both channels and users separately
            expect(results.items.some((item) => item.channel.id === 'dm_channel_1')).toBe(true);

            results = switchProvider.formatGroup('different@domain2.org', channels, users);
            expect(results.items.length).toBe(2); // formatGroup processes both channels and users separately
            expect(results.items.some((item) => item.channel.id === 'dm_channel_2')).toBe(true);

            results = switchProvider.formatGroup('prefix-search@', channels, users);
            expect(results.items.length).toBe(2); // formatGroup processes both channels and users separately
            expect(results.items.some((item) => item.channel.id === 'dm_channel_1')).toBe(true);
        });

        it('should match by partial email with @ symbol', () => {
            const channels = [
                modifiedState.entities.channels.channels.dm_channel_1,
                modifiedState.entities.channels.channels.dm_channel_2,
            ];
            const users = [
                modifiedState.entities.users.profiles.user_with_email,
                modifiedState.entities.users.profiles.user_with_common_domain,
            ];

            // Partial email searches with @ should work
            switchProvider.startNewRequest('');
            let results = switchProvider.formatGroup('prefix-search@', channels, users);
            expect(results.items.length).toBe(2); // formatGroup processes both channels and users separately
            expect(results.items.some((item) => item.channel.id === 'dm_channel_1')).toBe(true);

            results = switchProvider.formatGroup('different@', channels, users);
            expect(results.items.length).toBe(2); // formatGroup processes both channels and users separately
            expect(results.items.some((item) => item.channel.id === 'dm_channel_2')).toBe(true);
        });

        it('should handle @ at the beginning correctly', () => {
            const channels = [
                modifiedState.entities.channels.channels.dm_channel_1,
                modifiedState.entities.channels.channels.dm_channel_2,
            ];
            const users = [
                modifiedState.entities.users.profiles.user_with_email,
                modifiedState.entities.users.profiles.user_with_common_domain,
            ];

            // @ at the beginning should be stripped and then apply smart logic
            switchProvider.startNewRequest('');
            let results = switchProvider.formatGroup('@prefix-search', channels, users);
            expect(results.items.length).toBe(2); // formatGroup processes both channels and users separately
            expect(results.items.some((item) => item.channel.id === 'dm_channel_1')).toBe(true);

            results = switchProvider.formatGroup('@different', channels, users);
            expect(results.items.length).toBe(2); // formatGroup processes both channels and users separately
            expect(results.items.some((item) => item.channel.id === 'dm_channel_2')).toBe(true);
        });

        it('should match domain when @ is present in search term', () => {
            const channels = [
                modifiedState.entities.channels.channels.dm_channel_1,
                modifiedState.entities.channels.channels.dm_channel_2,
            ];
            const users = [
                modifiedState.entities.users.profiles.user_with_email,
                modifiedState.entities.users.profiles.user_with_common_domain,
            ];

            // When @ is present, domain matching should work
            switchProvider.startNewRequest('');
            let results = switchProvider.formatGroup('@domain1', channels, users);
            expect(results.items.length).toBe(2); // formatGroup processes both channels and users separately
            expect(results.items.some((item) => item.channel.id === 'dm_channel_1')).toBe(true);

            results = switchProvider.formatGroup('@domain2', channels, users);
            expect(results.items.length).toBe(2); // formatGroup processes both channels and users separately
            expect(results.items.some((item) => item.channel.id === 'dm_channel_2')).toBe(true);

            results = switchProvider.formatGroup('domain1@', channels, users);
            expect(results.items.length).toBe(2); // formatGroup processes both channels and users separately
            expect(results.items.some((item) => item.channel.id === 'dm_channel_1')).toBe(true);
        });
    });

    describe('ranking quick switcher results by recency then conversation type', () => {
        const delphine = TestHelper.getUserMock({
            id: 'delphine_user_id',
            username: 'delphine',
            first_name: 'Delphine',
            last_name: 'Marlow',
        });

        const otherMembers = ['esme.fielder', 'bruno.castellani', 'bianca.rossi', 'clive.mercer', 'wanda.pryor'].
            map((username) => TestHelper.getUserMock({id: `${username}_id`, username}));

        // A GM's display name is its members listed alphabetically, so it starts with the searched
        // username whenever that member sorts first, which is how a GM can look like a prefix match
        const gmMemberSets = [
            ['delphine', 'esme.fielder'],
            ['bruno.castellani', 'delphine'],
            ['bianca.rossi', 'clive.mercer', 'delphine'],
        ];

        type Options = {
            existingDmLastViewedAt?: number;
            hiddenGmMembers?: string[];
            extraProfiles?: UserProfile[];
            extraDmChannels?: Array<{userId: string; lastViewedAt: number}>;
        };

        function makeState({existingDmLastViewedAt, hiddenGmMembers, extraProfiles = [], extraDmChannels = []}: Options = {}) {
            const channels: Record<string, Channel> = {};
            const myMembers: Record<string, {channel_id: string; last_viewed_at: number}> = {};
            const profilesInChannel: Record<string, Set<string>> = {};
            const myPreferences: Record<string, PreferenceType> = {
                'display_settings--name_format': {
                    category: 'display_settings',
                    name: 'name_format',
                    user_id: 'current_user_id',
                    value: 'username',
                },
            };

            const profiles: Record<string, UserProfile> = {
                current_user_id: TestHelper.getUserMock({id: 'current_user_id', username: 'current.user'}),
                [delphine.id]: delphine,
            };
            [...otherMembers, ...extraProfiles].forEach((profile) => {
                profiles[profile.id] = profile;
            });

            const addGm = (id: string, memberUsernames: string[], lastViewedAt: number, visibleInSidebar: boolean) => {
                channels[id] = TestHelper.getChannelMock({
                    id,
                    type: 'G',
                    name: id,
                    display_name: '',
                    delete_at: 0,
                    team_id: '',
                });
                myMembers[id] = {channel_id: id, last_viewed_at: lastViewedAt};
                profilesInChannel[id] = new Set([
                    'current_user_id',
                    ...memberUsernames.map((username) => (username === delphine.username ? delphine.id : `${username}_id`)),
                ]);
                myPreferences[`group_channel_show--${id}`] = {
                    category: 'group_channel_show',
                    name: id,
                    user_id: 'current_user_id',
                    value: visibleInSidebar ? 'true' : 'false',
                };
            };

            // Every GM was read more recently than the DM below
            gmMemberSets.forEach((memberUsernames, i) => addGm(`gm_channel_${i}`, memberUsernames, 1000 + i, true));

            if (hiddenGmMembers) {
                addGm('hidden_gm_channel', hiddenGmMembers, 5000, false);
            }

            const addDm = (userId: string, lastViewedAt: number) => {
                const id = `dm_${userId}`;
                channels[id] = TestHelper.getChannelMock({
                    id,
                    type: 'D',
                    name: [userId, 'current_user_id'].sort().join('__'),
                    display_name: '',
                    delete_at: 0,
                    team_id: '',
                });
                myMembers[id] = {channel_id: id, last_viewed_at: lastViewedAt};
                profilesInChannel[id] = new Set(['current_user_id', userId]);
            };

            if (existingDmLastViewedAt) {
                addDm(delphine.id, existingDmLastViewedAt);
            }
            extraDmChannels.forEach(({userId, lastViewedAt}) => addDm(userId, lastViewedAt));

            return {
                ...defaultState,
                entities: {
                    ...defaultState.entities,
                    channels: {
                        ...defaultState.entities.channels,
                        channels,
                        myMembers,
                        channelsInTeam: {'': new Set(Object.keys(channels))},
                        messageCounts: {},
                    },
                    preferences: {myPreferences},
                    users: {
                        ...defaultState.entities.users,
                        profiles,
                        currentUserId: 'current_user_id',
                        profilesInChannel,
                    },
                    posts: {posts: {}, postsInChannel: {}, postsInThread: {}},
                },
            };
        }

        async function search(term: string, state: ReturnType<typeof makeState>, usersFromServer: UserProfile[] = [delphine]) {
            jest.mocked(Client4.autocompleteUsers).mockResolvedValue({users: usersFromServer});

            const switchProvider = new SwitchChannelProvider();
            switchProvider.store = mockStore(state);

            const resultsCallback = jest.fn();
            switchProvider.handlePretextChanged(term, resultsCallback);

            await waitFor(() => expect(resultsCallback).toHaveBeenCalledTimes(2));

            return resultsCallback.mock.calls.map((call) => call[0].groups[0]);
        }

        // A second person whose username is also a prefix match for the search term, but whose DM was
        // read much more recently, so recency puts it ahead of the other match within the same band
        function stateWithCompetingDm() {
            const recentMatch = TestHelper.getUserMock({
                id: 'recent_match_user_id',
                username: 'delphina',
            });

            return {
                recentMatch,
                state: makeState({
                    existingDmLastViewedAt: 1,
                    extraProfiles: [recentMatch],
                    extraDmChannels: [{userId: recentMatch.id, lastViewedAt: 9000}],
                }),
            };
        }

        it('sorts a never-messaged person below every group message the user has opened', async () => {
            const [localResults, mergedResults] = await search('delp', makeState());

            // The user has never messaged delphine, so only the GMs are known locally
            expect(localResults.terms).toEqual(['gm_channel_2', 'gm_channel_1', 'gm_channel_0']);

            // delphine has no direct message history, so the server-only person falls below every
            // group message the user has actually opened
            expect(mergedResults.terms).toEqual(['gm_channel_2', 'gm_channel_1', 'gm_channel_0', delphine.id]);

            // Selecting a suggestion resolves it by term, so the two have to stay in lockstep
            expect(mergedResults.items.map((item: WrappedChannel) => (
                (item.channel as {userId?: string}).userId ?? item.channel.id
            ))).toEqual(mergedResults.terms);
        });

        it('sorts an existing direct message above group messages in the same recency band', async () => {
            const [, mergedResults] = await search('delp', makeState({existingDmLastViewedAt: 1}));

            // The DM and the group messages were all last read long ago, so they share a recency
            // band; the direct message is a prefix match on the searched name while the group
            // messages only contain it, so the direct message leads
            expect(mergedResults.terms).toEqual([delphine.id, 'gm_channel_2', 'gm_channel_1', 'gm_channel_0']);
        });

        it('sorts the more recently used of two matching direct messages first', async () => {
            const {recentMatch, state} = stateWithCompetingDm();

            const [, mergedResults] = await search('delp', state, [delphine, recentMatch]);

            // Both usernames are prefix matches for "delp" and both DMs share the stale band, so the
            // one opened more recently leads; both still outrank the group messages
            expect(mergedResults.terms).toEqual([recentMatch.id, delphine.id, 'gm_channel_2', 'gm_channel_1', 'gm_channel_0']);
        });

        it('ignores capitalization and a leading @ when ranking matching direct messages', async () => {
            const {recentMatch, state} = stateWithCompetingDm();

            // A leading @ makes the channel filter substring match on "@delp", which no group
            // message contains, so only the two people are left to rank, ordered by recency
            const [, mergedResults] = await search('@Delp', state, [delphine, recentMatch]);

            expect(mergedResults.terms).toEqual([recentMatch.id, delphine.id]);
        });

        it('keeps a group message hidden from the sidebar below an equally relevant visible one', async () => {
            const state = makeState({hiddenGmMembers: ['delphine', 'wanda.pryor']});

            const [, mergedResults] = await search('delp', state);

            // Hidden group messages used to end up last only because they came from the server
            // results, which were appended rather than ranked
            expect(mergedResults.terms).toContain('hidden_gm_channel');
            expect(mergedResults.terms.indexOf('hidden_gm_channel')).toBeGreaterThan(mergedResults.terms.indexOf('gm_channel_0'));
        });

        describe('developer-mode ranking debug log', () => {
            let groupCollapsed: jest.SpyInstance;
            let table: jest.SpyInstance;
            let groupEnd: jest.SpyInstance;

            beforeEach(() => {
                groupCollapsed = jest.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
                table = jest.spyOn(console, 'table').mockImplementation(() => {});
                groupEnd = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
            });

            afterEach(() => {
                groupCollapsed.mockRestore();
                table.mockRestore();
                groupEnd.mockRestore();
            });

            function withDeveloperMode(state: ReturnType<typeof makeState>, enabled: boolean) {
                return {
                    ...state,
                    entities: {
                        ...state.entities,
                        general: {
                            ...state.entities.general,
                            config: {...state.entities.general.config, EnableDeveloper: enabled ? 'true' : 'false'},
                        },
                    },
                };
            }

            it('does not log ranking information when developer mode is disabled', async () => {
                await search('delp', withDeveloperMode(makeState({existingDmLastViewedAt: 1}), false));

                expect(table).not.toHaveBeenCalled();
                expect(groupCollapsed).not.toHaveBeenCalled();
            });

            it('logs a ranking breakdown for each result list when developer mode is enabled', async () => {
                await search('delp', withDeveloperMode(makeState({existingDmLastViewedAt: 1}), true));

                // A breakdown is logged for both lists provided to the user: the local results and
                // then the combined local + remote results
                expect(table).toHaveBeenCalledTimes(2);

                const loggedRows = table.mock.calls[table.mock.calls.length - 1][0];
                const dmRow = loggedRows.find((row: {term: string}) => row.term === delphine.id);

                // The breakdown shows why the direct message leads: it is a prefix match (no penalty)
                // and a direct message (no type penalty), so the ordering is explainable at a glance
                expect(dmRow).toMatchObject({type: Constants.DM_CHANNEL, nonPrefixMatch: 0, conversationType: 0});
                expect(dmRow.rank).toBe(Math.min(...loggedRows.map((row: {rank: number}) => row.rank)));
            });
        });
    });

    describe('makeQuickSwitchSorter', () => {
        function wrap(id: string, type: string, lastViewedAt: number, name: string): WrappedChannel {
            return {
                channel: TestHelper.getChannelMock({id, name, display_name: name, type: type as Channel['type'], delete_at: 0}),
                name,
                deactivated: false,
                last_viewed_at: lastViewedAt,
            };
        }

        function permutations<T>(items: T[]): T[][] {
            if (items.length <= 1) {
                return [items];
            }

            return items.flatMap((item, i) => (
                permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest])
            ));
        }

        const DAY = 24 * 60 * 60 * 1000;

        it('orders a result set the same way no matter which order it is merged in', async () => {
            // Ranking has to be consistent when compared through a third result, otherwise the
            // order depends on how the local and server results happened to be concatenated
            const results = [
                wrap('dm', Constants.DM_CHANNEL, 1, 'sam.smith'),
                wrap('gm', Constants.GM_CHANNEL, 1000, 'sam.smith, wanda.pryor'),
                wrap('open', Constants.OPEN_CHANNEL, 500, 'project-sam'),
            ];

            const orderings = permutations(results).map((ordering) => (
                [...ordering].sort(makeQuickSwitchSorter('sam')).map((result) => result.channel.id).join(',')
            ));

            // All three were last read long ago, so they share a recency band. The direct message is
            // a prefix match on the term while the group message and channel only contain it, so the
            // direct message leads and the remaining two sort by type: group message, then channel
            expect(new Set(orderings)).toEqual(new Set(['dm,gm,open']));
        });

        it('ranks recently used conversations above stale ones regardless of type', () => {
            const recent = Date.now();
            const stale = Date.now() - (90 * DAY);

            const results = [
                wrap('stale-dm', Constants.DM_CHANNEL, stale, 'sam.stale'),
                wrap('recent-gm', Constants.GM_CHANNEL, recent, 'sam.smith, wanda.pryor'),
                wrap('recent-channel', Constants.OPEN_CHANNEL, recent, 'project-sam'),
            ];

            expect([...results].sort(makeQuickSwitchSorter('sam')).map((result) => result.channel.id)).
                toEqual(['recent-gm', 'recent-channel', 'stale-dm']);
        });

        it('ranks a direct message above a group message and channel within the same recency band', () => {
            const recent = Date.now();

            const results = [
                wrap('recent-gm', Constants.GM_CHANNEL, recent, 'sam.smith, wanda.pryor'),
                wrap('recent-dm', Constants.DM_CHANNEL, recent, 'sam.smith'),
                wrap('recent-channel', Constants.OPEN_CHANNEL, recent, 'project-sam'),
            ];

            expect([...results].sort(makeQuickSwitchSorter('sam')).map((result) => result.channel.id)).
                toEqual(['recent-dm', 'recent-gm', 'recent-channel']);
        });

        it('ranks a channel the term is a prefix of above a direct message that only contains it', () => {
            const recent = Date.now();

            // Both were used just as recently, so recency does not separate them. "off" is a prefix
            // of the channel's name but only appears mid-string in the person's, so the channel must
            // not be buried under the direct message (MM-70519 review follow-up).
            const results = [
                wrap('midstring-dm', Constants.DM_CHANNEL, recent, 'geoffrey.hinton'),
                wrap('prefix-channel', Constants.OPEN_CHANNEL, recent, 'off-topic'),
            ];

            expect([...results].sort(makeQuickSwitchSorter('off')).map((result) => result.channel.id)).
                toEqual(['prefix-channel', 'midstring-dm']);
        });

        it('sorts a never-opened direct message below any conversation with activity', () => {
            const stale = Date.now() - (90 * DAY);

            const results = [
                wrap('never-dm', Constants.DM_CHANNEL, 0, 'sam.newperson'),
                wrap('stale-gm', Constants.GM_CHANNEL, stale, 'sam.smith, wanda.pryor'),
            ];

            expect([...results].sort(makeQuickSwitchSorter('sam')).map((result) => result.channel.id)).
                toEqual(['stale-gm', 'never-dm']);
        });
    });
});

describe('SwitchChannelSuggestion', () => {
    const baseProps = {
        id: 'test-suggestion',
        matchedPretext: '',
        isSelection: false,
        onClick: jest.fn(),
        onMouseMove: jest.fn(),
    };

    const currentUserId = 'currentUser';

    const team1 = TestHelper.getTeamMock({id: 'team1', display_name: 'Team One'});
    const team2 = TestHelper.getTeamMock({id: 'team2', display_name: 'Team Two'});

    function getBaseState(teams: Team[], channels: Channel[]): any {
        return {
            entities: {
                channels: {
                    channels: channels.reduce((channelsMap, channel) => ({...channelsMap, [channel.id]: channel}), {}),
                    myMembers: channels.reduce((membersMap, channel) => ({
                        ...membersMap,
                        [channel.id]: TestHelper.getChannelMembershipMock({channel_id: channel.id, user_id: currentUserId}),
                    }), {}),
                },
                teams: {
                    teams: teams.reduce((teamsMap, team) => ({...teamsMap, [team.id]: team}), {}),
                    myMembers: teams.reduce((membersMap, team) => ({
                        ...membersMap,
                        [team.id]: TestHelper.getTeamMembershipMock({team_id: team.id, user_id: currentUserId}),
                    }), {}),
                },
            },
        };
    }

    test('should show the team name for channels if the user is on multiple teams', () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: 'team1', name: 'channel_one', display_name: 'Channel One'});

        const {replaceStoreState} = renderWithContext(
            <ConnectedSwitchChannelSuggestion
                {...baseProps}
                term={channel1.name}
                item={{
                    channel: channel1,
                    name: channel1.name,
                    deactivated: false,
                }}
            />,
            getBaseState([team1], [channel1]),
        );

        const suggestion = document.getElementById(baseProps.id);

        // When the user is on only a single team, the channel's URL name is displayed
        expect(screen.getByText(`~${channel1.name}`)).toBeInTheDocument();
        expect(suggestion).toHaveAccessibleName(channel1.display_name);
        expect(suggestion).toHaveAccessibleDescription(`~${channel1.name} Public channel`);

        replaceStoreState(getBaseState([team1, team2], [channel1]));

        // When the user is on multiple teams, we show the team's display name instead
        expect(screen.getByText(team1.display_name)).toBeInTheDocument();
        expect(suggestion).toHaveAccessibleName(channel1.display_name);
        expect(suggestion).toHaveAccessibleDescription(`${team1.display_name} Public channel`);
    });

    test('should show the type of channel', () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: 'team1', name: 'channel_one', display_name: 'Channel One', type: General.OPEN_CHANNEL});
        const channel2 = TestHelper.getChannelMock({id: 'channel2', team_id: 'team1', name: 'channel_two', display_name: 'Channel Two', type: General.PRIVATE_CHANNEL});

        const {rerender} = renderWithContext(
            <ConnectedSwitchChannelSuggestion
                {...baseProps}
                term={channel1.name}
                item={{
                    channel: channel1,
                    name: channel1.name,
                    deactivated: false,
                }}
            />,
            getBaseState([team1], [channel1, channel2]),
        );

        const suggestion = document.getElementById(baseProps.id);

        expect(screen.getByLabelText('Public channel')).toBeInTheDocument();
        expect(suggestion).toHaveAccessibleName(channel1.display_name);
        expect(suggestion).toHaveAccessibleDescription(`~${channel1.name} Public channel`);

        rerender(
            <ConnectedSwitchChannelSuggestion
                {...baseProps}
                term={channel2.name}
                item={{
                    channel: channel2,
                    name: channel2.name,
                    deactivated: false,
                }}
            />,
        );

        expect(screen.getByLabelText('Private channel')).toBeInTheDocument();
        expect(suggestion).toHaveAccessibleName(channel2.display_name);
        expect(suggestion).toHaveAccessibleDescription(`~${channel2.name} Private channel`);
    });

    test('should show if the channel has a draft instead of the channel type', () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: 'team1', name: 'channel_one', display_name: 'Channel One'});
        const channel2 = TestHelper.getChannelMock({id: 'channel2', team_id: 'team1', name: 'channel_two', display_name: 'Channel Two'});

        const testState = getBaseState([team1], [channel1, channel2]);
        testState.storage = {
            storage: {
                [`${StoragePrefixes.DRAFT}${channel2.id}`]: {
                    value: TestHelper.getPostDraftMock({message: 'post draft'}),
                },
            },
        };

        const {rerender} = renderWithContext(
            <ConnectedSwitchChannelSuggestion
                {...baseProps}
                term={channel1.name}
                item={{
                    channel: channel1,
                    name: channel1.name,
                    deactivated: false,
                }}
            />,
            testState,
        );

        const suggestion = document.getElementById(baseProps.id);

        expect(screen.queryByLabelText('Has draft')).not.toBeInTheDocument();
        expect(suggestion).toHaveAccessibleName(channel1.display_name);
        expect(suggestion).toHaveAccessibleDescription(`~${channel1.name} Public channel`);

        rerender(
            <ConnectedSwitchChannelSuggestion
                {...baseProps}
                term={channel2.name}
                item={{
                    channel: channel2,
                    name: channel2.name,
                    deactivated: false,
                }}
            />,
        );

        expect(screen.queryByLabelText('Has draft')).toBeInTheDocument();
        expect(suggestion).toHaveAccessibleName(channel2.display_name);
        expect(suggestion).toHaveAccessibleDescription(`~${channel2.name} Has draft`);
    });

    test('should show if the channel is archived instead of the channel type', () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: 'team1', name: 'channel_one', display_name: 'Channel One'});
        const channel2 = TestHelper.getChannelMock({id: 'channel2', team_id: 'team1', name: 'channel_two', display_name: 'Channel Two', delete_at: 1});

        const {rerender} = renderWithContext(
            <ConnectedSwitchChannelSuggestion
                {...baseProps}
                term={channel1.name}
                item={{
                    channel: channel1,
                    name: channel1.name,
                    deactivated: false,
                }}
            />,
            getBaseState([team1], [channel1, channel2]),
        );

        const suggestion = document.getElementById(baseProps.id);

        expect(screen.queryByLabelText('Archved channel')).not.toBeInTheDocument();
        expect(suggestion).toHaveAccessibleName(channel1.display_name);
        expect(suggestion).toHaveAccessibleDescription(`~${channel1.name} Public channel`);

        rerender(
            <ConnectedSwitchChannelSuggestion
                {...baseProps}
                term={channel2.name}
                item={{
                    channel: channel2,
                    name: channel2.name,
                    deactivated: false,
                }}
            />,
        );

        expect(screen.queryByLabelText('Archived channel')).toBeInTheDocument();
        expect(suggestion).toHaveAccessibleName(channel2.display_name);
        expect(suggestion).toHaveAccessibleDescription(`~${channel2.name} Archived channel`);
    });

    test('should show if the channel has unread mentions', () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: 'team1', name: 'channel_one', display_name: 'Channel One'});
        const channel2 = TestHelper.getChannelMock({id: 'channel2', team_id: 'team1', name: 'channel_two', display_name: 'Channel Two'});
        const channel3 = TestHelper.getChannelMock({id: 'channel3', team_id: 'team1', name: 'channel_three', display_name: 'Channel Three'});

        const testState = getBaseState([team1], [channel1, channel2, channel3]);
        testState.entities.channels.myMembers[channel1.id].mention_count = 0;
        testState.entities.channels.myMembers[channel2.id].mention_count = 1;
        testState.entities.channels.myMembers[channel3.id].mention_count = 5;

        const {rerender} = renderWithContext(
            <ConnectedSwitchChannelSuggestion
                {...baseProps}
                term={channel1.name}
                item={{
                    channel: channel1,
                    name: channel1.name,
                    deactivated: false,
                }}
            />,
            testState,
        );

        const suggestion = document.getElementById(baseProps.id);

        expect(screen.queryByLabelText(/unread/, {exact: false})).not.toBeInTheDocument();
        expect(suggestion).toHaveAccessibleName(channel1.display_name);
        expect(suggestion).toHaveAccessibleDescription(`~${channel1.name} Public channel`);

        rerender(
            <ConnectedSwitchChannelSuggestion
                {...baseProps}
                term={channel2.name}
                item={{
                    channel: channel2,
                    name: channel2.name,
                    deactivated: false,
                }}
            />,
        );

        expect(screen.queryByLabelText('1 unread notification')).toBeInTheDocument();
        expect(suggestion).toHaveAccessibleName(channel2.display_name);
        expect(suggestion).toHaveAccessibleDescription(`1 unread notification ~${channel2.name} Public channel`);

        rerender(
            <ConnectedSwitchChannelSuggestion
                {...baseProps}
                term={channel3.name}
                item={{
                    channel: channel3,
                    name: channel3.name,
                    deactivated: false,
                }}
            />,
        );

        expect(screen.queryByLabelText('5 unread notifications')).toBeInTheDocument();
        expect(suggestion).toHaveAccessibleName(channel3.display_name);
        expect(suggestion).toHaveAccessibleDescription(`5 unread notifications ~${channel3.name} Public channel`);
    });

    describe('layout and tooltip behavior for long names', () => {
        const longTeam1 = TestHelper.getTeamMock({
            id: 'team1',
            display_name: 'A Very Long Team Display Name That Will Likely Overflow Its Slot In The Switcher',
        });
        const longTeam2 = TestHelper.getTeamMock({
            id: 'team2',
            display_name: 'Another Long Team Two',
        });
        const longChannel = TestHelper.getChannelMock({
            id: 'channel1',
            team_id: 'team1',
            name: 'super_long_channel_name',
            display_name: 'Super Extremely Long Channel Display Name That Should Truncate With An Ellipsis',
        });

        afterEach(() => {
            // reset prototype overrides between tests
            Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {configurable: true, value: 0});
            Object.defineProperty(HTMLElement.prototype, 'clientWidth', {configurable: true, value: 0});
        });

        test('should render team name as a sibling of the primary column wrapper inside .suggestion-list__flex when on multiple teams', () => {
            renderWithContext(
                <ConnectedSwitchChannelSuggestion
                    {...baseProps}
                    term={longChannel.name}
                    item={{
                        channel: longChannel,
                        name: longChannel.name,
                        deactivated: false,
                    }}
                />,
                getBaseState([longTeam1, longTeam2], [longChannel]),
            );

            const suggestion = document.getElementById(baseProps.id) as HTMLElement;
            expect(suggestion).toBeInTheDocument();

            // Both nodes (channel name and team name) are present
            expect(screen.getByText(longChannel.display_name)).toBeInTheDocument();
            expect(screen.getByText(longTeam1.display_name)).toBeInTheDocument();

            // The flex row contains the primary column wrapper and the team name as siblings
            const flexRow = suggestion.querySelector('.suggestion-list__flex') as HTMLElement;
            expect(flexRow).not.toBeNull();

            const primaryColumn = flexRow.querySelector(':scope > .suggestion-list__switch-channel-primary');
            expect(primaryColumn).not.toBeNull();

            const teamNameNode = flexRow.querySelector('.suggestion-list__team-name');
            expect(teamNameNode).not.toBeNull();
            expect(teamNameNode).toHaveTextContent(longTeam1.display_name);

            // Team name must live outside the primary column so it remains a flex sibling that doesn't shrink with the channel name.
            expect(primaryColumn!.contains(teamNameNode)).toBe(false);

            // Channel name span should live inside the primary column with the truncation class
            const channelNameNode = primaryColumn!.querySelector('.suggestion-list__channel-name-text');
            expect(channelNameNode).not.toBeNull();
            expect(channelNameNode).toHaveTextContent(longChannel.display_name);
        });

        test('should disable the channel-name and team-name tooltips when the names fit their containers', async () => {
            jest.useFakeTimers();

            Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {configurable: true, value: 100});
            Object.defineProperty(HTMLElement.prototype, 'clientWidth', {configurable: true, value: 100});

            renderWithContext(
                <ConnectedSwitchChannelSuggestion
                    {...baseProps}
                    term={longChannel.name}
                    item={{
                        channel: longChannel,
                        name: longChannel.name,
                        deactivated: false,
                    }}
                />,
                getBaseState([longTeam1, longTeam2], [longChannel]),
            );

            const channelNameNode = screen.getByText(longChannel.display_name);
            await userEvent.hover(channelNameNode, {advanceTimers: jest.advanceTimersByTime});
            jest.advanceTimersByTime(1000);
            expect(screen.queryAllByText(longChannel.display_name)).toHaveLength(1);

            const teamNameNode = screen.getByText(longTeam1.display_name);
            await userEvent.hover(teamNameNode, {advanceTimers: jest.advanceTimersByTime});
            jest.advanceTimersByTime(1000);
            expect(screen.queryAllByText(longTeam1.display_name)).toHaveLength(1);

            jest.useRealTimers();
        });

        test('should enable the channel-name and team-name tooltips when the names overflow their containers', async () => {
            jest.useFakeTimers();

            Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {configurable: true, value: 500});
            Object.defineProperty(HTMLElement.prototype, 'clientWidth', {configurable: true, value: 100});

            renderWithContext(
                <ConnectedSwitchChannelSuggestion
                    {...baseProps}
                    term={longChannel.name}
                    item={{
                        channel: longChannel,
                        name: longChannel.name,
                        deactivated: false,
                    }}
                />,
                getBaseState([longTeam1, longTeam2], [longChannel]),
            );

            const channelNameNode = screen.getByText(longChannel.display_name);
            await userEvent.hover(channelNameNode, {advanceTimers: jest.advanceTimersByTime});
            await waitFor(() => {
                expect(screen.queryAllByText(longChannel.display_name)).toHaveLength(2);
            });

            await userEvent.unhover(channelNameNode, {advanceTimers: jest.advanceTimersByTime});
            await waitFor(() => {
                expect(screen.queryAllByText(longChannel.display_name)).toHaveLength(1);
            });

            const teamNameNode = screen.getByText(longTeam1.display_name);
            await userEvent.hover(teamNameNode, {advanceTimers: jest.advanceTimersByTime});
            await waitFor(() => {
                expect(screen.queryAllByText(longTeam1.display_name)).toHaveLength(2);
            });

            jest.useRealTimers();
        });
    });

    test('should render override icon when matcher matches', () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: 'team1', name: 'channel_one', display_name: 'Channel One', type: 'O'});
        const overrideState = {
            ...getBaseState([team1], [channel1]),
            plugins: {components: {ChannelIconOverride: [{id: '1', pluginId: 'mbe', matcher: () => true, iconName: 'shield-outline'}]}},
        };

        const {container} = renderWithContext(
            <ConnectedSwitchChannelSuggestion
                {...baseProps}
                term={channel1.name}
                item={{
                    channel: channel1,
                    name: channel1.name,
                    deactivated: false,
                }}
            />,
            overrideState,
        );

        const icon = container.querySelector('.suggestion-list__icon i');
        expect(icon).toHaveClass('icon', 'icon-shield-outline');
        expect(icon).not.toHaveClass('icon-globe');
    });

    test('should render fallback globe icon when matcher returns false', () => {
        const channel1 = TestHelper.getChannelMock({id: 'channel1', team_id: 'team1', name: 'channel_one', display_name: 'Channel One', type: 'O'});
        const overrideState = {
            ...getBaseState([team1], [channel1]),
            plugins: {components: {ChannelIconOverride: [{id: '1', pluginId: 'mbe', matcher: () => false, iconName: 'shield-outline'}]}},
        };

        const {container} = renderWithContext(
            <ConnectedSwitchChannelSuggestion
                {...baseProps}
                term={channel1.name}
                item={{
                    channel: channel1,
                    name: channel1.name,
                    deactivated: false,
                }}
            />,
            overrideState,
        );

        const icon = container.querySelector('.suggestion-list__icon i');
        expect(icon).toHaveClass('icon', 'icon-globe');
    });
});
