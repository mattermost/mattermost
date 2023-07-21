// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import {Team, TeamMembership} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';
import * as Selectors from 'mattermost-redux/selectors/entities/teams';
import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';

import TestHelper from '../../../test/test_helper';

describe('Selectors.Teams', () => {
    TestHelper.initMockEntities();
    const team1 = TestHelper.fakeTeamWithId();
    const team2 = TestHelper.fakeTeamWithId();
    const team3 = TestHelper.fakeTeamWithId();
    const team4 = TestHelper.fakeTeamWithId();
    const team5 = TestHelper.fakeTeamWithId();

    const teams: Record<string, Team> = {};
    teams[team1.id] = team1;
    teams[team2.id] = team2;
    teams[team3.id] = team3;
    teams[team4.id] = team4;
    teams[team5.id] = team5;
    team1.display_name = 'Marketeam';
    team1.name = 'marketing_team';
    team2.display_name = 'Core Team';
    team3.allow_open_invite = true;
    team4.allow_open_invite = true;
    team3.display_name = 'Team AA';
    team4.display_name = 'aa-team';
    team5.delete_at = 10;
    team5.allow_open_invite = true;

    const user = TestHelper.fakeUserWithId();
    const user2 = TestHelper.fakeUserWithId();
    const user3 = TestHelper.fakeUserWithId();
    const profiles: Record<string, UserProfile> = {};
    profiles[user.id] = user;
    profiles[user2.id] = user2;
    profiles[user3.id] = user3;

    const myMembers: Record<string, TeamMembership> = {};
    myMembers[team1.id] = {team_id: team1.id, user_id: user.id, roles: General.TEAM_USER_ROLE, mention_count: 1} as TeamMembership;
    myMembers[team2.id] = {team_id: team2.id, user_id: user.id, roles: General.TEAM_USER_ROLE, mention_count: 3} as TeamMembership;
    myMembers[team5.id] = {team_id: team5.id, user_id: user.id, roles: General.TEAM_USER_ROLE, mention_count: 0} as TeamMembership;

    const membersInTeam: Record<string, Record<string, TeamMembership>> = {};
    membersInTeam[team1.id] = {} as Record<string, TeamMembership>;
    membersInTeam[team1.id][user2.id] = {team_id: team1.id, user_id: user2.id, roles: General.TEAM_USER_ROLE} as TeamMembership;
    membersInTeam[team1.id][user3.id] = {team_id: team1.id, user_id: user3.id, roles: General.TEAM_USER_ROLE} as TeamMembership;

    const testState = deepFreezeAndThrowOnMutation({
        entities: {
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId: user.id,
                profiles,
            },
            teams: {
                currentTeamId: team1.id,
                teams,
                myMembers,
                membersInTeam,
            },
            roles: {
                roles: TestHelper.basicRoles,
            },
            general: {
                serverVersion: '5.8.0',
            },
        },
    });

    it('getTeamsList', () => {
        expect(Selectors.getTeamsList(testState)).toEqual([team1, team2, team3, team4, team5]);
    });

    it('getMyTeams', () => {
        expect(Selectors.getMyTeams(testState)).toEqual([team1, team2]);
    });

    it('getMembersInCurrentTeam', () => {
        expect(Selectors.getMembersInCurrentTeam(testState)).toEqual(membersInTeam[team1.id]);
    });

    it('getTeamMember', () => {
        expect(Selectors.getTeamMember(testState, team1.id, user2.id)).toEqual(membersInTeam[team1.id][user2.id]);
    });

    it('getJoinableTeams', () => {
        const openTeams = [team3, team4];
        const joinableTeams = Selectors.getJoinableTeams(testState);
        expect(joinableTeams[0]).toBe(openTeams[0]);
        expect(joinableTeams[1]).toBe(openTeams[1]);
    });

    it('getSortedJoinableTeams', () => {
        const openTeams = [team4, team3];
        const joinableTeams = Selectors.getSortedJoinableTeams(testState, 'en');
        expect(joinableTeams[0]).toBe(openTeams[0]);
        expect(joinableTeams[1]).toBe(openTeams[1]);
    });

    it('getListableTeams', () => {
        const openTeams = [team3, team4];
        const listableTeams = Selectors.getListableTeams(testState);
        expect(listableTeams[0]).toBe(openTeams[0]);
        expect(listableTeams[1]).toBe(openTeams[1]);
    });

    it('getListedJoinableTeams', () => {
        const openTeams = [team4, team3];
        const joinableTeams = Selectors.getSortedListableTeams(testState, 'en');
        expect(joinableTeams[0]).toBe(openTeams[0]);
        expect(joinableTeams[1]).toBe(openTeams[1]);
    });

    it('getJoinableTeamsUsingPermissions', () => {
        const privateTeams = [team1, team2];
        const openTeams = [team3, team4];
        let modifiedState = {
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    myMembers: {},
                },
                roles: {
                    roles: {
                        system_user: {
                            ...testState.entities.roles.roles.system_user,
                            permissions: ['join_private_teams'],
                        },
                    },
                },
                general: {
                    serverVersion: '5.10.0',
                },
            },
        } as GlobalState;
        let joinableTeams = Selectors.getJoinableTeams(modifiedState);
        expect(joinableTeams[0]).toBe(privateTeams[0]);
        expect(joinableTeams[1]).toBe(privateTeams[1]);

        modifiedState = {
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    myMembers: {},
                },
                roles: {
                    roles: {
                        system_user: {
                            permissions: ['join_public_teams'],
                        },
                    },
                },
                general: {
                    serverVersion: '5.10.0',
                },
            },
        } as GlobalState;
        joinableTeams = Selectors.getJoinableTeams(modifiedState);
        expect(joinableTeams[0]).toBe(openTeams[0]);
        expect(joinableTeams[1]).toBe(openTeams[1]);

        modifiedState = {
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    myMembers: {},
                },
                roles: {
                    roles: {
                        system_user: {
                            permissions: ['join_public_teams', 'join_private_teams'],
                        },
                    },
                },
                general: {
                    serverVersion: '5.10.0',
                },
            },
        } as GlobalState;
        joinableTeams = Selectors.getJoinableTeams(modifiedState);
        expect(joinableTeams[0]).toBe(privateTeams[0]);
        expect(joinableTeams[1]).toBe(privateTeams[1]);
        expect(joinableTeams[2]).toBe(openTeams[0]);
        expect(joinableTeams[3]).toBe(openTeams[1]);
    });

    it('getSortedJoinableTeamsUsingPermissions', () => {
        const privateTeams = [team2, team1];
        const openTeams = [team4, team3];
        const modifiedState = {
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    myMembers: {},
                },
                roles: {
                    roles: {
                        system_user: {
                            ...testState.entities.roles.roles.system_user,
                            permissions: ['join_public_teams', 'join_private_teams'],
                        },
                    },
                },
                general: {
                    serverVersion: '5.10.0',
                },
            },
        } as GlobalState;
        const joinableTeams = Selectors.getSortedJoinableTeams(modifiedState, 'en');
        expect(joinableTeams[0]).toBe(openTeams[0]);
        expect(joinableTeams[1]).toBe(privateTeams[0]);
        expect(joinableTeams[2]).toBe(privateTeams[1]);
        expect(joinableTeams[3]).toBe(openTeams[1]);
    });

    it('getListableTeamsUsingPermissions', () => {
        const privateTeams = [team1, team2];
        const openTeams = [team3, team4];
        let modifiedState = {
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    myMembers: {},
                },
                roles: {
                    roles: {
                        system_user: {
                            ...testState.entities.roles.roles.system_user,
                            permissions: ['list_private_teams'],
                        },
                    },
                },
                general: {
                    serverVersion: '5.10.0',
                },
            },
        } as GlobalState;
        let listableTeams = Selectors.getListableTeams(modifiedState);
        expect(listableTeams[0]).toBe(privateTeams[0]);
        expect(listableTeams[1]).toBe(privateTeams[1]);

        modifiedState = {
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    myMembers: {},
                },
                roles: {
                    roles: {
                        system_user: {
                            permissions: ['list_public_teams'],
                        },
                    },
                },
                general: {
                    serverVersion: '5.10.0',
                },
            },
        } as GlobalState;
        listableTeams = Selectors.getListableTeams(modifiedState);
        expect(listableTeams[0]).toBe(openTeams[0]);
        expect(listableTeams[1]).toBe(openTeams[1]);

        modifiedState = {
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    myMembers: {},
                },
                roles: {
                    roles: {
                        system_user: {
                            permissions: ['list_public_teams', 'list_private_teams'],
                        },
                    },
                },
                general: {
                    serverVersion: '5.10.0',
                },
            },
        } as GlobalState;
        listableTeams = Selectors.getListableTeams(modifiedState);
        expect(listableTeams[0]).toBe(privateTeams[0]);
        expect(listableTeams[1]).toBe(privateTeams[1]);
        expect(listableTeams[2]).toBe(openTeams[0]);
        expect(listableTeams[3]).toBe(openTeams[1]);
    });

    it('getSortedListableTeamsUsingPermissions', () => {
        const privateTeams = [team2, team1];
        const openTeams = [team4, team3];
        const modifiedState = {
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    myMembers: {},
                },
                roles: {
                    roles: {
                        system_user: {
                            ...testState.entities.roles.roles.system_user,
                            permissions: ['list_public_teams', 'list_private_teams'],
                        },
                    },
                },
                general: {
                    serverVersion: '5.10.0',
                },
            },
        } as GlobalState;
        const listableTeams = Selectors.getSortedListableTeams(modifiedState, 'en');
        expect(listableTeams[0]).toBe(openTeams[0]);
        expect(listableTeams[1]).toBe(privateTeams[0]);
        expect(listableTeams[2]).toBe(privateTeams[1]);
        expect(listableTeams[3]).toBe(openTeams[1]);
    });

    it('isCurrentUserCurrentTeamAdmin', () => {
        expect(Selectors.isCurrentUserCurrentTeamAdmin(testState)).toEqual(false);
    });

    it('getMyTeamMember', () => {
        expect(Selectors.getMyTeamMember(testState, team1.id)).toEqual(myMembers[team1.id]);
    });

    it('getTeam', () => {
        const modifiedState = {
            ...testState,
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    teams: {
                        ...testState.entities.teams.teams,
                        [team3.id]: {
                            ...team3,
                            allow_open_invite: false,
                        },
                    },
                },
            },
        };

        const fromOriginalState = Selectors.getTeam(testState, team1.id);
        const fromModifiedState = Selectors.getTeam(modifiedState, team1.id);
        expect(fromOriginalState).toEqual(fromModifiedState);
    });

    it('getJoinableTeamIds', () => {
        const modifiedState = {
            ...testState,
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    teams: {
                        ...testState.entities.teams.teams,
                        [team3.id]: {
                            ...team3,
                            display_name: 'Welcome',
                        },
                    },
                },
            },
        };

        const fromOriginalState = Selectors.getJoinableTeamIds(testState);
        const fromModifiedState = Selectors.getJoinableTeamIds(modifiedState);
        expect(fromOriginalState).toEqual(fromModifiedState);
    });

    it('getMySortedTeamIds', () => {
        const modifiedState = {
            ...testState,
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    teams: {
                        ...testState.entities.teams.teams,
                        [team3.id]: {
                            ...team3,
                            display_name: 'Welcome',
                        },
                    },
                },
            },
        };

        const updateState = {
            ...testState,
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    teams: {
                        ...testState.entities.teams.teams,
                        [team2.id]: {
                            ...team2,
                            display_name: 'Yankz',
                        },
                    },
                },
            },
        };

        const fromOriginalState = Selectors.getMySortedTeamIds(testState, 'en');
        const fromModifiedState = Selectors.getMySortedTeamIds(modifiedState, 'en');
        const fromUpdateState = Selectors.getMySortedTeamIds(updateState, 'en');

        expect(fromOriginalState).toEqual(fromModifiedState);
        expect(fromModifiedState[0]).toEqual(team2.id);

        expect(fromModifiedState).not.toEqual(fromUpdateState);
        expect(fromUpdateState[0]).toEqual(team1.id);
    });

    it('getMyTeamsCount', () => {
        const modifiedState = {
            ...testState,
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    teams: {
                        ...testState.entities.teams.teams,
                        [team3.id]: {
                            ...team3,
                            display_name: 'Welcome',
                        },
                    },
                },
            },
        };

        const updateState = {
            ...testState,
            entities: {
                ...testState.entities,
                teams: {
                    ...testState.entities.teams,
                    myMembers: {
                        ...testState.entities.teams.myMembers,
                        [team3.id]: {team_id: team3.id, user_id: user.id, roles: General.TEAM_USER_ROLE},
                    },
                },
            },
        };

        const fromOriginalState = Selectors.getMyTeamsCount(testState);
        const fromModifiedState = Selectors.getMyTeamsCount(modifiedState);
        const fromUpdateState = Selectors.getMyTeamsCount(updateState);

        expect(fromOriginalState).toEqual(fromModifiedState);
        expect(fromModifiedState).toEqual(2);

        expect(fromModifiedState).not.toEqual(fromUpdateState);
        expect(fromUpdateState).toEqual(3);
    });

    it('getChannelDrawerBadgeCount', () => {
        const mentions = Selectors.getChannelDrawerBadgeCount(testState);
        expect(mentions).toEqual(3);
    });

    it('getTeamMentions', () => {
        const factory1 = Selectors.makeGetBadgeCountForTeamId();
        const factory2 = Selectors.makeGetBadgeCountForTeamId();
        const factory3 = Selectors.makeGetBadgeCountForTeamId();

        const mentions1 = factory1(testState, team1.id);
        expect(mentions1).toEqual(1);

        const mentions2 = factory2(testState, team2.id);
        expect(mentions2).toEqual(3);

        // Not a member of the team
        const mentions3 = factory3(testState, team3.id);
        expect(mentions3).toEqual(0);
    });

    it('getCurrentRelativeTeamUrl', () => {
        expect(Selectors.getCurrentRelativeTeamUrl(testState)).toEqual('/' + team1.name);
        expect(Selectors.getCurrentRelativeTeamUrl({entities: {teams: {teams: {}}}} as GlobalState)).toEqual('/');
    });

    it('getCurrentTeamUrl', () => {
        const siteURL = 'http://localhost:8065';
        const general = {
            config: {SiteURL: siteURL},
            credentials: {},
        };

        const withSiteURLState = {
            ...testState,
            entities: {
                ...testState.entities,
                general,
            },
        };
        withSiteURLState.entities.general = general;
        expect(Selectors.getCurrentTeamUrl(withSiteURLState)).toEqual(siteURL + '/' + team1.name);

        const credentialURL = 'http://localhost:8065';
        const withCredentialURLState = {
            ...withSiteURLState,
            entities: {
                ...withSiteURLState.entities,
                general: {
                    ...withSiteURLState.entities.general,
                    credentials: {url: credentialURL},
                },
            },
        };
        expect(Selectors.getCurrentTeamUrl(withCredentialURLState)).toEqual(credentialURL + '/' + team1.name);
    });

    it('getCurrentTeamUrl with falsy currentTeam', () => {
        const siteURL = 'http://localhost:8065';
        const general = {
            config: {SiteURL: siteURL},
            credentials: {},
        };
        const falsyCurrentTeamIds = ['', null, undefined];
        falsyCurrentTeamIds.forEach((falsyCurrentTeamId) => {
            const withSiteURLState = {
                ...testState,
                entities: {
                    ...testState.entities,
                    teams: {
                        ...testState.entities.teams,
                        currentTeamId: falsyCurrentTeamId,
                    },
                    general,
                },
            };
            withSiteURLState.entities.general = general;
            expect(Selectors.getCurrentTeamUrl(withSiteURLState)).toEqual(siteURL);

            const credentialURL = 'http://localhost:8065';
            const withCredentialURLState = {
                ...withSiteURLState,
                entities: {
                    ...withSiteURLState.entities,
                    general: {
                        ...withSiteURLState.entities.general,
                        credentials: {url: credentialURL},
                    },
                },
            };
            expect(Selectors.getCurrentTeamUrl(withCredentialURLState)).toEqual(credentialURL);
        });
    });
});
