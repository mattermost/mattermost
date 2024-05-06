// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {Permissions} from 'mattermost-redux/constants';

import type {GlobalState} from 'types/store';

import {mapStateToProps} from './index';

describe('mapStateToProps', () => {
    const currentTeamId = 'team-id';
    const currentUserId = 'user-id';
    const currentChannelId = 'channel-id';

    const initialState = {
        entities: {
            general: {
                config: {
                    EnableGuestAccounts: 'true',
                    BuildEnterpriseReady: 'true',
                },
                license: {
                    IsLicensed: 'true',
                },
            },
            teams: {
                currentTeamId,
                teams: {
                    [currentTeamId]: {
                        display_name: 'team1',
                    },
                },
                myMembers: {},
            },
            preferences: {
                myPreferences: {},
            },
            channels: {
                channels: {
                    [currentChannelId]: {
                        display_name: 'team1',
                    },
                },
                currentChannelId,
                channelsInTeam: {
                    [currentTeamId]: new Set(),
                },
            },
            users: {
                currentUserId,
                profiles: {
                    [currentUserId]: {
                        id: currentUserId,
                        roles: 'test_user_role',
                    },
                },
            },
            roles: {
                roles: {
                    test_user_role: {permissions: [Permissions.INVITE_GUEST]},
                },
            },
            cloud: {},
        },
        views: {
            modals: {
                modalState: {},
            },
        },
        errors: [],
        websocket: {},
        requests: {},
    } as unknown as GlobalState;

    test('canInviteGuests is false when group_constrained is true', () => {
        const testState = {
            ...initialState,
            entities: {
                ...initialState.entities,
                teams: {
                    ...initialState.entities.teams,
                    teams: {
                        [currentTeamId]: {
                            id: currentTeamId,
                            group_constrained: true,
                        },
                    },
                },
            },
        } as unknown as GlobalState;

        const props = mapStateToProps(testState, {});
        expect(props.canInviteGuests).toBe(false);
    });

    test('canInviteGuests is false when BuildEnterpriseReady is false', () => {
        const testState = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    config: {
                        EnableGuestAccounts: 'true',
                        BuildEnterpriseReady: 'false',
                    },
                    license: {
                        IsLicensed: 'true',
                    },
                },
                teams: {
                    ...initialState.entities.teams,
                    teams: {
                        [currentTeamId]: {
                            id: currentTeamId,
                            group_constrained: true,
                        },
                    },
                },
            },
        } as unknown as GlobalState;

        const props = mapStateToProps(testState, {});
        expect(props.canInviteGuests).toBe(false);
    });

    test('canInviteGuests is true when group_constrained is false', () => {
        const testState = {
            ...initialState,
            entities: {
                ...initialState.entities,
                teams: {
                    ...initialState.entities.teams,
                    myMembers: {
                        ...initialState.entities.teams.myMembers,
                    },
                    teams: {
                        [currentTeamId]: {
                            id: currentTeamId,
                            group_constrained: false,
                        },
                    },
                },
            },
        } as unknown as GlobalState;

        const props = mapStateToProps(testState, {});
        expect(props.canInviteGuests).toBe(true);
    });

    test('grabs the team info based on the ownProps channelToInvite value', () => {
        const testState = {
            ...initialState,
            entities: {
                ...initialState.entities,
                teams: {
                    ...initialState.entities.teams,
                    myMembers: {
                        ...initialState.entities.teams.myMembers,
                    },
                    teams: {
                        [currentTeamId]: {
                            id: currentTeamId,
                            group_constrained: false,
                        },
                        currentTeamId: '',
                    },
                },
            },
        } as unknown as GlobalState;

        const testChannel = {
            display_name: 'team1',
            channel_id: currentChannelId,
            team_id: currentTeamId,
        } as unknown as Channel;

        const props = mapStateToProps(testState, {channelToInvite: testChannel});

        expect(props.currentTeam?.id).toBe(testChannel.team_id);
    });
});
