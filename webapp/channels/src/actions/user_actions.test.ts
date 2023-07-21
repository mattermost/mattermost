// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel, ChannelMembership, ChannelMessageCount} from '@mattermost/types/channels';
import {Post} from '@mattermost/types/posts';
import {Team, TeamMembership} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';

import * as UserActions from 'actions/user_actions';
import {Preferences, General} from 'mattermost-redux/constants';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';
import store from 'stores/redux_store';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import mockStore from 'tests/test_store';
import {GlobalState} from 'types/store';

jest.mock('mattermost-redux/actions/users', () => {
    const original = jest.requireActual('mattermost-redux/actions/users');
    return {
        ...original,
        searchProfiles: (...args: any[]) => ({type: 'MOCK_SEARCH_PROFILES', args}),
        getProfilesInTeam: (...args: any[]) => ({type: 'MOCK_GET_PROFILES_IN_TEAM', args}),
        getProfilesInChannel: (...args: any[]) => ({type: 'MOCK_GET_PROFILES_IN_CHANNEL', args, data: [{id: 'user_1'}]}),
        getProfilesInGroupChannels: (...args: any[]) => ({type: 'MOCK_GET_PROFILES_IN_GROUP_CHANNELS', args}),
        getStatusesByIds: (...args: any[]) => ({type: 'MOCK_GET_STATUSES_BY_ID', args}),
    };
});

jest.mock('mattermost-redux/actions/teams', () => {
    const original = jest.requireActual('mattermost-redux/actions/teams');
    return {
        ...original,
        getTeamMembersByIds: (...args: any[]) => ({type: 'MOCK_GET_TEAM_MEMBERS_BY_IDS', args}),
    };
});

jest.mock('mattermost-redux/actions/channels', () => {
    const original = jest.requireActual('mattermost-redux/actions/channels');
    return {
        ...original,
        getChannelMembersByIds: (...args: any[]) => ({type: 'MOCK_GET_CHANNEL_MEMBERS_BY_IDS', args}),
    };
});

jest.mock('mattermost-redux/actions/preferences', () => {
    const original = jest.requireActual('mattermost-redux/actions/preferences');
    return {
        ...original,
        deletePreferences: (...args: any[]) => ({type: 'MOCK_DELETE_PREFERENCES', args}),
        savePreferences: (...args: any[]) => ({type: 'MOCK_SAVE_PREFERENCES', args}),
    };
});

jest.mock('stores/redux_store', () => {
    return {
        dispatch: jest.fn(),
        getState: jest.fn(),
    };
});

jest.mock('actions/telemetry_actions.jsx', () => {
    const original = jest.requireActual('actions/telemetry_actions.jsx');
    return {
        ...original,
        trackEvent: jest.fn(),
    };
});

