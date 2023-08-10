// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import nock from 'nock';

import {UserTypes} from 'mattermost-redux/action_types';
import * as Actions from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';
import {RequestStatus} from '../constants';

import type {UserProfile} from '@mattermost/types/users';
import type {ActionResult} from 'mattermost-redux/types/actions';

const OK_RESPONSE = {status: 'OK'};

describe('Actions.Users', () => {
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

        Client4.setUserId('');
        Client4.setUserRoles('');
    });

    afterEach(() => {
        nock.cleanAll();
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('createUser', async () => {
        const userToCreate = TestHelper.fakeUser();
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(201, {...userToCreate, id: TestHelper.generateId()});

        const {data: user} = await Actions.createUser(userToCreate, '', '', '')(store.dispatch, store.getState) as ActionResult;

        const state = store.getState();
        const {profiles} = state.entities.users;

        expect(profiles).toBeTruthy();
        expect(profiles[user.id]).toBeTruthy();
    });

    it('getTermsOfService', async () => {
        const response = {
            create_at: 1537976679426,
            id: '1234',
            text: 'Terms of Service',
            user_id: '1',
        };

        nock(Client4.getBaseRoute()).
            get('/terms_of_service').
            reply(200, response);

        const {data} = await Actions.getTermsOfService()(store.dispatch, store.getState) as ActionResult;

        expect(data).toEqual(response);
    });

    it('updateMyTermsOfServiceStatus accept terms', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(201, {...TestHelper.fakeUserWithId()});

        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        nock(Client4.getBaseRoute()).
            post('/users/me/terms_of_service').
            reply(200, OK_RESPONSE);

        await Actions.updateMyTermsOfServiceStatus('1', true)(store.dispatch, store.getState);

        const {currentUserId} = store.getState().entities.users;
        const currentUser = store.getState().entities.users.profiles[currentUserId];

        expect(currentUserId).toBeTruthy();
        expect(currentUser.terms_of_service_id).toBeTruthy();
        expect(currentUser.terms_of_service_create_at).toBeTruthy();
        expect(currentUser.terms_of_service_id).toEqual('1');
    });

    it('updateMyTermsOfServiceStatus reject terms', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(201, {...TestHelper.fakeUserWithId()});

        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        nock(Client4.getBaseRoute()).
            post('/users/me/terms_of_service').
            reply(200, OK_RESPONSE);

        await Actions.updateMyTermsOfServiceStatus('1', false)(store.dispatch, store.getState);

        const {currentUserId, myAcceptedTermsOfServiceId} = store.getState().entities.users;

        expect(currentUserId).toBeTruthy();
        expect(myAcceptedTermsOfServiceId).not.toEqual('1');
    });

    it('logout', async () => {
        nock(Client4.getBaseRoute()).
            post('/users/logout').
            reply(200, OK_RESPONSE);

        await Actions.logout()(store.dispatch, store.getState);

        const state = store.getState();
        const logoutRequest = state.requests.users.logout;
        const general = state.entities.general;
        const users = state.entities.users;
        const teams = state.entities.teams;
        const channels = state.entities.channels;
        const posts = state.entities.posts;
        const preferences = state.entities.preferences;

        if (logoutRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(logoutRequest.error));
        }

        // config not empty
        expect(general.config).toEqual({});

        // license not empty
        expect(general.license).toEqual({});

        // current user id not empty
        expect(users.currentUserId).toEqual('');

        // user sessions not empty
        expect(users.mySessions).toEqual([]);

        // user audits not empty
        expect(users.myAudits).toEqual([]);

        // user profiles not empty
        expect(users.profiles).toEqual({});

        // users profiles in team not empty
        expect(users.profilesInTeam).toEqual({});

        // users profiles in channel not empty
        expect(users.profilesInChannel).toEqual({});

        // users profiles NOT in channel not empty
        expect(users.profilesNotInChannel).toEqual({});

        // users statuses not empty
        expect(users.statuses).toEqual({});

        // current team id is not empty
        expect(teams.currentTeamId).toEqual('');

        // teams is not empty
        expect(teams.teams).toEqual({});

        // team members is not empty
        expect(teams.myMembers).toEqual({});

        // members in team is not empty
        expect(teams.membersInTeam).toEqual({});

        // team stats is not empty
        expect(teams.stats).toEqual({});

        // current channel id is not empty
        expect(channels.currentChannelId).toEqual('');

        // channels is not empty
        expect(channels.channels).toEqual({});

        // channelsInTeam is not empty
        expect(channels.channelsInTeam).toEqual({});

        // channel members is not empty
        expect(channels.myMembers).toEqual({});

        // channel stats is not empty
        expect(channels.stats).toEqual({});

        // selected post id is not empty
        expect(posts.selectedPostId).toEqual('');

        // current focused post id is not empty
        expect(posts.currentFocusedPostId).toEqual('');

        // posts is not empty
        expect(posts.posts).toEqual({});

        // posts by channel is not empty
        expect(posts.postsInChannel).toEqual({});

        // user preferences not empty
        expect(preferences.myPreferences).toEqual({});

        nock(Client4.getBaseRoute()).
            post('/users/login').
            reply(200, TestHelper.basicUser!);
        await TestHelper.basicClient4!.login(TestHelper.basicUser!.email, 'password1');
    });

    it('getProfiles', async () => {
        nock(Client4.getBaseRoute()).
            get('/users').
            query(true).
            reply(200, [TestHelper.basicUser]);

        await Actions.getProfiles(0)(store.dispatch, store.getState);
        const {profiles} = store.getState().entities.users;

        expect(Object.keys(profiles).length).toBeTruthy();
    });

    it('getProfilesByIds', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(200, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getBaseRoute()).
            post('/users/ids').
            reply(200, [user]);

        await Actions.getProfilesByIds([user.id])(store.dispatch, store.getState);
        const {profiles} = store.getState().entities.users;

        expect(profiles[user.id]).toBeTruthy();
    });

    it('getMissingProfilesByIds', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(200, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getBaseRoute()).
            post('/users/ids').
            reply(200, [user]);

        await Actions.getMissingProfilesByIds([user.id])(store.dispatch, store.getState);
        const {profiles} = store.getState().entities.users;

        expect(profiles[user.id]).toBeTruthy();
    });

    it('getProfilesByUsernames', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(200, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getBaseRoute()).
            post('/users/usernames').
            reply(200, [user]);

        await Actions.getProfilesByUsernames([user.username])(store.dispatch, store.getState);
        const {profiles} = store.getState().entities.users;

        expect(profiles[user.id]).toBeTruthy();
    });

    it('getProfilesInTeam', async () => {
        nock(Client4.getBaseRoute()).
            get('/users').
            query(true).
            reply(200, [TestHelper.basicUser]);

        await Actions.getProfilesInTeam(TestHelper.basicTeam!.id, 0)(store.dispatch, store.getState);

        const {profilesInTeam, profiles} = store.getState().entities.users;
        const team = profilesInTeam[TestHelper.basicTeam!.id];

        expect(team).toBeTruthy();
        expect(team.has(TestHelper.basicUser!.id)).toBeTruthy();

        // profiles != profiles in team
        expect(Object.keys(profiles).length).toEqual(team.size);
    });

    it('getProfilesNotInTeam', async () => {
        const team = TestHelper.basicTeam;

        nock(Client4.getBaseRoute()).
            post('/users').
            reply(200, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getBaseRoute()).
            get('/users').
            query(true).
            reply(200, [user]);

        await Actions.getProfilesNotInTeam(team!.id, false, 0)(store.dispatch, store.getState);

        const {profilesNotInTeam} = store.getState().entities.users;
        const notInTeam = profilesNotInTeam[team!.id];

        expect(notInTeam).toBeTruthy();
        expect(notInTeam.size > 0).toBeTruthy();
    });

    it('getProfilesWithoutTeam', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(200, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getBaseRoute()).
            get('/users').
            query(true).
            reply(200, [user]);

        await Actions.getProfilesWithoutTeam(0)(store.dispatch, store.getState);
        const {profilesWithoutTeam, profiles} = store.getState().entities.users;

        expect(profilesWithoutTeam).toBeTruthy();
        expect(profilesWithoutTeam.size > 0).toBeTruthy();
        expect(profiles).toBeTruthy();
        expect(Object.keys(profiles).length > 0).toBeTruthy();
    });

    it('getProfilesInChannel', async () => {
        nock(Client4.getBaseRoute()).
            get('/users').
            query(true).
            reply(200, [TestHelper.basicUser]);

        await Actions.getProfilesInChannel(
            TestHelper.basicChannel!.id,
            0,
        )(store.dispatch, store.getState);

        const {profiles, profilesInChannel} = store.getState().entities.users;

        const channel = profilesInChannel[TestHelper.basicChannel!.id];
        expect(channel.has(TestHelper.basicUser!.id)).toBeTruthy();

        // profiles != profiles in channel
        expect(Object.keys(profiles).length).toEqual(channel.size);
    });

    it('getProfilesNotInChannel', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            query(true).
            reply(200, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(
            TestHelper.fakeUser(),
            '',
            '',
            TestHelper.basicTeam!.invite_id,
        );

        nock(Client4.getBaseRoute()).
            get('/users').
            query(true).
            reply(200, [user]);

        await Actions.getProfilesNotInChannel(
            TestHelper.basicTeam!.id,
            TestHelper.basicChannel!.id,
            false,
            0,
        )(store.dispatch, store.getState);

        const {profiles, profilesNotInChannel} = store.getState().entities.users;

        const channel = profilesNotInChannel[TestHelper.basicChannel!.id];
        expect(channel.has(user.id)).toBeTruthy();

        // profiles != profiles in channel
        expect(Object.keys(profiles).length).toEqual(channel.size);
    });

    it('getProfilesInGroup', async () => {
        nock(Client4.getBaseRoute()).
            get('/users').
            query(true).
            reply(200, [TestHelper.basicUser]);

        await Actions.getProfilesInGroup(TestHelper.basicGroup!.id, 0)(store.dispatch, store.getState);

        const {profilesInGroup, profiles} = store.getState().entities.users;
        const group = profilesInGroup[TestHelper.basicGroup!.id];

        expect(group).toBeTruthy();
        expect(group.has(TestHelper.basicUser!.id)).toBeTruthy();

        // profiles != profiles in group
        expect(Object.keys(profiles).length).toEqual(group.size);
    });

    it('getUser', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(200, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getBaseRoute()).
            get(`/users/${user.id}`).
            reply(200, user);

        await Actions.getUser(
            user.id,
        )(store.dispatch, store.getState);

        const state = store.getState();
        const {profiles} = state.entities.users;

        expect(profiles[user.id]).toBeTruthy();
        expect(profiles[user.id].id).toEqual(user.id);
    });

    it('getMe', async () => {
        nock(Client4.getBaseRoute()).
            get('/users/me').
            reply(200, TestHelper.basicUser!);

        await Actions.getMe()(store.dispatch, store.getState);

        const state = store.getState();
        const {profiles, currentUserId} = state.entities.users;

        expect(profiles[currentUserId]).toBeTruthy();
        expect(profiles[currentUserId].id).toEqual(currentUserId);
    });

    it('getUserByUsername', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(200, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getBaseRoute()).
            get(`/users/username/${user.username}`).
            reply(200, user);

        await Actions.getUserByUsername(
            user.username,
        )(store.dispatch, store.getState);

        const state = store.getState();
        const {profiles} = state.entities.users;

        expect(profiles[user.id]).toBeTruthy();
        expect(profiles[user.id].username).toEqual(user.username);
    });

    it('getUserByEmail', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(200, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(TestHelper.fakeUser(), '', '');

        nock(Client4.getBaseRoute()).
            get(`/users/email/${user.email}`).
            reply(200, user);

        await Actions.getUserByEmail(
            user.email,
        )(store.dispatch, store.getState);

        const state = store.getState();
        const {profiles} = state.entities.users;

        expect(profiles[user.id]).toBeTruthy();
        expect(profiles[user.id].email).toEqual(user.email);
    });

    it('searchProfiles', async () => {
        const user = TestHelper.basicUser;

        nock(Client4.getBaseRoute()).
            post('/users/search').
            reply(200, [user]);

        await Actions.searchProfiles(
            user!.username,
        )(store.dispatch, store.getState);

        const state = store.getState();
        const {profiles} = state.entities.users;

        expect(profiles[user!.id]).toBeTruthy();
        expect(profiles[user!.id].id).toEqual(user!.id);
    });

    it('getStatusesByIds', async () => {
        nock(Client4.getBaseRoute()).
            post('/users/status/ids').
            reply(200, [{user_id: TestHelper.basicUser!.id, status: 'online', manual: false, last_activity_at: 1507662212199}]);

        await Actions.getStatusesByIds(
            [TestHelper.basicUser!.id],
        )(store.dispatch, store.getState);

        const statuses = store.getState().entities.users.statuses;

        expect(statuses[TestHelper.basicUser!.id]).toBeTruthy();
        expect(Object.keys(statuses).length).toEqual(1);
    });

    it('getTotalUsersStats', async () => {
        nock(Client4.getBaseRoute()).
            get('/users/stats').
            reply(200, {total_users_count: 2605});
        await Actions.getTotalUsersStats()(store.dispatch, store.getState);

        const {stats} = store.getState().entities.users;

        expect(stats.total_users_count).toEqual(2605);
    });

    it('getStatus', async () => {
        const user = TestHelper.basicUser;

        nock(Client4.getBaseRoute()).
            get(`/users/${user!.id}/status`).
            reply(200, {user_id: user!.id, status: 'online', manual: false, last_activity_at: 1507662212199});

        await Actions.getStatus(
            user!.id,
        )(store.dispatch, store.getState);

        const statuses = store.getState().entities.users.statuses;
        expect(statuses[user!.id]).toBeTruthy();
    });

    it('setStatus', async () => {
        nock(Client4.getBaseRoute()).
            put(`/users/${TestHelper.basicUser!.id}/status`).
            reply(200, OK_RESPONSE);

        await Actions.setStatus(
            {user_id: TestHelper.basicUser!.id, status: 'away'},
        )(store.dispatch, store.getState);

        const statuses = store.getState().entities.users.statuses;
        expect(statuses[TestHelper.basicUser!.id] === 'away').toBeTruthy();
    });

    it('getSessions', async () => {
        nock(Client4.getBaseRoute()).
            get(`/users/${TestHelper.basicUser!.id}/sessions`).
            reply(200, [{id: TestHelper.generateId(), create_at: 1507756921338, expires_at: 1510348921338, last_activity_at: 1507821125630, user_id: TestHelper.basicUser!.id, device_id: '', roles: 'system_admin system_user'}]);

        await Actions.getSessions(TestHelper.basicUser!.id)(store.dispatch, store.getState);

        const sessions = store.getState().entities.users.mySessions;

        expect(sessions.length).toBeTruthy();
        expect(sessions[0].user_id).toEqual(TestHelper.basicUser!.id);
    });

    it('revokeSession', async () => {
        nock(Client4.getBaseRoute()).
            get(`/users/${TestHelper.basicUser!.id}/sessions`).
            reply(200, [{id: TestHelper.generateId(), create_at: 1507756921338, expires_at: 1510348921338, last_activity_at: 1507821125630, user_id: TestHelper.basicUser!.id, device_id: '', roles: 'system_admin system_user'}]);

        await Actions.getSessions(TestHelper.basicUser!.id)(store.dispatch, store.getState);

        let sessions = store.getState().entities.users.mySessions;

        const sessionsLength = sessions.length;

        nock(Client4.getBaseRoute()).
            post(`/users/${TestHelper.basicUser!.id}/sessions/revoke`).
            reply(200, OK_RESPONSE);
        await Actions.revokeSession(TestHelper.basicUser!.id, sessions[0].id)(store.dispatch, store.getState);

        sessions = store.getState().entities.users.mySessions;
        expect(sessions.length === sessionsLength - 1).toBeTruthy();

        nock(Client4.getBaseRoute()).
            post('/users/login').
            reply(200, TestHelper.basicUser!);
        await TestHelper.basicClient4!.login(TestHelper.basicUser!.email, 'password1');
    });

    it('revokeSession and logout', async () => {
        nock(Client4.getBaseRoute()).
            get(`/users/${TestHelper.basicUser!.id}/sessions`).
            reply(200, [{id: TestHelper.generateId(), create_at: 1507756921338, expires_at: 1510348921338, last_activity_at: 1507821125630, user_id: TestHelper.basicUser!.id, device_id: '', roles: 'system_admin system_user'}]);

        await Actions.getSessions(TestHelper.basicUser!.id)(store.dispatch, store.getState);

        const sessions = store.getState().entities.users.mySessions;

        nock(Client4.getBaseRoute()).
            post(`/users/${TestHelper.basicUser!.id}/sessions/revoke`).
            reply(200, OK_RESPONSE);

        const {data: revokeSessionResponse} = await Actions.revokeSession(TestHelper.basicUser!.id, sessions[0].id)(store.dispatch, store.getState) as ActionResult;
        expect(revokeSessionResponse).toBe(true);

        nock(Client4.getBaseRoute()).
            get('/users').
            reply(401, {});

        await Actions.getProfiles(0)(store.dispatch, store.getState);

        const basicUser = TestHelper.basicUser;
        nock(Client4.getBaseRoute()).
            post('/users/login').
            reply(200, basicUser!);
        const response = await TestHelper.basicClient4!.login(TestHelper.basicUser!.email, 'password1');
        expect(response.email).toEqual(basicUser!.email);
    });

    it('revokeAllSessionsForCurrentUser', async () => {
        const user = TestHelper.basicUser;
        nock(Client4.getBaseRoute()).
            post('/users/logout').
            reply(200, OK_RESPONSE);
        await TestHelper.basicClient4!.logout();
        let sessions = store.getState().entities.users.mySessions;

        expect(sessions.length).toBe(0);

        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        nock(Client4.getBaseRoute()).
            post('/users/login').
            reply(200, TestHelper.basicUser!);
        await TestHelper.basicClient4!.login(TestHelper.basicUser!.email, 'password1');

        nock(Client4.getBaseRoute()).
            get(`/users/${user!.id}/sessions`).
            reply(200, [{id: TestHelper.generateId(), create_at: 1507756921338, expires_at: 1510348921338, last_activity_at: 1507821125630, user_id: TestHelper.basicUser!.id, device_id: '', roles: 'system_admin system_user'}, {id: TestHelper.generateId(), create_at: 1507756921338, expires_at: 1510348921338, last_activity_at: 1507821125630, user_id: TestHelper.basicUser!.id, device_id: '', roles: 'system_admin system_user'}]);
        await Actions.getSessions(user!.id)(store.dispatch, store.getState);

        sessions = store.getState().entities.users.mySessions;
        expect(sessions.length > 1).toBeTruthy();

        nock(Client4.getBaseRoute()).
            post(`/users/${user!.id}/sessions/revoke/all`).
            reply(200, OK_RESPONSE);
        const {data} = await Actions.revokeAllSessionsForUser(user!.id)(store.dispatch, store.getState) as ActionResult;
        expect(data).toBe(true);

        nock(Client4.getBaseRoute()).
            get('/users').
            query(true).
            reply(401, {});
        await Actions.getProfiles(0)(store.dispatch, store.getState);

        const logoutRequest = store.getState().requests.users.logout;
        if (logoutRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(logoutRequest.error));
        }

        sessions = store.getState().entities.users.mySessions;

        expect(sessions.length).toBe(0);

        nock(Client4.getBaseRoute()).
            post('/users/login').
            reply(200, TestHelper.basicUser!);
        await TestHelper.basicClient4!.login(TestHelper.basicUser!.email, 'password1');
    });

    it('revokeSessionsForAllUsers', async () => {
        const user = TestHelper.basicUser;
        nock(Client4.getBaseRoute()).
            post('/users/logout').
            reply(200, OK_RESPONSE);
        await TestHelper.basicClient4!.logout();
        let sessions = store.getState().entities.users.mySessions;

        expect(sessions.length).toBe(0);

        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        nock(Client4.getBaseRoute()).
            post('/users/login').
            reply(200, TestHelper.basicUser!);
        await TestHelper.basicClient4!.login(TestHelper.basicUser!.email, 'password1');

        nock(Client4.getBaseRoute()).
            get(`/users/${user!.id}/sessions`).
            reply(200, [{id: TestHelper.generateId(), create_at: 1507756921338, expires_at: 1510348921338, last_activity_at: 1507821125630, user_id: TestHelper.basicUser!.id, device_id: '', roles: 'system_admin system_user'}, {id: TestHelper.generateId(), create_at: 1507756921338, expires_at: 1510348921338, last_activity_at: 1507821125630, user_id: TestHelper.basicUser!.id, device_id: '', roles: 'system_admin system_user'}]);
        await Actions.getSessions(user!.id)(store.dispatch, store.getState);

        sessions = store.getState().entities.users.mySessions;
        expect(sessions.length > 1).toBeTruthy();

        nock(Client4.getBaseRoute()).
            post('/users/sessions/revoke/all').
            reply(200, OK_RESPONSE);
        const {data} = await Actions.revokeSessionsForAllUsers()(store.dispatch, store.getState) as ActionResult;
        expect(data).toBe(true);

        nock(Client4.getBaseRoute()).
            get('/users').
            query(true).
            reply(401, {});
        await Actions.getProfiles(0)(store.dispatch, store.getState);

        const logoutRequest = store.getState().requests.users.logout;
        if (logoutRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(logoutRequest.error));
        }

        sessions = store.getState().entities.users.mySessions;

        expect(sessions.length).toBe(0);

        nock(Client4.getBaseRoute()).
            post('/users/login').
            reply(200, TestHelper.basicUser!);
        await TestHelper.basicClient4!.login(TestHelper.basicUser!.email, 'password1');
    });

    it('getUserAudits', async () => {
        nock(Client4.getBaseRoute()).
            get(`/users/${TestHelper.basicUser!.id}/audits`).
            query(true).
            reply(200, [{id: TestHelper.generateId(), create_at: 1497285546645, user_id: TestHelper.basicUser!.id, action: '/api/v4/users/login', extra_info: 'success', ip_address: '::1', session_id: ''}]);

        await Actions.getUserAudits(TestHelper.basicUser!.id)(store.dispatch, store.getState);

        const audits = store.getState().entities.users.myAudits;

        expect(audits.length).toBeTruthy();
        expect(audits[0].user_id).toEqual(TestHelper.basicUser!.id);
    });

    it('autocompleteUsers', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            query(true).
            reply(200, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(
            TestHelper.fakeUser(),
            '',
            '',
            TestHelper.basicTeam!.invite_id,
        );

        nock(Client4.getBaseRoute()).
            get('/users/autocomplete').
            query(true).
            reply(200, {users: [TestHelper.basicUser], out_of_channel: [user]});

        await Actions.autocompleteUsers(
            '',
            TestHelper.basicTeam!.id,
            TestHelper.basicChannel!.id,
        )(store.dispatch, store.getState);

        const autocompleteRequest = store.getState().requests.users.autocompleteUsers;
        const {profiles, profilesNotInChannel, profilesInChannel} = store.getState().entities.users;

        if (autocompleteRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(autocompleteRequest.error));
        }

        const notInChannel = profilesNotInChannel[TestHelper.basicChannel!.id];
        const inChannel = profilesInChannel[TestHelper.basicChannel!.id];
        expect(notInChannel.has(user.id)).toBeTruthy();
        expect(inChannel.has(TestHelper.basicUser!.id)).toBeTruthy();
        expect(profiles[user.id]).toBeTruthy();
    });

    it('autocompleteUsers without out_of_channel', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            query(true).
            reply(200, TestHelper.fakeUserWithId());

        const user = await TestHelper.basicClient4!.createUser(
            TestHelper.fakeUser(),
            '',
            '',
            TestHelper.basicTeam!.invite_id,
        );

        nock(Client4.getBaseRoute()).
            get('/users/autocomplete').
            query(true).
            reply(200, {users: [user]});

        await Actions.autocompleteUsers(
            '',
            TestHelper.basicTeam!.id,
            TestHelper.basicChannel!.id,
        )(store.dispatch, store.getState);

        const autocompleteRequest = store.getState().requests.users.autocompleteUsers;
        const {profiles, profilesNotInChannel, profilesInChannel} = store.getState().entities.users;

        if (autocompleteRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(autocompleteRequest.error));
        }

        const notInChannel = profilesNotInChannel[TestHelper.basicChannel!.id];
        const inChannel = profilesInChannel[TestHelper.basicChannel!.id];
        expect(notInChannel).toBe(undefined);
        expect(inChannel.has(user.id)).toBeTruthy();
        expect(profiles[user.id]).toBeTruthy();
    });

    it('updateMe', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const state = store.getState();
        const currentUser = state.entities.users.profiles[state.entities.users.currentUserId];
        const notifyProps = currentUser.notify_props;

        nock(Client4.getBaseRoute()).
            put('/users/me/patch').
            query(true).
            reply(200, {
                ...currentUser,
                notify_props: {
                    ...notifyProps,
                    comments: 'any',
                    email: 'false',
                    first_name: 'false',
                    mention_keys: '',
                    user_id: currentUser.id,
                },
            });

        await Actions.updateMe({
            notify_props: {
                ...notifyProps,
                comments: 'any',
                email: 'false',
                first_name: 'false',
                mention_keys: '',
                user_id: currentUser.id,
            },
        } as UserProfile)(store.dispatch, store.getState);

        const updateRequest = store.getState().requests.users.updateMe;
        const {currentUserId, profiles} = store.getState().entities.users;
        const updateNotifyProps = profiles[currentUserId].notify_props;

        if (updateRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(updateRequest.error));
        }

        expect(updateNotifyProps.comments).toBe('any');
        expect(updateNotifyProps.email).toBe('false');
        expect(updateNotifyProps.first_name).toBe('false');
        expect(updateNotifyProps.mention_keys).toBe('');
    });

    it('patchUser', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const state = store.getState();
        const currentUserId = state.entities.users.currentUserId;
        const currentUser = state.entities.users.profiles[currentUserId];
        const notifyProps = currentUser.notify_props;

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/patch`).
            query(true).
            reply(200, {
                ...currentUser,
                notify_props: {
                    ...notifyProps,
                    comments: 'any',
                    email: 'false',
                    first_name: 'false',
                    mention_keys: '',
                    user_id: currentUser.id,
                },
            });

        await Actions.patchUser({
            id: currentUserId,
            notify_props: {
                ...notifyProps,
                comments: 'any',
                email: 'false',
                first_name: 'false',
                mention_keys: '',
                user_id: currentUser.id,
            },
        } as UserProfile)(store.dispatch, store.getState);

        const {profiles} = store.getState().entities.users;
        const updateNotifyProps = profiles[currentUserId].notify_props;

        expect(updateNotifyProps.comments).toBe('any');
        expect(updateNotifyProps.email).toBe('false');
        expect(updateNotifyProps.first_name).toBe('false');
        expect(updateNotifyProps.mention_keys).toBe('');
    });

    it('updateUserRoles', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const currentUserId = store.getState().entities.users.currentUserId;

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/roles`).
            reply(200, OK_RESPONSE);

        await Actions.updateUserRoles(currentUserId, 'system_user system_admin')(store.dispatch, store.getState);

        const {profiles} = store.getState().entities.users;
        const currentUserRoles = profiles[currentUserId].roles;

        expect(currentUserRoles).toBe('system_user system_admin');
    });

    it('updateUserMfa', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const currentUserId = store.getState().entities.users.currentUserId;

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/mfa`).
            reply(200, OK_RESPONSE);

        await Actions.updateUserMfa(currentUserId, false, '')(store.dispatch, store.getState);

        const {profiles} = store.getState().entities.users;
        const currentUserMfa = profiles[currentUserId].mfa_active;

        expect(currentUserMfa).toBe(false);
    });

    it('updateUserPassword', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const beforeTime = new Date().getTime();
        const currentUserId = store.getState().entities.users.currentUserId;

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/password`).
            reply(200, OK_RESPONSE);

        await Actions.updateUserPassword(currentUserId, 'password1', 'password1')(store.dispatch, store.getState);

        const {profiles} = store.getState().entities.users;
        const currentUser = profiles[currentUserId];

        expect(currentUser).toBeTruthy();
        expect(currentUser.last_password_update_at > beforeTime).toBeTruthy();
    });

    it('generateMfaSecret', async () => {
        const response = {secret: 'somesecret', qr_code: 'someqrcode'};

        nock(Client4.getBaseRoute()).
            post('/users/me/mfa/generate').
            reply(200, response);

        const {data} = await Actions.generateMfaSecret('me')(store.dispatch, store.getState) as ActionResult;

        expect(data).toEqual(response);
    });

    it('updateUserActive', async () => {
        nock(Client4.getBaseRoute()).
            post('/users').
            reply(200, TestHelper.fakeUserWithId());

        const {data: user} = await Actions.createUser(TestHelper.fakeUser(), '', '', '')(store.dispatch, store.getState) as ActionResult;

        const beforeTime = new Date().getTime();

        nock(Client4.getBaseRoute()).
            put(`/users/${user.id}/active`).
            reply(200, OK_RESPONSE);
        await Actions.updateUserActive(user.id, false)(store.dispatch, store.getState);

        const {profiles} = store.getState().entities.users;

        expect(profiles[user.id]).toBeTruthy();
        expect(profiles[user.id].delete_at > beforeTime).toBeTruthy();
    });

    it('verifyUserEmail', async () => {
        nock(Client4.getBaseRoute()).
            post('/users/email/verify').
            reply(200, OK_RESPONSE);

        const {data} = await Actions.verifyUserEmail('sometoken')(store.dispatch, store.getState) as ActionResult;

        expect(data).toEqual(OK_RESPONSE);
    });

    it('sendVerificationEmail', async () => {
        nock(Client4.getBaseRoute()).
            post('/users/email/verify/send').
            reply(200, OK_RESPONSE);

        const {data} = await Actions.sendVerificationEmail(TestHelper.basicUser!.email)(store.dispatch, store.getState) as ActionResult;

        expect(data).toEqual(OK_RESPONSE);
    });

    it('resetUserPassword', async () => {
        nock(Client4.getBaseRoute()).
            post('/users/password/reset').
            reply(200, OK_RESPONSE);

        const {data} = await Actions.resetUserPassword('sometoken', 'newpassword')(store.dispatch, store.getState) as ActionResult;

        expect(data).toEqual(OK_RESPONSE);
    });

    it('sendPasswordResetEmail', async () => {
        nock(Client4.getBaseRoute()).
            post('/users/password/reset/send').
            reply(200, OK_RESPONSE);

        const {data} = await Actions.sendPasswordResetEmail(TestHelper.basicUser!.email)(store.dispatch, store.getState) as ActionResult;

        expect(data).toEqual(OK_RESPONSE);
    });

    it('uploadProfileImage', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const testImageData = fs.createReadStream('src/packages/mattermost-redux/test/assets/images/test.png');

        const beforeTime = new Date().getTime();
        const currentUserId = store.getState().entities.users.currentUserId;

        nock(Client4.getBaseRoute()).
            post(`/users/${TestHelper.basicUser!.id}/image`).
            reply(200, OK_RESPONSE);

        await Actions.uploadProfileImage(currentUserId, testImageData)(store.dispatch, store.getState);

        const {profiles} = store.getState().entities.users;
        const currentUser = profiles[currentUserId];

        expect(currentUser).toBeTruthy();
        expect(currentUser.last_picture_update > beforeTime).toBeTruthy();
    });

    it('setDefaultProfileImage', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const currentUserId = store.getState().entities.users.currentUserId;

        nock(Client4.getBaseRoute()).
            delete(`/users/${TestHelper.basicUser!.id}/image`).
            reply(200, OK_RESPONSE);

        await Actions.setDefaultProfileImage(currentUserId)(store.dispatch, store.getState);

        const {profiles} = store.getState().entities.users;
        const currentUser = profiles[currentUserId];

        expect(currentUser).toBeTruthy();
        expect(currentUser.last_picture_update).toBe(0);
    });

    it('switchEmailToOAuth', async () => {
        nock(Client4.getBaseRoute()).
            post('/users/login/switch').
            reply(200, {follow_link: '/login'});

        const {data} = await Actions.switchEmailToOAuth('gitlab', TestHelper.basicUser!.email, TestHelper.basicUser!.password)(store.dispatch, store.getState) as ActionResult;
        expect(data).toEqual({follow_link: '/login'});
    });

    it('switchOAuthToEmail', async () => {
        nock(Client4.getBaseRoute()).
            post('/users/login/switch').
            reply(200, {follow_link: '/login'});

        const {data} = await Actions.switchOAuthToEmail('gitlab', TestHelper.basicUser!.email, TestHelper.basicUser!.password)(store.dispatch, store.getState) as ActionResult;

        expect(data).toEqual({follow_link: '/login'});
    });

    it('switchEmailToLdap', async () => {
        nock(Client4.getBaseRoute()).
            post('/users/login/switch').
            reply(200, {follow_link: '/login'});

        const {data} = await Actions.switchEmailToLdap(TestHelper.basicUser!.email, TestHelper.basicUser!.password, 'someid', 'somepassword')(store.dispatch, store.getState) as ActionResult;

        expect(data).toEqual({follow_link: '/login'});
    });

    it('switchLdapToEmail', (done) => {
        async function test() {
            nock(Client4.getBaseRoute()).
                post('/users/login/switch').
                reply(200, {follow_link: '/login'});

            const {data} = await Actions.switchLdapToEmail('somepassword', TestHelper.basicUser!.email, TestHelper.basicUser!.password)(store.dispatch, store.getState) as ActionResult;
            expect(data).toEqual({follow_link: '/login'});

            done();
        }

        test();
    });

    it('createUserAccessToken', (done) => {
        async function test() {
            TestHelper.mockLogin();
            store.dispatch({
                type: UserTypes.LOGIN_SUCCESS,
            });
            await Actions.loadMeREST()(store.dispatch, store.getState);

            const currentUserId = store.getState().entities.users.currentUserId;

            nock(Client4.getBaseRoute()).
                post(`/users/${currentUserId}/tokens`).
                reply(201, {id: 'someid', token: 'sometoken', description: 'test token', user_id: currentUserId});

            const {data} = await Actions.createUserAccessToken(currentUserId, 'test token')(store.dispatch, store.getState) as ActionResult;

            const {myUserAccessTokens} = store.getState().entities.users;
            const {userAccessTokensByUser} = store.getState().entities.admin;

            expect(myUserAccessTokens).toBeTruthy();
            expect(myUserAccessTokens[data.id]).toBeTruthy();
            expect(!myUserAccessTokens[data.id].token).toBeTruthy();
            expect(userAccessTokensByUser).toBeTruthy();
            expect(userAccessTokensByUser[currentUserId]).toBeTruthy();
            expect(userAccessTokensByUser[currentUserId][data.id]).toBeTruthy();
            expect(!userAccessTokensByUser[currentUserId][data.id].token).toBeTruthy();
            done();
        }

        test();
    });

    it('getUserAccessToken', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const currentUserId = store.getState().entities.users.currentUserId;

        nock(Client4.getBaseRoute()).
            post(`/users/${currentUserId}/tokens`).
            reply(201, {id: 'someid', token: 'sometoken', description: 'test token', user_id: currentUserId});

        const {data} = await Actions.createUserAccessToken(currentUserId, 'test token')(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            get(`/users/tokens/${data.id}`).
            reply(200, {id: data.id, description: 'test token', user_id: currentUserId});

        await Actions.getUserAccessToken(data.id)(store.dispatch, store.getState);

        const {myUserAccessTokens} = store.getState().entities.users;
        const {userAccessTokensByUser, userAccessTokens} = store.getState().entities.admin;

        expect(myUserAccessTokens).toBeTruthy();
        expect(myUserAccessTokens[data.id]).toBeTruthy();
        expect(!myUserAccessTokens[data.id].token).toBeTruthy();
        expect(userAccessTokensByUser).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId]).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId][data.id]).toBeTruthy();
        expect(!userAccessTokensByUser[currentUserId][data.id].token).toBeTruthy();
        expect(userAccessTokens).toBeTruthy();
        expect(userAccessTokens[data.id]).toBeTruthy();
        expect(!userAccessTokens[data.id].token).toBeTruthy();
    });

    it('getUserAccessTokens', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const currentUserId = store.getState().entities.users.currentUserId;

        nock(Client4.getBaseRoute()).
            post(`/users/${currentUserId}/tokens`).
            reply(201, {id: 'someid', token: 'sometoken', description: 'test token', user_id: currentUserId});

        const {data} = await Actions.createUserAccessToken(currentUserId, 'test token')(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            get('/users/tokens').
            query(true).
            reply(200, [{id: data.id, description: 'test token', user_id: currentUserId}]);

        await Actions.getUserAccessTokens()(store.dispatch, store.getState);

        const {myUserAccessTokens} = store.getState().entities.users;
        const {userAccessTokensByUser, userAccessTokens} = store.getState().entities.admin;

        expect(myUserAccessTokens).toBeTruthy();
        expect(myUserAccessTokens[data.id]).toBeTruthy();
        expect(!myUserAccessTokens[data.id].token).toBeTruthy();
        expect(userAccessTokensByUser).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId]).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId][data.id]).toBeTruthy();
        expect(!userAccessTokensByUser[currentUserId][data.id].token).toBeTruthy();
        expect(userAccessTokens).toBeTruthy();
        expect(userAccessTokens[data.id]).toBeTruthy();
        expect(!userAccessTokens[data.id].token).toBeTruthy();
    });

    it('getUserAccessTokensForUser', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const currentUserId = store.getState().entities.users.currentUserId;

        nock(Client4.getBaseRoute()).
            post(`/users/${currentUserId}/tokens`).
            reply(201, {id: 'someid', token: 'sometoken', description: 'test token', user_id: currentUserId});

        const {data} = await Actions.createUserAccessToken(currentUserId, 'test token')(store.dispatch, store.getState) as ActionResult;

        nock(Client4.getBaseRoute()).
            get(`/users/${currentUserId}/tokens`).
            query(true).
            reply(200, [{id: data.id, description: 'test token', user_id: currentUserId}]);

        await Actions.getUserAccessTokensForUser(currentUserId)(store.dispatch, store.getState);

        const {myUserAccessTokens} = store.getState().entities.users;
        const {userAccessTokensByUser, userAccessTokens} = store.getState().entities.admin;

        expect(myUserAccessTokens).toBeTruthy();
        expect(myUserAccessTokens[data.id]).toBeTruthy();
        expect(!myUserAccessTokens[data.id].token).toBeTruthy();
        expect(userAccessTokensByUser).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId]).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId][data.id]).toBeTruthy();
        expect(!userAccessTokensByUser[currentUserId][data.id].token).toBeTruthy();
        expect(userAccessTokens).toBeTruthy();
        expect(userAccessTokens[data.id]).toBeTruthy();
        expect(!userAccessTokens[data.id].token).toBeTruthy();
    });

    it('revokeUserAccessToken', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const currentUserId = store.getState().entities.users.currentUserId;

        nock(Client4.getBaseRoute()).
            post(`/users/${currentUserId}/tokens`).
            reply(201, {id: 'someid', token: 'sometoken', description: 'test token', user_id: currentUserId});

        const {data} = await Actions.createUserAccessToken(currentUserId, 'test token')(store.dispatch, store.getState) as ActionResult;

        let {myUserAccessTokens} = store.getState().entities.users;
        let {userAccessTokensByUser, userAccessTokens} = store.getState().entities.admin;

        expect(myUserAccessTokens).toBeTruthy();
        expect(myUserAccessTokens[data.id]).toBeTruthy();
        expect(!myUserAccessTokens[data.id].token).toBeTruthy();
        expect(userAccessTokensByUser).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId]).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId][data.id]).toBeTruthy();
        expect(!userAccessTokensByUser[currentUserId][data.id].token).toBeTruthy();
        expect(userAccessTokens).toBeTruthy();
        expect(userAccessTokens[data.id]).toBeTruthy();
        expect(!userAccessTokens[data.id].token).toBeTruthy();

        nock(Client4.getBaseRoute()).
            post('/users/tokens/revoke').
            reply(200, OK_RESPONSE);

        await Actions.revokeUserAccessToken(data.id)(store.dispatch, store.getState);

        myUserAccessTokens = store.getState().entities.users.myUserAccessTokens;
        userAccessTokensByUser = store.getState().entities.admin.userAccessTokensByUser;
        userAccessTokens = store.getState().entities.admin.userAccessTokens;

        expect(myUserAccessTokens).toBeTruthy();
        expect(!myUserAccessTokens[data.id]).toBeTruthy();
        expect(userAccessTokensByUser).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId]).toBeTruthy();
        expect(!userAccessTokensByUser[currentUserId][data.id]).toBeTruthy();
        expect(userAccessTokens).toBeTruthy();
        expect(!userAccessTokens[data.id]).toBeTruthy();
    });

    it('disableUserAccessToken', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const currentUserId = store.getState().entities.users.currentUserId;

        nock(Client4.getBaseRoute()).
            post(`/users/${currentUserId}/tokens`).
            reply(201, {id: 'someid', token: 'sometoken', description: 'test token', user_id: currentUserId});

        const {data} = await Actions.createUserAccessToken(currentUserId, 'test token')(store.dispatch, store.getState) as ActionResult;
        const testId = data.id;

        let {myUserAccessTokens} = store.getState().entities.users;
        let {userAccessTokensByUser, userAccessTokens} = store.getState().entities.admin;

        expect(myUserAccessTokens).toBeTruthy();
        expect(myUserAccessTokens[testId]).toBeTruthy();
        expect(!myUserAccessTokens[testId].token).toBeTruthy();
        expect(userAccessTokensByUser).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId]).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId][testId]).toBeTruthy();
        expect(!userAccessTokensByUser[currentUserId][testId].token).toBeTruthy();
        expect(userAccessTokens).toBeTruthy();
        expect(userAccessTokens[data.id]).toBeTruthy();
        expect(!userAccessTokens[data.id].token).toBeTruthy();

        nock(Client4.getBaseRoute()).
            post('/users/tokens/disable').
            reply(200, OK_RESPONSE);

        await Actions.disableUserAccessToken(testId)(store.dispatch, store.getState);

        myUserAccessTokens = store.getState().entities.users.myUserAccessTokens;
        userAccessTokensByUser = store.getState().entities.admin.userAccessTokensByUser;
        userAccessTokens = store.getState().entities.admin.userAccessTokens;

        expect(myUserAccessTokens).toBeTruthy();
        expect(myUserAccessTokens[testId]).toBeTruthy();
        expect(!myUserAccessTokens[testId].is_active).toBeTruthy();
        expect(!myUserAccessTokens[testId].token).toBeTruthy();
        expect(userAccessTokensByUser).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId]).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId][testId]).toBeTruthy();
        expect(!userAccessTokensByUser[currentUserId][testId].is_active).toBeTruthy();
        expect(!userAccessTokensByUser[currentUserId][testId].token).toBeTruthy();
        expect(userAccessTokens).toBeTruthy();
        expect(userAccessTokens[testId]).toBeTruthy();
        expect(!userAccessTokens[testId].is_active).toBeTruthy();
        expect(!userAccessTokens[testId].token).toBeTruthy();
    });

    it('enableUserAccessToken', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const currentUserId = store.getState().entities.users.currentUserId;

        nock(Client4.getBaseRoute()).
            post(`/users/${currentUserId}/tokens`).
            reply(201, {id: 'someid', token: 'sometoken', description: 'test token', user_id: currentUserId});

        const {data} = await Actions.createUserAccessToken(currentUserId, 'test token')(store.dispatch, store.getState) as ActionResult;
        const testId = data.id;

        let {myUserAccessTokens} = store.getState().entities.users;
        let {userAccessTokensByUser, userAccessTokens} = store.getState().entities.admin;

        expect(myUserAccessTokens).toBeTruthy();
        expect(myUserAccessTokens[testId]).toBeTruthy();
        expect(!myUserAccessTokens[testId].token).toBeTruthy();
        expect(userAccessTokensByUser).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId]).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId][testId]).toBeTruthy();
        expect(!userAccessTokensByUser[currentUserId][testId].token).toBeTruthy();
        expect(userAccessTokens).toBeTruthy();
        expect(userAccessTokens[testId]).toBeTruthy();
        expect(!userAccessTokens[testId].token).toBeTruthy();

        nock(Client4.getBaseRoute()).
            post('/users/tokens/enable').
            reply(200, OK_RESPONSE);

        await Actions.enableUserAccessToken(testId)(store.dispatch, store.getState);

        myUserAccessTokens = store.getState().entities.users.myUserAccessTokens;
        userAccessTokensByUser = store.getState().entities.admin.userAccessTokensByUser;
        userAccessTokens = store.getState().entities.admin.userAccessTokens;

        expect(myUserAccessTokens).toBeTruthy();
        expect(myUserAccessTokens[testId]).toBeTruthy();
        expect(myUserAccessTokens[testId].is_active).toBeTruthy();
        expect(!myUserAccessTokens[testId].token).toBeTruthy();
        expect(userAccessTokensByUser).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId]).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId][testId]).toBeTruthy();
        expect(userAccessTokensByUser[currentUserId][testId].is_active).toBeTruthy();
        expect(!userAccessTokensByUser[currentUserId][testId].token).toBeTruthy();
        expect(userAccessTokens).toBeTruthy();
        expect(userAccessTokens[testId]).toBeTruthy();
        expect(userAccessTokens[testId].is_active).toBeTruthy();
        expect(!userAccessTokens[testId].token).toBeTruthy();
    });

    it('clearUserAccessTokens', async () => {
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await Actions.loadMeREST()(store.dispatch, store.getState);

        const currentUserId = store.getState().entities.users.currentUserId;

        nock(Client4.getBaseRoute()).
            post(`/users/${currentUserId}/tokens`).
            reply(201, {id: 'someid', token: 'sometoken', description: 'test token', user_id: currentUserId});

        await Actions.createUserAccessToken(currentUserId, 'test token')(store.dispatch, store.getState);

        await Actions.clearUserAccessTokens()(store.dispatch, store.getState);

        const {myUserAccessTokens} = store.getState().entities.users;

        expect(Object.values(myUserAccessTokens).length === 0).toBeTruthy();
    });

    describe('checkForModifiedUsers', () => {
        test('should request users by IDs that have changed since the last websocket disconnect', async () => {
            const lastDisconnectAt = 1500;

            const user1 = {id: 'user1', update_at: 1000};
            const user2 = {id: 'user2', update_at: 1000};

            nock(Client4.getBaseRoute()).
                post('/users/ids').
                query({since: lastDisconnectAt}).
                reply(200, [{...user2, update_at: 2000}]);

            store = configureStore({
                entities: {
                    general: {
                        serverVersion: '5.14.0',
                    },
                    users: {
                        profiles: {
                            user1,
                            user2,
                        },
                    },
                },
                websocket: {
                    lastDisconnectAt,
                },
            });

            await store.dispatch(Actions.checkForModifiedUsers());

            const profiles = store.getState().entities.users.profiles;
            expect(profiles.user1).toBe(user1);
            expect(profiles.user2).not.toBe(user2);
            expect(profiles.user2).toEqual({id: 'user2', update_at: 2000});
        });

        test('should do nothing on older servers', async () => {
            const lastDisconnectAt = 1500;
            const originalState = deepFreeze({
                entities: {
                    general: {
                        serverVersion: '5.13.0',
                    },
                    users: {
                        profiles: {},
                    },
                },
                websocket: {
                    lastDisconnectAt,
                },
            });

            store = configureStore(originalState);

            await store.dispatch(Actions.checkForModifiedUsers());

            const profiles = store.getState().entities.users.profiles;
            expect(profiles).toBe(originalState.entities.users.profiles);
        });
    });
});
