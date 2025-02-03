// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {UserTypes} from 'mattermost-redux/action_types';
import * as Actions from 'mattermost-redux/actions/preferences';
import {loadMe} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

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
        await store.dispatch(Actions.getMyPreferences());

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
        await store.dispatch(Actions.getMyPreferences());

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
        await store.dispatch(Actions.savePreferences(user.id, preferences));

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
        await store.dispatch(Actions.getMyPreferences());

        nock(Client4.getUsersRoute()).
            post(`/${TestHelper.basicUser!.id}/preferences/delete`).
            reply(200, OK_RESPONSE);
        await store.dispatch(Actions.deletePreferences(user.id, [
            existingPreferences[0],
            existingPreferences[2],
        ]));

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
        await store.dispatch(Actions.getMyPreferences());

        const newTheme = {
            type: 'Mattermost Dark',
        } as unknown as Theme;
        nock(Client4.getUsersRoute()).
            put(`/${TestHelper.basicUser!.id}/preferences`).
            reply(200, OK_RESPONSE);
        await store.dispatch(Actions.saveTheme(team.id, newTheme));

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
        await store.dispatch(loadMe());

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
        await store.dispatch(Actions.getMyPreferences());

        nock(Client4.getUsersRoute()).
            post(`/${user.id}/preferences/delete`).
            reply(200, OK_RESPONSE);
        await store.dispatch(Actions.deleteTeamSpecificThemes());

        const state = store.getState();
        const {myPreferences} = state.entities.preferences;

        expect(Object.entries(myPreferences).length).toBe(1);

        // theme preference doesn't exist
        expect(myPreferences['theme--']).toBeTruthy();
    });
});
