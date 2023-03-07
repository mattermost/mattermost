// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import nock from 'nock';

import {ActionResult} from 'mattermost-redux/types/actions';
import * as Actions from 'mattermost-redux/actions/teams';
import {loadMeREST} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {GeneralTypes, UserTypes} from 'mattermost-redux/action_types';
import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';
import {General, RequestStatus} from 'mattermost-redux/constants';
import {Team} from '@mattermost/types/teams';

const OK_RESPONSE = {status: 'OK'};

describe('Actions.Teams', () => {
    let store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    beforeEach(() => {
        store = configureStore({
            entities: {
                general: {
                    config: {
                        CollapsedThreads: 'always_on',
                    },
                },
            },
        });
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('selectTeam', async () => {
        await store.dispatch(Actions.selectTeam(TestHelper.basicTeam!));
        await TestHelper.wait(100);
        const {currentTeamId} = store.getState().entities.teams;

        expect(currentTeamId).toBeTruthy();
        expect(currentTeamId).toEqual(TestHelper.basicTeam!.id);
    });

    it('getMyTeams', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await loadMeREST()(store.dispatch, store.getState);

        nock(Client4.getBaseRoute()).
            get('/users/me/teams').
            reply(200, [TestHelper.basicTeam]);
        await Actions.getMyTeams()(store.dispatch, store.getState);

        const teamsRequest = store.getState().requests.teams.getMyTeams;
        const {teams} = store.getState().entities.teams;

        if (teamsRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(teamsRequest.error));
        }

        expect(teams).toBeTruthy();
        expect(teams[TestHelper.basicTeam!.id]).toBeTruthy();
    });

    it('getTeamsForUser', async () => {
        nock(Client4.getBaseRoute()).
            get(`/users/${TestHelper.basicUser!.id}/teams`).
            reply(200, [TestHelper.basicTeam]);

        await Actions.getTeamsForUser(TestHelper.basicUser!.id)(store.dispatch, store.getState);

        const teamsRequest = store.getState().requests.teams.getTeams;
        const {teams} = store.getState().entities.teams;

        if (teamsRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(teamsRequest.error));
        }

        expect(teams).toBeTruthy();
        expect(teams[TestHelper.basicTeam!.id]).toBeTruthy();
    });

    it('getTeams', async () => {
        let team = {...TestHelper.fakeTeam(), allow_open_invite: true};

        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, {...team, id: TestHelper.generateId()});
        team = await Client4.createTeam(team);

        nock(Client4.getBaseRoute()).
            get('/teams').
            query(true).
            reply(200, [team]);
        await Actions.getTeams()(store.dispatch, store.getState);

        const teamsRequest = store.getState().requests.teams.getTeams;
        const {teams} = store.getState().entities.teams;

        if (teamsRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(teamsRequest.error));
        }

        expect(Object.keys(teams).length > 0).toBeTruthy();
    });

    it('getTeams with total count', async () => {
        let team = {...TestHelper.fakeTeam(), allow_open_invite: true};

        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, {...team, id: TestHelper.generateId()});
        team = await Client4.createTeam(team);

        nock(Client4.getBaseRoute()).
            get('/teams').
            query(true).
            reply(200, {teams: [team], total_count: 43});
        await Actions.getTeams(0, 1, true)(store.dispatch, store.getState);

        const teamsRequest = store.getState().requests.teams.getTeams;
        const {teams, totalCount} = store.getState().entities.teams;

        if (teamsRequest.status === RequestStatus.FAILURE!) {
            throw new Error(JSON.stringify(teamsRequest.error));
        }

        expect(Object.keys(teams).length > 0).toBeTruthy();
        expect(totalCount).toEqual(43);
    });

    it('getTeam', async () => {
        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());
        const team = await Client4.createTeam(TestHelper.fakeTeam());

        nock(Client4.getBaseRoute()).
            get(`/teams/${team.id}`).
            reply(200, team);
        await Actions.getTeam(team.id)(store.dispatch, store.getState);

        const state = store.getState();
        const {teams} = state.entities.teams;

        expect(teams).toBeTruthy();
        expect(teams[team.id]).toBeTruthy();
    });

    it('getTeamByName', async () => {
        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());
        const team = await Client4.createTeam(TestHelper.fakeTeam());

        nock(Client4.getBaseRoute()).
            get(`/teams/name/${team.name}`).
            reply(200, team);
        await Actions.getTeamByName(team.name)(store.dispatch, store.getState);

        const state = store.getState();
        const {teams} = state.entities.teams;

        expect(teams).toBeTruthy();
        expect(teams[team.id]).toBeTruthy();
    });

    it('createTeam', async () => {
        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());
        await Actions.createTeam(
            TestHelper.fakeTeam(),
        )(store.dispatch, store.getState);

        const {teams, myMembers, currentTeamId} = store.getState().entities.teams;

        const teamId = Object.keys(teams)[0];
        expect(Object.keys(teams).length).toEqual(1);
        expect(currentTeamId).toEqual(teamId);
        expect(myMembers[teamId]).toBeTruthy();
    });

    it('deleteTeam', async () => {
        const secondClient = TestHelper.createClient4();

        nock(Client4.getBaseRoute()).
            post('/users').
            query(true).
            reply(201, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(
            TestHelper.fakeUser(),
            '',
            '',
            TestHelper.basicTeam!.invite_id,
        );

        nock(Client4.getBaseRoute()).
            post('/users/login').
            reply(200, user);
        await secondClient.login(user.email, 'password1');

        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());
        const secondTeam = await secondClient.createTeam(
            TestHelper.fakeTeam());

        nock(Client4.getBaseRoute()).
            delete(`/teams/${secondTeam.id}`).
            reply(200, OK_RESPONSE);

        await Actions.deleteTeam(
            secondTeam.id,
        )(store.dispatch, store.getState);

        const {teams, myMembers} = store.getState().entities.teams;
        if (teams[secondTeam.id]) {
            throw new Error('unexpected teams[secondTeam.id]');
        }
        if (myMembers[secondTeam.id]) {
            throw new Error('unexpected myMembers[secondTeam.id]');
        }
    });

    it('unarchiveTeam', async () => {
        const secondClient = TestHelper.createClient4();

        nock(Client4.getBaseRoute()).
            post('/users').
            query(true).
            reply(201, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(
            TestHelper.fakeUser(),
            '',
            '',
            TestHelper.basicTeam!.invite_id,
        );

        nock(Client4.getBaseRoute()).
            post('/users/login').
            reply(200, user);
        await secondClient.login(user.email, 'password1');

        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());
        const secondTeam = await secondClient.createTeam(
            TestHelper.fakeTeam());

        nock(Client4.getBaseRoute()).
            delete(`/teams/${secondTeam.id}`).
            reply(200, OK_RESPONSE);

        await Actions.deleteTeam(
            secondTeam.id,
        )(store.dispatch, store.getState);

        nock(Client4.getBaseRoute()).
            post(`/teams/${secondTeam.id}/restore`).
            reply(200, secondTeam);

        await Actions.unarchiveTeam(
            secondTeam.id,
        )(store.dispatch, store.getState);

        const {teams} = store.getState().entities.teams;
        expect(teams[secondTeam.id]).toEqual(secondTeam);
    });

    it('updateTeam', async () => {
        const displayName = 'The Updated Team';
        const description = 'This is a team created by unit tests';
        const team = {
            ...TestHelper.basicTeam,
            display_name: displayName,
            description,
        };

        nock(Client4.getBaseRoute()).
            put(`/teams/${team.id}`).
            reply(200, team);
        await Actions.updateTeam(team as Team)(store.dispatch, store.getState);

        const {teams} = store.getState().entities.teams;
        const updated = teams[TestHelper.basicTeam!.id];

        expect(updated).toBeTruthy();
        expect(updated.display_name).toEqual(displayName);
        expect(updated.description).toEqual(description);
    });

    it('patchTeam', async () => {
        const displayName = 'The Patched Team';
        const description = 'This is a team created by unit tests';
        const team = {
            ...TestHelper.basicTeam,
            display_name: displayName,
            description,
        };

        nock(Client4.getBaseRoute()).
            put(`/teams/${team.id}/patch`).
            reply(200, team);
        await Actions.patchTeam(team as Team)(store.dispatch, store.getState);
        const {teams} = store.getState().entities.teams;

        const patched = teams[TestHelper.basicTeam!.id];

        expect(patched).toBeTruthy();
        expect(patched.display_name).toEqual(displayName);
        expect(patched.description).toEqual(description);
    });

    it('regenerateTeamInviteId', async () => {
        const patchedInviteId = TestHelper.generateId();
        const team = TestHelper.basicTeam;
        const patchedTeam = {
            ...team,
            invite_id: patchedInviteId,
        };
        nock(Client4.getBaseRoute()).
            post(`/teams/${team!.id}/regenerate_invite_id`).
            reply(200, patchedTeam);
        await Actions.regenerateTeamInviteId(team!.id)(store.dispatch, store.getState);
        const {teams} = store.getState().entities.teams;

        const patched = teams[TestHelper.basicTeam!.id];

        expect(patched).toBeTruthy();
        expect(patched.invite_id).not.toEqual(team!.invite_id);
        expect(patched.invite_id).toEqual(patchedInviteId);
    });

    it('Join Open Team', async () => {
        const client = TestHelper.createClient4();

        nock(Client4.getBaseRoute()).
            post('/users').
            query(true).
            reply(201, TestHelper.fakeUserWithId());
        const user = await client.createUser(
            TestHelper.fakeUser(),
            '',
            '',
            TestHelper.basicTeam!.invite_id,
        );

        nock(Client4.getBaseRoute()).
            post('/users/login').
            reply(200, user);
        await client.login(user.email, 'password1');

        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, {...TestHelper.fakeTeamWithId(), allow_open_invite: true});
        const team = await client.createTeam({...TestHelper.fakeTeam(), allow_open_invite: true});

        store.dispatch({type: GeneralTypes.RECEIVED_SERVER_VERSION, data: '4.0.0'});

        nock(Client4.getBaseRoute()).
            post('/teams/members/invite').
            query(true).
            reply(201, {user_id: TestHelper.basicUser!.id, team_id: team.id});

        nock(Client4.getBaseRoute()).
            get(`/teams/${team.id}`).
            reply(200, team);

        nock(Client4.getUserRoute('me')).
            get('/teams/members').
            reply(200, [{user_id: TestHelper.basicUser!.id, roles: 'team_user', team_id: team.id}]);

        nock(Client4.getUserRoute('me')).
            get('/teams/unread').
            query({params: {include_collapsed_threads: true}}).
            reply(200, [{team_id: team.id, msg_count: 0, mention_count: 0}]);

        await Actions.joinTeam(team.invite_id, team.id)(store.dispatch, store.getState);

        const state = store.getState();

        const request = state.requests.teams.joinTeam;

        if (request.status !== RequestStatus.SUCCESS) {
            throw new Error(JSON.stringify(request.error));
        }

        const {teams, myMembers} = state.entities.teams;
        expect(teams[team.id]).toBeTruthy();
        expect(myMembers[team.id]).toBeTruthy();
    });

    it('getMyTeamMembers and getMyTeamUnreads', async () => {
        nock(Client4.getUserRoute('me')).
            get('/teams/members').
            reply(200, [{user_id: TestHelper.basicUser!.id, roles: 'team_user', team_id: TestHelper.basicTeam!.id}]);
        await Actions.getMyTeamMembers()(store.dispatch, store.getState);

        nock(Client4.getUserRoute('me')).
            get('/teams/unread').
            query({params: {include_collapsed_threads: true}}).
            reply(200, [{team_id: TestHelper.basicTeam!.id, msg_count: 0, mention_count: 0}]);
        await Actions.getMyTeamUnreads(false)(store.dispatch, store.getState);

        const members = store.getState().entities.teams.myMembers;
        const member = members[TestHelper.basicTeam!.id];

        expect(member).toBeTruthy();
        expect(Object.prototype.hasOwnProperty.call(member, 'mention_count')).toBeTruthy();
    });

    it('getTeamMembersForUser', async () => {
        nock(Client4.getUserRoute(TestHelper.basicUser!.id)).
            get('/teams/members').
            reply(200, [{user_id: TestHelper.basicUser!.id, team_id: TestHelper.basicTeam!.id}]);
        await Actions.getTeamMembersForUser(TestHelper.basicUser!.id)(store.dispatch, store.getState);

        const membersInTeam = store.getState().entities.teams.membersInTeam;

        expect(membersInTeam).toBeTruthy();
        expect(membersInTeam[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(membersInTeam[TestHelper.basicTeam!.id][TestHelper.basicUser!.id]).toBeTruthy();
    });

    it('getTeamMember', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            query(true).
            reply(201, TestHelper.fakeUserWithId());
        const user = await TestHelper.basicClient4!.createUser(
            TestHelper.fakeUser(),
            '',
            '',
            TestHelper.basicTeam!.invite_id,
        );

        nock(Client4.getBaseRoute()).
            get(`/teams/${TestHelper.basicTeam!.id}/members/${user.id}`).
            reply(200, {user_id: user.id, team_id: TestHelper.basicTeam!.id});
        await Actions.getTeamMember(TestHelper.basicTeam!.id, user.id)(store.dispatch, store.getState);

        const members = store.getState().entities.teams.membersInTeam;

        expect(members[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(members[TestHelper.basicTeam!.id][user.id]).toBeTruthy();
    });

    it('getTeamMembers', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(201, TestHelper.fakeUserWithId());
        const user1 = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getBaseRoute()).
            post('/users').
            reply(201, TestHelper.fakeUserWithId());
        const user2 = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getTeamRoute(TestHelper.basicTeam!.id)).
            post('/members').
            reply(201, {user_id: user1.id, team_id: TestHelper.basicTeam!.id});
        const {data: member1} = await Actions.addUserToTeam(TestHelper.basicTeam!.id, user1.id)(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getTeamRoute(TestHelper.basicTeam!.id)).
            post('/members').
            reply(201, {user_id: user2.id, team_id: TestHelper.basicTeam!.id});
        const {data: member2} = await Actions.addUserToTeam(TestHelper.basicTeam!.id, user2.id)(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            get(`/teams/${TestHelper.basicTeam!.id}/members`).
            query(true).
            reply(200, [member1, member2, TestHelper.basicTeamMember]);
        await Actions.getTeamMembers(TestHelper.basicTeam!.id, undefined, undefined, {})(store.dispatch, store.getState);
        const membersInTeam = store.getState().entities.teams.membersInTeam;

        expect(membersInTeam[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(membersInTeam[TestHelper.basicTeam!.id][TestHelper.basicUser!.id]).toBeTruthy();
        expect(membersInTeam[TestHelper.basicTeam!.id][user1.id]).toBeTruthy();
        expect(membersInTeam[TestHelper.basicTeam!.id][user2.id]).toBeTruthy();
    });

    it('getTeamMembersByIds', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            query(true).
            reply(201, TestHelper.fakeUserWithId());
        const user1 = await TestHelper.basicClient4!.createUser(
            TestHelper.fakeUser(),
            '',
            '',
            TestHelper.basicTeam!.invite_id,
        );

        nock(Client4.getBaseRoute()).
            post('/users').
            query(true).
            reply(201, TestHelper.fakeUserWithId());
        const user2 = await TestHelper.basicClient4!.createUser(
            TestHelper.fakeUser(),
            '',
            '',
            TestHelper.basicTeam!.invite_id,
        );

        nock(Client4.getBaseRoute()).
            post(`/teams/${TestHelper.basicTeam!.id}/members/ids`).
            reply(200, [{user_id: user1.id, team_id: TestHelper.basicTeam!.id}, {user_id: user2.id, team_id: TestHelper.basicTeam!.id}]);
        await Actions.getTeamMembersByIds(
            TestHelper.basicTeam!.id,
            [user1.id, user2.id],
        )(store.dispatch, store.getState);

        const members = store.getState().entities.teams.membersInTeam;

        expect(members[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(members[TestHelper.basicTeam!.id][user1.id]).toBeTruthy();
        expect(members[TestHelper.basicTeam!.id][user2.id]).toBeTruthy();
    });

    it('getTeamStats', async () => {
        nock(Client4.getTeamRoute(TestHelper.basicTeam!.id)).
            get('/stats').
            reply(200, {team_id: TestHelper.basicTeam!.id, total_member_count: 2605, active_member_count: 2571});
        await Actions.getTeamStats(TestHelper.basicTeam!.id)(store.dispatch, store.getState);

        const {stats} = store.getState().entities.teams;

        const stat = stats[TestHelper.basicTeam!.id];
        expect(stat).toBeTruthy();

        expect(stat.total_member_count > 1).toBeTruthy();
        expect(stat.active_member_count > 1).toBeTruthy();
    });

    it('addUserToTeam', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(201, TestHelper.fakeUserWithId());
        const user = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getTeamRoute(TestHelper.basicTeam!.id)).
            post('/members').
            reply(201, {user_id: user.id, team_id: TestHelper.basicTeam!.id});
        await Actions.addUserToTeam(TestHelper.basicTeam!.id, user.id)(store.dispatch, store.getState);
        const members = store.getState().entities.teams.membersInTeam;

        expect(members[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(members[TestHelper.basicTeam!.id][user.id]).toBeTruthy();
    });

    it('addUsersToTeam', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(201, TestHelper.fakeUserWithId());
        const user = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getBaseRoute()).
            post('/users').
            reply(201, TestHelper.fakeUserWithId());
        const user2 = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getTeamRoute(TestHelper.basicTeam!.id)).
            post('/members/batch').
            reply(201, [{user_id: user.id, team_id: TestHelper.basicTeam!.id}, {user_id: user2.id, team_id: TestHelper.basicTeam!.id}]);
        await Actions.addUsersToTeam(TestHelper.basicTeam!.id, [user.id, user2.id])(store.dispatch, store.getState);

        const members = store.getState().entities.teams.membersInTeam;
        const profilesInTeam = store.getState().entities.users.profilesInTeam;

        expect(members[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(members[TestHelper.basicTeam!.id][user.id]).toBeTruthy();
        expect(members[TestHelper.basicTeam!.id][user2.id]).toBeTruthy();
        expect(profilesInTeam[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(profilesInTeam[TestHelper.basicTeam!.id].has(user.id)).toBeTruthy();
        expect(profilesInTeam[TestHelper.basicTeam!.id].has(user2.id)).toBeTruthy();
    });

    describe('removeUserFromTeam', () => {
        const team = {id: 'team'};
        const user = {id: 'user'};

        test('should remove the user from the team', async () => {
            store = configureStore({
                entities: {
                    teams: {
                        membersInTeam: {
                            [team.id]: {
                                [user.id]: {},
                            },
                        },
                    },
                    users: {
                        currentUserId: '',
                        profilesInTeam: {
                            [team.id]: [user.id],
                        },
                        profilesNotInTeam: {
                            [team.id]: [],
                        },
                    },
                },
            });

            nock(Client4.getBaseRoute()).
                delete(`/teams/${team.id}/members/${user.id}`).
                reply(200, OK_RESPONSE);
            await store.dispatch(Actions.removeUserFromTeam(team.id, user.id));

            const state = store.getState();
            expect(state.entities.teams.membersInTeam[team.id]).toEqual({});
            expect(state.entities.users.profilesInTeam[team.id]).toEqual(new Set());
            expect(state.entities.users.profilesNotInTeam[team.id]).toEqual(new Set([user.id]));
        });

        test('should leave all channels when leaving a team', async () => {
            const channel1 = {id: 'channel1', team_id: team.id};
            const channel2 = {id: 'channel2', team_id: 'team2'};

            store = configureStore({
                entities: {
                    channels: {
                        channels: {
                            [channel1.id]: channel1,
                            [channel2.id]: channel2,
                        },
                        myMembers: {
                            [channel1.id]: {user_id: user.id, channel_id: channel1.id},
                            [channel2.id]: {user_id: user.id, channel_id: channel2.id},
                        },
                    },
                    users: {
                        currentUserId: user.id,
                    },
                },
            });

            nock(Client4.getBaseRoute()).
                delete(`/teams/${team.id}/members/${user.id}`).
                reply(200, OK_RESPONSE);
            await store.dispatch(Actions.removeUserFromTeam(team.id, user.id));

            const state = store.getState();
            expect(state.entities.channels.myMembers[channel1.id]).toBeFalsy();
            expect(state.entities.channels.myMembers[channel2.id]).toBeTruthy();
        });

        test('should clear the current channel when leaving a team', async () => {
            const channel = {id: 'channel'};

            store = configureStore({
                entities: {
                    channels: {
                        channels: {
                            [channel.id]: channel,
                        },
                        myMembers: {},
                    },
                    users: {
                        currentUserId: user.id,
                    },
                },
            });

            nock(Client4.getBaseRoute()).
                delete(`/teams/${team.id}/members/${user.id}`).
                reply(200, OK_RESPONSE);
            await store.dispatch(Actions.removeUserFromTeam(team.id, user.id));

            const state = store.getState();
            expect(state.entities.channels.currentChannelId).toBe('');
        });
    });

    it('updateTeamMemberRoles', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(201, TestHelper.fakeUserWithId());
        const user = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getTeamRoute(TestHelper.basicTeam!.id)).
            post('/members').
            reply(201, {user_id: user.id, team_id: TestHelper.basicTeam!.id});
        await Actions.addUserToTeam(TestHelper.basicTeam!.id, user.id)(store.dispatch, store.getState);

        const roles = General.TEAM_USER_ROLE + ' ' + General.TEAM_ADMIN_ROLE;

        nock(Client4.getBaseRoute()).
            put(`/teams/${TestHelper.basicTeam!.id}/members/${user.id}/roles`).
            reply(200, {user_id: user.id, team_id: TestHelper.basicTeam!.id, roles});
        await Actions.updateTeamMemberRoles(TestHelper.basicTeam!.id, user.id, roles.split(' '))(store.dispatch, store.getState);

        const members = store.getState().entities.teams.membersInTeam;

        expect(members[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(members[TestHelper.basicTeam!.id][user.id]).toBeTruthy();
        expect(members[TestHelper.basicTeam!.id][user.id].roles).toEqual(roles.split(' '));
    });

    it('sendEmailInvitesToTeam', async () => {
        nock(Client4.getTeamRoute(TestHelper.basicTeam!.id)).
            post('/invite/email').
            reply(200, OK_RESPONSE);
        const {data} = await Actions.sendEmailInvitesToTeam(TestHelper.basicTeam!.id, ['fakeemail1@example.com', 'fakeemail2@example.com'])(store.dispatch, store.getState) as ActionResult;
        expect(data).toEqual(OK_RESPONSE);
    });

    it('checkIfTeamExists', async () => {
        nock(Client4.getBaseRoute()).
            get(`/teams/name/${TestHelper.basicTeam!.name}/exists`).
            reply(200, {exists: true});

        let {data: exists} = await Actions.checkIfTeamExists(TestHelper.basicTeam!.name)(store.dispatch, store.getState) as ActionResult;

        expect(exists === true).toBeTruthy();

        nock(Client4.getBaseRoute()).
            get('/teams/name/junk/exists').
            reply(200, {exists: false});
        const {data} = await Actions.checkIfTeamExists('junk')(store.dispatch, store.getState) as ActionResult;
        exists = data;

        expect(exists === false).toBeTruthy();
    });

    it('setTeamIcon', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await loadMeREST()(store.dispatch, store.getState);

        const team = TestHelper.basicTeam;
        const imageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getTeamRoute(team!.id)).
            post('/image').
            reply(200, OK_RESPONSE);

        const {data} = await Actions.setTeamIcon(team!.id, imageData as any)(store.dispatch, store.getState) as ActionResult;
        expect(data).toEqual(OK_RESPONSE);
    });

    it('removeTeamIcon', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await loadMeREST()(store.dispatch, store.getState);

        const team = TestHelper.basicTeam;

        nock(Client4.getTeamRoute(team!.id)).
            delete('/image').
            reply(200, OK_RESPONSE);

        const {data} = await Actions.removeTeamIcon(team!.id)(store.dispatch, store.getState) as ActionResult;
        expect(data).toEqual(OK_RESPONSE);
    });

    it('updateTeamScheme', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await loadMeREST()(store.dispatch, store.getState);

        const schemeId = 'xxxxxxxxxxxxxxxxxxxxxxxxxx';
        const {id} = TestHelper.basicTeam!;

        nock(Client4.getBaseRoute()).
            put('/teams/' + id + '/scheme').
            reply(200, OK_RESPONSE);

        await Actions.updateTeamScheme(id, schemeId)(store.dispatch, store.getState);

        const state = store.getState!();
        const {teams} = state.entities.teams;

        const updated = teams[id];
        expect(updated).toBeTruthy();
        expect(updated.scheme_id).toEqual(schemeId);
    });

    it('membersMinusGroupMembers', async () => {
        const teamID = 'tid10000000000000000000000';
        const groupIDs = ['gid10000000000000000000000', 'gid20000000000000000000000'];
        const page = 4;
        const perPage = 63;

        nock(Client4.getBaseRoute()).get(
            `/teams/${teamID}/members_minus_group_members?group_ids=${groupIDs.join(',')}&page=${page}&per_page=${perPage}`).
            reply(200, {users: [], total_count: 0});

        const {error} = await Actions.membersMinusGroupMembers(teamID, groupIDs, page, perPage)(store.dispatch, store.getState) as ActionResult;

        expect(error).toEqual(undefined);
    });

    it('searchTeams', async () => {
        const userClient = TestHelper.createClient4();

        nock(Client4.getBaseRoute()).
            post('/users').
            query(true).
            reply(201, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(
            TestHelper.fakeUser(),
            '',
            '',
            TestHelper.basicTeam!.invite_id,
        );

        nock(Client4.getBaseRoute()).
            post('/users/login').
            reply(200, user);

        await userClient.login(user.email, 'password1');

        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());

        const userTeam = await userClient.createTeam(
            TestHelper.fakeTeam(),
        );

        nock(Client4.getBaseRoute()).
            post('/teams/search').
            reply(200, [TestHelper.basicTeam, userTeam]);

        await store.dispatch(Actions.searchTeams('test', {page: 0}));

        const moreRequest = store.getState().requests.teams.getTeams;
        if (moreRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(moreRequest.error));
        }

        nock(Client4.getBaseRoute()).
            post('/teams/search').
            reply(200, {teams: [TestHelper.basicTeam, userTeam], total_count: 2});

        const response = await store.dispatch(Actions.searchTeams('test', {page: 0, per_page: 1}));

        const paginatedRequest = store.getState().requests.teams.getTeams;
        if (paginatedRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(paginatedRequest.error));
        }

        expect(response.data.teams.length === 2).toBeTruthy();
    });
});
