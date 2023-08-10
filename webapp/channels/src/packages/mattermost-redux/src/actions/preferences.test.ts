// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {UserTypes} from 'mattermost-redux/action_types';
import * as Actions from 'mattermost-redux/actions/preferences';
import {loadMeREST} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';
import {Preferences} from '../constants';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

const OK_RESPONSE = {status: 'OK'};

describe('Actions.Preferences', () => {
    let store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    beforeEach(() => {
        store = configureStore({
            entities: {
                users: {
                    currentUserId: TestHelper.basicUser!.id,
                },
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

    it('getMyPreferences', async () => {
        const user = TestHelper.basicUser!;
        const existingPreferences = [
            {
                user_id: user.id,
                category: 'test',
                name: 'test1',
                value: 'test',
            },
            {
                user_id: user.id,
                category: 'test',
                name: 'test2',
                value: 'test',
            },
        ];

        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        await Client4.savePreferences(user.id, existingPreferences);

        nock(Client4.getUsersRoute()).
            get('/me/preferences').
            reply(200, existingPreferences);
        await Actions.getMyPreferences()(store.dispatch, store.getState);

        const state = store.getState();
        const {myPreferences} = state.entities.preferences;

        // first preference doesn't exist
        expect(myPreferences['test--test1']).toBeTruthy();
        expect(existingPreferences[0]).toEqual(myPreferences['test--test1']);

        // second preference doesn't exist
        expect(myPreferences['test--test2']).toBeTruthy();
        expect(existingPreferences[1]).toEqual(myPreferences['test--test2']);
    });

    it('savePrefrences', async () => {
        const user = TestHelper.basicUser!;
        const existingPreferences = [
            {
                user_id: user.id,
                category: 'test',
                name: 'test1',
                value: 'test',
            },
        ];

        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        await Client4.savePreferences(user.id, existingPreferences);

        nock(Client4.getUsersRoute()).
            get('/me/preferences').
            reply(200, existingPreferences);
        await Actions.getMyPreferences()(store.dispatch, store.getState);

        const preferences = [
            {
                user_id: user.id,
                category: 'test',
                name: 'test2',
                value: 'test',
            },
            {
                user_id: user.id,
                category: 'test',
                name: 'test3',
                value: 'test',
            },
        ];

        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        await Actions.savePreferences(user.id, preferences)(store.dispatch);

        const state = store.getState();
        const {myPreferences} = state.entities.preferences;

        // first preference doesn't exist
        expect(myPreferences['test--test1']).toBeTruthy();
        expect(existingPreferences[0]).toEqual(myPreferences['test--test1']);

        // second preference doesn't exist
        expect(myPreferences['test--test2']).toBeTruthy();
        expect(preferences[0]).toEqual(myPreferences['test--test2']);

        // third preference doesn't exist
        expect(myPreferences['test--test3']).toBeTruthy();
        expect(preferences[1]).toEqual(myPreferences['test--test3']);
    });

    it('deletePreferences', async () => {
        const user = TestHelper.basicUser!;
        const existingPreferences = [
            {
                user_id: user.id,
                category: 'test',
                name: 'test1',
                value: 'test',
            },
            {
                user_id: user.id,
                category: 'test',
                name: 'test2',
                value: 'test',
            },
            {
                user_id: user.id,
                category: 'test',
                name: 'test3',
                value: 'test',
            },
        ];

        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        await Client4.savePreferences(user.id, existingPreferences);

        nock(Client4.getUsersRoute()).
            get('/me/preferences').
            reply(200, existingPreferences);
        await Actions.getMyPreferences()(store.dispatch, store.getState);

        nock(Client4.getUsersRoute()).
            post(`/${TestHelper.basicUser!.id}/preferences/delete`).
            reply(200, OK_RESPONSE);
        await Actions.deletePreferences(user.id, [
            existingPreferences[0],
            existingPreferences[2],
        ])(store.dispatch, store.getState);

        const state = store.getState();
        const {myPreferences} = state.entities.preferences;

        // deleted preference still exists
        expect(!myPreferences['test--test1']).toBeTruthy();

        // second preference doesn't exist
        expect(myPreferences['test--test2']).toBeTruthy();
        expect(existingPreferences[1]).toEqual(myPreferences['test--test2']);

        // third preference doesn't exist
        expect(!myPreferences['test--test3']).toBeTruthy();
    });

    it('makeDirectChannelVisibleIfNecessary', async () => {
        const user = TestHelper.basicUser!;

        nock(Client4.getBaseRoute()).
            post('/users').
            reply(201, TestHelper.fakeUserWithId());
        const user2 = await TestHelper.createClient4().createUser(TestHelper.fakeUser(), '', '');

        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await loadMeREST()(store.dispatch, store.getState);

        // Test that a new preference is created if none exists
        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        await Actions.makeDirectChannelVisibleIfNecessary(user2.id)(store.dispatch, store.getState);

        let state = store.getState();
        let myPreferences = state.entities.preferences.myPreferences;
        let preference = myPreferences[`${Preferences.CATEGORY_DIRECT_CHANNEL_SHOW}--${user2.id}`];

        // preference for showing direct channel doesn't exist
        expect(preference).toBeTruthy();

        // preference for showing direct channel is not true
        expect(preference.value).toBe('true');

        // Test that nothing changes if the preference already exists and is true
        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        await Actions.makeDirectChannelVisibleIfNecessary(user2.id)(store.dispatch, store.getState);

        const state2 = store.getState();

        // store should not change since direct channel is already visible
        expect(state).toEqual(state2);

        // Test that the preference is updated if it already exists and is false
        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        Actions.savePreferences(user.id, [{
            ...preference,
            value: 'false',
        }])(store.dispatch);

        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        await Actions.makeDirectChannelVisibleIfNecessary(user2.id)(store.dispatch, store.getState);

        state = store.getState();
        myPreferences = state.entities.preferences.myPreferences;
        preference = myPreferences[`${Preferences.CATEGORY_DIRECT_CHANNEL_SHOW}--${user2.id}`];

        // preference for showing direct channel doesn't exist
        expect(preference).toBeTruthy();

        // preference for showing direct channel is not true
        expect(preference.value).toEqual('true');
    });

    it('saveTheme', async () => {
        const user = TestHelper.basicUser!;
        const team = TestHelper.basicTeam!;
        const existingPreferences = [
            {
                user_id: user.id,
                category: 'theme',
                name: team.id,
                value: JSON.stringify({
                    type: 'Mattermost',
                }),
            },
        ];

        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        await Client4.savePreferences(user.id, existingPreferences);

        nock(Client4.getUsersRoute()).
            get('/me/preferences').
            reply(200, existingPreferences);
        await Actions.getMyPreferences()(store.dispatch, store.getState);

        const newTheme = {
            type: 'Mattermost Dark',
        } as unknown as Theme;
        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        await Actions.saveTheme(team.id, newTheme)(store.dispatch, store.getState);

        const state = store.getState();
        const {myPreferences} = state.entities.preferences;

        // theme preference doesn't exist
        expect(myPreferences[`theme--${team.id}`]).toBeTruthy();
        expect(myPreferences[`theme--${team.id}`].value).toEqual(JSON.stringify(newTheme));
    });

    it('deleteTeamSpecificThemes', async () => {
        const user = TestHelper.basicUser!;
        TestHelper.mockLogin();
        store.dispatch({
            type: UserTypes.LOGIN_SUCCESS,
        });
        await loadMeREST()(store.dispatch, store.getState);

        const theme = {
            type: 'Mattermost Dark',
        };
        const existingPreferences = [
            {
                user_id: user.id,
                category: 'theme',
                name: '',
                value: JSON.stringify(theme),
            },
            {
                user_id: user.id,
                category: 'theme',
                name: TestHelper.generateId(),
                value: JSON.stringify({
                    type: 'Mattermost',
                }),
            },
            {
                user_id: user.id,
                category: 'theme',
                name: TestHelper.generateId(),
                value: JSON.stringify({
                    type: 'Mattermost',
                }),
            },
        ];

        nock(Client4.getUsersRoute()).
            put(`/${user.id}/preferences`).
            reply(200, OK_RESPONSE);
        await Client4.savePreferences(user.id, existingPreferences);

        nock(Client4.getUsersRoute()).
            get('/me/preferences').
            reply(200, existingPreferences);
        await Actions.getMyPreferences()(store.dispatch, store.getState);

        nock(Client4.getUsersRoute()).
            post(`/${user.id}/preferences/delete`).
            reply(200, OK_RESPONSE);
        await Actions.deleteTeamSpecificThemes()(store.dispatch, store.getState);

        const state = store.getState();
        const {myPreferences} = state.entities.preferences;

        expect(Object.entries(myPreferences).length).toBe(1);

        // theme preference doesn't exist
        expect(myPreferences['theme--']).toBeTruthy();
    });
});
