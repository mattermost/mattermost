// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GroupTypes} from 'mattermost-redux/action_types';
import reducer from 'mattermost-redux/reducers/entities/groups';

describe('reducers/entities/groups', () => {
    describe('syncables', () => {
        it('initial state', () => {
            const state = undefined;
            const action = {
                type: '',
            };
            const expectedState = {
                syncables: {},
            };

            const newState = reducer(state, action);
            expect(newState.syncables).toEqual(expectedState.syncables);
        });
        it('GroupTypes.RECEIVED_GROUP_TEAMS state', () => {
            const groupId = '5rgoajywb3nfbdtyafbod47rya';
            const data = [
                {
                    team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
                    team_display_name: 'dolphins',
                    team_type: 'O',
                    group_id: '5rgoajywb3nfbdtyafbod47rya',
                    auto_add: true,
                    create_at: 1542643748412,
                    delete_at: 0,
                    update_at: 1542643748412,
                },
                {
                    team_id: 'tdjrcr3hg7yazyos17a53jduna',
                    team_display_name: 'developers',
                    team_type: 'O',
                    group_id: '5rgoajywb3nfbdtyafbod47rya',
                    auto_add: true,
                    create_at: 1542643825026,
                    delete_at: 0,
                    update_at: 1542643825026,
                },
            ];
            const state = {
                syncables: {},
                groups: {},
                stats: {},
                myGroups: [],
            };
            const action = {
                type: GroupTypes.RECEIVED_GROUP_TEAMS,
                data,
                group_id: groupId,
            };
            const expectedState = {
                syncables: {
                    [groupId]: {
                        teams: data,
                    },
                },
            };

            const newState = reducer(state, action);
            expect(newState.syncables).toEqual(expectedState.syncables);
        });

        it('GroupTypes.RECEIVED_GROUP_CHANNELS state', () => {
            const groupId = '5rgoajywb3nfbdtyafbod47rya';
            const data = [
                {
                    channel_id: 'o3tdawqxot8kikzq8bk54zggbc',
                    channel_display_name: 'standup',
                    channel_type: 'P',
                    team_id: 'tdjrcr3hg7yazyos17a53jduna',
                    team_display_name: 'developers',
                    team_type: 'O',
                    group_id: '5rgoajywb3nfbdtyafbod47rya',
                    auto_add: true,
                    create_at: 1542644105041,
                    delete_at: 0,
                    update_at: 1542644105041,
                },
                {
                    channel_id: 's6oxu3embpdepyprx1fn5gjhea',
                    channel_display_name: 'swimming',
                    channel_type: 'P',
                    team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
                    team_display_name: 'dolphins',
                    team_type: 'O',
                    group_id: '5rgoajywb3nfbdtyafbod47rya',
                    auto_add: true,
                    create_at: 1542644105042,
                    delete_at: 0,
                    update_at: 1542644105042,
                },
            ];
            const state = {
                syncables: {},
                groups: {},
                stats: {},
                myGroups: [],
            };
            const action = {
                type: GroupTypes.RECEIVED_GROUP_CHANNELS,
                data,
                group_id: groupId,
            };
            const expectedState = {
                syncables: {
                    [groupId]: {
                        channels: data,
                    },
                },
            };

            const newState = reducer(state, action);
            expect(newState.syncables).toEqual(expectedState.syncables);
        });
        it('GroupTypes.LINKED_GROUP_TEAM state', () => {
            const groupId = '5rgoajywb3nfbdtyafbod47rya';
            const data = {
                team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
                group_id: '5rgoajywb3nfbdtyafbod47rya',
                auto_add: true,
                create_at: 1542643748412,
                delete_at: 0,
                update_at: 1542660566032,
            };

            const state = {
                syncables: {},
                groups: {},
                stats: {},
                myGroups: [],
            };
            const action = {
                type: GroupTypes.LINKED_GROUP_TEAM,
                data,
                group_id: groupId,
            };
            const expectedState = {
                syncables: {
                    [groupId]: {
                        teams: [data],
                    },
                },
            };

            const newState = reducer(state, action);
            expect(newState.syncables).toEqual(expectedState.syncables);
        });

        it('GroupTypes.LINKED_GROUP_CHANNEL state', () => {
            const groupId = '5rgoajywb3nfbdtyafbod47rya';
            const data = {
                team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
                channel_id: 'o3tdawqxot8kikzq8bk54zggbc',
                group_id: '5rgoajywb3nfbdtyafbod47rya',
                auto_add: true,
                create_at: 1542643748412,
                delete_at: 0,
                update_at: 1542660566032,
            };

            const state = {
                syncables: {},
                groups: {},
                stats: {},
                myGroups: [],
            };
            const action = {
                type: GroupTypes.LINKED_GROUP_CHANNEL,
                data,
                group_id: groupId,
            };
            const expectedState = {
                syncables: {
                    [groupId]: {
                        channels: [data],
                    },
                },
            };

            const newState = reducer(state, action);
            expect(newState.syncables).toEqual(expectedState.syncables);
        });
        it('GroupTypes.UNLINKED_GROUP_TEAM state', () => {
            const groupId = '5rgoajywb3nfbdtyafbod47rya';
            const data = {
                syncable_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
                group_id: '5rgoajywb3nfbdtyafbod47rya',
            };
            const expectedChannel = {
                team_id: 'ge63nq31sbfy3duzq5f7yqn7ii',
                channel_id: 'o3tdawqxot8kikzq8bk54zgccc',
                group_id: '5rgoajywb3nfbdtyafbod47rya',
                channel_display_name: 'Test Channel 2',
                channel_type: 'O',
                team_display_name: 'Test Team 2',
                team_type: 'O',
                scheme_admin: false,
                auto_add: true,
                create_at: 1542643748412,
                delete_at: 0,
                update_at: 1542660566032,
            };

            const state = {
                syncables: {
                    [groupId]: {
                        teams: [
                            {
                                team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
                                group_id: '5rgoajywb3nfbdtyafbod47rya',
                                team_display_name: 'Test Team',
                                team_type: 'O',
                                auto_add: true,
                                create_at: 1542643748412,
                                delete_at: 0,
                                update_at: 1542660566032,
                                scheme_admin: false,
                            },
                        ],
                        channels: [
                            {
                                team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
                                channel_id: 'o3tdawqxot8kikzq8bk54zggbc',
                                group_id: '5rgoajywb3nfbdtyafbod47rya',
                                channel_display_name: 'Test Channel',
                                channel_type: 'O',
                                team_display_name: 'Test Team',
                                team_type: 'O',
                                scheme_admin: false,
                                auto_add: true,
                                create_at: 1542643748412,
                                delete_at: 0,
                                update_at: 1542660566032,
                            },
                            expectedChannel,
                        ],
                    },
                },
                groups: {},
                stats: {},
                myGroups: [],
            };
            const action = {
                type: GroupTypes.UNLINKED_GROUP_TEAM,
                data,
                group_id: groupId,
            };
            const expectedState = {
                syncables: {
                    [groupId]: {
                        teams: [],
                        channels: [expectedChannel],
                    },
                },
            };

            const newState = reducer(state, action);
            expect(newState.syncables).toEqual(expectedState.syncables);
        });
        it('GroupTypes.UNLINKED_GROUP_CHANNEL state', () => {
            const groupId = '5rgoajywb3nfbdtyafbod47rya';
            const data = {
                syncable_id: 'o3tdawqxot8kikzq8bk54zggbc',
                group_id: '5rgoajywb3nfbdtyafbod47rya',
            };
            const expectedTeam = {
                team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
                group_id: '5rgoajywb3nfbdtyafbod47rya',
                team_display_name: 'Test Team',
                team_type: 'O',
                auto_add: true,
                create_at: 1542643748412,
                delete_at: 0,
                update_at: 1542660566032,
                scheme_admin: false,
            };
            const expectedChannel = {
                team_id: 'ge63nq31sbfy3duzq5f7yqn7ii',
                channel_id: 'o3tdawqxot8kikzq8bk54zgccc',
                group_id: '5rgoajywb3nfbdtyafbod47rya',
                channel_display_name: 'Test Channel 2',
                channel_type: 'O',
                team_display_name: 'Test Team 2',
                team_type: 'O',
                scheme_admin: false,
                auto_add: true,
                create_at: 1542643748412,
                delete_at: 0,
                update_at: 1542660566032,
            };

            const state = {
                syncables: {
                    [groupId]: {
                        teams: [
                            expectedTeam,
                        ],
                        channels: [
                            {
                                team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
                                channel_id: 'o3tdawqxot8kikzq8bk54zggbc',
                                group_id: '5rgoajywb3nfbdtyafbod47rya',
                                channel_display_name: 'Test Channel',
                                channel_type: 'O',
                                team_display_name: 'Test Team',
                                team_type: 'O',
                                scheme_admin: false,
                                auto_add: true,
                                create_at: 1542643748412,
                                delete_at: 0,
                                update_at: 1542660566032,
                            },
                            expectedChannel,
                        ],
                    },
                },
                groups: {},
                stats: {},
                myGroups: [],
            };
            const action = {
                type: GroupTypes.UNLINKED_GROUP_CHANNEL,
                data,
                group_id: groupId,
            };
            const expectedState = {
                syncables: {
                    [groupId]: {
                        teams: [expectedTeam],
                        channels: [expectedChannel],
                    },
                },
            };

            const newState = reducer(state, action);
            expect(newState.syncables).toEqual(expectedState.syncables);
        });
    });
});
