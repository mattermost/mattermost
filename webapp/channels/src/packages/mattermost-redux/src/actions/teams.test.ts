// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import nock from 'nock';

import type {Team} from '@mattermost/types/teams';

import {UserTypes} from 'mattermost-redux/action_types';
import * as Actions from 'mattermost-redux/actions/teams';
import {loadMe} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {RequestStatus} from 'mattermost-redux/constants';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

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
        await store.dispatch(loadMe());

        nock(Client4.getBaseRoute()).
            get('/users/me/teams').
            reply(200, [TestHelper.basicTeam]);
        await store.dispatch(Actions.getMyTeams());

        const {teams} = store.getState().entities.teams;

        expect(teams).toBeTruthy();
        expect(teams[TestHelper.basicTeam!.id]).toBeTruthy();
    });

    it('getTeamsForUser', async () => {
        nock(Client4.getBaseRoute()).
            get(`/users/${TestHelper.basicUser!.id}/teams`).
            reply(200, [TestHelper.basicTeam]);

        await store.dispatch(Actions.getTeamsForUser(TestHelper.basicUser!.id));

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
        await store.dispatch(Actions.getTeams());

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
        await store.dispatch(Actions.getTeams(0, 1, true));

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
        await store.dispatch(Actions.getTeam(team.id));

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
        await store.dispatch(Actions.getTeamByName(team.name));

        const state = store.getState();
        const {teams} = state.entities.teams;

        expect(teams).toBeTruthy();
        expect(teams[team.id]).toBeTruthy();
    });

    it('createTeam', async () => {
        nock(Client4.getBaseRoute()).
            post('/teams').
            reply(201, TestHelper.fakeTeamWithId());
        await store.dispatch(Actions.createTeam(
            TestHelper.fakeTeam(),
        ));

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

        await store.dispatch(Actions.deleteTeam(
            secondTeam.id,
        ));

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

        await store.dispatch(Actions.deleteTeam(
            secondTeam.id,
        ));

        nock(Client4.getBaseRoute()).
            post(`/teams/${secondTeam.id}/restore`).
            reply(200, secondTeam);

        await store.dispatch(Actions.unarchiveTeam(
            secondTeam.id,
        ));

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
        await store.dispatch(Actions.updateTeam(team as Team));

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
        await store.dispatch(Actions.patchTeam(team as Team));
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
        await store.dispatch(Actions.regenerateTeamInviteId(team!.id));
        const {teams} = store.getState().entities.teams;

        const patched = teams[TestHelper.basicTeam!.id];

        expect(patched).toBeTruthy();
        expect(patched.invite_id).not.toEqual(team!.invite_id);
        expect(patched.invite_id).toEqual(patchedInviteId);
    });

    it('getMyTeamMembers and getMyTeamUnreads', async () => {
        nock(Client4.getUserRoute('me')).
            get('/teams/members').
            reply(200, [{user_id: TestHelper.basicUser!.id, roles: 'team_user', team_id: TestHelper.basicTeam!.id}]);
        await store.dispatch(Actions.getMyTeamMembers());

        nock(Client4.getUserRoute('me')).
            get('/teams/unread').
            query({params: {include_collapsed_threads: true}}).
            reply(200, [{team_id: TestHelper.basicTeam!.id, msg_count: 0, mention_count: 0}]);
        await store.dispatch(Actions.getMyTeamUnreads(false));

        const members = store.getState().entities.teams.myMembers;
        const member = members[TestHelper.basicTeam!.id];

        expect(member).toBeTruthy();
        expect(Object.hasOwn(member, 'mention_count')).toBeTruthy();
    });

    it('getTeamMembersForUser', async () => {
        nock(Client4.getUserRoute(TestHelper.basicUser!.id)).
            get('/teams/members').
            reply(200, [{user_id: TestHelper.basicUser!.id, team_id: TestHelper.basicTeam!.id}]);
        await store.dispatch(Actions.getTeamMembersForUser(TestHelper.basicUser!.id));

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
        await store.dispatch(Actions.getTeamMember(TestHelper.basicTeam!.id, user.id));

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
        const {data: member1} = await store.dispatch(Actions.addUserToTeam(TestHelper.basicTeam!.id, user1.id));

        nock(Client4.getTeamRoute(TestHelper.basicTeam!.id)).
            post('/members').
            reply(201, {user_id: user2.id, team_id: TestHelper.basicTeam!.id});
        const {data: member2} = await store.dispatch(Actions.addUserToTeam(TestHelper.basicTeam!.id, user2.id));

        nock(Client4.getBaseRoute()).
            get(`/teams/${TestHelper.basicTeam!.id}/members`).
            query(true).
            reply(200, [member1, member2, TestHelper.basicTeamMember]);
        await store.dispatch(Actions.getTeamMembers(TestHelper.basicTeam!.id, undefined, undefined, {}));
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
        await store.dispatch(Actions.getTeamMembersByIds(
            TestHelper.basicTeam!.id,
            [user1.id, user2.id],
        ));

        const members = store.getState().entities.teams.membersInTeam;

        expect(members[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(members[TestHelper.basicTeam!.id][user1.id]).toBeTruthy();
        expect(members[TestHelper.basicTeam!.id][user2.id]).toBeTruthy();
    });

    it('getTeamStats', async () => {
        nock(Client4.getTeamRoute(TestHelper.basicTeam!.id)).
            get('/stats').
            reply(200, {team_id: TestHelper.basicTeam!.id, total_member_count: 2605, active_member_count: 2571});
        await store.dispatch(Actions.getTeamStats(TestHelper.basicTeam!.id));

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
        await store.dispatch(Actions.addUserToTeam(TestHelper.basicTeam!.id, user.id));
        const members = store.getState().entities.teams.membersInTeam;

        expect(members[TestHelper.basicTeam!.id]).toBeTruthy();
        expect(members[TestHelper.basicTeam!.id][user.id]).toBeTruthy();
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

    it('sendEmailInvitesToTeam', async () => {
        nock(Client4.getTeamRoute(TestHelper.basicTeam!.id)).
            post('/invite/email').
            reply(200, OK_RESPONSE);
        const {data} = await store.dispatch(Actions.sendEmailInvitesToTeam(TestHelper.basicTeam!.id, ['fakeemail1@example.com', 'fakeemail2@example.com']));
        expect(data).toEqual(OK_RESPONSE);
    });

    it('checkIfTeamExists', async () => {
        nock(Client4.getBaseRoute()).
            get(`/teams/name/${TestHelper.basicTeam!.name}/exists`).
            reply(200, {exists: true});

        let {data: exists} = await store.dispatch(Actions.checkIfTeamExists(TestHelper.basicTeam!.name));

        expect(exists === true).toBeTruthy();

        nock(Client4.getBaseRoute()).
            get('/teams/name/junk/exists').
            reply(200, {exists: false});
        const {data} = await store.dispatch(Actions.checkIfTeamExists('junk'));
        exists = data;

        expect(exists === false).toBeTruthy();
    });

    it('setTeamIcon', async () => {
        const team = {id: 'teamId', invite_id: ''};
        store = configureStore({
            entities: {
                teams: {
                    teams: {
                        [team!.id]: {...team},
                    },
                },
            },
        });

        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await store.dispatch(loadMe());

        let state = store.getState();
        expect(state.entities.teams.teams[team!.id].invite_id).toEqual('');

        const imageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');

        nock(Client4.getTeamRoute(team!.id)).
            post('/image').
            reply(200, OK_RESPONSE);

        nock(Client4.getTeamRoute(team!.id)).
            get('').
            reply(200, {...team, invite_id: 'inviteId'});

        const {data} = await store.dispatch(Actions.setTeamIcon(team!.id, imageData as any));
        expect(data).toEqual(OK_RESPONSE);

        state = store.getState();
        expect(state.entities.teams.teams[team!.id].invite_id).toEqual('inviteId');
    });

    it('removeTeamIcon', async () => {
        const team = {id: 'teamId', invite_id: ''};
        store = configureStore({
            entities: {
                teams: {
                    teams: {
                        [team!.id]: {...team},
                    },
                },
            },
        });

        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await store.dispatch(loadMe());

        let state = store.getState();
        expect(state.entities.teams.teams[team!.id].invite_id).toEqual('');

        nock(Client4.getTeamRoute(team!.id)).
            delete('/image').
            reply(200, OK_RESPONSE);

        nock(Client4.getTeamRoute(team!.id)).
            get('').
            reply(200, {...team, invite_id: 'inviteId'});

        const {data} = await store.dispatch(Actions.removeTeamIcon(team!.id));
        expect(data).toEqual(OK_RESPONSE);

        state = store.getState();
        expect(state.entities.teams.teams[team!.id].invite_id).toEqual('inviteId');
    });

    it('updateTeamScheme', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await store.dispatch(loadMe());

        const schemeId = 'xxxxxxxxxxxxxxxxxxxxxxxxxx';
        const {id} = TestHelper.basicTeam!;

        nock(Client4.getBaseRoute()).
            put('/teams/' + id + '/scheme').
            reply(200, OK_RESPONSE);

        await store.dispatch(Actions.updateTeamScheme(id, schemeId));

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

        const {error} = await store.dispatch(Actions.membersMinusGroupMembers(teamID, groupIDs, page, perPage));

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

        await store.dispatch(Actions.searchTeams('test', {page: 0, per_page: 1}));

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
