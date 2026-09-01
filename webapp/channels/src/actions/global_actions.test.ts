// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';
import {General} from 'mattermost-redux/constants';

import {redirectUserToDefaultTeam, toggleSideBarRightMenuAction, getTeamRedirectChannelIfIsAccesible} from 'actions/global_actions';
import {close as closeLhs} from 'actions/views/lhs';
import {closeRightHandSide, closeMenu as closeRhsMenu} from 'actions/views/rhs';
import configureStore from 'store';
import LocalStorageStore from 'stores/local_storage_store';
import reduxStore from 'stores/redux_store';

import mockStore from 'tests/test_store';
import {getHistory} from 'utils/browser_history';

import type {GlobalState} from 'types/store';

const getState = jest.mocked(reduxStore.getState);

jest.mock('actions/views/rhs', () => ({
    closeMenu: jest.fn(),
    closeRightHandSide: jest.fn(),
}));

jest.mock('actions/views/lhs', () => ({
    close: jest.fn(),
}));

jest.mock('mattermost-redux/actions/users', () => ({
    loadMe: () => ({type: 'MOCK_RECEIVED_ME'}),
}));

jest.mock('stores/redux_store', () => {
    return {
        dispatch: jest.fn(),
        getState: jest.fn(),
    };
});

describe('actions/global_actions', () => {
    describe('redirectUserToDefaultTeam', () => {
        it('should redirect to /select_team when no team is available', async () => {
            const store = mockStore({
                entities: {
                    general: {
                        config: {
                            DefaultClientLocale: 'en',
                        },
                    },
                    teams: {
                        teams: {},
                        myMembers: {},
                    },
                    channels: {
                        myMembers: {},
                        channels: {},
                        channelsInTeam: {},
                    },
                    users: {
                        currentUserId: 'user1',
                        profiles: {
                            user1: {
                                id: 'user1',
                                roles: '',
                            },
                        },
                    },
                },
            });

            getState.mockImplementation(store.getState);

            await redirectUserToDefaultTeam();
            expect(getHistory().push).toHaveBeenCalledWith('/select_team');
        });

        it('should redirect to last viewed channel in the last viewed team when the user have access to that team', async () => {
            const userId = 'user1';
            LocalStorageStore.setPreviousTeamId(userId, 'team2');
            LocalStorageStore.setPreviousChannelName(userId, 'team1', 'channel-in-team-1');
            LocalStorageStore.setPreviousChannelName(userId, 'team2', 'channel-in-team-2');

            const store = mockStore({
                entities: {
                    general: {
                        config: {
                            DefaultClientLocale: 'en',
                        },
                        serverVersion: '5.16.0',
                    },
                    teams: {
                        teams: {
                            team1: {id: 'team1', display_name: 'Team 1', name: 'team1', delete_at: 0},
                            team2: {id: 'team2', display_name: 'Team 2', name: 'team2', delete_at: 0},
                        },
                        myMembers: {
                            team1: {team_id: 'team1'},
                            team2: {team_id: 'team2'},
                        },
                    },
                    channels: {
                        myMembers: {
                            'channel-in-team-1': {},
                            'channel-in-team-2': {},
                        },
                        channels: {
                            'channel-in-team-1': {
                                id: 'channel-in-team-1',
                                team_id: 'team1',
                                name: 'channel-in-team-1',
                            },
                            'channel-in-team-2': {
                                id: 'channel-in-team-2',
                                team_id: 'team2',
                                name: 'channel-in-team-2',
                            },
                        },
                        channelsInTeam: {
                            team1: new Set(['channel-in-team-1']),
                            team2: new Set(['channel-in-team-2']),
                        },
                    },
                    users: {
                        currentUserId: userId,
                        profiles: {
                            [userId]: {id: userId, roles: 'system_guest'},
                        },
                    },
                    roles: {
                        roles: {
                            system_guest: {
                                permissions: [],
                            },
                            team_guest: {
                                permissions: [],
                            },
                            channel_guest: {
                                permissions: [],
                            },
                        },
                    },
                },
            });

            getState.mockImplementation(store.getState);

            await redirectUserToDefaultTeam();
            expect(getHistory().push).toHaveBeenCalledWith('/team2/channels/channel-in-team-2');
        });

        it('should redirect to last channel on first team with channels when the user have no channels in the current team', async () => {
            const userId = 'user1';
            LocalStorageStore.setPreviousTeamId(userId, 'team1');
            LocalStorageStore.setPreviousChannelName(userId, 'team1', 'channel-in-team-1');
            LocalStorageStore.setPreviousChannelName(userId, 'team2', 'channel-in-team-2');

            const store = mockStore({
                entities: {
                    general: {
                        config: {
                            DefaultClientLocale: 'en',
                        },
                        serverVersion: '5.16.0',
                    },
                    teams: {
                        teams: {
                            team1: {id: 'team1', display_name: 'Team 1', name: 'team1', delete_at: 0},
                            team2: {id: 'team2', display_name: 'Team 2', name: 'team2', delete_at: 0},
                        },
                        myMembers: {
                            team1: {team_id: 'team1'},
                            team2: {team_id: 'team2'},
                        },
                    },
                    channels: {
                        myMembers: {
                            'channel-in-team-2': {},
                        },
                        channels: {
                            'channel-in-team-1': {
                                id: 'channel-in-team-1',
                                team_id: 'team1',
                                name: 'channel-in-team-1',
                            },
                            'channel-in-team-2': {
                                id: 'channel-in-team-2',
                                team_id: 'team2',
                                name: 'channel-in-team-2',
                            },
                        },
                        channelsInTeam: {
                            team1: new Set(['channel-in-team-1']),
                            team2: new Set(['channel-in-team-2']),
                        },
                    },
                    users: {
                        currentUserId: userId,
                        profiles: {
                            [userId]: {id: userId, roles: 'system_guest'},
                        },
                    },
                    roles: {
                        roles: {
                            system_guest: {
                                permissions: [],
                            },
                            team_guest: {
                                permissions: [],
                            },
                            channel_guest: {
                                permissions: [],
                            },
                        },
                    },
                },
            });

            getState.mockImplementation(store.getState);

            await redirectUserToDefaultTeam();
            expect(getHistory().push).toHaveBeenCalledWith('/team2/channels/channel-in-team-2');
        });

        it('should redirect to /select_team when the user have no channels in the any of his teams', async () => {
            const userId = 'user1';
            LocalStorageStore.setPreviousTeamId(userId, 'team1');
            LocalStorageStore.setPreviousChannelName(userId, 'team1', 'channel-in-team-1');
            LocalStorageStore.setPreviousChannelName(userId, 'team2', 'channel-in-team-2');

            const store = mockStore({
                entities: {
                    general: {
                        config: {
                            DefaultClientLocale: 'en',
                        },
                        serverVersion: '5.16.0',
                    },
                    teams: {
                        teams: {
                            team1: {id: 'team1', display_name: 'Team 1', name: 'team1', delete_at: 0},
                            team2: {id: 'team2', display_name: 'Team 2', name: 'team2', delete_at: 0},
                        },
                        myMembers: {
                            team1: {team_id: 'team1'},
                            team2: {team_id: 'team2'},
                        },
                    },
                    channels: {
                        myMembers: {
                        },
                        channels: {
                            'channel-in-team-1': {
                                id: 'channel-in-team-1',
                                team_id: 'team1',
                                name: 'channel-in-team-1',
                            },
                            'channel-in-team-2': {
                                id: 'channel-in-team-2',
                                team_id: 'team2',
                                name: 'channel-in-team-2',
                            },
                        },
                        channelsInTeam: {
                            team1: new Set(['channel-in-team-1']),
                            team2: new Set(['channel-in-team-2']),
                        },
                    },
                    users: {
                        currentUserId: userId,
                        profiles: {
                            [userId]: {id: userId, roles: 'system_guest'},
                        },
                    },
                    roles: {
                        roles: {
                            system_guest: {
                                permissions: [],
                            },
                            team_guest: {
                                permissions: [],
                            },
                            channel_guest: {
                                permissions: [],
                            },
                        },
                    },
                },
            });

            getState.mockImplementation(store.getState);

            await redirectUserToDefaultTeam();
            expect(getHistory().push).toHaveBeenCalledWith('/select_team');
        });

        it('should do nothing if there is not current user', async () => {
            const store = mockStore({
                entities: {
                    general: {
                        config: {
                            DefaultClientLocale: 'en',
                        },
                    },
                    teams: {
                        teams: {
                            team1: {id: 'team1', display_name: 'Team 1', name: 'team1', delete_at: 0},
                            team2: {id: 'team2', display_name: 'Team 2', name: 'team2', delete_at: 0},
                        },
                        myMembers: {
                            team1: {team_id: 'team1'},
                            team2: {team_id: 'team2'},
                        },
                    },
                    users: {
                        profiles: {
                            user1: {id: 'user1', roles: 'system_guest'},
                        },
                    },
                },
            });

            getState.mockImplementation(store.getState);

            await redirectUserToDefaultTeam();
            expect(getHistory().push).not.toHaveBeenCalled();
        });

        it('should redirect to direct message if that\'s the most recently used', async () => {
            const userId = 'user1';
            const teamId = 'team1';
            const user2 = 'user2';
            const directChannelId = `${userId}__${user2}`;
            const store = mockStore({
                entities: {
                    general: {
                        config: {
                            DefaultClientLocale: 'en',
                            TeammateNameDisplay: 'username',
                        },
                        serverVersion: '5.16.0',
                    },
                    preferences: {
                        myPreferences: {},
                    },
                    teams: {
                        teams: {
                            team1: {id: 'team1', display_name: 'Team 1', name: 'team1', delete_at: 0},
                            team2: {id: 'team2', display_name: 'Team 2', name: 'team2', delete_at: 0},
                        },
                        myMembers: {
                            team1: {team_id: 'team1'},
                            team2: {team_id: 'team2'},
                        },
                    },
                    channels: {
                        myMembers: {
                            'channel-in-team-1': {},
                            'channel-in-team-2': {},
                            [directChannelId]: {},
                        },
                        channels: {
                            'channel-in-team-1': {
                                id: 'channel-in-team-1',
                                team_id: 'team1',
                                name: 'channel-in-team-1',
                                type: 'O',
                            },
                            'channel-in-team-2': {
                                id: 'channel-in-team-2',
                                team_id: 'team2',
                                name: 'channel-in-team-2',
                                type: 'O',
                            },
                            [directChannelId]: {
                                id: directChannelId,
                                team_id: '',
                                name: directChannelId,
                                type: 'D',
                                teammate_id: 'user2',
                            },
                            'group-channel': {
                                id: 'group-channel',
                                name: 'group-channel',
                                team_id: 'team1',
                                type: 'G',
                            },
                        },
                        channelsInTeam: {
                            team1: new Set(['channel-in-team-1', directChannelId]),
                            team2: new Set(['channel-in-team-2']),
                        },
                    },
                    users: {
                        currentUserId: userId,
                        profiles: {
                            [userId]: {id: userId, username: userId, roles: 'system_guest'},
                            [user2]: {id: user2, username: user2, roles: 'system_guest'},
                        },
                    },
                    roles: {
                        roles: {
                            system_guest: {
                                permissions: [],
                            },
                            team_guest: {
                                permissions: [],
                            },
                            channel_guest: {
                                permissions: [],
                            },
                        },
                    },
                },
            });
            getState.mockImplementation(store.getState);
            LocalStorageStore.setPreviousTeamId(userId, teamId);
            LocalStorageStore.setPreviousChannelName(userId, teamId, directChannelId);

            const result = await getTeamRedirectChannelIfIsAccesible({id: userId} as UserProfile, {id: teamId} as Team);
            expect(result?.id).toBe(directChannelId);
        });

        it('should redirect to group message if that\'s the most recently used', async () => {
            const userId = 'user1';
            const teamId = 'team1';
            const user2 = 'user2';
            const directChannelId = `${userId}__${user2}`;
            const groupChannelId = 'group-channel';
            const store = mockStore({
                entities: {
                    general: {
                        config: {
                            DefaultClientLocale: 'en',
                            TeammateNameDisplay: 'username',
                        },
                        serverVersion: '5.16.0',
                    },
                    preferences: {
                        myPreferences: {},
                    },
                    teams: {
                        teams: {
                            team1: {id: 'team1', display_name: 'Team 1', name: 'team1', delete_at: 0},
                            team2: {id: 'team2', display_name: 'Team 2', name: 'team2', delete_at: 0},
                        },
                        myMembers: {
                            team1: {team_id: 'team1'},
                            team2: {team_id: 'team2'},
                        },
                    },
                    channels: {
                        myMembers: {
                            'channel-in-team-1': {},
                            'channel-in-team-2': {},
                            [directChannelId]: {},
                            [groupChannelId]: {},
                        },
                        channels: {
                            'channel-in-team-1': {
                                id: 'channel-in-team-1',
                                team_id: 'team1',
                                name: 'channel-in-team-1',
                                type: 'O',
                            },
                            'channel-in-team-2': {
                                id: 'channel-in-team-2',
                                team_id: 'team2',
                                name: 'channel-in-team-2',
                                type: 'O',
                            },
                            [directChannelId]: {
                                id: directChannelId,
                                team_id: '',
                                name: directChannelId,
                                type: 'D',
                                teammate_id: 'user2',
                            },
                            [groupChannelId]: {
                                id: groupChannelId,
                                name: groupChannelId,
                                team_id: 'team1',
                                type: 'G',
                            },
                        },
                        channelsInTeam: {
                            team1: new Set(['channel-in-team-1', directChannelId, groupChannelId]),
                            team2: new Set(['channel-in-team-2']),
                        },
                    },
                    users: {
                        currentUserId: userId,
                        profiles: {
                            [userId]: {id: userId, username: userId, roles: 'system_guest'},
                            [user2]: {id: user2, username: user2, roles: 'system_guest'},
                        },
                    },
                    roles: {
                        roles: {
                            system_guest: {
                                permissions: [],
                            },
                            team_guest: {
                                permissions: [],
                            },
                            channel_guest: {
                                permissions: [],
                            },
                        },
                    },
                },
            });
            getState.mockImplementation(store.getState);
            LocalStorageStore.setPreviousTeamId(userId, teamId);
            LocalStorageStore.setPreviousChannelName(userId, teamId, groupChannelId);

            const result = await getTeamRedirectChannelIfIsAccesible({id: userId} as UserProfile, {id: teamId} as Team);
            expect(result?.id).toBe(groupChannelId);
        });

        it('should redirect to last channel on first team when current team is no longer available', async () => {
            const userId = 'user1';
            LocalStorageStore.setPreviousTeamId(userId, 'non-existent');
            LocalStorageStore.setPreviousChannelName(userId, 'team1', 'channel-in-team-1');
            LocalStorageStore.setPreviousChannelName(userId, 'team2', 'channel-in-team-2');

            const store = mockStore({
                entities: {
                    general: {
                        config: {
                            DefaultClientLocale: 'en',
                        },
                    },
                    teams: {
                        teams: {
                            team1: {id: 'team1', display_name: 'Team 1', name: 'team1', delete_at: 0},
                            team2: {id: 'team2', display_name: 'Team 2', name: 'team2', delete_at: 0},
                        },
                        myMembers: {
                            team1: {team_id: 'team1'},
                            team2: {team_id: 'team2'},
                        },
                    },
                    channels: {
                        myMembers: {
                            'channel-in-team-1': {},
                            'channel-in-team-2': {},
                        },
                        channels: {
                            'channel-in-team-1': {
                                id: 'channel-in-team-1',
                                team_id: 'team1',
                                name: 'channel-in-team-1',
                            },
                            'channel-in-team-2': {
                                id: 'channel-in-team-2',
                                team_id: 'team2',
                                name: 'channel-in-team-2',
                            },
                        },
                        channelsInTeam: {
                            team1: new Set(['channel-in-team-1']),
                            team2: new Set(['channel-in-team-2']),
                        },
                    },
                    users: {
                        currentUserId: userId,
                        profiles: {
                            [userId]: {id: userId, roles: ''},
                        },
                    },
                },
            });

            getState.mockImplementation(store.getState);

            await redirectUserToDefaultTeam();
            expect(getHistory().push).toHaveBeenCalledWith('/team1/channels/channel-in-team-1');
        });
    });

    describe('redirectUserToDefaultTeam with no channel memberships in the team', () => {
        const userId = 'user1';
        const teamId = 'team1';
        const townSquareId = 'town_square_id';

        const townSquare = {
            id: townSquareId,
            team_id: teamId,
            name: General.DEFAULT_CHANNEL,
            display_name: 'Town Square',
            type: General.OPEN_CHANNEL,
        };

        const townSquareMember = {channel_id: townSquareId, user_id: userId, roles: 'channel_user'};

        // A live team membership with zero channel memberships in that team, which is the state
        // that used to dead-end the user on /select_team.
        const deadEndedState = (teamPermissions: string[]) => ({
            entities: {
                general: {
                    config: {DefaultClientLocale: 'en'},
                    license: {},
                    serverVersion: '5.16.0',
                },
                teams: {
                    teams: {[teamId]: {id: teamId, display_name: 'Team 1', name: teamId, delete_at: 0}},
                    myMembers: {[teamId]: {team_id: teamId, roles: 'team_user'}},
                },
                channels: {
                    myMembers: {},
                    channels: {[townSquareId]: townSquare},
                    channelsInTeam: {[teamId]: new Set([townSquareId])},
                },
                users: {
                    currentUserId: userId,
                    profiles: {[userId]: {id: userId, roles: 'system_user'}},
                },
                roles: {
                    roles: {
                        system_user: {permissions: []},
                        team_user: {permissions: teamPermissions},
                        channel_user: {permissions: []},
                    },
                },
            },
        });

        // The real store is used rather than a mock one so the join actually lands in
        // entities.channels.myMembers and the assertions can read the resulting state.
        function setUpStore(preloadedState: DeepPartial<GlobalState>, previousChannelName = General.DEFAULT_CHANNEL) {
            const store = configureStore(preloadedState);
            getState.mockImplementation(store.getState);
            jest.mocked(reduxStore.dispatch).mockImplementation(store.dispatch as typeof reduxStore.dispatch);

            LocalStorageStore.setPreviousTeamId(userId, teamId);
            LocalStorageStore.setPreviousChannelName(userId, teamId, previousChannelName);

            return store;
        }

        beforeAll(() => {
            Client4.setUrl('http://localhost:8065');
            nock.disableNetConnect();
        });

        afterAll(() => {
            nock.enableNetConnect();
        });

        afterEach(() => {
            nock.cleanAll();
            jest.mocked(reduxStore.dispatch).mockReset();
        });

        it('joins the default channel and redirects into the team when the user can join public channels', async () => {
            const store = setUpStore(deadEndedState(['join_public_channels']));

            nock(Client4.getBaseRoute()).
                get(`/teams/name/${teamId}/channels/name/${General.DEFAULT_CHANNEL}`).
                query(true).
                reply(200, townSquare);
            const joinRequest = nock(Client4.getBaseRoute()).
                post(`/channels/${townSquareId}/members`).
                reply(201, townSquareMember);
            nock(Client4.getBaseRoute()).
                get(`/channels/${townSquareId}`).
                reply(200, townSquare);

            await redirectUserToDefaultTeam();

            expect(joinRequest.isDone()).toBe(true);
            expect(store.getState().entities.channels.myMembers[townSquareId]).toMatchObject(townSquareMember);
            expect(store.getState().entities.channels.currentChannelId).toBe(townSquareId);
            expect(getHistory().push).toHaveBeenCalledWith(`/${teamId}/channels/${General.DEFAULT_CHANNEL}`);
        });

        it('joins the default channel by name when it has not been loaded into the store', async () => {
            const state = deadEndedState(['join_public_channels']);
            const store = setUpStore({
                ...state,
                entities: {
                    ...state.entities,
                    channels: {myMembers: {}, channels: {}, channelsInTeam: {}},
                },
            }, 'a-channel-that-no-longer-exists');

            nock(Client4.getBaseRoute()).
                get(`/users/me/teams/${teamId}/channels`).
                reply(200, []);
            nock(Client4.getBaseRoute()).
                get(`/users/me/teams/${teamId}/channels/members`).
                reply(200, []);
            nock(Client4.getBaseRoute()).
                get(`/teams/name/${teamId}/channels/name/a-channel-that-no-longer-exists`).
                query(true).
                reply(404, {id: 'app.channel.get_by_name.missing.app_error', status_code: 404});
            const lookupByName = nock(Client4.getBaseRoute()).
                get(`/teams/${teamId}/channels/name/${General.DEFAULT_CHANNEL}`).
                query(true).
                reply(200, townSquare);
            const joinRequest = nock(Client4.getBaseRoute()).
                post(`/channels/${townSquareId}/members`).
                reply(201, townSquareMember);

            await redirectUserToDefaultTeam();

            expect(lookupByName.isDone()).toBe(true);
            expect(joinRequest.isDone()).toBe(true);
            expect(store.getState().entities.channels.myMembers[townSquareId]).toMatchObject(townSquareMember);
            expect(getHistory().push).toHaveBeenCalledWith(`/${teamId}/channels/${General.DEFAULT_CHANNEL}`);
        });

        it('does not join anything when the user cannot join public channels', async () => {
            const store = setUpStore(deadEndedState([]));

            nock(Client4.getBaseRoute()).
                get(`/teams/name/${teamId}/channels/name/${General.DEFAULT_CHANNEL}`).
                query(true).
                reply(200, townSquare);
            const joinRequest = nock(Client4.getBaseRoute()).
                post(`/channels/${townSquareId}/members`).
                reply(201, townSquareMember);

            await redirectUserToDefaultTeam();

            expect(joinRequest.isDone()).toBe(false);
            expect(store.getState().entities.channels.myMembers).toEqual({});
            expect(getHistory().push).toHaveBeenCalledWith('/select_team');
        });

        it('falls back to /select_team when the server refuses the join', async () => {
            const store = setUpStore(deadEndedState(['join_public_channels']));

            nock(Client4.getBaseRoute()).
                get(`/teams/name/${teamId}/channels/name/${General.DEFAULT_CHANNEL}`).
                query(true).
                reply(200, townSquare);
            const joinRequest = nock(Client4.getBaseRoute()).
                post(`/channels/${townSquareId}/members`).
                reply(403, {id: 'api.context.permissions.app_error', status_code: 403});

            await redirectUserToDefaultTeam();

            expect(joinRequest.isDone()).toBe(true);
            expect(store.getState().entities.channels.myMembers).toEqual({});
            expect(getHistory().push).toHaveBeenCalledWith('/select_team');
        });

        it('prefers a team the user already has channels in over joining the default channel of another', async () => {
            const otherTeamId = 'team2';
            const otherChannel = {id: 'other_channel_id', team_id: otherTeamId, name: 'other-channel', type: General.OPEN_CHANNEL};
            const state = deadEndedState(['join_public_channels']);

            const store = setUpStore({
                ...state,
                entities: {
                    ...state.entities,
                    teams: {
                        teams: {
                            ...state.entities.teams.teams,

                            // Sorted after team1 by display name, so the dead-ended team is scanned first.
                            [otherTeamId]: {id: otherTeamId, display_name: 'Team 2', name: otherTeamId, delete_at: 0},
                        },
                        myMembers: {
                            ...state.entities.teams.myMembers,
                            [otherTeamId]: {team_id: otherTeamId, roles: 'team_user'},
                        },
                    },
                    channels: {
                        myMembers: {[otherChannel.id]: {channel_id: otherChannel.id, user_id: userId, roles: 'channel_user'}},
                        channels: {[townSquareId]: townSquare, [otherChannel.id]: otherChannel},
                        channelsInTeam: {[teamId]: new Set([townSquareId]), [otherTeamId]: new Set([otherChannel.id])},
                    },
                },
            });
            LocalStorageStore.setPreviousChannelName(userId, otherTeamId, otherChannel.name);

            nock(Client4.getBaseRoute()).
                get(`/teams/name/${teamId}/channels/name/${General.DEFAULT_CHANNEL}`).
                query(true).
                reply(200, townSquare);
            const joinRequest = nock(Client4.getBaseRoute()).
                post(`/channels/${townSquareId}/members`).
                reply(201, townSquareMember);

            await redirectUserToDefaultTeam();

            expect(joinRequest.isDone()).toBe(false);
            expect(store.getState().entities.channels.myMembers[townSquareId]).toBeUndefined();
            expect(getHistory().push).toHaveBeenCalledWith(`/${otherTeamId}/channels/${otherChannel.name}`);
        });
    });

    test('toggleSideBarRightMenuAction', () => {
        const dispatchMock = (arg: any) => {
            if (typeof arg === 'function') {
                arg(dispatchMock);
            }
        };
        dispatchMock(toggleSideBarRightMenuAction());
        expect(closeRhsMenu).toHaveBeenCalled();
        expect(closeRightHandSide).toHaveBeenCalled();
        expect(closeLhs).toHaveBeenCalled();
    });
});
