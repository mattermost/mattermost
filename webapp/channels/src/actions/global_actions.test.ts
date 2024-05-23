// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {redirectUserToDefaultTeam, toggleSideBarRightMenuAction, getTeamRedirectChannelIfIsAccesible} from 'actions/global_actions';
import {close as closeLhs} from 'actions/views/lhs';
import {closeRightHandSide, closeMenu as closeRhsMenu} from 'actions/views/rhs';
import LocalStorageStore from 'stores/local_storage_store';
import reduxStore from 'stores/redux_store';

import mockStore from 'tests/test_store';
import {getHistory} from 'utils/browser_history';

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

            reduxStore.getState.mockImplementation(store.getState);

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

            reduxStore.getState.mockImplementation(store.getState);

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

            reduxStore.getState.mockImplementation(store.getState);

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

            reduxStore.getState.mockImplementation(store.getState);

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

            reduxStore.getState.mockImplementation(store.getState);

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
            reduxStore.getState.mockImplementation(store.getState);
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
            reduxStore.getState.mockImplementation(store.getState);
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

            reduxStore.getState.mockImplementation(store.getState);

            await redirectUserToDefaultTeam();
            expect(getHistory().push).toHaveBeenCalledWith('/team1/channels/channel-in-team-1');
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