describe('Actions.User', () => {
    const initialState: GlobalState = {
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
                    } as ChannelMembership,
                },
                channels: {
                    current_channel_id: {
                        team_id: 'team_1',
                    } as Channel,
                },
                channelsInTeam: {
                    team_1: ['current_channel_id'],
                },
                messageCounts: {
                    current_channel_id: {total: 10} as ChannelMessageCount,
                },
                membersInChannel: {
                    current_channel_id: {
                        current_user_id: {channel_id: 'current_user_id'} as ChannelMembership,
                    },
                },
            } as unknown as GlobalState['entities']['channels'],
            general: {
                config: {},
            } as GlobalState['entities']['general'],
            preferences: {
                myPreferences: {
                    'theme--team_1': {
                        category: 'theme',
                        name: 'team_1',
                        user_id: 'current_user_id',
                        value: JSON.stringify(Preferences.THEMES.indigo),
                    },
                },
            },
            teams: {
                currentTeamId: 'team_1',
                teams: {
                    team_1: {
                        id: 'team_1',
                        name: 'team-1',
                        display_name: 'Team 1',
                    } as Team,
                    team_2: {
                        id: 'team_2',
                        name: 'team-2',
                        display_name: 'Team 2',
                    } as Team,
                },
                myMembers: {
                    team_1: {roles: 'team_role'} as TeamMembership,
                    team_2: {roles: 'team_role'} as TeamMembership,
                },
                membersInTeam: {
                    team_1: {
                        current_user_id: {id: 'current_user_id'} as unknown as TeamMembership,
                    },
                    team_2: {
                        current_user_id: {id: 'current_user_id'} as unknown as TeamMembership,
                    },
                },
            } as unknown as GlobalState['entities']['teams'],
            users: {
                currentUserId: 'current_user_id',
                profilesInChannel: {
                    group_channel_2: ['user_1', 'user_2'],
                },
            } as unknown as GlobalState['entities']['users'],
            posts: {
                posts: {
                    sample_post_id: {
                        id: 'sample_post_id',
                    } as Post,
                },
                postsInChannel: {
                    current_channel_id: [
                        {
                            order: ['sample_post_id'],
                        },
                    ]},
            } as unknown as GlobalState['entities']['posts'],
        } as unknown as GlobalState['entities'],
        storage: {
            storage: {},
            initialized: true,
        },
        views: {
            channel: {
            } as GlobalState['views']['channel'],
            channelSidebar: {
                unreadFilterEnabled: false,
            } as GlobalState['views']['channelSidebar'],
        } as GlobalState['views'],
    } as GlobalState;

    test('loadProfilesAndStatusesInChannel', async () => {
        const testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadProfilesAndStatusesInChannel('channel_1', 0, 60, 'status', {}));
        const actualActions = testStore.getActions();
        expect(actualActions[0].args).toEqual(['channel_1', 0, 60, 'status', {}]);
        expect(actualActions[0].type).toEqual('MOCK_GET_PROFILES_IN_CHANNEL');
        expect(actualActions[1].args).toEqual([['user_1']]);
        expect(actualActions[1].type).toEqual('MOCK_GET_STATUSES_BY_ID');
    });

    test('loadProfilesAndTeamMembers', async () => {
        const expectedActions = [{type: 'MOCK_GET_PROFILES_IN_TEAM', args: ['team_1', 0, 60, '', {}]}];

        let testStore = mockStore({} as GlobalState);
        await testStore.dispatch(UserActions.loadProfilesAndTeamMembers(0, 60, 'team_1', {}));
        let actualActions = testStore.getActions();
        expect(actualActions[0].args).toEqual(expectedActions[0].args);
        expect(actualActions[0].type).toEqual(expectedActions[0].type);

        testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadProfilesAndTeamMembers(0, 60, '', {}));
        actualActions = testStore.getActions();
        expect(actualActions[0].args).toEqual(expectedActions[0].args);
        expect(actualActions[0].type).toEqual(expectedActions[0].type);
    });

    test('loadProfilesAndReloadChannelMembers', async () => {
        const expectedActions = [{type: 'MOCK_GET_PROFILES_IN_CHANNEL', args: ['current_channel_id', 0, 60, 'sort', {}]}];

        const testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadProfilesAndReloadChannelMembers(0, 60, 'current_channel_id', 'sort', {}));
        const actualActions = testStore.getActions();
        expect(actualActions[0].args).toEqual(expectedActions[0].args);
        expect(actualActions[0].type).toEqual(expectedActions[0].type);
    });

    test('loadProfilesAndTeamMembersAndChannelMembers', async () => {
        const expectedActions = [{type: 'MOCK_GET_PROFILES_IN_CHANNEL', args: ['current_channel_id', 0, 60, '', undefined]}];

        let testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadProfilesAndTeamMembersAndChannelMembers(0, 60, 'team_1', 'current_channel_id'));
        let actualActions = testStore.getActions();
        expect(actualActions[0].args).toEqual(expectedActions[0].args);
        expect(actualActions[0].type).toEqual(expectedActions[0].type);

        testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadProfilesAndTeamMembersAndChannelMembers(0, 60, '', ''));
        actualActions = testStore.getActions();
        expect(actualActions[0].args).toEqual(expectedActions[0].args);
        expect(actualActions[0].type).toEqual(expectedActions[0].type);
    });

    test('loadTeamMembersForProfilesList', async () => {
        const expectedActions = [{args: ['team_1', ['other_user_id']], type: 'MOCK_GET_TEAM_MEMBERS_BY_IDS'}];

        // should call getTeamMembersByIds since 'other_user_id' is not loaded yet
        let testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadTeamMembersForProfilesList(
            [{id: 'other_user_id'} as UserProfile],
            'team_1',
        ));
        expect(testStore.getActions()).toEqual(expectedActions);

        // should not call getTeamMembersByIds since 'current_user_id' is already loaded
        testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadTeamMembersForProfilesList(
            [{id: 'current_user_id'} as UserProfile],
            'team_1',
        ));
        expect(testStore.getActions()).toEqual([]);

        // should call getTeamMembersByIds when reloadAllMembers = true even though 'current_user_id' is already loaded
        testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadTeamMembersForProfilesList(
            [{id: 'current_user_id'} as UserProfile],
            'team_1',
            true,
        ));
        expect(testStore.getActions()).toEqual([{args: ['team_1', ['current_user_id']], type: 'MOCK_GET_TEAM_MEMBERS_BY_IDS'}]);

        // should not call getTeamMembersByIds since no or empty profile is passed
        testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadTeamMembersForProfilesList([], 'team_1'));
        expect(testStore.getActions()).toEqual([]);
    });

    test('loadTeamMembersAndChannelMembersForProfilesList', async () => {
        const expectedActions = [
            {args: ['team_1', ['other_user_id']], type: 'MOCK_GET_TEAM_MEMBERS_BY_IDS'},
            {args: ['current_channel_id', ['other_user_id']], type: 'MOCK_GET_CHANNEL_MEMBERS_BY_IDS'},
        ];

        // should call getTeamMembersByIds and getChannelMembersByIds since 'other_user_id' is not loaded yet
        let testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadTeamMembersAndChannelMembersForProfilesList(
            [{id: 'other_user_id'} as UserProfile],
            'team_1',
            'current_channel_id',
        ));
        expect(testStore.getActions()).toEqual(expectedActions);

        // should not call getTeamMembersByIds/getChannelMembersByIds since 'current_user_id' is already loaded
        testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadTeamMembersForProfilesList(
            [{id: 'current_user_id'} as UserProfile],
            'team_1',
        ));
        expect(testStore.getActions()).toEqual([]);

        // should not call getTeamMembersByIds/getChannelMembersByIds since no or empty profile is passed
        testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadTeamMembersForProfilesList([], 'team_1'));
        expect(testStore.getActions()).toEqual([]);
    });

    test('loadChannelMembersForProfilesList', async () => {
        const expectedActions = [{args: ['current_channel_id', ['other_user_id']], type: 'MOCK_GET_CHANNEL_MEMBERS_BY_IDS'}];

        // should call getChannelMembersByIds since 'other_user_id' is not loaded yet
        let testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadChannelMembersForProfilesList(
            [{id: 'other_user_id'} as UserProfile],
            'current_channel_id',
        ));
        expect(testStore.getActions()).toEqual(expectedActions);

        // should not call getChannelMembersByIds since 'current_user_id' is already loaded
        testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadChannelMembersForProfilesList(
            [{id: 'current_user_id'} as UserProfile],
            'current_channel_id',
        ));
        expect(testStore.getActions()).toEqual([]);

        // should not call getChannelMembersByIds since no or empty profile is passed
        testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadChannelMembersForProfilesList([], 'current_channel_id'));
        expect(testStore.getActions()).toEqual([]);
    });

    test('loadProfilesForGroupChannels', async () => {
        const mockedGroupChannels = [{id: 'group_channel_1'}, {id: 'group_channel_2'}] as Channel[];

        // as users in group_channel_2 are already loaded, it should only try to load group_channel_1
        const expectedActions = [{args: [['group_channel_1']], type: 'MOCK_GET_PROFILES_IN_GROUP_CHANNELS'}];
        const testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.loadProfilesForGroupChannels(mockedGroupChannels));
        expect(testStore.getActions()).toEqual(expectedActions);
    });

    test('searchProfilesAndChannelMembers', async () => {
        const expectedActions = [{type: 'MOCK_SEARCH_PROFILES', args: ['term', {}]}];

        const testStore = mockStore(initialState);
        await testStore.dispatch(UserActions.searchProfilesAndChannelMembers('term'));
        const actualActions = testStore.getActions();
        expect(actualActions[0].args).toEqual(expectedActions[0].args);
        expect(actualActions[0].type).toEqual(expectedActions[0].type);
    });

    describe('getGMsForLoading', () => {
        const gmChannel1 = {id: 'gmChannel1', type: General.GM_CHANNEL, delete_at: 0};
        const gmChannel2 = {id: 'gmChannel2', type: General.GM_CHANNEL, delete_at: 0};

        const dmsCategory = {id: 'dmsCategory', type: CategoryTypes.DIRECT_MESSAGES, channel_ids: [gmChannel1.id, gmChannel2.id]};

        const baseState = {
            ...initialState,
            entities: {
                ...initialState.entities,
                channelCategories: {
                    ...initialState.entities.channelCategories,
                    byId: {
                        dmsCategory,
                    },
                    orderByTeam: {
                        [initialState.entities.teams.currentTeamId]: [dmsCategory.id],
                    },
                },
                channels: {
                    ...initialState.entities.channels,
                    channels: {
                        ...initialState.entities.channels,
                        gmChannel1,
                        gmChannel2,
                    },
                    myMembers: {
                        [gmChannel1.id]: {last_viewed_at: 1000},
                        [gmChannel2.id]: {last_viewed_at: 2000},
                    },
                },
                preferences: {
                    ...initialState.entities.preferences,
                    myPreferences: {
                        ...initialState.entities.preferences.myPreferences,
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '10'},
                        [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel1.id)]: {value: 'true'},
                        [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel2.id)]: {value: 'true'},
                    },
                },
            },
        };

        test('should not return autoclosed GMs', () => {
            let state = baseState;

            expect(UserActions.getGMsForLoading(state as unknown as GlobalState)).toEqual([gmChannel1, gmChannel2]);

            state = {
                ...state,
                entities: {
                    ...state.entities,
                    preferences: {
                        ...state.entities.preferences,
                        myPreferences: {
                            ...state.entities.preferences.myPreferences,
                            [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '1'},
                        },
                    },
                },
            };

            expect(UserActions.getGMsForLoading(state as unknown as GlobalState)).toEqual([gmChannel2]);

            state = {
                ...state,
                entities: {
                    ...state.entities,
                    channels: {
                        ...state.entities.channels,
                        myMembers: {
                            ...state.entities.channels.myMembers,
                            [gmChannel1.id]: {last_viewed_at: 3000},
                        },
                    },
                },
            };

            expect(UserActions.getGMsForLoading(state as unknown as GlobalState)).toEqual([gmChannel1]);
        });

        test('should not return manually closed GMs', () => {
            let state = baseState;

            expect(UserActions.getGMsForLoading(state as unknown as GlobalState)).toEqual([gmChannel1, gmChannel2]);

            state = {
                ...state,
                entities: {
                    ...state.entities,
                    preferences: {
                        ...state.entities.preferences,
                        myPreferences: {
                            ...state.entities.preferences.myPreferences,
                            [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel1.id)]: {value: 'false'},
                        },
                    },
                },
            };

            expect(UserActions.getGMsForLoading(state as unknown as GlobalState)).toEqual([gmChannel2]);

            state = {
                ...state,
                entities: {
                    ...state.entities,
                    preferences: {
                        ...state.entities.preferences,
                        myPreferences: {
                            ...state.entities.preferences.myPreferences,
                            [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel2.id)]: {value: 'false'},
                        },
                    },
                },
            };

            expect(UserActions.getGMsForLoading(state as unknown as GlobalState)).toEqual([]);
        });

        test('should return GMs that are in custom categories, even if they would be automatically hidden in the DMs category', () => {
            const gmChannel3 = {id: 'gmChannel3', type: General.GM_CHANNEL, delete_at: 0};
            const customCategory = {id: 'customCategory', type: CategoryTypes.CUSTOM, channel_ids: [gmChannel3.id]};

            let state = {
                ...baseState,
                entities: {
                    ...baseState.entities,
                    channelCategories: {
                        ...baseState.entities.channelCategories,
                        byId: {
                            ...baseState.entities.channelCategories.byId,
                            customCategory,
                        },
                        orderByTeam: {
                            ...baseState.entities.channelCategories.orderByTeam,
                            [baseState.entities.teams.currentTeamId]: [customCategory.id, dmsCategory.id],
                        },
                    },
                    channels: {
                        ...baseState.entities.channels,
                        channels: {
                            ...baseState.entities.channels.channels,
                            gmChannel3,
                        },
                        myMembers: {
                            ...baseState.entities.channels.myMembers,
                            [gmChannel3.id]: {last_viewed_at: 500},
                        },
                    },
                    preferences: {
                        ...baseState.entities.preferences,
                        myPreferences: {
                            ...baseState.entities.preferences.myPreferences,
                            [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel3.id)]: {value: 'true'},
                        },
                    },
                },
            };

            expect(UserActions.getGMsForLoading(state as unknown as GlobalState)).toEqual([gmChannel3, gmChannel1, gmChannel2]);

            state = {
                ...state,
                entities: {
                    ...state.entities,
                    preferences: {
                        ...state.entities.preferences,
                        myPreferences: {
                            ...state.entities.preferences.myPreferences,
                            [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '1'},
                        },
                    },
                },
            };

            expect(UserActions.getGMsForLoading(state as unknown as GlobalState)).toEqual([gmChannel3, gmChannel2]);

            state = {
                ...state,
                entities: {
                    ...state.entities,
                    preferences: {
                        ...state.entities.preferences,
                        myPreferences: {
                            ...state.entities.preferences.myPreferences,
                            [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '0'},
                        },
                    },
                },
            };

            expect(UserActions.getGMsForLoading(state as unknown as GlobalState)).toEqual([gmChannel3]);
        });
    });

    test('Should call p-queue APIs on loadProfilesForGM', async () => {
        const gmChannel = {id: 'gmChannel', type: General.GM_CHANNEL, team_id: '', delete_at: 0};
        UserActions.queue.add = jest.fn().mockReturnValue(jest.fn());
        UserActions.queue.onEmpty = jest.fn();

        const user = TestHelper.fakeUser();

        const profiles = {
            current_user_id: {
                ...user,
                id: 'current_user_id',
            },
        };

        const channels = {
            [gmChannel.id]: gmChannel,
        };

        const channelsInTeam = {
            '': [gmChannel.id],
        };

        const myMembers = {
            [gmChannel.id]: {},
        };

        const dmsCategory = {id: 'dmsCategory', type: CategoryTypes.DIRECT_MESSAGES, channel_ids: [gmChannel.id]};

        const state = {
            entities: {
                users: {
                    currentUserId: 'current_user_id',
                    profiles,
                    statuses: {},
                    profilesInChannel: {
                        [gmChannel.id]: new Set(['current_user_id']),
                    },
                },
                teams: {
                    currentTeamId: 'team_1',
                },
                posts: {
                    posts: {
                        post_id: {id: 'post_id'},
                    },
                    postsInChannel: {},
                },
                channelCategories: {
                    byId: {
                        dmsCategory,
                    },
                    orderByTeam: {
                        team_1: [dmsCategory.id],
                    },
                },
                channels: {
                    channels,
                    channelsInTeam,
                    messageCounts: {},
                    myMembers,
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel.id)]: {value: 'true'},
                    },
                },
                general: {
                    config: {},
                },
            },
            storage: {
                storage: {},
            },
            views: {
                channel: {
                    lastViewedChannel: null,
                },
                channelSidebar: {
                    unreadFilterEnabled: false,
                },
            },
        } as unknown as GlobalState;

        const testStore = mockStore(state);
        store.getState.mockImplementation(testStore.getState);

        await UserActions.loadProfilesForGM();
        expect(UserActions.queue.onEmpty).toHaveBeenCalled();
        expect(UserActions.queue.add).toHaveBeenCalled();
    });
});
